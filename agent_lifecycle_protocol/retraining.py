"""Retraining events and identity continuity test (Section 5.5).

Records significant changes to an agent's model or behavioral profile.
Implements the Identity Continuity Test and retraining classification.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .schema import (
    COUNTERPARTY_ACTIONS,
    RETRAINING_CHANGE_TYPES,
    RETRAINING_CLASSES,
    Initiator,
    LifecycleEvent,
    _now_iso,
)
from .lifecycle import LifecycleError, LifecycleManager


@dataclass
class CapabilitySnapshot:
    """Before/after snapshot of agent capabilities."""
    model_version: str = ""
    capability_hash: str = ""
    behavioral_profile_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_version": self.model_version,
            "capability_hash": self.capability_hash,
            "behavioral_profile_hash": self.behavioral_profile_hash,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "CapabilitySnapshot":
        return cls(
            model_version=d.get("model_version", ""),
            capability_hash=d.get("capability_hash", ""),
            behavioral_profile_hash=d.get("behavioral_profile_hash", ""),
        )


@dataclass
class IdentityContinuity:
    """Identity continuity assertion (Section 5.5 test)."""
    same_identity_key: bool = True
    same_coc_chain: bool = True
    operator_assertion: bool = True
    rationale: str = ""

    @property
    def identity_preserved(self) -> bool:
        """Identity is preserved iff all three conditions hold."""
        return self.same_identity_key and self.same_coc_chain and self.operator_assertion

    def to_dict(self) -> Dict[str, Any]:
        return {
            "same_identity_key": self.same_identity_key,
            "same_coc_chain": self.same_coc_chain,
            "operator_assertion": self.operator_assertion,
            "identity_preserved": self.identity_preserved,
            "rationale": self.rationale,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "IdentityContinuity":
        return cls(
            same_identity_key=d.get("same_identity_key", True),
            same_coc_chain=d.get("same_coc_chain", True),
            operator_assertion=d.get("operator_assertion", True),
            rationale=d.get("rationale", ""),
        )


@dataclass
class RetrainingEvent:
    """A retraining event with impact assessment."""
    agent_id: str = ""
    change_type: str = "model_upgrade"
    before: CapabilitySnapshot = field(default_factory=CapabilitySnapshot)
    after: CapabilitySnapshot = field(default_factory=CapabilitySnapshot)
    retraining_class: str = "minor"
    identity_continuity: IdentityContinuity = field(
        default_factory=IdentityContinuity
    )
    counterparty_action_required: str = "none"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "change_type": self.change_type,
            "before": self.before.to_dict(),
            "after": self.after.to_dict(),
            "retraining_class": self.retraining_class,
            "identity_continuity": self.identity_continuity.to_dict(),
            "counterparty_action_required": self.counterparty_action_required,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "RetrainingEvent":
        return cls(
            agent_id=d.get("agent_id", ""),
            change_type=d.get("change_type", "model_upgrade"),
            before=CapabilitySnapshot.from_dict(d.get("before", {})),
            after=CapabilitySnapshot.from_dict(d.get("after", {})),
            retraining_class=d.get("retraining_class", "minor"),
            identity_continuity=IdentityContinuity.from_dict(
                d.get("identity_continuity", {})
            ),
            counterparty_action_required=d.get("counterparty_action_required", "none"),
        )


def classify_retraining(change_type: str) -> str:
    """Classify retraining by impact (Section 5.5 table).

    Returns the retraining class and required counterparty action.
    """
    minor_types = ("prompt_revision", "capability_addition", "capability_removal")
    moderate_types = ("model_upgrade", "fine_tuning")

    if change_type in minor_types:
        return "minor"
    elif change_type in moderate_types:
        return "moderate"
    return "major"


def counterparty_action_for_class(retraining_class: str) -> str:
    """Map retraining class to counterparty action (Section 5.5 table)."""
    mapping = {
        "minor": "none",
        "moderate": "acknowledge",
        "major": "consent",
    }
    return mapping.get(retraining_class, "consent")


def check_identity_continuity(
    continuity: IdentityContinuity,
) -> bool:
    """The Identity Continuity Test (Section 5.5).

    Identity is preserved iff:
    (a) same identity key, (b) same CoC chain, (c) operator asserts continuity.
    If any fails, this should be a Succession, not a Retraining.
    """
    return continuity.identity_preserved


def record_retraining(
    manager: LifecycleManager,
    retraining: RetrainingEvent,
    initiator: Optional[Initiator] = None,
) -> LifecycleEvent:
    """Record a retraining event (Section 5.5).

    Agent must be Active. Retraining is a self-transition (Active -> Active).
    If identity continuity test fails, raises LifecycleError (should use
    succession instead).
    """
    if retraining.change_type not in RETRAINING_CHANGE_TYPES:
        raise LifecycleError(
            f"Invalid change type: {retraining.change_type}"
        )

    agent = manager.store.get_agent(retraining.agent_id)
    if agent is None:
        raise LifecycleError(f"Agent not found: {retraining.agent_id}")
    if agent.state != "active":
        raise LifecycleError(
            f"Agent must be Active for retraining, currently: {agent.state}"
        )

    # Check identity continuity
    if not check_identity_continuity(retraining.identity_continuity):
        raise LifecycleError(
            "Identity continuity test failed. This change should be "
            "modeled as a Succession, not a Retraining. "
            f"Key: {retraining.identity_continuity.same_identity_key}, "
            f"Chain: {retraining.identity_continuity.same_coc_chain}, "
            f"Assertion: {retraining.identity_continuity.operator_assertion}"
        )

    # Classify based on change type
    retraining.retraining_class = classify_retraining(retraining.change_type)
    retraining.counterparty_action_required = counterparty_action_for_class(
        retraining.retraining_class
    )

    event = LifecycleEvent(
        event_type="retraining",
        agent_id=retraining.agent_id,
        agent_state_before="active",
        agent_state_after="active",
        initiator=initiator or Initiator(),
        details=retraining.to_dict(),
    )

    manager._run_pre_hooks(event, agent)

    agent.updated_at = _now_iso()
    agent.event_history.append(event.event_id)

    # Update genetic profile if model changed
    if retraining.after.model_version:
        agent.genetic_profile.model_version = retraining.after.model_version

    event.compute_hash()
    manager.store.append_event(event)
    manager.store.save_agent(agent)

    manager._run_post_hooks(event, agent)

    return event
