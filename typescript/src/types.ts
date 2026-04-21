import { createHash, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

export const PROTOCOL_VERSION = "1.0.0";
export const SCHEMA_VERSION = "1.0.0";

export const AGENT_STATES = [
  "provisioning",
  "active",
  "suspended",
  "migrating",
  "deprecated",
  "decommissioned",
  "failed",
] as const;
export type AgentState = (typeof AGENT_STATES)[number];

export const TERMINAL_STATES: readonly AgentState[] = ["decommissioned", "failed"];

export const EVENT_TYPES = [
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
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const FORK_TYPES = [
  "full_clone",
  "partial_clone",
  "capability_fork",
  "specialization",
] as const;
export type ForkType = (typeof FORK_TYPES)[number];

export const MIGRATION_TYPES = ["cold", "warm", "live"] as const;
export type MigrationType = (typeof MIGRATION_TYPES)[number];

export const RETRAINING_CHANGE_TYPES = [
  "model_upgrade",
  "fine_tuning",
  "prompt_revision",
  "capability_addition",
  "capability_removal",
] as const;
export type RetrainingChangeType = (typeof RETRAINING_CHANGE_TYPES)[number];

export const RETRAINING_CLASSES = ["minor", "moderate", "major"] as const;
export type RetrainingClass = (typeof RETRAINING_CLASSES)[number];

export const COUNTERPARTY_ACTIONS = ["none", "acknowledge", "consent"] as const;
export type CounterpartyAction = (typeof COUNTERPARTY_ACTIONS)[number];

export const SUCCESSION_TYPES = ["replacement", "upgrade", "role_transfer"] as const;
export type SuccessionType = (typeof SUCCESSION_TYPES)[number];

export const DECOMMISSION_REASONS = [
  "end_of_life",
  "superseded",
  "compromised",
  "policy_violation",
  "resource_constraint",
] as const;
export type DecommissionReason = (typeof DECOMMISSION_REASONS)[number];

export const AGREEMENT_CLASSIFICATIONS = [
  "auto_transfer",
  "consent_required",
  "non_transferable",
  "operator_absorbed",
] as const;

export const ACCESS_LEVELS = ["public", "authorized", "operator_only"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const REDACTION_LEVELS = ["none", "partial", "full"] as const;
export type RedactionLevel = (typeof REDACTION_LEVELS)[number];

export const CREDENTIAL_OVERLAP_POLICIES = ["strict_zero", "configurable"] as const;

export const MEMORY_SCOPES = ["full", "filtered", "summary", "none"] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export const DEFAULT_SUCCESSION_ALPHA = 0.5;
export const DEFAULT_FORK_ALPHA = 0.3;
export const DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS = 30;
export const DEFAULT_FORK_DECAY_HALF_LIFE_DAYS = 21;
export const DEFAULT_PROBATIONARY_PERIOD_DAYS = 14;
export const DEFAULT_MIN_OPERATIONAL_DAYS = 7;
export const DEFAULT_MIN_COC_ENTRIES = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function uuid(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function hashDict(d: Record<string, unknown>): string {
  const raw = JSON.stringify(d, Object.keys(d).sort(), undefined)
    .replace(/: /g, ":")
    .replace(/, /g, ",");
  const canonical = JSON.stringify(
    JSON.parse(raw),
    Object.keys(JSON.parse(raw)).sort(),
  );
  const normalized = JSON.stringify(JSON.parse(canonical));
  return (
    "sha256:" +
    createHash("sha256").update(normalized, "utf-8").digest("hex")
  );
}

export function computeInheritedReputation(
  predecessorScore: number,
  alpha: number,
  decayHalfLifeDays: number,
  daysElapsed: number,
): number {
  if (decayHalfLifeDays <= 0) return 0.0;
  const lam = Math.log(2) / decayHalfLifeDays;
  return predecessorScore * alpha * Math.exp(-lam * daysElapsed);
}

export function computeEffectiveReputation(
  inherited: number,
  earned: number,
): number {
  return Math.min(1.0, Math.max(0.0, inherited + earned));
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export interface GeneticProfileData {
  model_family: string;
  model_version: string;
  architecture: string;
  training_data_hash: string;
}

export class GeneticProfile {
  modelFamily: string;
  modelVersion: string;
  architecture: string;
  trainingDataHash: string;

  constructor(opts?: Partial<{
    modelFamily: string;
    modelVersion: string;
    architecture: string;
    trainingDataHash: string;
  }>) {
    this.modelFamily = opts?.modelFamily ?? "";
    this.modelVersion = opts?.modelVersion ?? "";
    this.architecture = opts?.architecture ?? "";
    this.trainingDataHash = opts?.trainingDataHash ?? "";
  }

  toDict(): GeneticProfileData {
    return {
      model_family: this.modelFamily,
      model_version: this.modelVersion,
      architecture: this.architecture,
      training_data_hash: this.trainingDataHash,
    };
  }

  static fromDict(d: Partial<GeneticProfileData>): GeneticProfile {
    return new GeneticProfile({
      modelFamily: d.model_family,
      modelVersion: d.model_version,
      architecture: d.architecture,
      trainingDataHash: d.training_data_hash,
    });
  }
}

export interface EpigeneticProfileData {
  role: string;
  specialization: string;
  system_prompt_hash: string;
  tool_access: string[];
  memory_state: string;
  initial_configuration: Record<string, unknown>;
}

export class EpigeneticProfile {
  role: string;
  specialization: string;
  systemPromptHash: string;
  toolAccess: string[];
  memoryState: string;
  initialConfiguration: Record<string, unknown>;

  constructor(opts?: Partial<{
    role: string;
    specialization: string;
    systemPromptHash: string;
    toolAccess: string[];
    memoryState: string;
    initialConfiguration: Record<string, unknown>;
  }>) {
    this.role = opts?.role ?? "";
    this.specialization = opts?.specialization ?? "";
    this.systemPromptHash = opts?.systemPromptHash ?? "";
    this.toolAccess = opts?.toolAccess ?? [];
    this.memoryState = opts?.memoryState ?? "";
    this.initialConfiguration = opts?.initialConfiguration ?? {};
  }

  toDict(): EpigeneticProfileData {
    return {
      role: this.role,
      specialization: this.specialization,
      system_prompt_hash: this.systemPromptHash,
      tool_access: [...this.toolAccess],
      memory_state: this.memoryState,
      initial_configuration: { ...this.initialConfiguration },
    };
  }

  static fromDict(d: Partial<EpigeneticProfileData>): EpigeneticProfile {
    return new EpigeneticProfile({
      role: d.role,
      specialization: d.specialization,
      systemPromptHash: d.system_prompt_hash,
      toolAccess: d.tool_access,
      memoryState: d.memory_state,
      initialConfiguration: d.initial_configuration as Record<string, unknown>,
    });
  }
}

export interface InitiatorData {
  type: string;
  id: string;
}

export class Initiator {
  type: string;
  id: string;

  constructor(opts?: Partial<{ type: string; id: string }>) {
    this.type = opts?.type ?? "human";
    this.id = opts?.id ?? "";
  }

  toDict(): InitiatorData {
    return { type: this.type, id: this.id };
  }

  static fromDict(d: Partial<InitiatorData>): Initiator {
    return new Initiator({ type: d.type, id: d.id });
  }
}

export interface ChainReferenceData {
  chain_id: string;
  entry_index: number;
  entry_hash: string;
}

export class ChainReference {
  chainId: string;
  entryIndex: number;
  entryHash: string;

  constructor(opts?: Partial<{
    chainId: string;
    entryIndex: number;
    entryHash: string;
  }>) {
    this.chainId = opts?.chainId ?? "";
    this.entryIndex = opts?.entryIndex ?? -1;
    this.entryHash = opts?.entryHash ?? "";
  }

  toDict(): ChainReferenceData {
    return {
      chain_id: this.chainId,
      entry_index: this.entryIndex,
      entry_hash: this.entryHash,
    };
  }

  static fromDict(d: Partial<ChainReferenceData>): ChainReference {
    return new ChainReference({
      chainId: d.chain_id,
      entryIndex: d.entry_index,
      entryHash: d.entry_hash,
    });
  }
}

export interface ReputationInheritanceData {
  predecessor_score: number;
  alpha: number;
  decay_half_life_days: number;
  probationary_period_days: number;
  inherited_score: number;
  decay_function: string;
}

export class ReputationInheritance {
  predecessorScore: number;
  alpha: number;
  decayHalfLifeDays: number;
  probationaryPeriodDays: number;
  inheritedScore: number;
  decayFunction: string;

  constructor(opts?: Partial<{
    predecessorScore: number;
    alpha: number;
    decayHalfLifeDays: number;
    probationaryPeriodDays: number;
    inheritedScore: number;
    decayFunction: string;
  }>) {
    this.predecessorScore = opts?.predecessorScore ?? 0.0;
    this.alpha = opts?.alpha ?? DEFAULT_SUCCESSION_ALPHA;
    this.decayHalfLifeDays = opts?.decayHalfLifeDays ?? DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS;
    this.probationaryPeriodDays = opts?.probationaryPeriodDays ?? DEFAULT_PROBATIONARY_PERIOD_DAYS;
    this.inheritedScore = opts?.inheritedScore ?? 0.0;
    this.decayFunction = opts?.decayFunction ?? "exponential";
  }

  computeInitial(): number {
    this.inheritedScore = this.predecessorScore * this.alpha;
    return this.inheritedScore;
  }

  computeAt(daysElapsed: number): number {
    return computeInheritedReputation(
      this.predecessorScore,
      this.alpha,
      this.decayHalfLifeDays,
      daysElapsed,
    );
  }

  toDict(): ReputationInheritanceData {
    return {
      predecessor_score: this.predecessorScore,
      alpha: this.alpha,
      decay_half_life_days: this.decayHalfLifeDays,
      probationary_period_days: this.probationaryPeriodDays,
      inherited_score: this.inheritedScore,
      decay_function: this.decayFunction,
    };
  }

  static fromDict(d: Partial<ReputationInheritanceData>): ReputationInheritance {
    return new ReputationInheritance({
      predecessorScore: d.predecessor_score,
      alpha: d.alpha,
      decayHalfLifeDays: d.decay_half_life_days,
      probationaryPeriodDays: d.probationary_period_days,
      inheritedScore: d.inherited_score,
      decayFunction: d.decay_function,
    });
  }
}

export interface CounterpartyNotificationData {
  counterparty_id: string;
  notification_sent: string;
  consent_required: boolean;
  consent_received: boolean;
  consent_timestamp: string;
  response: string;
}

export class CounterpartyNotification {
  counterpartyId: string;
  notificationSent: string;
  consentRequired: boolean;
  consentReceived: boolean;
  consentTimestamp: string;
  response: string;

  constructor(opts?: Partial<{
    counterpartyId: string;
    notificationSent: string;
    consentRequired: boolean;
    consentReceived: boolean;
    consentTimestamp: string;
    response: string;
  }>) {
    this.counterpartyId = opts?.counterpartyId ?? "";
    this.notificationSent = opts?.notificationSent ?? "";
    this.consentRequired = opts?.consentRequired ?? false;
    this.consentReceived = opts?.consentReceived ?? false;
    this.consentTimestamp = opts?.consentTimestamp ?? "";
    this.response = opts?.response ?? "";
  }

  toDict(): CounterpartyNotificationData {
    return {
      counterparty_id: this.counterpartyId,
      notification_sent: this.notificationSent,
      consent_required: this.consentRequired,
      consent_received: this.consentReceived,
      consent_timestamp: this.consentTimestamp,
      response: this.response,
    };
  }

  static fromDict(d: Partial<CounterpartyNotificationData>): CounterpartyNotification {
    return new CounterpartyNotification({
      counterpartyId: d.counterparty_id,
      notificationSent: d.notification_sent,
      consentRequired: d.consent_required,
      consentReceived: d.consent_received,
      consentTimestamp: d.consent_timestamp,
      response: d.response,
    });
  }
}

export interface LifecycleEventData {
  event_id: string;
  event_type: string;
  timestamp: string;
  agent_id: string;
  agent_state_before: string | null;
  agent_state_after: string;
  initiator: InitiatorData;
  details: Record<string, unknown>;
  related_agents: Array<Record<string, string>>;
  chain_entry?: ChainReferenceData;
  metadata: Record<string, unknown>;
  event_hash?: string;
}

export class LifecycleEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  agentId: string;
  agentStateBefore: string | null;
  agentStateAfter: string;
  initiator: Initiator;
  details: Record<string, unknown>;
  relatedAgents: Array<Record<string, string>>;
  chainEntry: ChainReference | null;
  metadata: Record<string, unknown>;
  eventHash: string;

  constructor(opts?: Partial<{
    eventId: string;
    eventType: string;
    timestamp: string;
    agentId: string;
    agentStateBefore: string | null;
    agentStateAfter: string;
    initiator: Initiator;
    details: Record<string, unknown>;
    relatedAgents: Array<Record<string, string>>;
    chainEntry: ChainReference | null;
    metadata: Record<string, unknown>;
    eventHash: string;
  }>) {
    this.eventId = opts?.eventId ?? `evt-${uuid().slice(0, 8)}`;
    this.eventType = opts?.eventType ?? "";
    this.timestamp = opts?.timestamp ?? nowIso();
    this.agentId = opts?.agentId ?? "";
    this.agentStateBefore = opts?.agentStateBefore ?? null;
    this.agentStateAfter = opts?.agentStateAfter ?? "";
    this.initiator = opts?.initiator ?? new Initiator();
    this.details = opts?.details ?? {};
    this.relatedAgents = opts?.relatedAgents ?? [];
    this.chainEntry = opts?.chainEntry ?? null;
    this.metadata = opts?.metadata ?? {
      protocol_version: PROTOCOL_VERSION,
      schema_version: SCHEMA_VERSION,
    };
    this.eventHash = opts?.eventHash ?? "";
  }

  computeHash(): string {
    const d: Record<string, unknown> = { ...this.toDict() };
    delete d["event_hash"];
    this.eventHash = hashDict(d);
    return this.eventHash;
  }

  canonicalString(): string {
    const sb = this.agentStateBefore ?? "null";
    const detailsHash =
      Object.keys(this.details).length > 0
        ? hashDict(this.details as unknown as Record<string, unknown>)
        : "sha256:empty";
    return (
      `ALP|${PROTOCOL_VERSION}|${this.eventType}|${this.timestamp}` +
      `|${this.agentId}|${sb}>${this.agentStateAfter}|${detailsHash}`
    );
  }

  toDict(): LifecycleEventData {
    const d: LifecycleEventData = {
      event_id: this.eventId,
      event_type: this.eventType,
      timestamp: this.timestamp,
      agent_id: this.agentId,
      agent_state_before: this.agentStateBefore,
      agent_state_after: this.agentStateAfter,
      initiator: this.initiator.toDict(),
      details: this.details,
      related_agents: [...this.relatedAgents],
      metadata: { ...this.metadata },
    };
    if (this.chainEntry) {
      d.chain_entry = this.chainEntry.toDict();
    }
    if (this.eventHash) {
      d.event_hash = this.eventHash;
    }
    return d;
  }

  static fromDict(d: Partial<LifecycleEventData>): LifecycleEvent {
    let chain: ChainReference | null = null;
    if (d.chain_entry) {
      chain = ChainReference.fromDict(d.chain_entry);
    }
    return new LifecycleEvent({
      eventId: d.event_id,
      eventType: d.event_type,
      timestamp: d.timestamp,
      agentId: d.agent_id,
      agentStateBefore: d.agent_state_before,
      agentStateAfter: d.agent_state_after,
      initiator: Initiator.fromDict(d.initiator ?? {}),
      details: (d.details ?? {}) as Record<string, unknown>,
      relatedAgents: d.related_agents ?? [],
      chainEntry: chain,
      metadata: (d.metadata ?? {
        protocol_version: PROTOCOL_VERSION,
        schema_version: SCHEMA_VERSION,
      }) as Record<string, unknown>,
      eventHash: d.event_hash ?? "",
    });
  }
}

export interface AgentRecordData {
  agent_id: string;
  state: string;
  genetic_profile: GeneticProfileData;
  epigenetic_profile: EpigeneticProfileData;
  parent_id: string | null;
  children: string[];
  coc_chain_id: string;
  created_at: string;
  updated_at: string;
  generation: number;
  reputation_inherited: number;
  reputation_earned: number;
  probationary_until: string;
  redaction_level: string;
  event_history: string[];
}

export class AgentRecord {
  agentId: string;
  state: string;
  geneticProfile: GeneticProfile;
  epigeneticProfile: EpigeneticProfile;
  parentId: string | null;
  children: string[];
  cocChainId: string;
  createdAt: string;
  updatedAt: string;
  generation: number;
  reputationInherited: number;
  reputationEarned: number;
  probationaryUntil: string;
  redactionLevel: string;
  eventHistory: string[];

  constructor(opts?: Partial<{
    agentId: string;
    state: string;
    geneticProfile: GeneticProfile;
    epigeneticProfile: EpigeneticProfile;
    parentId: string | null;
    children: string[];
    cocChainId: string;
    createdAt: string;
    updatedAt: string;
    generation: number;
    reputationInherited: number;
    reputationEarned: number;
    probationaryUntil: string;
    redactionLevel: string;
    eventHistory: string[];
  }>) {
    this.agentId = opts?.agentId ?? "";
    this.state = opts?.state ?? "provisioning";
    this.geneticProfile = opts?.geneticProfile ?? new GeneticProfile();
    this.epigeneticProfile = opts?.epigeneticProfile ?? new EpigeneticProfile();
    this.parentId = opts?.parentId ?? null;
    this.children = opts?.children ?? [];
    this.cocChainId = opts?.cocChainId ?? "";
    this.createdAt = opts?.createdAt ?? nowIso();
    this.updatedAt = opts?.updatedAt ?? nowIso();
    this.generation = opts?.generation ?? 1;
    this.reputationInherited = opts?.reputationInherited ?? 0.0;
    this.reputationEarned = opts?.reputationEarned ?? 0.0;
    this.probationaryUntil = opts?.probationaryUntil ?? "";
    this.redactionLevel = opts?.redactionLevel ?? "none";
    this.eventHistory = opts?.eventHistory ?? [];
  }

  get isTerminal(): boolean {
    return (TERMINAL_STATES as readonly string[]).includes(this.state);
  }

  toDict(): AgentRecordData {
    return {
      agent_id: this.agentId,
      state: this.state,
      genetic_profile: this.geneticProfile.toDict(),
      epigenetic_profile: this.epigeneticProfile.toDict(),
      parent_id: this.parentId,
      children: [...this.children],
      coc_chain_id: this.cocChainId,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      generation: this.generation,
      reputation_inherited: this.reputationInherited,
      reputation_earned: this.reputationEarned,
      probationary_until: this.probationaryUntil,
      redaction_level: this.redactionLevel,
      event_history: [...this.eventHistory],
    };
  }

  static fromDict(d: Partial<AgentRecordData>): AgentRecord {
    return new AgentRecord({
      agentId: d.agent_id,
      state: d.state,
      geneticProfile: GeneticProfile.fromDict(d.genetic_profile ?? {}),
      epigeneticProfile: EpigeneticProfile.fromDict(d.epigenetic_profile ?? {}),
      parentId: d.parent_id,
      children: d.children,
      cocChainId: d.coc_chain_id,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      generation: d.generation,
      reputationInherited: d.reputation_inherited,
      reputationEarned: d.reputation_earned,
      probationaryUntil: d.probationary_until,
      redactionLevel: d.redaction_level,
      eventHistory: d.event_history,
    });
  }
}
