import {
  DEFAULT_PROBATIONARY_PERIOD_DAYS,
  CounterpartyNotification,
  Initiator,
  LifecycleEvent,
  ReputationInheritance,
  nowIso,
} from "./types";
import type { CounterpartyNotificationData, ReputationInheritanceData } from "./types";
import { LifecycleError, LifecycleManager } from "./lifecycle";

export interface SuccessionPlanData {
  predecessor_id: string;
  successor_id: string;
  succession_type: string;
  transition_window_days: number;
  planned_cutover: string;
  reputation_inheritance: ReputationInheritanceData;
  counterparty_notifications: CounterpartyNotificationData[];
  phase: string;
  obligations_transferred: number;
  obligations_terminated: number;
  knowledge_transfer_complete: boolean;
  verification_passed: boolean;
}

export class SuccessionPlan {
  predecessorId: string;
  successorId: string;
  successionType: string;
  transitionWindowDays: number;
  plannedCutover: string;
  reputationInheritance: ReputationInheritance;
  counterpartyNotifications: CounterpartyNotification[];
  phase: string;
  obligationsTransferred: number;
  obligationsTerminated: number;
  knowledgeTransferComplete: boolean;
  verificationPassed: boolean;

  constructor(opts?: Partial<{
    predecessorId: string;
    successorId: string;
    successionType: string;
    transitionWindowDays: number;
    plannedCutover: string;
    reputationInheritance: ReputationInheritance;
    counterpartyNotifications: CounterpartyNotification[];
    phase: string;
    obligationsTransferred: number;
    obligationsTerminated: number;
    knowledgeTransferComplete: boolean;
    verificationPassed: boolean;
  }>) {
    this.predecessorId = opts?.predecessorId ?? "";
    this.successorId = opts?.successorId ?? "";
    this.successionType = opts?.successionType ?? "replacement";
    this.transitionWindowDays = opts?.transitionWindowDays ?? 14;
    this.plannedCutover = opts?.plannedCutover ?? "";
    this.reputationInheritance = opts?.reputationInheritance ?? new ReputationInheritance();
    this.counterpartyNotifications = opts?.counterpartyNotifications ?? [];
    this.phase = opts?.phase ?? "planned";
    this.obligationsTransferred = opts?.obligationsTransferred ?? 0;
    this.obligationsTerminated = opts?.obligationsTerminated ?? 0;
    this.knowledgeTransferComplete = opts?.knowledgeTransferComplete ?? false;
    this.verificationPassed = opts?.verificationPassed ?? false;
  }

  toDict(): SuccessionPlanData {
    return {
      predecessor_id: this.predecessorId,
      successor_id: this.successorId,
      succession_type: this.successionType,
      transition_window_days: this.transitionWindowDays,
      planned_cutover: this.plannedCutover,
      reputation_inheritance: this.reputationInheritance.toDict(),
      counterparty_notifications: this.counterpartyNotifications.map((n) =>
        n.toDict(),
      ),
      phase: this.phase,
      obligations_transferred: this.obligationsTransferred,
      obligations_terminated: this.obligationsTerminated,
      knowledge_transfer_complete: this.knowledgeTransferComplete,
      verification_passed: this.verificationPassed,
    };
  }

  static fromDict(d: Partial<SuccessionPlanData>): SuccessionPlan {
    return new SuccessionPlan({
      predecessorId: d.predecessor_id,
      successorId: d.successor_id,
      successionType: d.succession_type,
      transitionWindowDays: d.transition_window_days,
      plannedCutover: d.planned_cutover,
      reputationInheritance: ReputationInheritance.fromDict(
        d.reputation_inheritance ?? {},
      ),
      counterpartyNotifications: (d.counterparty_notifications ?? []).map(
        (n) => CounterpartyNotification.fromDict(n),
      ),
      phase: d.phase,
      obligationsTransferred: d.obligations_transferred,
      obligationsTerminated: d.obligations_terminated,
      knowledgeTransferComplete: d.knowledge_transfer_complete,
      verificationPassed: d.verification_passed,
    });
  }
}

export function announceSuccession(
  manager: LifecycleManager,
  plan: SuccessionPlan,
  initiator?: Initiator,
): SuccessionPlan {
  const predecessor = manager.store.getAgent(plan.predecessorId);
  if (predecessor === null) {
    throw new LifecycleError(`Predecessor not found: ${plan.predecessorId}`);
  }
  if (predecessor.state !== "active") {
    throw new LifecycleError(
      `Predecessor must be Active, currently: ${predecessor.state}`,
    );
  }

  const successor = manager.store.getAgent(plan.successorId);
  if (successor === null) {
    throw new LifecycleError(`Successor not found: ${plan.successorId}`);
  }

  const cutover = new Date(
    Date.now() + plan.transitionWindowDays * 86400000,
  )
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  plan.plannedCutover = cutover;
  plan.phase = "announced";

  const predScore =
    predecessor.reputationEarned + predecessor.reputationInherited;
  plan.reputationInheritance.predecessorScore = predScore;
  plan.reputationInheritance.computeInitial();

  const event = new LifecycleEvent({
    eventType: "deprecate",
    agentId: plan.predecessorId,
    agentStateBefore: "active",
    agentStateAfter: "deprecated",
    initiator: initiator ?? new Initiator(),
    details: {
      reason: `succession to ${plan.successorId}`,
      successor_id: plan.successorId,
      planned_cutover: cutover,
      succession_plan: plan.toDict(),
    },
    relatedAgents: [
      { agent_id: plan.successorId, relationship: "successor" },
    ],
  });

  manager._runPreHooks(event, predecessor);

  predecessor.state = "deprecated";
  predecessor.updatedAt = nowIso();
  predecessor.eventHistory.push(event.eventId);

  event.computeHash();
  manager.store.appendEvent(event);
  manager.store.saveAgent(predecessor);

  manager._runPostHooks(event, predecessor);

  return plan;
}

export function transferEstate(
  manager: LifecycleManager,
  plan: SuccessionPlan,
  opts?: {
    obligationsTransferred?: number;
    obligationsTerminated?: number;
    knowledgeTransferred?: boolean;
  },
): SuccessionPlan {
  if (plan.phase !== "announced") {
    throw new LifecycleError(
      `Cannot transfer estate in phase: ${plan.phase}`,
    );
  }

  const successor = manager.store.getAgent(plan.successorId);
  if (successor === null) {
    throw new LifecycleError(`Successor not found: ${plan.successorId}`);
  }

  const probUntil = new Date(
    Date.now() +
      plan.reputationInheritance.probationaryPeriodDays * 86400000,
  )
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

  successor.reputationInherited =
    plan.reputationInheritance.inheritedScore;
  successor.probationaryUntil = probUntil;
  successor.updatedAt = nowIso();
  manager.store.saveAgent(successor);

  plan.obligationsTransferred = opts?.obligationsTransferred ?? 0;
  plan.obligationsTerminated = opts?.obligationsTerminated ?? 0;
  plan.knowledgeTransferComplete = opts?.knowledgeTransferred ?? true;
  plan.phase = "transferred";

  return plan;
}

export function verifySuccession(
  manager: LifecycleManager,
  plan: SuccessionPlan,
): SuccessionPlan {
  if (plan.phase !== "transferred") {
    throw new LifecycleError(
      `Cannot verify succession in phase: ${plan.phase}`,
    );
  }

  const errors: string[] = [];

  const successor = manager.store.getAgent(plan.successorId);
  if (successor === null) {
    errors.push("Successor not found");
  } else if (
    successor.reputationInherited <= 0 &&
    plan.reputationInheritance.inheritedScore > 0
  ) {
    errors.push("Reputation inheritance not applied");
  }

  if (!plan.knowledgeTransferComplete) {
    errors.push("Knowledge transfer incomplete");
  }

  for (const notification of plan.counterpartyNotifications) {
    if (notification.consentRequired && !notification.consentReceived) {
      errors.push(
        `Counterparty ${notification.counterpartyId} consent pending`,
      );
    }
  }

  if (errors.length > 0) {
    plan.verificationPassed = false;
    throw new LifecycleError(
      `Succession verification failed: ${errors.join("; ")}`,
    );
  }

  plan.verificationPassed = true;
  plan.phase = "verified";
  return plan;
}

export function executeCutover(
  manager: LifecycleManager,
  plan: SuccessionPlan,
  initiator?: Initiator,
): SuccessionPlan {
  if (plan.phase !== "verified") {
    throw new LifecycleError(
      `Cannot execute cutover in phase: ${plan.phase}`,
    );
  }

  const predecessor = manager.store.getAgent(plan.predecessorId);
  if (predecessor === null) {
    throw new LifecycleError(
      `Predecessor not found: ${plan.predecessorId}`,
    );
  }
  if (predecessor.state !== "deprecated") {
    throw new LifecycleError(
      `Predecessor must be Deprecated for cutover, currently: ${predecessor.state}`,
    );
  }

  const successor = manager.store.getAgent(plan.successorId);
  if (successor === null) {
    throw new LifecycleError(`Successor not found: ${plan.successorId}`);
  }

  const decomEvent = new LifecycleEvent({
    eventType: "decommission",
    agentId: plan.predecessorId,
    agentStateBefore: "deprecated",
    agentStateAfter: "decommissioned",
    initiator: initiator ?? new Initiator(),
    details: {
      reason: "superseded",
      successor_id: plan.successorId,
      estate: {
        obligations_transferred: plan.obligationsTransferred,
        obligations_terminated: plan.obligationsTerminated,
        reputation: plan.reputationInheritance.toDict(),
        knowledge_transfer_complete: plan.knowledgeTransferComplete,
      },
    },
    relatedAgents: [
      { agent_id: plan.successorId, relationship: "successor" },
    ],
  });

  manager._runPreHooks(decomEvent, predecessor);

  predecessor.state = "decommissioned";
  predecessor.updatedAt = nowIso();
  predecessor.eventHistory.push(decomEvent.eventId);

  decomEvent.computeHash();
  manager.store.appendEvent(decomEvent);
  manager.store.saveAgent(predecessor);

  manager._runPostHooks(decomEvent, predecessor);

  plan.phase = "complete";
  return plan;
}

export function abortSuccession(
  manager: LifecycleManager,
  plan: SuccessionPlan,
  reason: string = "",
  initiator?: Initiator,
): SuccessionPlan {
  if (["complete", "aborted", "planned"].includes(plan.phase)) {
    throw new LifecycleError(
      `Cannot abort succession in phase: ${plan.phase}`,
    );
  }

  const predecessor = manager.store.getAgent(plan.predecessorId);
  if (predecessor === null) {
    throw new LifecycleError(
      `Predecessor not found: ${plan.predecessorId}`,
    );
  }

  if (predecessor.state === "deprecated") {
    const abortEvent = new LifecycleEvent({
      eventType: "abort_succession",
      agentId: plan.predecessorId,
      agentStateBefore: "deprecated",
      agentStateAfter: "active",
      initiator: initiator ?? new Initiator(),
      details: {
        reason,
        successor_id: plan.successorId,
        rollback_actions: [
          "obligations_rolled_back",
          "reputation_zeroed",
          "counterparties_notified",
        ],
      },
    });

    manager._runPreHooks(abortEvent, predecessor);

    predecessor.state = "active";
    predecessor.updatedAt = nowIso();
    predecessor.eventHistory.push(abortEvent.eventId);

    abortEvent.computeHash();
    manager.store.appendEvent(abortEvent);
    manager.store.saveAgent(predecessor);

    manager._runPostHooks(abortEvent, predecessor);
  }

  const successor = manager.store.getAgent(plan.successorId);
  if (successor !== null) {
    successor.reputationInherited = 0.0;
    successor.probationaryUntil = "";
    successor.updatedAt = nowIso();
    manager.store.saveAgent(successor);
  }

  plan.phase = "aborted";
  return plan;
}
