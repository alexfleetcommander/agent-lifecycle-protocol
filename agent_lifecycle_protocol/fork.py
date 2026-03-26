"""Fork operations (Section 5.3, 6, 10.4).

Creates new agents derived from existing parents with configurable
genetic and epigenetic inheritance.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from .schema import (
    DEFAULT_FORK_ALPHA,
    DEFAULT_FORK_DECAY_HALF_LIFE_DAYS,
    DEFAULT_PROBATIONARY_PERIOD_DAYS,
    FORK_TYPES,
    MEMORY_SCOPES,
    AgentRecord,
    EpigeneticProfile,
    GeneticProfile,
    Initiator,
    LifecycleEvent,
    ReputationInheritance,
    _now_iso,
)
from .lifecycle import LifecycleError, LifecycleManager


@dataclass
class InheritanceConfig:
    """Configuration for what a fork inherits from its parent."""
    genetic_inherited: bool = True
    genetic_modified: bool = False
    memory_inherited: bool = True
    memory_scope: str = "filtered"
    configuration_inherited: bool = True
    configuration_modifications: List[str] = field(default_factory=list)
    reputation_factor: float = DEFAULT_FORK_ALPHA
    decay_half_life_days: float = DEFAULT_FORK_DECAY_HALF_LIFE_DAYS
    probationary_period_days: float = DEFAULT_PROBATIONARY_PERIOD_DAYS

    def to_dict(self) -> Dict[str, Any]:
        return {
            "genetic": {
                "model_inherited": self.genetic_inherited,
                "model_modified": self.genetic_modified,
            },
            "epigenetic": {
                "memory_inherited": self.memory_inherited,
                "memory_scope": self.memory_scope,
                "configuration_inherited": self.configuration_inherited,
                "configuration_modifications": list(self.configuration_modifications),
                "reputation_inheritance_factor": self.reputation_factor,
            },
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "InheritanceConfig":
        gen = d.get("genetic", {})
        epi = d.get("epigenetic", {})
        return cls(
            genetic_inherited=gen.get("model_inherited", True),
            genetic_modified=gen.get("model_modified", False),
            memory_inherited=epi.get("memory_inherited", True),
            memory_scope=epi.get("memory_scope", "filtered"),
            configuration_inherited=epi.get("configuration_inherited", True),
            configuration_modifications=epi.get("configuration_modifications", []),
            reputation_factor=epi.get("reputation_inheritance_factor", DEFAULT_FORK_ALPHA),
        )


@dataclass
class ForkRecord:
    """Record of a fork event with parent-child relationship."""
    parent_id: str = ""
    child_id: str = ""
    fork_type: str = "specialization"
    fork_timestamp: str = field(default_factory=_now_iso)
    inheritance: InheritanceConfig = field(default_factory=InheritanceConfig)
    divergence_declaration: Dict[str, Any] = field(default_factory=dict)
    reputation_inheritance: Optional[ReputationInheritance] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "parent_id": self.parent_id,
            "child_id": self.child_id,
            "fork_type": self.fork_type,
            "fork_timestamp": self.fork_timestamp,
            "inheritance": self.inheritance.to_dict(),
            "divergence_declaration": self.divergence_declaration,
        }
        if self.reputation_inheritance:
            d["reputation_inheritance"] = self.reputation_inheritance.to_dict()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ForkRecord":
        rep = None
        if "reputation_inheritance" in d and d["reputation_inheritance"]:
            rep = ReputationInheritance.from_dict(d["reputation_inheritance"])
        return cls(
            parent_id=d.get("parent_id", ""),
            child_id=d.get("child_id", ""),
            fork_type=d.get("fork_type", "specialization"),
            fork_timestamp=d.get("fork_timestamp", ""),
            inheritance=InheritanceConfig.from_dict(d.get("inheritance", {})),
            divergence_declaration=d.get("divergence_declaration", {}),
            reputation_inheritance=rep,
        )


def fork_agent(
    manager: LifecycleManager,
    parent_id: str,
    child_id: str,
    fork_type: str = "specialization",
    inheritance: Optional[InheritanceConfig] = None,
    child_genetic: Optional[GeneticProfile] = None,
    child_epigenetic: Optional[EpigeneticProfile] = None,
    divergence_declaration: Optional[Dict[str, Any]] = None,
    initiator: Optional[Initiator] = None,
) -> ForkRecord:
    """Fork an agent, creating a new child from an existing parent.

    Section 5.3: Parent remains Active; child enters Provisioning.
    Reputation inheritance follows Section 10.4 defaults (alpha=0.3).
    """
    if fork_type not in FORK_TYPES:
        raise LifecycleError(f"Invalid fork type: {fork_type}")

    parent = manager.store.get_agent(parent_id)
    if parent is None:
        raise LifecycleError(f"Parent agent not found: {parent_id}")
    if parent.state != "active":
        raise LifecycleError(
            f"Parent must be Active to fork, currently: {parent.state}"
        )

    existing_child = manager.store.get_agent(child_id)
    if existing_child is not None:
        raise LifecycleError(f"Child agent already exists: {child_id}")

    inh = inheritance or InheritanceConfig()

    # Compute reputation inheritance
    rep = ReputationInheritance(
        predecessor_score=parent.reputation_earned + parent.reputation_inherited,
        alpha=inh.reputation_factor,
        decay_half_life_days=inh.decay_half_life_days,
        probationary_period_days=inh.probationary_period_days,
    )
    rep.compute_initial()

    # Build child genetic profile
    if child_genetic:
        gen = child_genetic
    elif inh.genetic_inherited:
        gen = GeneticProfile.from_dict(parent.genetic_profile.to_dict())
    else:
        gen = GeneticProfile()

    # Build child epigenetic profile
    if child_epigenetic:
        epi = child_epigenetic
    elif inh.configuration_inherited:
        epi = EpigeneticProfile.from_dict(parent.epigenetic_profile.to_dict())
    else:
        epi = EpigeneticProfile()

    now = _now_iso()
    prob_until = (
        datetime.now(timezone.utc)
        + timedelta(days=inh.probationary_period_days)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Create child agent record (Provisioning)
    child = AgentRecord(
        agent_id=child_id,
        state="provisioning",
        genetic_profile=gen,
        epigenetic_profile=epi,
        parent_id=parent_id,
        coc_chain_id=f"coc-{child_id}",
        generation=parent.generation + 1,
        reputation_inherited=rep.inherited_score,
        probationary_until=prob_until,
    )

    fork_record = ForkRecord(
        parent_id=parent_id,
        child_id=child_id,
        fork_type=fork_type,
        fork_timestamp=now,
        inheritance=inh,
        divergence_declaration=divergence_declaration or {},
        reputation_inheritance=rep,
    )

    # Record fork event on parent
    fork_event = LifecycleEvent(
        event_type="fork",
        agent_id=parent_id,
        agent_state_before="active",
        agent_state_after="active",
        initiator=initiator or Initiator(),
        details=fork_record.to_dict(),
        related_agents=[{"agent_id": child_id, "relationship": "child"}],
    )

    manager._run_pre_hooks(fork_event, parent)

    # Update parent
    parent.children.append(child_id)
    parent.updated_at = now
    parent.event_history.append(fork_event.event_id)

    fork_event.compute_hash()
    manager.store.append_event(fork_event)
    manager.store.save_agent(parent)

    # Save child
    child.event_history.append(fork_event.event_id)
    manager.store.save_agent(child)

    manager._run_post_hooks(fork_event, parent)

    return fork_record
