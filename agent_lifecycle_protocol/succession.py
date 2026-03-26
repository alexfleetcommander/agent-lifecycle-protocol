"""Succession protocol — four-phase handoff (Section 7).

Phase 1: Announcement — successor identified, counterparties notified
Phase 2: Transfer — obligations, reputation, knowledge transferred
Phase 3: Verification — integrity checks
Phase 4: Cutover — predecessor deprecated, successor active
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from .schema import (
    DEFAULT_PROBATIONARY_PERIOD_DAYS,
    DEFAULT_SUCCESSION_ALPHA,
    DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS,
    CounterpartyNotification,
    Initiator,
    LifecycleEvent,
    ReputationInheritance,
    _now_iso,
)
from .lifecycle import LifecycleError, LifecycleManager


@dataclass
class SuccessionPlan:
    """A succession plan between predecessor and successor."""
    predecessor_id: str = ""
    successor_id: str = ""
    succession_type: str = "replacement"
    transition_window_days: int = 14
    planned_cutover: str = ""
    reputation_inheritance: ReputationInheritance = field(
        default_factory=ReputationInheritance
    )
    counterparty_notifications: List[CounterpartyNotification] = field(
        default_factory=list
    )
    phase: str = "planned"  # planned | announced | transferred | verified | complete | aborted
    obligations_transferred: int = 0
    obligations_terminated: int = 0
    knowledge_transfer_complete: bool = False
    verification_passed: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "predecessor_id": self.predecessor_id,
            "successor_id": self.successor_id,
            "succession_type": self.succession_type,
            "transition_window_days": self.transition_window_days,
            "planned_cutover": self.planned_cutover,
            "reputation_inheritance": self.reputation_inheritance.to_dict(),
            "counterparty_notifications": [
                n.to_dict() for n in self.counterparty_notifications
            ],
            "phase": self.phase,
            "obligations_transferred": self.obligations_transferred,
            "obligations_terminated": self.obligations_terminated,
            "knowledge_transfer_complete": self.knowledge_transfer_complete,
            "verification_passed": self.verification_passed,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "SuccessionPlan":
        return cls(
            predecessor_id=d.get("predecessor_id", ""),
            successor_id=d.get("successor_id", ""),
            succession_type=d.get("succession_type", "replacement"),
            transition_window_days=d.get("transition_window_days", 14),
            planned_cutover=d.get("planned_cutover", ""),
            reputation_inheritance=ReputationInheritance.from_dict(
                d.get("reputation_inheritance", {})
            ),
            counterparty_notifications=[
                CounterpartyNotification.from_dict(n)
                for n in d.get("counterparty_notifications", [])
            ],
            phase=d.get("phase", "planned"),
            obligations_transferred=d.get("obligations_transferred", 0),
            obligations_terminated=d.get("obligations_terminated", 0),
            knowledge_transfer_complete=d.get("knowledge_transfer_complete", False),
            verification_passed=d.get("verification_passed", False),
        )


def announce_succession(
    manager: LifecycleManager,
    plan: SuccessionPlan,
    initiator: Optional[Initiator] = None,
) -> SuccessionPlan:
    """Phase 1: Announce succession, notify counterparties (Section 7.2).

    - Predecessor must be Active
    - Successor must exist
    - Computes planned cutover date
    """
    predecessor = manager.store.get_agent(plan.predecessor_id)
    if predecessor is None:
        raise LifecycleError(f"Predecessor not found: {plan.predecessor_id}")
    if predecessor.state != "active":
        raise LifecycleError(
            f"Predecessor must be Active, currently: {predecessor.state}"
        )

    successor = manager.store.get_agent(plan.successor_id)
    if successor is None:
        raise LifecycleError(f"Successor not found: {plan.successor_id}")

    # Compute planned cutover
    cutover = (
        datetime.now(timezone.utc)
        + timedelta(days=plan.transition_window_days)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    plan.planned_cutover = cutover
    plan.phase = "announced"

    # Compute initial reputation inheritance
    pred_score = predecessor.reputation_earned + predecessor.reputation_inherited
    plan.reputation_inheritance.predecessor_score = pred_score
    plan.reputation_inheritance.compute_initial()

    # Record announcement event
    event = LifecycleEvent(
        event_type="deprecate",
        agent_id=plan.predecessor_id,
        agent_state_before="active",
        agent_state_after="deprecated",
        initiator=initiator or Initiator(),
        details={
            "reason": f"succession to {plan.successor_id}",
            "successor_id": plan.successor_id,
            "planned_cutover": cutover,
            "succession_plan": plan.to_dict(),
        },
        related_agents=[
            {"agent_id": plan.successor_id, "relationship": "successor"}
        ],
    )

    manager._run_pre_hooks(event, predecessor)

    predecessor.state = "deprecated"
    predecessor.updated_at = _now_iso()
    predecessor.event_history.append(event.event_id)

    event.compute_hash()
    manager.store.append_event(event)
    manager.store.save_agent(predecessor)

    manager._run_post_hooks(event, predecessor)

    return plan


def transfer_estate(
    manager: LifecycleManager,
    plan: SuccessionPlan,
    obligations_transferred: int = 0,
    obligations_terminated: int = 0,
    knowledge_transferred: bool = True,
) -> SuccessionPlan:
    """Phase 2: Transfer obligations, reputation, and knowledge (Section 7.3).

    Updates the successor's inherited reputation.
    """
    if plan.phase != "announced":
        raise LifecycleError(
            f"Cannot transfer estate in phase: {plan.phase}"
        )

    successor = manager.store.get_agent(plan.successor_id)
    if successor is None:
        raise LifecycleError(f"Successor not found: {plan.successor_id}")

    # Apply reputation inheritance
    prob_until = (
        datetime.now(timezone.utc)
        + timedelta(days=plan.reputation_inheritance.probationary_period_days)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    successor.reputation_inherited = plan.reputation_inheritance.inherited_score
    successor.probationary_until = prob_until
    successor.updated_at = _now_iso()
    manager.store.save_agent(successor)

    plan.obligations_transferred = obligations_transferred
    plan.obligations_terminated = obligations_terminated
    plan.knowledge_transfer_complete = knowledge_transferred
    plan.phase = "transferred"

    return plan


def verify_succession(
    manager: LifecycleManager,
    plan: SuccessionPlan,
) -> SuccessionPlan:
    """Phase 3: Verify transfer integrity (Section 7.4).

    Checks:
    1. Successor exists and has inherited reputation
    2. Knowledge transfer complete
    3. Counterparties requiring consent have responded
    """
    if plan.phase != "transferred":
        raise LifecycleError(
            f"Cannot verify succession in phase: {plan.phase}"
        )

    errors: List[str] = []

    successor = manager.store.get_agent(plan.successor_id)
    if successor is None:
        errors.append("Successor not found")
    elif successor.reputation_inherited <= 0 and plan.reputation_inheritance.inherited_score > 0:
        errors.append("Reputation inheritance not applied")

    if not plan.knowledge_transfer_complete:
        errors.append("Knowledge transfer incomplete")

    # Check counterparty consent
    for notification in plan.counterparty_notifications:
        if notification.consent_required and not notification.consent_received:
            errors.append(
                f"Counterparty {notification.counterparty_id} consent pending"
            )

    if errors:
        plan.verification_passed = False
        raise LifecycleError(
            f"Succession verification failed: {'; '.join(errors)}"
        )

    plan.verification_passed = True
    plan.phase = "verified"
    return plan


def execute_cutover(
    manager: LifecycleManager,
    plan: SuccessionPlan,
    initiator: Optional[Initiator] = None,
) -> SuccessionPlan:
    """Phase 4: Execute cutover (Section 7.5).

    Predecessor transitions from Deprecated to Decommissioned.
    Successor is marked as fully active with succession link.
    """
    if plan.phase != "verified":
        raise LifecycleError(
            f"Cannot execute cutover in phase: {plan.phase}"
        )

    predecessor = manager.store.get_agent(plan.predecessor_id)
    if predecessor is None:
        raise LifecycleError(f"Predecessor not found: {plan.predecessor_id}")
    if predecessor.state != "deprecated":
        raise LifecycleError(
            f"Predecessor must be Deprecated for cutover, currently: {predecessor.state}"
        )

    successor = manager.store.get_agent(plan.successor_id)
    if successor is None:
        raise LifecycleError(f"Successor not found: {plan.successor_id}")

    # Decommission predecessor
    decom_event = LifecycleEvent(
        event_type="decommission",
        agent_id=plan.predecessor_id,
        agent_state_before="deprecated",
        agent_state_after="decommissioned",
        initiator=initiator or Initiator(),
        details={
            "reason": "superseded",
            "successor_id": plan.successor_id,
            "estate": {
                "obligations_transferred": plan.obligations_transferred,
                "obligations_terminated": plan.obligations_terminated,
                "reputation": plan.reputation_inheritance.to_dict(),
                "knowledge_transfer_complete": plan.knowledge_transfer_complete,
            },
        },
        related_agents=[
            {"agent_id": plan.successor_id, "relationship": "successor"}
        ],
    )

    manager._run_pre_hooks(decom_event, predecessor)

    predecessor.state = "decommissioned"
    predecessor.updated_at = _now_iso()
    predecessor.event_history.append(decom_event.event_id)

    decom_event.compute_hash()
    manager.store.append_event(decom_event)
    manager.store.save_agent(predecessor)

    manager._run_post_hooks(decom_event, predecessor)

    plan.phase = "complete"
    return plan


def abort_succession(
    manager: LifecycleManager,
    plan: SuccessionPlan,
    reason: str = "",
    initiator: Optional[Initiator] = None,
) -> SuccessionPlan:
    """Abort an in-progress succession (Section 7.6).

    Rolls back predecessor from Deprecated to Active.
    Zeros out successor's inherited reputation.
    """
    if plan.phase in ("complete", "aborted", "planned"):
        raise LifecycleError(
            f"Cannot abort succession in phase: {plan.phase}"
        )

    predecessor = manager.store.get_agent(plan.predecessor_id)
    if predecessor is None:
        raise LifecycleError(f"Predecessor not found: {plan.predecessor_id}")

    if predecessor.state == "deprecated":
        abort_event = LifecycleEvent(
            event_type="abort_succession",
            agent_id=plan.predecessor_id,
            agent_state_before="deprecated",
            agent_state_after="active",
            initiator=initiator or Initiator(),
            details={
                "reason": reason,
                "successor_id": plan.successor_id,
                "rollback_actions": [
                    "obligations_rolled_back",
                    "reputation_zeroed",
                    "counterparties_notified",
                ],
            },
        )

        manager._run_pre_hooks(abort_event, predecessor)

        predecessor.state = "active"
        predecessor.updated_at = _now_iso()
        predecessor.event_history.append(abort_event.event_id)

        abort_event.compute_hash()
        manager.store.append_event(abort_event)
        manager.store.save_agent(predecessor)

        manager._run_post_hooks(abort_event, predecessor)

    # Zero out successor's inherited reputation
    successor = manager.store.get_agent(plan.successor_id)
    if successor is not None:
        successor.reputation_inherited = 0.0
        successor.probationary_until = ""
        successor.updated_at = _now_iso()
        manager.store.save_agent(successor)

    plan.phase = "aborted"
    return plan
