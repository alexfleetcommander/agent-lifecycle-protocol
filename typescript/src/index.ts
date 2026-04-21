// Types, constants, helpers
export {
  PROTOCOL_VERSION,
  SCHEMA_VERSION,
  AGENT_STATES,
  TERMINAL_STATES,
  EVENT_TYPES,
  FORK_TYPES,
  MIGRATION_TYPES,
  RETRAINING_CHANGE_TYPES,
  RETRAINING_CLASSES,
  COUNTERPARTY_ACTIONS,
  SUCCESSION_TYPES,
  DECOMMISSION_REASONS,
  AGREEMENT_CLASSIFICATIONS,
  ACCESS_LEVELS,
  REDACTION_LEVELS,
  CREDENTIAL_OVERLAP_POLICIES,
  MEMORY_SCOPES,
  DEFAULT_SUCCESSION_ALPHA,
  DEFAULT_FORK_ALPHA,
  DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS,
  DEFAULT_FORK_DECAY_HALF_LIFE_DAYS,
  DEFAULT_PROBATIONARY_PERIOD_DAYS,
  DEFAULT_MIN_OPERATIONAL_DAYS,
  DEFAULT_MIN_COC_ENTRIES,
  uuid,
  nowIso,
  hashDict,
  computeInheritedReputation,
  computeEffectiveReputation,
  GeneticProfile,
  EpigeneticProfile,
  Initiator,
  ChainReference,
  ReputationInheritance,
  CounterpartyNotification,
  LifecycleEvent,
  AgentRecord,
} from "./types";
export type {
  AgentState,
  EventType,
  ForkType,
  MigrationType,
  RetrainingChangeType,
  RetrainingClass,
  CounterpartyAction,
  SuccessionType,
  DecommissionReason,
  AccessLevel,
  RedactionLevel,
  MemoryScope,
  GeneticProfileData,
  EpigeneticProfileData,
  InitiatorData,
  ChainReferenceData,
  ReputationInheritanceData,
  CounterpartyNotificationData,
  LifecycleEventData,
  AgentRecordData,
} from "./types";

// Store
export { LifecycleStore } from "./store";

// Lifecycle
export { LifecycleError, LifecycleManager } from "./lifecycle";
export type { HookResult, HookCallback } from "./lifecycle";

// Fork
export { InheritanceConfig, ForkRecord, forkAgent } from "./fork";
export type { InheritanceConfigData, ForkRecordData } from "./fork";

// Succession
export {
  SuccessionPlan,
  announceSuccession,
  transferEstate,
  verifySuccession,
  executeCutover,
  abortSuccession,
} from "./succession";
export type { SuccessionPlanData } from "./succession";

// Migration
export {
  PlatformInfo,
  MigrationPlan,
  beginMigration,
  completeMigration,
  abortMigration,
} from "./migration";
export type { PlatformInfoData, MigrationPlanData } from "./migration";

// Retraining
export {
  CapabilitySnapshot,
  IdentityContinuity,
  RetrainingEvent,
  classifyRetraining,
  counterpartyActionForClass,
  checkIdentityContinuity,
  recordRetraining,
} from "./retraining";
export type {
  CapabilitySnapshotData,
  IdentityContinuityData,
  RetrainingEventData,
} from "./retraining";

// Decommission
export {
  CredentialRevocation,
  DataDisposition,
  EstateDisposition,
  DecommissionPlan,
  gracefulDecommission,
  emergencyDecommission,
  validateDecommissionChecklist,
} from "./decommission";
export type {
  CredentialRevocationData,
  DataDispositionData,
  EstateDispositionData,
  DecommissionPlanData,
} from "./decommission";

// Registry
export { RegistryEntry, LineageRegistry } from "./registry";
export type { RegistryEntryData } from "./registry";
