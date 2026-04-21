import {
  DEFAULT_FORK_ALPHA,
  DEFAULT_FORK_DECAY_HALF_LIFE_DAYS,
  DEFAULT_PROBATIONARY_PERIOD_DAYS,
  FORK_TYPES,
  ReputationInheritanceData,
  AgentRecord,
  EpigeneticProfile,
  GeneticProfile,
  Initiator,
  LifecycleEvent,
  ReputationInheritance,
  nowIso,
} from "./types";
import { LifecycleError, LifecycleManager } from "./lifecycle";

export interface InheritanceConfigData {
  genetic: {
    model_inherited: boolean;
    model_modified: boolean;
  };
  epigenetic: {
    memory_inherited: boolean;
    memory_scope: string;
    configuration_inherited: boolean;
    configuration_modifications: string[];
    reputation_inheritance_factor: number;
  };
}

export class InheritanceConfig {
  geneticInherited: boolean;
  geneticModified: boolean;
  memoryInherited: boolean;
  memoryScope: string;
  configurationInherited: boolean;
  configurationModifications: string[];
  reputationFactor: number;
  decayHalfLifeDays: number;
  probationaryPeriodDays: number;

  constructor(opts?: Partial<{
    geneticInherited: boolean;
    geneticModified: boolean;
    memoryInherited: boolean;
    memoryScope: string;
    configurationInherited: boolean;
    configurationModifications: string[];
    reputationFactor: number;
    decayHalfLifeDays: number;
    probationaryPeriodDays: number;
  }>) {
    this.geneticInherited = opts?.geneticInherited ?? true;
    this.geneticModified = opts?.geneticModified ?? false;
    this.memoryInherited = opts?.memoryInherited ?? true;
    this.memoryScope = opts?.memoryScope ?? "filtered";
    this.configurationInherited = opts?.configurationInherited ?? true;
    this.configurationModifications = opts?.configurationModifications ?? [];
    this.reputationFactor = opts?.reputationFactor ?? DEFAULT_FORK_ALPHA;
    this.decayHalfLifeDays = opts?.decayHalfLifeDays ?? DEFAULT_FORK_DECAY_HALF_LIFE_DAYS;
    this.probationaryPeriodDays = opts?.probationaryPeriodDays ?? DEFAULT_PROBATIONARY_PERIOD_DAYS;
  }

  toDict(): InheritanceConfigData {
    return {
      genetic: {
        model_inherited: this.geneticInherited,
        model_modified: this.geneticModified,
      },
      epigenetic: {
        memory_inherited: this.memoryInherited,
        memory_scope: this.memoryScope,
        configuration_inherited: this.configurationInherited,
        configuration_modifications: [...this.configurationModifications],
        reputation_inheritance_factor: this.reputationFactor,
      },
    };
  }

  static fromDict(d: Partial<InheritanceConfigData>): InheritanceConfig {
    const gen = d.genetic ?? {};
    const epi = d.epigenetic ?? {};
    return new InheritanceConfig({
      geneticInherited: (gen as Record<string, unknown>).model_inherited as boolean | undefined,
      geneticModified: (gen as Record<string, unknown>).model_modified as boolean | undefined,
      memoryInherited: (epi as Record<string, unknown>).memory_inherited as boolean | undefined,
      memoryScope: (epi as Record<string, unknown>).memory_scope as string | undefined,
      configurationInherited: (epi as Record<string, unknown>).configuration_inherited as boolean | undefined,
      configurationModifications: (epi as Record<string, unknown>).configuration_modifications as string[] | undefined,
      reputationFactor: (epi as Record<string, unknown>).reputation_inheritance_factor as number | undefined,
    });
  }
}

export interface ForkRecordData {
  parent_id: string;
  child_id: string;
  fork_type: string;
  fork_timestamp: string;
  inheritance: InheritanceConfigData;
  divergence_declaration: Record<string, unknown>;
  reputation_inheritance?: ReputationInheritanceData;
}

export class ForkRecord {
  parentId: string;
  childId: string;
  forkType: string;
  forkTimestamp: string;
  inheritance: InheritanceConfig;
  divergenceDeclaration: Record<string, unknown>;
  reputationInheritance: ReputationInheritance | null;

  constructor(opts?: Partial<{
    parentId: string;
    childId: string;
    forkType: string;
    forkTimestamp: string;
    inheritance: InheritanceConfig;
    divergenceDeclaration: Record<string, unknown>;
    reputationInheritance: ReputationInheritance | null;
  }>) {
    this.parentId = opts?.parentId ?? "";
    this.childId = opts?.childId ?? "";
    this.forkType = opts?.forkType ?? "specialization";
    this.forkTimestamp = opts?.forkTimestamp ?? nowIso();
    this.inheritance = opts?.inheritance ?? new InheritanceConfig();
    this.divergenceDeclaration = opts?.divergenceDeclaration ?? {};
    this.reputationInheritance = opts?.reputationInheritance ?? null;
  }

  toDict(): ForkRecordData {
    const d: ForkRecordData = {
      parent_id: this.parentId,
      child_id: this.childId,
      fork_type: this.forkType,
      fork_timestamp: this.forkTimestamp,
      inheritance: this.inheritance.toDict(),
      divergence_declaration: this.divergenceDeclaration,
    };
    if (this.reputationInheritance) {
      d.reputation_inheritance = this.reputationInheritance.toDict();
    }
    return d;
  }

  static fromDict(d: Partial<ForkRecordData>): ForkRecord {
    let rep: ReputationInheritance | null = null;
    if (d.reputation_inheritance) {
      rep = ReputationInheritance.fromDict(
        d.reputation_inheritance as unknown as Record<string, unknown>,
      );
    }
    return new ForkRecord({
      parentId: d.parent_id,
      childId: d.child_id,
      forkType: d.fork_type,
      forkTimestamp: d.fork_timestamp,
      inheritance: InheritanceConfig.fromDict(d.inheritance ?? {}),
      divergenceDeclaration: d.divergence_declaration as Record<string, unknown>,
      reputationInheritance: rep,
    });
  }
}

export function forkAgent(
  manager: LifecycleManager,
  parentId: string,
  childId: string,
  opts?: {
    forkType?: string;
    inheritance?: InheritanceConfig;
    childGenetic?: GeneticProfile;
    childEpigenetic?: EpigeneticProfile;
    divergenceDeclaration?: Record<string, unknown>;
    initiator?: Initiator;
  },
): ForkRecord {
  const forkType = opts?.forkType ?? "specialization";
  if (!(FORK_TYPES as readonly string[]).includes(forkType)) {
    throw new LifecycleError(`Invalid fork type: ${forkType}`);
  }

  const parent = manager.store.getAgent(parentId);
  if (parent === null) {
    throw new LifecycleError(`Parent agent not found: ${parentId}`);
  }
  if (parent.state !== "active") {
    throw new LifecycleError(
      `Parent must be Active to fork, currently: ${parent.state}`,
    );
  }

  const existingChild = manager.store.getAgent(childId);
  if (existingChild !== null) {
    throw new LifecycleError(`Child agent already exists: ${childId}`);
  }

  const inh = opts?.inheritance ?? new InheritanceConfig();

  const rep = new ReputationInheritance({
    predecessorScore: parent.reputationEarned + parent.reputationInherited,
    alpha: inh.reputationFactor,
    decayHalfLifeDays: inh.decayHalfLifeDays,
    probationaryPeriodDays: inh.probationaryPeriodDays,
  });
  rep.computeInitial();

  let gen: GeneticProfile;
  if (opts?.childGenetic) {
    gen = opts.childGenetic;
  } else if (inh.geneticInherited) {
    gen = GeneticProfile.fromDict(parent.geneticProfile.toDict());
  } else {
    gen = new GeneticProfile();
  }

  let epi: EpigeneticProfile;
  if (opts?.childEpigenetic) {
    epi = opts.childEpigenetic;
  } else if (inh.configurationInherited) {
    epi = EpigeneticProfile.fromDict(parent.epigeneticProfile.toDict());
  } else {
    epi = new EpigeneticProfile();
  }

  const now = nowIso();
  const probUntil = new Date(
    Date.now() + inh.probationaryPeriodDays * 86400000,
  )
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

  const child = new AgentRecord({
    agentId: childId,
    state: "provisioning",
    geneticProfile: gen,
    epigeneticProfile: epi,
    parentId,
    cocChainId: `coc-${childId}`,
    generation: parent.generation + 1,
    reputationInherited: rep.inheritedScore,
    probationaryUntil: probUntil,
  });

  const forkRecord = new ForkRecord({
    parentId,
    childId,
    forkType,
    forkTimestamp: now,
    inheritance: inh,
    divergenceDeclaration: opts?.divergenceDeclaration ?? {},
    reputationInheritance: rep,
  });

  const forkEvent = new LifecycleEvent({
    eventType: "fork",
    agentId: parentId,
    agentStateBefore: "active",
    agentStateAfter: "active",
    initiator: opts?.initiator ?? new Initiator(),
    details: forkRecord.toDict() as unknown as Record<string, unknown>,
    relatedAgents: [{ agent_id: childId, relationship: "child" }],
  });

  manager._runPreHooks(forkEvent, parent);

  parent.children.push(childId);
  parent.updatedAt = now;
  parent.eventHistory.push(forkEvent.eventId);

  forkEvent.computeHash();
  manager.store.appendEvent(forkEvent);
  manager.store.saveAgent(parent);

  child.eventHistory.push(forkEvent.eventId);
  manager.store.saveAgent(child);

  manager._runPostHooks(forkEvent, parent);

  return forkRecord;
}
