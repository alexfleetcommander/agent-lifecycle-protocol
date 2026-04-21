import { createHash } from "node:crypto";
import {
  REDACTION_LEVELS,
  AgentRecord,
} from "./types";
import { LifecycleStore } from "./store";

export interface RegistryEntryData {
  agent_id: string;
  parent_id: string | null;
  children: string[];
  siblings: string[];
  generation: number;
  fork_type: string;
  genesis_timestamp: string;
  lifecycle_status: string;
  genetic_profile: Record<string, unknown>;
  epigenetic_profile: Record<string, unknown>;
  redaction_level: string;
  last_updated: string;
}

export class RegistryEntry {
  agentId: string;
  parentId: string | null;
  children: string[];
  siblings: string[];
  generation: number;
  forkType: string;
  genesisTimestamp: string;
  lifecycleStatus: string;
  geneticProfile: Record<string, unknown>;
  epigeneticProfile: Record<string, unknown>;
  redactionLevel: string;
  lastUpdated: string;

  constructor(opts?: Partial<{
    agentId: string;
    parentId: string | null;
    children: string[];
    siblings: string[];
    generation: number;
    forkType: string;
    genesisTimestamp: string;
    lifecycleStatus: string;
    geneticProfile: Record<string, unknown>;
    epigeneticProfile: Record<string, unknown>;
    redactionLevel: string;
    lastUpdated: string;
  }>) {
    this.agentId = opts?.agentId ?? "";
    this.parentId = opts?.parentId ?? null;
    this.children = opts?.children ?? [];
    this.siblings = opts?.siblings ?? [];
    this.generation = opts?.generation ?? 1;
    this.forkType = opts?.forkType ?? "";
    this.genesisTimestamp = opts?.genesisTimestamp ?? "";
    this.lifecycleStatus = opts?.lifecycleStatus ?? "provisioning";
    this.geneticProfile = opts?.geneticProfile ?? {};
    this.epigeneticProfile = opts?.epigeneticProfile ?? {};
    this.redactionLevel = opts?.redactionLevel ?? "none";
    this.lastUpdated = opts?.lastUpdated ?? "";
  }

  toDict(): RegistryEntryData {
    return {
      agent_id: this.agentId,
      parent_id: this.parentId,
      children: [...this.children],
      siblings: [...this.siblings],
      generation: this.generation,
      fork_type: this.forkType,
      genesis_timestamp: this.genesisTimestamp,
      lifecycle_status: this.lifecycleStatus,
      genetic_profile: { ...this.geneticProfile },
      epigenetic_profile: { ...this.epigeneticProfile },
      redaction_level: this.redactionLevel,
      last_updated: this.lastUpdated,
    };
  }

  static fromAgent(agent: AgentRecord): RegistryEntry {
    return new RegistryEntry({
      agentId: agent.agentId,
      parentId: agent.parentId,
      children: [...agent.children],
      generation: agent.generation,
      lifecycleStatus: agent.state,
      geneticProfile: { ...agent.geneticProfile.toDict() },
      epigeneticProfile: { ...agent.epigeneticProfile.toDict() },
      redactionLevel: agent.redactionLevel,
      lastUpdated: agent.updatedAt,
      genesisTimestamp: agent.createdAt,
    });
  }
}

function pseudonymousHash(agentId: string): string {
  return (
    "anon:" +
    createHash("sha256").update(agentId, "utf-8").digest("hex").slice(0, 16)
  );
}

export class LineageRegistry {
  readonly store: LifecycleStore;

  constructor(store: LifecycleStore) {
    this.store = store;
  }

  private buildIndex(): Map<string, AgentRecord> {
    const latest = new Map<string, AgentRecord>();
    for (const a of this.store.getAllAgents()) {
      latest.set(a.agentId, a);
    }
    return latest;
  }

  getEntry(
    agentId: string,
    accessLevel: string = "public",
  ): RegistryEntry | null {
    const index = this.buildIndex();
    const agent = index.get(agentId);
    if (!agent) return null;

    let entry = RegistryEntry.fromAgent(agent);

    if (agent.parentId && index.has(agent.parentId)) {
      const parent = index.get(agent.parentId)!;
      entry.siblings = parent.children.filter((c) => c !== agentId);
    }

    entry = this.applyRedaction(entry);
    entry = this.applyAccessFilter(entry, accessLevel);

    return entry;
  }

  ancestors(agentId: string, maxDepth: number = 100): string[] {
    const index = this.buildIndex();
    const chain: string[] = [];
    let current = agentId;
    let depth = 0;
    while (depth < maxDepth) {
      const agent = index.get(current);
      if (!agent || !agent.parentId) break;
      chain.push(agent.parentId);
      current = agent.parentId;
      depth++;
    }
    return chain;
  }

  descendants(agentId: string, maxDepth: number = 100): string[] {
    const index = this.buildIndex();
    const result: string[] = [];
    let queue = [agentId];
    const visited = new Set([agentId]);
    let depth = 0;

    while (queue.length > 0 && depth < maxDepth) {
      const nextQueue: string[] = [];
      for (const aid of queue) {
        const agent = index.get(aid);
        if (!agent) continue;
        for (const child of agent.children) {
          if (!visited.has(child)) {
            visited.add(child);
            result.push(child);
            nextQueue.push(child);
          }
        }
      }
      queue = nextQueue;
      depth++;
    }

    return result;
  }

  siblings(agentId: string): string[] {
    const index = this.buildIndex();
    const agent = index.get(agentId);
    if (!agent || !agent.parentId) return [];

    const parent = index.get(agent.parentId);
    if (!parent) return [];

    return parent.children.filter((c) => c !== agentId);
  }

  familyTree(
    agentId: string,
    maxDepth: number = 100,
  ): Record<string, unknown> {
    const index = this.buildIndex();

    const buildNode = (
      aid: string,
      depth: number,
    ): Record<string, unknown> => {
      const agent = index.get(aid);
      if (!agent) {
        return { agent_id: aid, status: "unknown", children: [] };
      }
      const node: Record<string, unknown> = {
        agent_id: aid,
        state: agent.state,
        generation: agent.generation,
        children: [] as Record<string, unknown>[],
      };
      if (depth < maxDepth) {
        (node.children as Record<string, unknown>[]) = agent.children.map(
          (childId) => buildNode(childId, depth + 1),
        );
      }
      return node;
    };

    let root = agentId;
    while (true) {
      const agent = index.get(root);
      if (!agent || !agent.parentId) break;
      root = agent.parentId;
    }

    return buildNode(root, 0);
  }

  geneticMatch(
    modelFamily: string = "",
    architecture: string = "",
  ): string[] {
    const index = this.buildIndex();
    const results: string[] = [];
    for (const agent of index.values()) {
      if (modelFamily && agent.geneticProfile.modelFamily !== modelFamily)
        continue;
      if (architecture && agent.geneticProfile.architecture !== architecture)
        continue;
      results.push(agent.agentId);
    }
    return results;
  }

  epigeneticMatch(
    role: string = "",
    specialization: string = "",
  ): string[] {
    const index = this.buildIndex();
    const results: string[] = [];
    for (const agent of index.values()) {
      if (role && agent.epigeneticProfile.role !== role) continue;
      if (
        specialization &&
        agent.epigeneticProfile.specialization !== specialization
      )
        continue;
      results.push(agent.agentId);
    }
    return results;
  }

  redactEntry(
    agentId: string,
    level: string = "partial",
  ): AgentRecord | null {
    if (!(REDACTION_LEVELS as readonly string[]).includes(level)) {
      throw new Error(`Invalid redaction level: ${level}`);
    }

    const agent = this.store.getAgent(agentId);
    if (agent === null) return null;
    if (agent.state !== "decommissioned") {
      throw new Error("Only decommissioned agents can be redacted");
    }

    agent.redactionLevel = level;
    this.store.saveAgent(agent);
    return agent;
  }

  private applyRedaction(entry: RegistryEntry): RegistryEntry {
    if (entry.redactionLevel === "none") return entry;

    if (entry.redactionLevel === "partial") {
      entry.epigeneticProfile = {};
      return entry;
    }

    if (entry.redactionLevel === "full") {
      const originalId = entry.agentId;
      entry.agentId = pseudonymousHash(originalId);
      if (entry.parentId) {
        entry.parentId = pseudonymousHash(entry.parentId);
      }
      entry.children = entry.children.map(pseudonymousHash);
      entry.siblings = entry.siblings.map(pseudonymousHash);
      entry.geneticProfile = {};
      entry.epigeneticProfile = {};
      return entry;
    }

    return entry;
  }

  private applyAccessFilter(
    entry: RegistryEntry,
    accessLevel: string,
  ): RegistryEntry {
    if (accessLevel === "operator_only") return entry;

    if (accessLevel === "authorized") {
      entry.epigeneticProfile = {};
      return entry;
    }

    entry.epigeneticProfile = {};
    entry.children = [];
    entry.siblings = [];
    return entry;
  }
}
