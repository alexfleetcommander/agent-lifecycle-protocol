import {
  RETRAINING_CHANGE_TYPES,
  Initiator,
  LifecycleEvent,
  nowIso,
} from "./types";
import { LifecycleError, LifecycleManager } from "./lifecycle";

export interface CapabilitySnapshotData {
  model_version: string;
  capability_hash: string;
  behavioral_profile_hash: string;
}

export class CapabilitySnapshot {
  modelVersion: string;
  capabilityHash: string;
  behavioralProfileHash: string;

  constructor(opts?: Partial<{
    modelVersion: string;
    capabilityHash: string;
    behavioralProfileHash: string;
  }>) {
    this.modelVersion = opts?.modelVersion ?? "";
    this.capabilityHash = opts?.capabilityHash ?? "";
    this.behavioralProfileHash = opts?.behavioralProfileHash ?? "";
  }

  toDict(): CapabilitySnapshotData {
    return {
      model_version: this.modelVersion,
      capability_hash: this.capabilityHash,
      behavioral_profile_hash: this.behavioralProfileHash,
    };
  }

  static fromDict(d: Partial<CapabilitySnapshotData>): CapabilitySnapshot {
    return new CapabilitySnapshot({
      modelVersion: d.model_version,
      capabilityHash: d.capability_hash,
      behavioralProfileHash: d.behavioral_profile_hash,
    });
  }
}

export interface IdentityContinuityData {
  same_identity_key: boolean;
  same_coc_chain: boolean;
  operator_assertion: boolean;
  identity_preserved: boolean;
  rationale: string;
}

export class IdentityContinuity {
  sameIdentityKey: boolean;
  sameCocChain: boolean;
  operatorAssertion: boolean;
  rationale: string;

  constructor(opts?: Partial<{
    sameIdentityKey: boolean;
    sameCocChain: boolean;
    operatorAssertion: boolean;
    rationale: string;
  }>) {
    this.sameIdentityKey = opts?.sameIdentityKey ?? true;
    this.sameCocChain = opts?.sameCocChain ?? true;
    this.operatorAssertion = opts?.operatorAssertion ?? true;
    this.rationale = opts?.rationale ?? "";
  }

  get identityPreserved(): boolean {
    return (
      this.sameIdentityKey && this.sameCocChain && this.operatorAssertion
    );
  }

  toDict(): IdentityContinuityData {
    return {
      same_identity_key: this.sameIdentityKey,
      same_coc_chain: this.sameCocChain,
      operator_assertion: this.operatorAssertion,
      identity_preserved: this.identityPreserved,
      rationale: this.rationale,
    };
  }

  static fromDict(d: Partial<IdentityContinuityData>): IdentityContinuity {
    return new IdentityContinuity({
      sameIdentityKey: d.same_identity_key,
      sameCocChain: d.same_coc_chain,
      operatorAssertion: d.operator_assertion,
      rationale: d.rationale,
    });
  }
}

export interface RetrainingEventData {
  agent_id: string;
  change_type: string;
  before: CapabilitySnapshotData;
  after: CapabilitySnapshotData;
  retraining_class: string;
  identity_continuity: IdentityContinuityData;
  counterparty_action_required: string;
}

export class RetrainingEvent {
  agentId: string;
  changeType: string;
  before: CapabilitySnapshot;
  after: CapabilitySnapshot;
  retrainingClass: string;
  identityContinuity: IdentityContinuity;
  counterpartyActionRequired: string;

  constructor(opts?: Partial<{
    agentId: string;
    changeType: string;
    before: CapabilitySnapshot;
    after: CapabilitySnapshot;
    retrainingClass: string;
    identityContinuity: IdentityContinuity;
    counterpartyActionRequired: string;
  }>) {
    this.agentId = opts?.agentId ?? "";
    this.changeType = opts?.changeType ?? "model_upgrade";
    this.before = opts?.before ?? new CapabilitySnapshot();
    this.after = opts?.after ?? new CapabilitySnapshot();
    this.retrainingClass = opts?.retrainingClass ?? "minor";
    this.identityContinuity =
      opts?.identityContinuity ?? new IdentityContinuity();
    this.counterpartyActionRequired =
      opts?.counterpartyActionRequired ?? "none";
  }

  toDict(): RetrainingEventData {
    return {
      agent_id: this.agentId,
      change_type: this.changeType,
      before: this.before.toDict(),
      after: this.after.toDict(),
      retraining_class: this.retrainingClass,
      identity_continuity: this.identityContinuity.toDict(),
      counterparty_action_required: this.counterpartyActionRequired,
    };
  }

  static fromDict(d: Partial<RetrainingEventData>): RetrainingEvent {
    return new RetrainingEvent({
      agentId: d.agent_id,
      changeType: d.change_type,
      before: CapabilitySnapshot.fromDict(d.before ?? {}),
      after: CapabilitySnapshot.fromDict(d.after ?? {}),
      retrainingClass: d.retraining_class,
      identityContinuity: IdentityContinuity.fromDict(
        d.identity_continuity ?? {},
      ),
      counterpartyActionRequired: d.counterparty_action_required,
    });
  }
}

export function classifyRetraining(changeType: string): string {
  const minorTypes = [
    "prompt_revision",
    "capability_addition",
    "capability_removal",
  ];
  const moderateTypes = ["model_upgrade", "fine_tuning"];

  if (minorTypes.includes(changeType)) return "minor";
  if (moderateTypes.includes(changeType)) return "moderate";
  return "major";
}

export function counterpartyActionForClass(retrainingClass: string): string {
  const mapping: Record<string, string> = {
    minor: "none",
    moderate: "acknowledge",
    major: "consent",
  };
  return mapping[retrainingClass] ?? "consent";
}

export function checkIdentityContinuity(
  continuity: IdentityContinuity,
): boolean {
  return continuity.identityPreserved;
}

export function recordRetraining(
  manager: LifecycleManager,
  retraining: RetrainingEvent,
  initiator?: Initiator,
): LifecycleEvent {
  if (
    !(RETRAINING_CHANGE_TYPES as readonly string[]).includes(
      retraining.changeType,
    )
  ) {
    throw new LifecycleError(
      `Invalid change type: ${retraining.changeType}`,
    );
  }

  const agent = manager.store.getAgent(retraining.agentId);
  if (agent === null) {
    throw new LifecycleError(`Agent not found: ${retraining.agentId}`);
  }
  if (agent.state !== "active") {
    throw new LifecycleError(
      `Agent must be Active for retraining, currently: ${agent.state}`,
    );
  }

  if (!checkIdentityContinuity(retraining.identityContinuity)) {
    throw new LifecycleError(
      "Identity continuity test failed. This change should be " +
        "modeled as a Succession, not a Retraining. " +
        `Key: ${retraining.identityContinuity.sameIdentityKey}, ` +
        `Chain: ${retraining.identityContinuity.sameCocChain}, ` +
        `Assertion: ${retraining.identityContinuity.operatorAssertion}`,
    );
  }

  retraining.retrainingClass = classifyRetraining(retraining.changeType);
  retraining.counterpartyActionRequired = counterpartyActionForClass(
    retraining.retrainingClass,
  );

  const event = new LifecycleEvent({
    eventType: "retraining",
    agentId: retraining.agentId,
    agentStateBefore: "active",
    agentStateAfter: "active",
    initiator: initiator ?? new Initiator(),
    details: retraining.toDict() as unknown as Record<string, unknown>,
  });

  manager._runPreHooks(event, agent);

  agent.updatedAt = nowIso();
  agent.eventHistory.push(event.eventId);

  if (retraining.after.modelVersion) {
    agent.geneticProfile.modelVersion = retraining.after.modelVersion;
  }

  event.computeHash();
  manager.store.appendEvent(event);
  manager.store.saveAgent(agent);

  manager._runPostHooks(event, agent);

  return event;
}
