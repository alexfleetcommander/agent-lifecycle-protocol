"""Lifecycle state machine and transition logic (Section 4).

Manages agent state transitions with precondition checks and hook points.
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from .schema import (
    AGENT_STATES,
    TERMINAL_STATES,
    AgentRecord,
    EpigeneticProfile,
    GeneticProfile,
    Initiator,
    LifecycleEvent,
    _now_iso,
    _uuid,
)
from .store import LifecycleStore


class LifecycleError(Exception):
    """Raised for invalid lifecycle transitions."""


# Valid transitions: from_state -> {to_state: [allowed_event_types]}
_TRANSITIONS: Dict[Optional[str], Dict[str, List[str]]] = {
    None: {
        "provisioning": ["genesis"],
    },
    "provisioning": {
        "active": ["activate"],
        "failed": ["fail"],
    },
    "active": {
        "suspended": ["suspend"],
        "migrating": ["begin_migration"],
        "deprecated": ["deprecate"],
        "active": ["retraining", "fork"],  # self-transitions
        "decommissioned": ["emergency_decommission"],
    },
    "suspended": {
        "active": ["resume"],
        "decommissioned": ["emergency_decommission"],
    },
    "migrating": {
        "active": ["complete_migration", "abort_migration"],
        "decommissioned": ["emergency_decommission"],
    },
    "deprecated": {
        "decommissioned": ["decommission"],
        "active": ["abort_succession"],
    },
}


@dataclass
class HookResult:
    """Result from a lifecycle hook execution."""
    success: bool = True
    error: str = ""
    data: Dict[str, Any] = field(default_factory=dict)


# Type for hook callbacks: (event, agent_record) -> HookResult
HookCallback = Callable[[LifecycleEvent, AgentRecord], HookResult]


class LifecycleManager:
    """Manages agent lifecycle state machine transitions.

    Provides genesis, activate, suspend, resume, deprecate, decommission,
    and emergency_decommission operations. Fork, migration, succession,
    and retraining are in their own modules but integrate through this
    state machine.
    """

    def __init__(
        self,
        store: Optional[LifecycleStore] = None,
        store_dir: str = ".alp",
    ) -> None:
        self.store = store or LifecycleStore(store_dir)
        self._pre_hooks: Dict[str, List[HookCallback]] = {}
        self._post_hooks: Dict[str, List[HookCallback]] = {}

    # -- Hook registration --

    def register_pre_hook(self, event_type: str, hook: HookCallback) -> None:
        self._pre_hooks.setdefault(event_type, []).append(hook)

    def register_post_hook(self, event_type: str, hook: HookCallback) -> None:
        self._post_hooks.setdefault(event_type, []).append(hook)

    def _run_pre_hooks(self, event: LifecycleEvent, agent: AgentRecord) -> None:
        for hook in self._pre_hooks.get(event.event_type, []):
            result = hook(event, agent)
            if not result.success:
                raise LifecycleError(
                    f"PreTransition hook failed for {event.event_type}: {result.error}"
                )

    def _run_post_hooks(self, event: LifecycleEvent, agent: AgentRecord) -> None:
        for hook in self._post_hooks.get(event.event_type, []):
            hook(event, agent)  # post-hooks cannot abort

    # -- Transition validation --

    def validate_transition(
        self, from_state: Optional[str], to_state: str, event_type: str
    ) -> None:
        allowed = _TRANSITIONS.get(from_state, {})
        if to_state not in allowed:
            raise LifecycleError(
                f"Invalid transition: {from_state} -> {to_state}"
            )
        if event_type not in allowed[to_state]:
            raise LifecycleError(
                f"Event type '{event_type}' not allowed for "
                f"{from_state} -> {to_state}"
            )

    def _apply_transition(
        self,
        agent: AgentRecord,
        event_type: str,
        to_state: str,
        initiator: Optional[Initiator] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> LifecycleEvent:
        from_state = agent.state
        self.validate_transition(from_state, to_state, event_type)

        event = LifecycleEvent(
            event_type=event_type,
            agent_id=agent.agent_id,
            agent_state_before=from_state,
            agent_state_after=to_state,
            initiator=initiator or Initiator(),
            details=details or {},
        )

        self._run_pre_hooks(event, agent)

        agent.state = to_state
        agent.updated_at = _now_iso()
        agent.event_history.append(event.event_id)

        event.compute_hash()
        self.store.append_event(event)
        self.store.save_agent(agent)

        self._run_post_hooks(event, agent)

        return event

    # -- Lifecycle operations --

    def genesis(
        self,
        agent_id: str,
        genetic_profile: Optional[GeneticProfile] = None,
        epigenetic_profile: Optional[EpigeneticProfile] = None,
        creator_id: str = "",
        creation_method: str = "manual",
        coc_chain_id: str = "",
    ) -> AgentRecord:
        """Create a new agent (Section 5.2). Returns agent in Provisioning."""
        existing = self.store.get_agent(agent_id)
        if existing is not None:
            raise LifecycleError(f"Agent already exists: {agent_id}")

        agent = AgentRecord(
            agent_id=agent_id,
            state="provisioning",
            genetic_profile=genetic_profile or GeneticProfile(),
            epigenetic_profile=epigenetic_profile or EpigeneticProfile(),
            coc_chain_id=coc_chain_id or f"coc-{agent_id}",
        )

        details = {
            "creation_method": creation_method,
            "genetic_profile": agent.genetic_profile.to_dict(),
            "epigenetic_profile": agent.epigenetic_profile.to_dict(),
            "identity": {
                "agent_id": agent_id,
                "coc_chain_id": agent.coc_chain_id,
            },
            "authorization": {
                "creator_id": creator_id,
            },
        }

        event = LifecycleEvent(
            event_type="genesis",
            agent_id=agent_id,
            agent_state_before=None,
            agent_state_after="provisioning",
            initiator=Initiator(type="human", id=creator_id),
            details=details,
        )

        self._run_pre_hooks(event, agent)

        agent.event_history.append(event.event_id)
        event.compute_hash()
        self.store.append_event(event)
        self.store.save_agent(agent)

        self._run_post_hooks(event, agent)

        return agent

    def activate(
        self,
        agent_id: str,
        initiator: Optional[Initiator] = None,
    ) -> AgentRecord:
        """Transition agent from Provisioning to Active (Section 4.2)."""
        agent = self._get_agent_or_raise(agent_id)
        self._apply_transition(agent, "activate", "active", initiator)
        return agent

    def suspend(
        self,
        agent_id: str,
        reason: str = "",
        initiator: Optional[Initiator] = None,
    ) -> AgentRecord:
        """Transition agent from Active to Suspended."""
        agent = self._get_agent_or_raise(agent_id)
        self._apply_transition(
            agent, "suspend", "suspended", initiator,
            details={"reason": reason},
        )
        return agent

    def resume(
        self,
        agent_id: str,
        initiator: Optional[Initiator] = None,
    ) -> AgentRecord:
        """Transition agent from Suspended to Active."""
        agent = self._get_agent_or_raise(agent_id)
        self._apply_transition(agent, "resume", "active", initiator)
        return agent

    def deprecate(
        self,
        agent_id: str,
        reason: str = "",
        successor_id: str = "",
        initiator: Optional[Initiator] = None,
    ) -> AgentRecord:
        """Transition agent from Active to Deprecated (Section 4.2)."""
        agent = self._get_agent_or_raise(agent_id)
        self._apply_transition(
            agent, "deprecate", "deprecated", initiator,
            details={"reason": reason, "successor_id": successor_id},
        )
        return agent

    def decommission(
        self,
        agent_id: str,
        reason: str = "end_of_life",
        estate_disposition: Optional[Dict[str, Any]] = None,
        initiator: Optional[Initiator] = None,
    ) -> AgentRecord:
        """Transition agent from Deprecated to Decommissioned (Section 5.7)."""
        agent = self._get_agent_or_raise(agent_id)
        self._apply_transition(
            agent, "decommission", "decommissioned", initiator,
            details={
                "reason": reason,
                "estate_disposition": estate_disposition or {},
            },
        )
        return agent

    def emergency_decommission(
        self,
        agent_id: str,
        reason: str = "compromised",
        initiator: Optional[Initiator] = None,
    ) -> AgentRecord:
        """Emergency decommission from any non-terminal state (Section 9.4)."""
        agent = self._get_agent_or_raise(agent_id)
        if agent.state in TERMINAL_STATES:
            raise LifecycleError(
                f"Cannot emergency-decommission agent in terminal state: {agent.state}"
            )

        event = LifecycleEvent(
            event_type="emergency_decommission",
            agent_id=agent_id,
            agent_state_before=agent.state,
            agent_state_after="decommissioned",
            initiator=initiator or Initiator(),
            details={"reason": reason, "emergency": True},
        )

        self._run_pre_hooks(event, agent)

        agent.state = "decommissioned"
        agent.updated_at = _now_iso()
        agent.event_history.append(event.event_id)

        event.compute_hash()
        self.store.append_event(event)
        self.store.save_agent(agent)

        self._run_post_hooks(event, agent)

        return agent

    def fail(
        self,
        agent_id: str,
        error: str = "",
        initiator: Optional[Initiator] = None,
    ) -> AgentRecord:
        """Transition agent from Provisioning to Failed."""
        agent = self._get_agent_or_raise(agent_id)
        self._apply_transition(
            agent, "fail", "failed", initiator,
            details={"error": error},
        )
        return agent

    def get_agent(self, agent_id: str) -> Optional[AgentRecord]:
        return self.store.get_agent(agent_id)

    def _get_agent_or_raise(self, agent_id: str) -> AgentRecord:
        agent = self.store.get_agent(agent_id)
        if agent is None:
            raise LifecycleError(f"Agent not found: {agent_id}")
        return agent
