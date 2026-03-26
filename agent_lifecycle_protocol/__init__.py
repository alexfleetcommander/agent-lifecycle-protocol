"""Agent Lifecycle Protocol — manage agent birth, fork, succession,
migration, retraining, and decommission.

A pip-installable implementation of the Agent Lifecycle Protocol,
companion to Chain of Consciousness, Agent Rating Protocol,
Agent Service Agreements, and Agent Justice Protocol.
"""

from .schema import (
    # Constants
    AGENT_STATES,
    AGREEMENT_CLASSIFICATIONS,
    COUNTERPARTY_ACTIONS,
    CREDENTIAL_OVERLAP_POLICIES,
    DECOMMISSION_REASONS,
    DEFAULT_FORK_ALPHA,
    DEFAULT_FORK_DECAY_HALF_LIFE_DAYS,
    DEFAULT_PROBATIONARY_PERIOD_DAYS,
    DEFAULT_SUCCESSION_ALPHA,
    DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS,
    EVENT_TYPES,
    FORK_TYPES,
    MEMORY_SCOPES,
    MIGRATION_TYPES,
    PROTOCOL_VERSION,
    REDACTION_LEVELS,
    RETRAINING_CHANGE_TYPES,
    RETRAINING_CLASSES,
    SCHEMA_VERSION,
    SUCCESSION_TYPES,
    TERMINAL_STATES,
    # Data structures
    AgentRecord,
    ChainReference,
    CounterpartyNotification,
    EpigeneticProfile,
    GeneticProfile,
    Initiator,
    LifecycleEvent,
    ReputationInheritance,
    # Functions
    compute_effective_reputation,
    compute_inherited_reputation,
)
from .store import LifecycleStore
from .lifecycle import LifecycleError, LifecycleManager
from .fork import ForkRecord, InheritanceConfig, fork_agent
from .succession import (
    SuccessionPlan,
    abort_succession,
    announce_succession,
    execute_cutover,
    transfer_estate,
    verify_succession,
)
from .migration import (
    MigrationPlan,
    PlatformInfo,
    abort_migration,
    begin_migration,
    complete_migration,
)
from .retraining import (
    CapabilitySnapshot,
    IdentityContinuity,
    RetrainingEvent,
    check_identity_continuity,
    classify_retraining,
    counterparty_action_for_class,
    record_retraining,
)
from .decommission import (
    CredentialRevocation,
    DataDisposition,
    DecommissionPlan,
    EstateDisposition,
    emergency_decommission,
    graceful_decommission,
    validate_decommission_checklist,
)
from .registry import LineageRegistry, RegistryEntry

__all__ = [
    # Constants
    "AGENT_STATES",
    "AGREEMENT_CLASSIFICATIONS",
    "COUNTERPARTY_ACTIONS",
    "CREDENTIAL_OVERLAP_POLICIES",
    "DECOMMISSION_REASONS",
    "DEFAULT_FORK_ALPHA",
    "DEFAULT_FORK_DECAY_HALF_LIFE_DAYS",
    "DEFAULT_PROBATIONARY_PERIOD_DAYS",
    "DEFAULT_SUCCESSION_ALPHA",
    "DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS",
    "EVENT_TYPES",
    "FORK_TYPES",
    "MEMORY_SCOPES",
    "MIGRATION_TYPES",
    "PROTOCOL_VERSION",
    "REDACTION_LEVELS",
    "RETRAINING_CHANGE_TYPES",
    "RETRAINING_CLASSES",
    "SCHEMA_VERSION",
    "SUCCESSION_TYPES",
    "TERMINAL_STATES",
    # Schema data structures
    "AgentRecord",
    "ChainReference",
    "CounterpartyNotification",
    "EpigeneticProfile",
    "GeneticProfile",
    "Initiator",
    "LifecycleEvent",
    "ReputationInheritance",
    # Schema functions
    "compute_effective_reputation",
    "compute_inherited_reputation",
    # Store
    "LifecycleStore",
    # Lifecycle
    "LifecycleError",
    "LifecycleManager",
    # Fork
    "ForkRecord",
    "InheritanceConfig",
    "fork_agent",
    # Succession
    "SuccessionPlan",
    "abort_succession",
    "announce_succession",
    "execute_cutover",
    "transfer_estate",
    "verify_succession",
    # Migration
    "MigrationPlan",
    "PlatformInfo",
    "abort_migration",
    "begin_migration",
    "complete_migration",
    # Retraining
    "CapabilitySnapshot",
    "IdentityContinuity",
    "RetrainingEvent",
    "check_identity_continuity",
    "classify_retraining",
    "counterparty_action_for_class",
    "record_retraining",
    # Decommission
    "CredentialRevocation",
    "DataDisposition",
    "DecommissionPlan",
    "EstateDisposition",
    "emergency_decommission",
    "graceful_decommission",
    "validate_decommission_checklist",
    # Registry
    "LineageRegistry",
    "RegistryEntry",
]

__version__ = "0.1.0"
