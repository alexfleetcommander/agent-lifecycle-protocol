"""Shared data structures and JSON schemas for the Agent Lifecycle Protocol.

Implements the lifecycle state machine, event schemas, and data structures
from the ALP whitepaper v1.0.0 (Sections 2-5, Appendix A).

Zero external dependencies.  Python 3.8+.
"""

import hashlib
import json
import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROTOCOL_VERSION = "1.0.0"
SCHEMA_VERSION = "1.0.0"

# Agent lifecycle states (Section 4.1)
AGENT_STATES = (
    "provisioning",
    "active",
    "suspended",
    "migrating",
    "deprecated",
    "decommissioned",
    "failed",
)

TERMINAL_STATES = ("decommissioned", "failed")

# Lifecycle event types (Section 5, Appendix A)
EVENT_TYPES = (
    "genesis",
    "activate",
    "suspend",
    "resume",
    "fork",
    "begin_migration",
    "complete_migration",
    "abort_migration",
    "retraining",
    "deprecate",
    "decommission",
    "emergency_decommission",
    "abort_succession",
    "fail",
)

# Valid state transitions: (from_state, to_state) -> event_type
# None as from_state means the agent does not yet exist
VALID_TRANSITIONS: Dict[Tuple[Optional[str], str], str] = {
    (None, "provisioning"): "genesis",
    ("provisioning", "active"): "activate",
    ("provisioning", "failed"): "fail",
    ("active", "suspended"): "suspend",
    ("suspended", "active"): "resume",
    ("active", "migrating"): "begin_migration",
    ("migrating", "active"): "complete_migration",  # also abort_migration
    ("active", "deprecated"): "deprecate",
    ("deprecated", "decommissioned"): "decommission",
    ("deprecated", "active"): "abort_succession",
}

# Fork types (Section 5.3)
FORK_TYPES = ("full_clone", "partial_clone", "capability_fork", "specialization")

# Migration types (Section 5.4)
MIGRATION_TYPES = ("cold", "warm", "live")

# Retraining change types (Section 5.5)
RETRAINING_CHANGE_TYPES = (
    "model_upgrade",
    "fine_tuning",
    "prompt_revision",
    "capability_addition",
    "capability_removal",
)

# Retraining impact classes (Section 5.5)
RETRAINING_CLASSES = ("minor", "moderate", "major")

# Counterparty action required
COUNTERPARTY_ACTIONS = ("none", "acknowledge", "consent")

# Succession types (Section 5.6)
SUCCESSION_TYPES = ("replacement", "upgrade", "role_transfer")

# Decommission reasons (Section 5.7)
DECOMMISSION_REASONS = (
    "end_of_life",
    "superseded",
    "compromised",
    "policy_violation",
    "resource_constraint",
)

# Agreement reassignment classifications (Section 11.2)
AGREEMENT_CLASSIFICATIONS = (
    "auto_transfer",
    "consent_required",
    "non_transferable",
    "operator_absorbed",
)

# Registry access levels (Section 6.5)
ACCESS_LEVELS = ("public", "authorized", "operator_only")

# Registry redaction levels for decommissioned agents (Section 9.5)
REDACTION_LEVELS = ("none", "partial", "full")

# Credential overlap policies (Section 5.6)
CREDENTIAL_OVERLAP_POLICIES = ("strict_zero", "configurable")

# Memory scope options for fork inheritance
MEMORY_SCOPES = ("full", "filtered", "summary", "none")

# Identity systems (protocol is agnostic, these are common examples)
IDENTITY_SYSTEMS = ("did", "api_key", "oauth", "x509", "uri", "custom")

# Default reputation inheritance parameters (Section 10.3)
DEFAULT_SUCCESSION_ALPHA = 0.5
DEFAULT_FORK_ALPHA = 0.3
DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS = 30
DEFAULT_FORK_DECAY_HALF_LIFE_DAYS = 21
DEFAULT_PROBATIONARY_PERIOD_DAYS = 14
DEFAULT_MIN_OPERATIONAL_DAYS = 7
DEFAULT_MIN_COC_ENTRIES = 50


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uuid() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _hash_dict(d: Dict[str, Any]) -> str:
    """Deterministic SHA-256 of a dict."""
    raw = json.dumps(d, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_inherited_reputation(
    predecessor_score: float,
    alpha: float,
    decay_half_life_days: float,
    days_elapsed: float,
) -> float:
    """Compute inherited reputation: R_predecessor * alpha * e^(-lambda*t).

    Section 10.2 of the whitepaper.
    """
    if decay_half_life_days <= 0:
        return 0.0
    lam = math.log(2) / decay_half_life_days
    return predecessor_score * alpha * math.exp(-lam * days_elapsed)


def compute_effective_reputation(
    inherited: float,
    earned: float,
) -> float:
    """Effective reputation clamped to [0.0, 1.0]. Section 10.2."""
    return min(1.0, max(0.0, inherited + earned))


# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------

@dataclass
class GeneticProfile:
    """An agent's genetic lineage: model, architecture, training data."""
    model_family: str = ""
    model_version: str = ""
    architecture: str = ""
    training_data_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_family": self.model_family,
            "model_version": self.model_version,
            "architecture": self.architecture,
            "training_data_hash": self.training_data_hash,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "GeneticProfile":
        return cls(
            model_family=d.get("model_family", ""),
            model_version=d.get("model_version", ""),
            architecture=d.get("architecture", ""),
            training_data_hash=d.get("training_data_hash", ""),
        )


@dataclass
class EpigeneticProfile:
    """An agent's epigenetic lineage: config, memory, role."""
    role: str = ""
    specialization: str = ""
    system_prompt_hash: str = ""
    tool_access: List[str] = field(default_factory=list)
    memory_state: str = ""
    initial_configuration: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "role": self.role,
            "specialization": self.specialization,
            "system_prompt_hash": self.system_prompt_hash,
            "tool_access": list(self.tool_access),
            "memory_state": self.memory_state,
            "initial_configuration": dict(self.initial_configuration),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "EpigeneticProfile":
        return cls(
            role=d.get("role", ""),
            specialization=d.get("specialization", ""),
            system_prompt_hash=d.get("system_prompt_hash", ""),
            tool_access=d.get("tool_access", []),
            memory_state=d.get("memory_state", ""),
            initial_configuration=d.get("initial_configuration", {}),
        )


@dataclass
class Initiator:
    """Who or what triggered a lifecycle event."""
    type: str = "human"  # human | agent | system | policy
    id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {"type": self.type, "id": self.id}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Initiator":
        return cls(type=d.get("type", "human"), id=d.get("id", ""))


@dataclass
class ChainReference:
    """Reference to a CoC chain entry."""
    chain_id: str = ""
    entry_index: int = -1
    entry_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chain_id": self.chain_id,
            "entry_index": self.entry_index,
            "entry_hash": self.entry_hash,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ChainReference":
        return cls(
            chain_id=d.get("chain_id", ""),
            entry_index=d.get("entry_index", -1),
            entry_hash=d.get("entry_hash", ""),
        )


@dataclass
class ReputationInheritance:
    """Reputation inheritance parameters (Section 10)."""
    predecessor_score: float = 0.0
    alpha: float = DEFAULT_SUCCESSION_ALPHA
    decay_half_life_days: float = DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS
    probationary_period_days: float = DEFAULT_PROBATIONARY_PERIOD_DAYS
    inherited_score: float = 0.0
    decay_function: str = "exponential"

    def compute_initial(self) -> float:
        self.inherited_score = self.predecessor_score * self.alpha
        return self.inherited_score

    def compute_at(self, days_elapsed: float) -> float:
        return compute_inherited_reputation(
            self.predecessor_score, self.alpha,
            self.decay_half_life_days, days_elapsed,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "predecessor_score": self.predecessor_score,
            "alpha": self.alpha,
            "decay_half_life_days": self.decay_half_life_days,
            "probationary_period_days": self.probationary_period_days,
            "inherited_score": self.inherited_score,
            "decay_function": self.decay_function,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ReputationInheritance":
        return cls(
            predecessor_score=d.get("predecessor_score", 0.0),
            alpha=d.get("alpha", DEFAULT_SUCCESSION_ALPHA),
            decay_half_life_days=d.get("decay_half_life_days", DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS),
            probationary_period_days=d.get("probationary_period_days", DEFAULT_PROBATIONARY_PERIOD_DAYS),
            inherited_score=d.get("inherited_score", 0.0),
            decay_function=d.get("decay_function", "exponential"),
        )


@dataclass
class CounterpartyNotification:
    """Notification sent to a counterparty during succession."""
    counterparty_id: str = ""
    notification_sent: str = ""
    consent_required: bool = False
    consent_received: bool = False
    consent_timestamp: str = ""
    response: str = ""  # consent | object | renegotiate

    def to_dict(self) -> Dict[str, Any]:
        return {
            "counterparty_id": self.counterparty_id,
            "notification_sent": self.notification_sent,
            "consent_required": self.consent_required,
            "consent_received": self.consent_received,
            "consent_timestamp": self.consent_timestamp,
            "response": self.response,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "CounterpartyNotification":
        return cls(
            counterparty_id=d.get("counterparty_id", ""),
            notification_sent=d.get("notification_sent", ""),
            consent_required=d.get("consent_required", False),
            consent_received=d.get("consent_received", False),
            consent_timestamp=d.get("consent_timestamp", ""),
            response=d.get("response", ""),
        )


@dataclass
class LifecycleEvent:
    """Base lifecycle event (Section 5.1).

    Every lifecycle transition is recorded as a LifecycleEvent.
    """
    event_id: str = field(default_factory=lambda: f"evt-{_uuid()[:8]}")
    event_type: str = ""
    timestamp: str = field(default_factory=_now_iso)
    agent_id: str = ""
    agent_state_before: Optional[str] = None
    agent_state_after: str = ""
    initiator: Initiator = field(default_factory=Initiator)
    details: Dict[str, Any] = field(default_factory=dict)
    related_agents: List[Dict[str, str]] = field(default_factory=list)
    chain_entry: Optional[ChainReference] = None
    metadata: Dict[str, Any] = field(default_factory=lambda: {
        "protocol_version": PROTOCOL_VERSION,
        "schema_version": SCHEMA_VERSION,
    })
    event_hash: str = ""

    def compute_hash(self) -> str:
        d = self.to_dict()
        d.pop("event_hash", None)
        self.event_hash = _hash_dict(d)
        return self.event_hash

    def canonical_string(self) -> str:
        """ALP canonical string format (Appendix A.2)."""
        sb = self.agent_state_before or "null"
        details_hash = _hash_dict(self.details) if self.details else "sha256:empty"
        return (
            f"ALP|{PROTOCOL_VERSION}|{self.event_type}|{self.timestamp}"
            f"|{self.agent_id}|{sb}>{self.agent_state_after}|{details_hash}"
        )

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "timestamp": self.timestamp,
            "agent_id": self.agent_id,
            "agent_state_before": self.agent_state_before,
            "agent_state_after": self.agent_state_after,
            "initiator": self.initiator.to_dict(),
            "details": self.details,
            "related_agents": list(self.related_agents),
            "metadata": dict(self.metadata),
        }
        if self.chain_entry:
            d["chain_entry"] = self.chain_entry.to_dict()
        if self.event_hash:
            d["event_hash"] = self.event_hash
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "LifecycleEvent":
        chain = None
        if "chain_entry" in d and d["chain_entry"]:
            chain = ChainReference.from_dict(d["chain_entry"])
        return cls(
            event_id=d.get("event_id", f"evt-{_uuid()[:8]}"),
            event_type=d.get("event_type", ""),
            timestamp=d.get("timestamp", ""),
            agent_id=d.get("agent_id", ""),
            agent_state_before=d.get("agent_state_before"),
            agent_state_after=d.get("agent_state_after", ""),
            initiator=Initiator.from_dict(d.get("initiator", {})),
            details=d.get("details", {}),
            related_agents=d.get("related_agents", []),
            chain_entry=chain,
            metadata=d.get("metadata", {
                "protocol_version": PROTOCOL_VERSION,
                "schema_version": SCHEMA_VERSION,
            }),
            event_hash=d.get("event_hash", ""),
        )


@dataclass
class AgentRecord:
    """Current state record for a managed agent."""
    agent_id: str = ""
    state: str = "provisioning"
    genetic_profile: GeneticProfile = field(default_factory=GeneticProfile)
    epigenetic_profile: EpigeneticProfile = field(default_factory=EpigeneticProfile)
    parent_id: Optional[str] = None
    children: List[str] = field(default_factory=list)
    coc_chain_id: str = ""
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)
    generation: int = 1
    reputation_inherited: float = 0.0
    reputation_earned: float = 0.0
    probationary_until: str = ""
    redaction_level: str = "none"
    event_history: List[str] = field(default_factory=list)  # event_ids

    @property
    def is_terminal(self) -> bool:
        return self.state in TERMINAL_STATES

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "state": self.state,
            "genetic_profile": self.genetic_profile.to_dict(),
            "epigenetic_profile": self.epigenetic_profile.to_dict(),
            "parent_id": self.parent_id,
            "children": list(self.children),
            "coc_chain_id": self.coc_chain_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "generation": self.generation,
            "reputation_inherited": self.reputation_inherited,
            "reputation_earned": self.reputation_earned,
            "probationary_until": self.probationary_until,
            "redaction_level": self.redaction_level,
            "event_history": list(self.event_history),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "AgentRecord":
        return cls(
            agent_id=d.get("agent_id", ""),
            state=d.get("state", "provisioning"),
            genetic_profile=GeneticProfile.from_dict(d.get("genetic_profile", {})),
            epigenetic_profile=EpigeneticProfile.from_dict(d.get("epigenetic_profile", {})),
            parent_id=d.get("parent_id"),
            children=d.get("children", []),
            coc_chain_id=d.get("coc_chain_id", ""),
            created_at=d.get("created_at", ""),
            updated_at=d.get("updated_at", ""),
            generation=d.get("generation", 1),
            reputation_inherited=d.get("reputation_inherited", 0.0),
            reputation_earned=d.get("reputation_earned", 0.0),
            probationary_until=d.get("probationary_until", ""),
            redaction_level=d.get("redaction_level", "none"),
            event_history=d.get("event_history", []),
        )
