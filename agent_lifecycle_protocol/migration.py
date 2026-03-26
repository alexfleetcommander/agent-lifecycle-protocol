"""Migration operations (Section 8).

Transfers an agent from one platform to another while preserving identity.
Supports cold, warm, and live migration types.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .schema import (
    MIGRATION_TYPES,
    Initiator,
    LifecycleEvent,
    _hash_dict,
    _now_iso,
)
from .lifecycle import LifecycleError, LifecycleManager


@dataclass
class PlatformInfo:
    """Source or destination platform."""
    provider: str = ""
    runtime: str = ""
    region: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "runtime": self.runtime,
            "region": self.region,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "PlatformInfo":
        return cls(
            provider=d.get("provider", ""),
            runtime=d.get("runtime", ""),
            region=d.get("region", ""),
        )


@dataclass
class MigrationPlan:
    """Plan for migrating an agent between platforms."""
    agent_id: str = ""
    source: PlatformInfo = field(default_factory=PlatformInfo)
    destination: PlatformInfo = field(default_factory=PlatformInfo)
    migration_type: str = "cold"
    state_hash_before: str = ""
    state_hash_after: str = ""
    phase: str = "planned"  # planned | migrating | complete | aborted

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "source": self.source.to_dict(),
            "destination": self.destination.to_dict(),
            "migration_type": self.migration_type,
            "state_hash_before": self.state_hash_before,
            "state_hash_after": self.state_hash_after,
            "phase": self.phase,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MigrationPlan":
        return cls(
            agent_id=d.get("agent_id", ""),
            source=PlatformInfo.from_dict(d.get("source", {})),
            destination=PlatformInfo.from_dict(d.get("destination", {})),
            migration_type=d.get("migration_type", "cold"),
            state_hash_before=d.get("state_hash_before", ""),
            state_hash_after=d.get("state_hash_after", ""),
            phase=d.get("phase", "planned"),
        )


def begin_migration(
    manager: LifecycleManager,
    plan: MigrationPlan,
    initiator: Optional[Initiator] = None,
) -> MigrationPlan:
    """Begin migration: Active -> Migrating (Section 8.2 step 1-2).

    Checkpoints agent state and transitions to Migrating.
    """
    if plan.migration_type not in MIGRATION_TYPES:
        raise LifecycleError(f"Invalid migration type: {plan.migration_type}")

    agent = manager.store.get_agent(plan.agent_id)
    if agent is None:
        raise LifecycleError(f"Agent not found: {plan.agent_id}")
    if agent.state != "active":
        raise LifecycleError(
            f"Agent must be Active to migrate, currently: {agent.state}"
        )

    # Compute state hash for pre-migration checkpoint
    plan.state_hash_before = _hash_dict(agent.to_dict())

    event = LifecycleEvent(
        event_type="begin_migration",
        agent_id=plan.agent_id,
        agent_state_before="active",
        agent_state_after="migrating",
        initiator=initiator or Initiator(),
        details={
            "source_platform": plan.source.to_dict(),
            "destination_platform": plan.destination.to_dict(),
            "migration_type": plan.migration_type,
            "state_hash_before": plan.state_hash_before,
        },
    )

    manager._run_pre_hooks(event, agent)

    agent.state = "migrating"
    agent.updated_at = _now_iso()
    agent.event_history.append(event.event_id)

    event.compute_hash()
    manager.store.append_event(event)
    manager.store.save_agent(agent)

    manager._run_post_hooks(event, agent)

    plan.phase = "migrating"
    return plan


def complete_migration(
    manager: LifecycleManager,
    plan: MigrationPlan,
    state_hash_after: str = "",
    initiator: Optional[Initiator] = None,
) -> MigrationPlan:
    """Complete migration: Migrating -> Active (Section 8.2 step 3-5).

    Verifies state integrity and transitions back to Active.
    """
    if plan.phase != "migrating":
        raise LifecycleError(
            f"Cannot complete migration in phase: {plan.phase}"
        )

    agent = manager.store.get_agent(plan.agent_id)
    if agent is None:
        raise LifecycleError(f"Agent not found: {plan.agent_id}")
    if agent.state != "migrating":
        raise LifecycleError(
            f"Agent must be Migrating to complete, currently: {agent.state}"
        )

    plan.state_hash_after = state_hash_after

    # Verify integrity if both hashes provided
    integrity_verified = True
    if plan.state_hash_before and plan.state_hash_after:
        # For cold/warm, hashes should match (state preserved exactly)
        # For live, hashes may differ (state evolved during migration)
        if plan.migration_type in ("cold", "warm"):
            integrity_verified = plan.state_hash_before == plan.state_hash_after

    event = LifecycleEvent(
        event_type="complete_migration",
        agent_id=plan.agent_id,
        agent_state_before="migrating",
        agent_state_after="active",
        initiator=initiator or Initiator(),
        details={
            "source_platform": plan.source.to_dict(),
            "destination_platform": plan.destination.to_dict(),
            "migration_type": plan.migration_type,
            "verification": {
                "state_hash_before": plan.state_hash_before,
                "state_hash_after": plan.state_hash_after,
                "integrity_verified": integrity_verified,
            },
        },
    )

    manager._run_pre_hooks(event, agent)

    agent.state = "active"
    agent.updated_at = _now_iso()
    agent.event_history.append(event.event_id)

    event.compute_hash()
    manager.store.append_event(event)
    manager.store.save_agent(agent)

    manager._run_post_hooks(event, agent)

    plan.phase = "complete"
    return plan


def abort_migration(
    manager: LifecycleManager,
    plan: MigrationPlan,
    reason: str = "",
    initiator: Optional[Initiator] = None,
) -> MigrationPlan:
    """Abort migration: Migrating -> Active (Section 4.2).

    Rolls back to source, source state must be intact.
    """
    if plan.phase != "migrating":
        raise LifecycleError(
            f"Cannot abort migration in phase: {plan.phase}"
        )

    agent = manager.store.get_agent(plan.agent_id)
    if agent is None:
        raise LifecycleError(f"Agent not found: {plan.agent_id}")
    if agent.state != "migrating":
        raise LifecycleError(
            f"Agent must be Migrating to abort, currently: {agent.state}"
        )

    event = LifecycleEvent(
        event_type="abort_migration",
        agent_id=plan.agent_id,
        agent_state_before="migrating",
        agent_state_after="active",
        initiator=initiator or Initiator(),
        details={
            "abort_reason": reason,
            "rollback_to_source": plan.source.to_dict(),
        },
    )

    manager._run_pre_hooks(event, agent)

    agent.state = "active"
    agent.updated_at = _now_iso()
    agent.event_history.append(event.event_id)

    event.compute_hash()
    manager.store.append_event(event)
    manager.store.save_agent(agent)

    manager._run_post_hooks(event, agent)

    plan.phase = "aborted"
    return plan
