"""Decommission protocol — apoptosis and necrosis (Section 9).

Implements graceful (apoptosis) and emergency (necrosis) decommission
with estate management, credential revocation tracking, and
counterparty notification.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .schema import (
    DECOMMISSION_REASONS,
    CounterpartyNotification,
    Initiator,
    LifecycleEvent,
    _now_iso,
)
from .lifecycle import LifecycleError, LifecycleManager


@dataclass
class CredentialRevocation:
    """Tracks credential revocation during decommission (Section 9.2)."""
    api_keys_revoked: bool = False
    oauth_tokens_invalidated: bool = False
    service_accounts_deleted: bool = False
    trust_relationships_terminated: bool = False
    certificates_revoked: bool = False
    identity_key_archived: bool = False

    @property
    def all_revoked(self) -> bool:
        return (
            self.api_keys_revoked
            and self.oauth_tokens_invalidated
            and self.service_accounts_deleted
            and self.trust_relationships_terminated
            and self.certificates_revoked
            and self.identity_key_archived
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "all_api_keys_revoked": self.api_keys_revoked,
            "all_oauth_tokens_invalidated": self.oauth_tokens_invalidated,
            "all_service_accounts_deleted": self.service_accounts_deleted,
            "all_trust_relationships_terminated": self.trust_relationships_terminated,
            "all_certificates_revoked": self.certificates_revoked,
            "identity_key_archived": self.identity_key_archived,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "CredentialRevocation":
        return cls(
            api_keys_revoked=d.get("all_api_keys_revoked", False),
            oauth_tokens_invalidated=d.get("all_oauth_tokens_invalidated", False),
            service_accounts_deleted=d.get("all_service_accounts_deleted", False),
            trust_relationships_terminated=d.get("all_trust_relationships_terminated", False),
            certificates_revoked=d.get("all_certificates_revoked", False),
            identity_key_archived=d.get("identity_key_archived", False),
        )


@dataclass
class DataDisposition:
    """How agent data is handled at decommission (Section 9.2)."""
    operational_logs: str = "archived_90_days"
    memory_state: str = "purged"
    coc_chain: str = "sealed_permanent"
    knowledge_artifacts: str = "transferred_to_fleet"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operational_logs": self.operational_logs,
            "memory_state": self.memory_state,
            "coc_chain": self.coc_chain,
            "knowledge_artifacts": self.knowledge_artifacts,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "DataDisposition":
        return cls(
            operational_logs=d.get("operational_logs", "archived_90_days"),
            memory_state=d.get("memory_state", "purged"),
            coc_chain=d.get("coc_chain", "sealed_permanent"),
            knowledge_artifacts=d.get("knowledge_artifacts", "transferred_to_fleet"),
        )


@dataclass
class EstateDisposition:
    """Full estate disposition for decommission (Section 5.7)."""
    obligations_transferred: int = 0
    obligations_terminated: int = 0
    credentials: CredentialRevocation = field(
        default_factory=CredentialRevocation
    )
    data: DataDisposition = field(default_factory=DataDisposition)
    counterparties_notified: bool = False
    fleet_coordinator_notified: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "obligations": {
                "transferred": self.obligations_transferred,
                "terminated": self.obligations_terminated,
            },
            "credentials": self.credentials.to_dict(),
            "data": self.data.to_dict(),
            "notifications": {
                "counterparties_notified": self.counterparties_notified,
                "fleet_coordinator_notified": self.fleet_coordinator_notified,
            },
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "EstateDisposition":
        obligations = d.get("obligations", {})
        notif = d.get("notifications", {})
        return cls(
            obligations_transferred=obligations.get("transferred", 0),
            obligations_terminated=obligations.get("terminated", 0),
            credentials=CredentialRevocation.from_dict(d.get("credentials", {})),
            data=DataDisposition.from_dict(d.get("data", {})),
            counterparties_notified=notif.get("counterparties_notified", False),
            fleet_coordinator_notified=notif.get("fleet_coordinator_notified", False),
        )


@dataclass
class DecommissionPlan:
    """A decommission plan (Section 9.2)."""
    agent_id: str = ""
    reason: str = "end_of_life"
    successor_id: Optional[str] = None
    estate: EstateDisposition = field(default_factory=EstateDisposition)
    emergency: bool = False
    phase: str = "planned"  # planned | in_progress | complete

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "reason": self.reason,
            "successor_id": self.successor_id,
            "estate": self.estate.to_dict(),
            "emergency": self.emergency,
            "phase": self.phase,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "DecommissionPlan":
        return cls(
            agent_id=d.get("agent_id", ""),
            reason=d.get("reason", "end_of_life"),
            successor_id=d.get("successor_id"),
            estate=EstateDisposition.from_dict(d.get("estate", {})),
            emergency=d.get("emergency", False),
            phase=d.get("phase", "planned"),
        )


def graceful_decommission(
    manager: LifecycleManager,
    plan: DecommissionPlan,
    initiator: Optional[Initiator] = None,
) -> DecommissionPlan:
    """Execute graceful (apoptotic) decommission (Section 9.1-9.2).

    Agent must be in Deprecated state. Follows full checklist:
    1. Verify obligations resolved
    2. Revoke credentials
    3. Dispose data
    4. Update registry and notifications
    """
    agent = manager.store.get_agent(plan.agent_id)
    if agent is None:
        raise LifecycleError(f"Agent not found: {plan.agent_id}")
    if agent.state != "deprecated":
        raise LifecycleError(
            f"Graceful decommission requires Deprecated state, "
            f"currently: {agent.state}. Deprecate the agent first."
        )

    plan.phase = "in_progress"

    event = LifecycleEvent(
        event_type="decommission",
        agent_id=plan.agent_id,
        agent_state_before="deprecated",
        agent_state_after="decommissioned",
        initiator=initiator or Initiator(),
        details={
            "reason": plan.reason,
            "successor_id": plan.successor_id,
            "estate_disposition": plan.estate.to_dict(),
            "decommission_type": "graceful_apoptosis",
        },
    )

    manager._run_pre_hooks(event, agent)

    agent.state = "decommissioned"
    agent.updated_at = _now_iso()
    agent.event_history.append(event.event_id)

    event.compute_hash()
    manager.store.append_event(event)
    manager.store.save_agent(agent)

    manager._run_post_hooks(event, agent)

    plan.phase = "complete"
    return plan


def emergency_decommission(
    manager: LifecycleManager,
    plan: DecommissionPlan,
    initiator: Optional[Initiator] = None,
) -> DecommissionPlan:
    """Execute emergency (necrotic) decommission (Section 9.4).

    Can be called from any non-terminal state. Credential revocation
    is immediate. Knowledge export may be skipped.
    """
    plan.emergency = True
    plan.phase = "in_progress"

    agent = manager.emergency_decommission(
        agent_id=plan.agent_id,
        reason=plan.reason,
        initiator=initiator,
    )

    plan.phase = "complete"
    return plan


def validate_decommission_checklist(
    plan: DecommissionPlan,
) -> List[str]:
    """Validate the decommission checklist (Section 9.2).

    Returns a list of items that are NOT yet completed.
    """
    issues: List[str] = []

    # Phase 1: Preparation
    if not plan.estate.counterparties_notified:
        issues.append("Counterparties not yet notified")

    # Phase 2: Credential Revocation
    cred = plan.estate.credentials
    if not cred.api_keys_revoked:
        issues.append("API keys not revoked")
    if not cred.oauth_tokens_invalidated:
        issues.append("OAuth tokens not invalidated")
    if not cred.service_accounts_deleted:
        issues.append("Service accounts not deleted")
    if not cred.trust_relationships_terminated:
        issues.append("Trust relationships not terminated")
    if not cred.certificates_revoked:
        issues.append("Certificates not revoked")
    if not cred.identity_key_archived:
        issues.append("Identity key not archived")

    # Phase 4: Registry and notification
    if not plan.estate.fleet_coordinator_notified:
        issues.append("Fleet coordinator not notified")

    return issues
