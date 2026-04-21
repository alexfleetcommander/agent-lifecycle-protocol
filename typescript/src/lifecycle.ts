import {
  TERMINAL_STATES,
  AgentRecord,
  EpigeneticProfile,
  GeneticProfile,
  Initiator,
  LifecycleEvent,
  nowIso,
} from "./types";
import { LifecycleStore } from "./store";

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleError";
  }
}

export interface HookResult {
  success: boolean;
  error: string;
  data: Record<string, unknown>;
}

export type HookCallback = (
  event: LifecycleEvent,
  agent: AgentRecord,
) => HookResult;

const _TRANSITIONS: Record<
  string,
  Record<string, string[]>
> = {
  __none__: {
    provisioning: ["genesis"],
  },
  provisioning: {
    active: ["activate"],
    failed: ["fail"],
  },
  active: {
    suspended: ["suspend"],
    migrating: ["begin_migration"],
    deprecated: ["deprecate"],
    active: ["retraining", "fork"],
    decommissioned: ["emergency_decommission"],
  },
  suspended: {
    active: ["resume"],
    decommissioned: ["emergency_decommission"],
  },
  migrating: {
    active: ["complete_migration", "abort_migration"],
    decommissioned: ["emergency_decommission"],
  },
  deprecated: {
    decommissioned: ["decommission"],
    active: ["abort_succession"],
  },
};

export class LifecycleManager {
  readonly store: LifecycleStore;
  _preHooks: Record<string, HookCallback[]> = {};
  _postHooks: Record<string, HookCallback[]> = {};

  constructor(opts?: { store?: LifecycleStore; storeDir?: string }) {
    this.store = opts?.store ?? new LifecycleStore(opts?.storeDir ?? ".alp");
  }

  registerPreHook(eventType: string, hook: HookCallback): void {
    if (!this._preHooks[eventType]) this._preHooks[eventType] = [];
    this._preHooks[eventType].push(hook);
  }

  registerPostHook(eventType: string, hook: HookCallback): void {
    if (!this._postHooks[eventType]) this._postHooks[eventType] = [];
    this._postHooks[eventType].push(hook);
  }

  _runPreHooks(event: LifecycleEvent, agent: AgentRecord): void {
    for (const hook of this._preHooks[event.eventType] ?? []) {
      const result = hook(event, agent);
      if (!result.success) {
        throw new LifecycleError(
          `PreTransition hook failed for ${event.eventType}: ${result.error}`,
        );
      }
    }
  }

  _runPostHooks(event: LifecycleEvent, agent: AgentRecord): void {
    for (const hook of this._postHooks[event.eventType] ?? []) {
      hook(event, agent);
    }
  }

  validateTransition(
    fromState: string | null,
    toState: string,
    eventType: string,
  ): void {
    const key = fromState ?? "__none__";
    const allowed = _TRANSITIONS[key] ?? {};
    if (!(toState in allowed)) {
      throw new LifecycleError(
        `Invalid transition: ${fromState} -> ${toState}`,
      );
    }
    if (!allowed[toState].includes(eventType)) {
      throw new LifecycleError(
        `Event type '${eventType}' not allowed for ${fromState} -> ${toState}`,
      );
    }
  }

  private applyTransition(
    agent: AgentRecord,
    eventType: string,
    toState: string,
    initiator?: Initiator,
    details?: Record<string, unknown>,
  ): LifecycleEvent {
    const fromState = agent.state;
    this.validateTransition(fromState, toState, eventType);

    const event = new LifecycleEvent({
      eventType,
      agentId: agent.agentId,
      agentStateBefore: fromState,
      agentStateAfter: toState,
      initiator: initiator ?? new Initiator(),
      details: details ?? {},
    });

    this._runPreHooks(event, agent);

    agent.state = toState;
    agent.updatedAt = nowIso();
    agent.eventHistory.push(event.eventId);

    event.computeHash();
    this.store.appendEvent(event);
    this.store.saveAgent(agent);

    this._runPostHooks(event, agent);

    return event;
  }

  genesis(opts: {
    agentId: string;
    geneticProfile?: GeneticProfile;
    epigeneticProfile?: EpigeneticProfile;
    creatorId?: string;
    creationMethod?: string;
    cocChainId?: string;
  }): AgentRecord {
    const existing = this.store.getAgent(opts.agentId);
    if (existing !== null) {
      throw new LifecycleError(`Agent already exists: ${opts.agentId}`);
    }

    const agent = new AgentRecord({
      agentId: opts.agentId,
      state: "provisioning",
      geneticProfile: opts.geneticProfile ?? new GeneticProfile(),
      epigeneticProfile: opts.epigeneticProfile ?? new EpigeneticProfile(),
      cocChainId: opts.cocChainId ?? `coc-${opts.agentId}`,
    });

    const details: Record<string, unknown> = {
      creation_method: opts.creationMethod ?? "manual",
      genetic_profile: agent.geneticProfile.toDict(),
      epigenetic_profile: agent.epigeneticProfile.toDict(),
      identity: {
        agent_id: opts.agentId,
        coc_chain_id: agent.cocChainId,
      },
      authorization: {
        creator_id: opts.creatorId ?? "",
      },
    };

    const event = new LifecycleEvent({
      eventType: "genesis",
      agentId: opts.agentId,
      agentStateBefore: null,
      agentStateAfter: "provisioning",
      initiator: new Initiator({ type: "human", id: opts.creatorId ?? "" }),
      details,
    });

    this._runPreHooks(event, agent);

    agent.eventHistory.push(event.eventId);
    event.computeHash();
    this.store.appendEvent(event);
    this.store.saveAgent(agent);

    this._runPostHooks(event, agent);

    return agent;
  }

  activate(agentId: string, initiator?: Initiator): AgentRecord {
    const agent = this.getAgentOrThrow(agentId);
    this.applyTransition(agent, "activate", "active", initiator);
    return agent;
  }

  suspend(
    agentId: string,
    reason: string = "",
    initiator?: Initiator,
  ): AgentRecord {
    const agent = this.getAgentOrThrow(agentId);
    this.applyTransition(agent, "suspend", "suspended", initiator, {
      reason,
    });
    return agent;
  }

  resume(agentId: string, initiator?: Initiator): AgentRecord {
    const agent = this.getAgentOrThrow(agentId);
    this.applyTransition(agent, "resume", "active", initiator);
    return agent;
  }

  deprecate(
    agentId: string,
    reason: string = "",
    successorId: string = "",
    initiator?: Initiator,
  ): AgentRecord {
    const agent = this.getAgentOrThrow(agentId);
    this.applyTransition(agent, "deprecate", "deprecated", initiator, {
      reason,
      successor_id: successorId,
    });
    return agent;
  }

  decommission(
    agentId: string,
    reason: string = "end_of_life",
    estateDisposition?: Record<string, unknown>,
    initiator?: Initiator,
  ): AgentRecord {
    const agent = this.getAgentOrThrow(agentId);
    this.applyTransition(agent, "decommission", "decommissioned", initiator, {
      reason,
      estate_disposition: estateDisposition ?? {},
    });
    return agent;
  }

  emergencyDecommission(
    agentId: string,
    reason: string = "compromised",
    initiator?: Initiator,
  ): AgentRecord {
    const agent = this.getAgentOrThrow(agentId);
    if ((TERMINAL_STATES as readonly string[]).includes(agent.state)) {
      throw new LifecycleError(
        `Cannot emergency-decommission agent in terminal state: ${agent.state}`,
      );
    }

    const event = new LifecycleEvent({
      eventType: "emergency_decommission",
      agentId,
      agentStateBefore: agent.state,
      agentStateAfter: "decommissioned",
      initiator: initiator ?? new Initiator(),
      details: { reason, emergency: true },
    });

    this._runPreHooks(event, agent);

    agent.state = "decommissioned";
    agent.updatedAt = nowIso();
    agent.eventHistory.push(event.eventId);

    event.computeHash();
    this.store.appendEvent(event);
    this.store.saveAgent(agent);

    this._runPostHooks(event, agent);

    return agent;
  }

  fail(
    agentId: string,
    error: string = "",
    initiator?: Initiator,
  ): AgentRecord {
    const agent = this.getAgentOrThrow(agentId);
    this.applyTransition(agent, "fail", "failed", initiator, { error });
    return agent;
  }

  getAgent(agentId: string): AgentRecord | null {
    return this.store.getAgent(agentId);
  }

  getAgentOrThrow(agentId: string): AgentRecord {
    const agent = this.store.getAgent(agentId);
    if (agent === null) {
      throw new LifecycleError(`Agent not found: ${agentId}`);
    }
    return agent;
  }
}
