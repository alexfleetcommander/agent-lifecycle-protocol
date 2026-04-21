import {
  Initiator,
  LifecycleEvent,
  nowIso,
} from "./types";
import { LifecycleError, LifecycleManager } from "./lifecycle";

export interface CredentialRevocationData {
  all_api_keys_revoked: boolean;
  all_oauth_tokens_invalidated: boolean;
  all_service_accounts_deleted: boolean;
  all_trust_relationships_terminated: boolean;
  all_certificates_revoked: boolean;
  identity_key_archived: boolean;
}

export class CredentialRevocation {
  apiKeysRevoked: boolean;
  oauthTokensInvalidated: boolean;
  serviceAccountsDeleted: boolean;
  trustRelationshipsTerminated: boolean;
  certificatesRevoked: boolean;
  identityKeyArchived: boolean;

  constructor(opts?: Partial<{
    apiKeysRevoked: boolean;
    oauthTokensInvalidated: boolean;
    serviceAccountsDeleted: boolean;
    trustRelationshipsTerminated: boolean;
    certificatesRevoked: boolean;
    identityKeyArchived: boolean;
  }>) {
    this.apiKeysRevoked = opts?.apiKeysRevoked ?? false;
    this.oauthTokensInvalidated = opts?.oauthTokensInvalidated ?? false;
    this.serviceAccountsDeleted = opts?.serviceAccountsDeleted ?? false;
    this.trustRelationshipsTerminated = opts?.trustRelationshipsTerminated ?? false;
    this.certificatesRevoked = opts?.certificatesRevoked ?? false;
    this.identityKeyArchived = opts?.identityKeyArchived ?? false;
  }

  get allRevoked(): boolean {
    return (
      this.apiKeysRevoked &&
      this.oauthTokensInvalidated &&
      this.serviceAccountsDeleted &&
      this.trustRelationshipsTerminated &&
      this.certificatesRevoked &&
      this.identityKeyArchived
    );
  }

  toDict(): CredentialRevocationData {
    return {
      all_api_keys_revoked: this.apiKeysRevoked,
      all_oauth_tokens_invalidated: this.oauthTokensInvalidated,
      all_service_accounts_deleted: this.serviceAccountsDeleted,
      all_trust_relationships_terminated: this.trustRelationshipsTerminated,
      all_certificates_revoked: this.certificatesRevoked,
      identity_key_archived: this.identityKeyArchived,
    };
  }

  static fromDict(d: Partial<CredentialRevocationData>): CredentialRevocation {
    return new CredentialRevocation({
      apiKeysRevoked: d.all_api_keys_revoked,
      oauthTokensInvalidated: d.all_oauth_tokens_invalidated,
      serviceAccountsDeleted: d.all_service_accounts_deleted,
      trustRelationshipsTerminated: d.all_trust_relationships_terminated,
      certificatesRevoked: d.all_certificates_revoked,
      identityKeyArchived: d.identity_key_archived,
    });
  }
}

export interface DataDispositionData {
  operational_logs: string;
  memory_state: string;
  coc_chain: string;
  knowledge_artifacts: string;
}

export class DataDisposition {
  operationalLogs: string;
  memoryState: string;
  cocChain: string;
  knowledgeArtifacts: string;

  constructor(opts?: Partial<{
    operationalLogs: string;
    memoryState: string;
    cocChain: string;
    knowledgeArtifacts: string;
  }>) {
    this.operationalLogs = opts?.operationalLogs ?? "archived_90_days";
    this.memoryState = opts?.memoryState ?? "purged";
    this.cocChain = opts?.cocChain ?? "sealed_permanent";
    this.knowledgeArtifacts = opts?.knowledgeArtifacts ?? "transferred_to_fleet";
  }

  toDict(): DataDispositionData {
    return {
      operational_logs: this.operationalLogs,
      memory_state: this.memoryState,
      coc_chain: this.cocChain,
      knowledge_artifacts: this.knowledgeArtifacts,
    };
  }

  static fromDict(d: Partial<DataDispositionData>): DataDisposition {
    return new DataDisposition({
      operationalLogs: d.operational_logs,
      memoryState: d.memory_state,
      cocChain: d.coc_chain,
      knowledgeArtifacts: d.knowledge_artifacts,
    });
  }
}

export interface EstateDispositionData {
  obligations: { transferred: number; terminated: number };
  credentials: CredentialRevocationData;
  data: DataDispositionData;
  notifications: {
    counterparties_notified: boolean;
    fleet_coordinator_notified: boolean;
  };
}

export class EstateDisposition {
  obligationsTransferred: number;
  obligationsTerminated: number;
  credentials: CredentialRevocation;
  data: DataDisposition;
  counterpartiesNotified: boolean;
  fleetCoordinatorNotified: boolean;

  constructor(opts?: Partial<{
    obligationsTransferred: number;
    obligationsTerminated: number;
    credentials: CredentialRevocation;
    data: DataDisposition;
    counterpartiesNotified: boolean;
    fleetCoordinatorNotified: boolean;
  }>) {
    this.obligationsTransferred = opts?.obligationsTransferred ?? 0;
    this.obligationsTerminated = opts?.obligationsTerminated ?? 0;
    this.credentials = opts?.credentials ?? new CredentialRevocation();
    this.data = opts?.data ?? new DataDisposition();
    this.counterpartiesNotified = opts?.counterpartiesNotified ?? false;
    this.fleetCoordinatorNotified = opts?.fleetCoordinatorNotified ?? false;
  }

  toDict(): EstateDispositionData {
    return {
      obligations: {
        transferred: this.obligationsTransferred,
        terminated: this.obligationsTerminated,
      },
      credentials: this.credentials.toDict(),
      data: this.data.toDict(),
      notifications: {
        counterparties_notified: this.counterpartiesNotified,
        fleet_coordinator_notified: this.fleetCoordinatorNotified,
      },
    };
  }

  static fromDict(d: Partial<EstateDispositionData>): EstateDisposition {
    const obligations = d.obligations ?? {};
    const notif = d.notifications ?? {};
    return new EstateDisposition({
      obligationsTransferred: (obligations as Record<string, number>).transferred,
      obligationsTerminated: (obligations as Record<string, number>).terminated,
      credentials: CredentialRevocation.fromDict(d.credentials ?? {}),
      data: DataDisposition.fromDict(d.data ?? {}),
      counterpartiesNotified: (notif as Record<string, boolean>).counterparties_notified,
      fleetCoordinatorNotified: (notif as Record<string, boolean>).fleet_coordinator_notified,
    });
  }
}

export interface DecommissionPlanData {
  agent_id: string;
  reason: string;
  successor_id: string | null;
  estate: EstateDispositionData;
  emergency: boolean;
  phase: string;
}

export class DecommissionPlan {
  agentId: string;
  reason: string;
  successorId: string | null;
  estate: EstateDisposition;
  emergency: boolean;
  phase: string;

  constructor(opts?: Partial<{
    agentId: string;
    reason: string;
    successorId: string | null;
    estate: EstateDisposition;
    emergency: boolean;
    phase: string;
  }>) {
    this.agentId = opts?.agentId ?? "";
    this.reason = opts?.reason ?? "end_of_life";
    this.successorId = opts?.successorId ?? null;
    this.estate = opts?.estate ?? new EstateDisposition();
    this.emergency = opts?.emergency ?? false;
    this.phase = opts?.phase ?? "planned";
  }

  toDict(): DecommissionPlanData {
    return {
      agent_id: this.agentId,
      reason: this.reason,
      successor_id: this.successorId,
      estate: this.estate.toDict(),
      emergency: this.emergency,
      phase: this.phase,
    };
  }

  static fromDict(d: Partial<DecommissionPlanData>): DecommissionPlan {
    return new DecommissionPlan({
      agentId: d.agent_id,
      reason: d.reason,
      successorId: d.successor_id,
      estate: EstateDisposition.fromDict(d.estate ?? {}),
      emergency: d.emergency,
      phase: d.phase,
    });
  }
}

export function gracefulDecommission(
  manager: LifecycleManager,
  plan: DecommissionPlan,
  initiator?: Initiator,
): DecommissionPlan {
  const agent = manager.store.getAgent(plan.agentId);
  if (agent === null) {
    throw new LifecycleError(`Agent not found: ${plan.agentId}`);
  }
  if (agent.state !== "deprecated") {
    throw new LifecycleError(
      `Graceful decommission requires Deprecated state, ` +
        `currently: ${agent.state}. Deprecate the agent first.`,
    );
  }

  plan.phase = "in_progress";

  const event = new LifecycleEvent({
    eventType: "decommission",
    agentId: plan.agentId,
    agentStateBefore: "deprecated",
    agentStateAfter: "decommissioned",
    initiator: initiator ?? new Initiator(),
    details: {
      reason: plan.reason,
      successor_id: plan.successorId,
      estate_disposition: plan.estate.toDict(),
      decommission_type: "graceful_apoptosis",
    },
  });

  manager._runPreHooks(event, agent);

  agent.state = "decommissioned";
  agent.updatedAt = nowIso();
  agent.eventHistory.push(event.eventId);

  event.computeHash();
  manager.store.appendEvent(event);
  manager.store.saveAgent(agent);

  manager._runPostHooks(event, agent);

  plan.phase = "complete";
  return plan;
}

export function emergencyDecommission(
  manager: LifecycleManager,
  plan: DecommissionPlan,
  initiator?: Initiator,
): DecommissionPlan {
  plan.emergency = true;
  plan.phase = "in_progress";

  manager.emergencyDecommission(
    plan.agentId,
    plan.reason,
    initiator,
  );

  plan.phase = "complete";
  return plan;
}

export function validateDecommissionChecklist(
  plan: DecommissionPlan,
): string[] {
  const issues: string[] = [];

  if (!plan.estate.counterpartiesNotified) {
    issues.push("Counterparties not yet notified");
  }

  const cred = plan.estate.credentials;
  if (!cred.apiKeysRevoked) issues.push("API keys not revoked");
  if (!cred.oauthTokensInvalidated)
    issues.push("OAuth tokens not invalidated");
  if (!cred.serviceAccountsDeleted)
    issues.push("Service accounts not deleted");
  if (!cred.trustRelationshipsTerminated)
    issues.push("Trust relationships not terminated");
  if (!cred.certificatesRevoked) issues.push("Certificates not revoked");
  if (!cred.identityKeyArchived) issues.push("Identity key not archived");

  if (!plan.estate.fleetCoordinatorNotified) {
    issues.push("Fleet coordinator not notified");
  }

  return issues;
}
