import {
  MIGRATION_TYPES,
  Initiator,
  LifecycleEvent,
  hashDict,
  nowIso,
} from "./types";
import { LifecycleError, LifecycleManager } from "./lifecycle";

export interface PlatformInfoData {
  provider: string;
  runtime: string;
  region: string;
}

export class PlatformInfo {
  provider: string;
  runtime: string;
  region: string;

  constructor(opts?: Partial<{
    provider: string;
    runtime: string;
    region: string;
  }>) {
    this.provider = opts?.provider ?? "";
    this.runtime = opts?.runtime ?? "";
    this.region = opts?.region ?? "";
  }

  toDict(): PlatformInfoData {
    return {
      provider: this.provider,
      runtime: this.runtime,
      region: this.region,
    };
  }

  static fromDict(d: Partial<PlatformInfoData>): PlatformInfo {
    return new PlatformInfo({
      provider: d.provider,
      runtime: d.runtime,
      region: d.region,
    });
  }
}

export interface MigrationPlanData {
  agent_id: string;
  source: PlatformInfoData;
  destination: PlatformInfoData;
  migration_type: string;
  state_hash_before: string;
  state_hash_after: string;
  phase: string;
}

export class MigrationPlan {
  agentId: string;
  source: PlatformInfo;
  destination: PlatformInfo;
  migrationType: string;
  stateHashBefore: string;
  stateHashAfter: string;
  phase: string;

  constructor(opts?: Partial<{
    agentId: string;
    source: PlatformInfo;
    destination: PlatformInfo;
    migrationType: string;
    stateHashBefore: string;
    stateHashAfter: string;
    phase: string;
  }>) {
    this.agentId = opts?.agentId ?? "";
    this.source = opts?.source ?? new PlatformInfo();
    this.destination = opts?.destination ?? new PlatformInfo();
    this.migrationType = opts?.migrationType ?? "cold";
    this.stateHashBefore = opts?.stateHashBefore ?? "";
    this.stateHashAfter = opts?.stateHashAfter ?? "";
    this.phase = opts?.phase ?? "planned";
  }

  toDict(): MigrationPlanData {
    return {
      agent_id: this.agentId,
      source: this.source.toDict(),
      destination: this.destination.toDict(),
      migration_type: this.migrationType,
      state_hash_before: this.stateHashBefore,
      state_hash_after: this.stateHashAfter,
      phase: this.phase,
    };
  }

  static fromDict(d: Partial<MigrationPlanData>): MigrationPlan {
    return new MigrationPlan({
      agentId: d.agent_id,
      source: PlatformInfo.fromDict(d.source ?? {}),
      destination: PlatformInfo.fromDict(d.destination ?? {}),
      migrationType: d.migration_type,
      stateHashBefore: d.state_hash_before,
      stateHashAfter: d.state_hash_after,
      phase: d.phase,
    });
  }
}

export function beginMigration(
  manager: LifecycleManager,
  plan: MigrationPlan,
  initiator?: Initiator,
): MigrationPlan {
  if (!(MIGRATION_TYPES as readonly string[]).includes(plan.migrationType)) {
    throw new LifecycleError(
      `Invalid migration type: ${plan.migrationType}`,
    );
  }

  const agent = manager.store.getAgent(plan.agentId);
  if (agent === null) {
    throw new LifecycleError(`Agent not found: ${plan.agentId}`);
  }
  if (agent.state !== "active") {
    throw new LifecycleError(
      `Agent must be Active to migrate, currently: ${agent.state}`,
    );
  }

  plan.stateHashBefore = hashDict(
    agent.toDict() as unknown as Record<string, unknown>,
  );

  const event = new LifecycleEvent({
    eventType: "begin_migration",
    agentId: plan.agentId,
    agentStateBefore: "active",
    agentStateAfter: "migrating",
    initiator: initiator ?? new Initiator(),
    details: {
      source_platform: plan.source.toDict(),
      destination_platform: plan.destination.toDict(),
      migration_type: plan.migrationType,
      state_hash_before: plan.stateHashBefore,
    },
  });

  manager._runPreHooks(event, agent);

  agent.state = "migrating";
  agent.updatedAt = nowIso();
  agent.eventHistory.push(event.eventId);

  event.computeHash();
  manager.store.appendEvent(event);
  manager.store.saveAgent(agent);

  manager._runPostHooks(event, agent);

  plan.phase = "migrating";
  return plan;
}

export function completeMigration(
  manager: LifecycleManager,
  plan: MigrationPlan,
  stateHashAfter: string = "",
  initiator?: Initiator,
): MigrationPlan {
  if (plan.phase !== "migrating") {
    throw new LifecycleError(
      `Cannot complete migration in phase: ${plan.phase}`,
    );
  }

  const agent = manager.store.getAgent(plan.agentId);
  if (agent === null) {
    throw new LifecycleError(`Agent not found: ${plan.agentId}`);
  }
  if (agent.state !== "migrating") {
    throw new LifecycleError(
      `Agent must be Migrating to complete, currently: ${agent.state}`,
    );
  }

  plan.stateHashAfter = stateHashAfter;

  let integrityVerified = true;
  if (plan.stateHashBefore && plan.stateHashAfter) {
    if (["cold", "warm"].includes(plan.migrationType)) {
      integrityVerified = plan.stateHashBefore === plan.stateHashAfter;
    }
  }

  const event = new LifecycleEvent({
    eventType: "complete_migration",
    agentId: plan.agentId,
    agentStateBefore: "migrating",
    agentStateAfter: "active",
    initiator: initiator ?? new Initiator(),
    details: {
      source_platform: plan.source.toDict(),
      destination_platform: plan.destination.toDict(),
      migration_type: plan.migrationType,
      verification: {
        state_hash_before: plan.stateHashBefore,
        state_hash_after: plan.stateHashAfter,
        integrity_verified: integrityVerified,
      },
    },
  });

  manager._runPreHooks(event, agent);

  agent.state = "active";
  agent.updatedAt = nowIso();
  agent.eventHistory.push(event.eventId);

  event.computeHash();
  manager.store.appendEvent(event);
  manager.store.saveAgent(agent);

  manager._runPostHooks(event, agent);

  plan.phase = "complete";
  return plan;
}

export function abortMigration(
  manager: LifecycleManager,
  plan: MigrationPlan,
  reason: string = "",
  initiator?: Initiator,
): MigrationPlan {
  if (plan.phase !== "migrating") {
    throw new LifecycleError(
      `Cannot abort migration in phase: ${plan.phase}`,
    );
  }

  const agent = manager.store.getAgent(plan.agentId);
  if (agent === null) {
    throw new LifecycleError(`Agent not found: ${plan.agentId}`);
  }
  if (agent.state !== "migrating") {
    throw new LifecycleError(
      `Agent must be Migrating to abort, currently: ${agent.state}`,
    );
  }

  const event = new LifecycleEvent({
    eventType: "abort_migration",
    agentId: plan.agentId,
    agentStateBefore: "migrating",
    agentStateAfter: "active",
    initiator: initiator ?? new Initiator(),
    details: {
      abort_reason: reason,
      rollback_to_source: plan.source.toDict(),
    },
  });

  manager._runPreHooks(event, agent);

  agent.state = "active";
  agent.updatedAt = nowIso();
  agent.eventHistory.push(event.eventId);

  event.computeHash();
  manager.store.appendEvent(event);
  manager.store.saveAgent(agent);

  manager._runPostHooks(event, agent);

  plan.phase = "aborted";
  return plan;
}
