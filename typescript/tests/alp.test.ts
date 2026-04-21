import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";

import {
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
  REDACTION_LEVELS,
  MEMORY_SCOPES,
  DEFAULT_SUCCESSION_ALPHA,
  DEFAULT_FORK_ALPHA,
  DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS,
  DEFAULT_FORK_DECAY_HALF_LIFE_DAYS,
  DEFAULT_PROBATIONARY_PERIOD_DAYS,
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
} from "../src/types";

import { LifecycleStore } from "../src/store";
import { LifecycleError, LifecycleManager } from "../src/lifecycle";
import { InheritanceConfig, ForkRecord, forkAgent } from "../src/fork";
import {
  SuccessionPlan,
  announceSuccession,
  transferEstate,
  verifySuccession,
  executeCutover,
  abortSuccession,
} from "../src/succession";
import {
  PlatformInfo,
  MigrationPlan,
  beginMigration,
  completeMigration,
  abortMigration,
} from "../src/migration";
import {
  CapabilitySnapshot,
  IdentityContinuity,
  RetrainingEvent,
  classifyRetraining,
  counterpartyActionForClass,
  checkIdentityContinuity,
  recordRetraining,
} from "../src/retraining";
import {
  CredentialRevocation,
  DataDisposition,
  EstateDisposition,
  DecommissionPlan,
  gracefulDecommission,
  emergencyDecommission,
  validateDecommissionChecklist,
} from "../src/decommission";
import { RegistryEntry, LineageRegistry } from "../src/registry";

const TEST_DIR = ".alp-test-" + Date.now();

function cleanup(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function makeManager(): LifecycleManager {
  return new LifecycleManager({ storeDir: TEST_DIR });
}

function createActiveAgent(
  manager: LifecycleManager,
  agentId: string,
): AgentRecord {
  manager.genesis({
    agentId,
    creatorId: "test-creator",
    geneticProfile: new GeneticProfile({
      modelFamily: "claude",
      modelVersion: "4.6",
      architecture: "transformer",
    }),
    epigeneticProfile: new EpigeneticProfile({
      role: "assistant",
      specialization: "general",
    }),
  });
  return manager.activate(agentId);
}

// ========================================================================
// types.ts
// ========================================================================

describe("types.ts — constants", () => {
  it("PROTOCOL_VERSION is 1.0.0", () => {
    assert.equal(PROTOCOL_VERSION, "1.0.0");
  });

  it("SCHEMA_VERSION is 1.0.0", () => {
    assert.equal(SCHEMA_VERSION, "1.0.0");
  });

  it("AGENT_STATES has 7 states", () => {
    assert.equal(AGENT_STATES.length, 7);
    assert.ok(AGENT_STATES.includes("active"));
    assert.ok(AGENT_STATES.includes("decommissioned"));
  });

  it("TERMINAL_STATES", () => {
    assert.deepEqual([...TERMINAL_STATES], ["decommissioned", "failed"]);
  });

  it("EVENT_TYPES has 14 types", () => {
    assert.equal(EVENT_TYPES.length, 14);
  });

  it("FORK_TYPES", () => {
    assert.equal(FORK_TYPES.length, 4);
    assert.ok(FORK_TYPES.includes("specialization"));
  });

  it("MIGRATION_TYPES", () => {
    assert.deepEqual([...MIGRATION_TYPES], ["cold", "warm", "live"]);
  });

  it("RETRAINING_CHANGE_TYPES has 5 types", () => {
    assert.equal(RETRAINING_CHANGE_TYPES.length, 5);
  });

  it("RETRAINING_CLASSES", () => {
    assert.deepEqual([...RETRAINING_CLASSES], ["minor", "moderate", "major"]);
  });

  it("COUNTERPARTY_ACTIONS", () => {
    assert.deepEqual([...COUNTERPARTY_ACTIONS], ["none", "acknowledge", "consent"]);
  });

  it("SUCCESSION_TYPES", () => {
    assert.equal(SUCCESSION_TYPES.length, 3);
  });

  it("DECOMMISSION_REASONS has 5 reasons", () => {
    assert.equal(DECOMMISSION_REASONS.length, 5);
  });

  it("REDACTION_LEVELS", () => {
    assert.deepEqual([...REDACTION_LEVELS], ["none", "partial", "full"]);
  });

  it("MEMORY_SCOPES", () => {
    assert.equal(MEMORY_SCOPES.length, 4);
  });

  it("Default constants", () => {
    assert.equal(DEFAULT_SUCCESSION_ALPHA, 0.5);
    assert.equal(DEFAULT_FORK_ALPHA, 0.3);
    assert.equal(DEFAULT_SUCCESSION_DECAY_HALF_LIFE_DAYS, 30);
    assert.equal(DEFAULT_FORK_DECAY_HALF_LIFE_DAYS, 21);
    assert.equal(DEFAULT_PROBATIONARY_PERIOD_DAYS, 14);
  });
});

describe("types.ts — reputation functions", () => {
  it("computeInheritedReputation basic", () => {
    const result = computeInheritedReputation(0.8, 0.5, 30, 0);
    assert.ok(Math.abs(result - 0.4) < 0.001);
  });

  it("computeInheritedReputation decays over time", () => {
    const atZero = computeInheritedReputation(0.8, 0.5, 30, 0);
    const at30 = computeInheritedReputation(0.8, 0.5, 30, 30);
    assert.ok(at30 < atZero);
    assert.ok(Math.abs(at30 - atZero / 2) < 0.001);
  });

  it("computeInheritedReputation zero half-life returns 0", () => {
    assert.equal(computeInheritedReputation(0.8, 0.5, 0, 10), 0.0);
  });

  it("computeEffectiveReputation clamps", () => {
    assert.equal(computeEffectiveReputation(0.6, 0.6), 1.0);
    assert.equal(computeEffectiveReputation(-0.5, 0.1), 0.0);
    assert.ok(Math.abs(computeEffectiveReputation(0.3, 0.4) - 0.7) < 0.001);
  });
});

describe("types.ts — GeneticProfile", () => {
  it("roundtrips through toDict/fromDict", () => {
    const gp = new GeneticProfile({
      modelFamily: "claude",
      modelVersion: "4.6",
      architecture: "transformer",
      trainingDataHash: "abc123",
    });
    const d = gp.toDict();
    const gp2 = GeneticProfile.fromDict(d);
    assert.equal(gp2.modelFamily, "claude");
    assert.equal(gp2.modelVersion, "4.6");
    assert.equal(gp2.architecture, "transformer");
    assert.equal(gp2.trainingDataHash, "abc123");
  });

  it("defaults to empty strings", () => {
    const gp = new GeneticProfile();
    assert.equal(gp.modelFamily, "");
  });
});

describe("types.ts — EpigeneticProfile", () => {
  it("roundtrips through toDict/fromDict", () => {
    const ep = new EpigeneticProfile({
      role: "coordinator",
      specialization: "fleet",
      toolAccess: ["bash", "read"],
    });
    const d = ep.toDict();
    const ep2 = EpigeneticProfile.fromDict(d);
    assert.equal(ep2.role, "coordinator");
    assert.deepEqual(ep2.toolAccess, ["bash", "read"]);
  });
});

describe("types.ts — Initiator", () => {
  it("defaults to human", () => {
    const i = new Initiator();
    assert.equal(i.type, "human");
  });

  it("roundtrips", () => {
    const i = new Initiator({ type: "agent", id: "alex" });
    const d = i.toDict();
    const i2 = Initiator.fromDict(d);
    assert.equal(i2.type, "agent");
    assert.equal(i2.id, "alex");
  });
});

describe("types.ts — ChainReference", () => {
  it("roundtrips", () => {
    const cr = new ChainReference({
      chainId: "coc-alex",
      entryIndex: 42,
      entryHash: "sha256:abc",
    });
    const d = cr.toDict();
    const cr2 = ChainReference.fromDict(d);
    assert.equal(cr2.chainId, "coc-alex");
    assert.equal(cr2.entryIndex, 42);
  });
});

describe("types.ts — ReputationInheritance", () => {
  it("computeInitial", () => {
    const ri = new ReputationInheritance({
      predecessorScore: 0.8,
      alpha: 0.5,
    });
    const result = ri.computeInitial();
    assert.ok(Math.abs(result - 0.4) < 0.001);
    assert.ok(Math.abs(ri.inheritedScore - 0.4) < 0.001);
  });

  it("computeAt decays", () => {
    const ri = new ReputationInheritance({
      predecessorScore: 1.0,
      alpha: 1.0,
      decayHalfLifeDays: 10,
    });
    const atZero = ri.computeAt(0);
    const atTen = ri.computeAt(10);
    assert.ok(Math.abs(atZero - 1.0) < 0.001);
    assert.ok(Math.abs(atTen - 0.5) < 0.001);
  });

  it("roundtrips", () => {
    const ri = new ReputationInheritance({ predecessorScore: 0.9, alpha: 0.3 });
    const d = ri.toDict();
    const ri2 = ReputationInheritance.fromDict(d);
    assert.ok(Math.abs(ri2.predecessorScore - 0.9) < 0.001);
    assert.ok(Math.abs(ri2.alpha - 0.3) < 0.001);
  });
});

describe("types.ts — CounterpartyNotification", () => {
  it("roundtrips", () => {
    const cn = new CounterpartyNotification({
      counterpartyId: "agent-b",
      consentRequired: true,
    });
    const d = cn.toDict();
    const cn2 = CounterpartyNotification.fromDict(d);
    assert.equal(cn2.counterpartyId, "agent-b");
    assert.equal(cn2.consentRequired, true);
  });
});

describe("types.ts — LifecycleEvent", () => {
  it("creates with defaults", () => {
    const evt = new LifecycleEvent({
      eventType: "genesis",
      agentId: "test-agent",
      agentStateAfter: "provisioning",
    });
    assert.ok(evt.eventId.startsWith("evt-"));
    assert.equal(evt.eventType, "genesis");
    assert.ok(evt.timestamp.length > 0);
  });

  it("computeHash produces sha256", () => {
    const evt = new LifecycleEvent({
      eventType: "genesis",
      agentId: "a1",
      agentStateAfter: "provisioning",
    });
    const hash = evt.computeHash();
    assert.ok(hash.startsWith("sha256:"));
    assert.equal(evt.eventHash, hash);
  });

  it("canonicalString format", () => {
    const evt = new LifecycleEvent({
      eventType: "activate",
      agentId: "a1",
      agentStateBefore: "provisioning",
      agentStateAfter: "active",
      timestamp: "2026-01-01T00:00:00Z",
    });
    const cs = evt.canonicalString();
    assert.ok(cs.startsWith("ALP|1.0.0|activate|"));
    assert.ok(cs.includes("a1|provisioning>active|"));
  });

  it("roundtrips through toDict/fromDict", () => {
    const evt = new LifecycleEvent({
      eventType: "fork",
      agentId: "parent",
      agentStateBefore: "active",
      agentStateAfter: "active",
      chainEntry: new ChainReference({ chainId: "coc-1" }),
    });
    evt.computeHash();
    const d = evt.toDict();
    const evt2 = LifecycleEvent.fromDict(d);
    assert.equal(evt2.eventType, "fork");
    assert.equal(evt2.chainEntry?.chainId, "coc-1");
    assert.equal(evt2.eventHash, evt.eventHash);
  });
});

describe("types.ts — AgentRecord", () => {
  it("isTerminal for decommissioned", () => {
    const agent = new AgentRecord({ state: "decommissioned" });
    assert.equal(agent.isTerminal, true);
  });

  it("isTerminal false for active", () => {
    const agent = new AgentRecord({ state: "active" });
    assert.equal(agent.isTerminal, false);
  });

  it("roundtrips", () => {
    const agent = new AgentRecord({
      agentId: "test-1",
      state: "active",
      generation: 3,
      reputationEarned: 0.75,
    });
    const d = agent.toDict();
    const agent2 = AgentRecord.fromDict(d);
    assert.equal(agent2.agentId, "test-1");
    assert.equal(agent2.generation, 3);
    assert.ok(Math.abs(agent2.reputationEarned - 0.75) < 0.001);
  });
});

// ========================================================================
// store.ts
// ========================================================================

describe("store.ts — LifecycleStore", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("creates directory", () => {
    const store = new LifecycleStore(TEST_DIR);
    assert.ok(existsSync(TEST_DIR));
  });

  it("append and retrieve events", () => {
    const store = new LifecycleStore(TEST_DIR);
    const evt = new LifecycleEvent({
      eventType: "genesis",
      agentId: "a1",
      agentStateAfter: "provisioning",
    });
    evt.computeHash();
    store.appendEvent(evt);

    const events = store.getEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0].agentId, "a1");
  });

  it("getEvent by id", () => {
    const store = new LifecycleStore(TEST_DIR);
    const evt = new LifecycleEvent({
      eventId: "evt-test123",
      eventType: "genesis",
      agentId: "a1",
      agentStateAfter: "provisioning",
    });
    evt.computeHash();
    store.appendEvent(evt);

    const found = store.getEvent("evt-test123");
    assert.ok(found !== null);
    assert.equal(found!.eventId, "evt-test123");
    assert.equal(store.getEvent("nonexistent"), null);
  });

  it("getEventsFor filters by agent", () => {
    const store = new LifecycleStore(TEST_DIR);
    const e1 = new LifecycleEvent({ eventType: "genesis", agentId: "a1", agentStateAfter: "provisioning" });
    const e2 = new LifecycleEvent({ eventType: "genesis", agentId: "a2", agentStateAfter: "provisioning" });
    e1.computeHash();
    e2.computeHash();
    store.appendEvent(e1);
    store.appendEvent(e2);

    assert.equal(store.getEventsFor("a1").length, 1);
    assert.equal(store.getEventsFor("a2").length, 1);
  });

  it("save and retrieve agents", () => {
    const store = new LifecycleStore(TEST_DIR);
    const agent = new AgentRecord({ agentId: "a1", state: "active" });
    store.saveAgent(agent);

    const found = store.getAgent("a1");
    assert.ok(found !== null);
    assert.equal(found!.state, "active");
  });

  it("getAgent returns latest snapshot", () => {
    const store = new LifecycleStore(TEST_DIR);
    store.saveAgent(new AgentRecord({ agentId: "a1", state: "provisioning" }));
    store.saveAgent(new AgentRecord({ agentId: "a1", state: "active" }));

    const found = store.getAgent("a1");
    assert.equal(found!.state, "active");
  });

  it("getAgentsByState", () => {
    const store = new LifecycleStore(TEST_DIR);
    store.saveAgent(new AgentRecord({ agentId: "a1", state: "active" }));
    store.saveAgent(new AgentRecord({ agentId: "a2", state: "suspended" }));
    store.saveAgent(new AgentRecord({ agentId: "a3", state: "active" }));

    const active = store.getAgentsByState("active");
    assert.equal(active.length, 2);
  });

  it("stats returns correct counts", () => {
    const store = new LifecycleStore(TEST_DIR);
    store.saveAgent(new AgentRecord({ agentId: "a1", state: "active" }));
    store.saveAgent(new AgentRecord({ agentId: "a1", state: "suspended" }));
    const evt = new LifecycleEvent({ eventType: "genesis", agentId: "a1", agentStateAfter: "provisioning" });
    evt.computeHash();
    store.appendEvent(evt);

    const s = store.stats() as Record<string, Record<string, unknown>>;
    assert.equal((s.agents as Record<string, unknown>).unique_count, 1);
    assert.equal((s.agents as Record<string, unknown>).snapshots_count, 2);
    assert.equal((s.events as Record<string, unknown>).count, 1);
  });
});

// ========================================================================
// lifecycle.ts
// ========================================================================

describe("lifecycle.ts — LifecycleManager", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("genesis creates agent in provisioning", () => {
    const m = makeManager();
    const agent = m.genesis({ agentId: "a1", creatorId: "human1" });
    assert.equal(agent.state, "provisioning");
    assert.equal(agent.agentId, "a1");
    assert.ok(agent.eventHistory.length > 0);
  });

  it("genesis rejects duplicate", () => {
    const m = makeManager();
    m.genesis({ agentId: "a1" });
    assert.throws(() => m.genesis({ agentId: "a1" }), LifecycleError);
  });

  it("activate transitions provisioning to active", () => {
    const m = makeManager();
    m.genesis({ agentId: "a1" });
    const agent = m.activate("a1");
    assert.equal(agent.state, "active");
  });

  it("suspend and resume", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const suspended = m.suspend("a1", "maintenance");
    assert.equal(suspended.state, "suspended");
    const resumed = m.resume("a1");
    assert.equal(resumed.state, "active");
  });

  it("deprecate", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const deprecated = m.deprecate("a1", "replaced", "a2");
    assert.equal(deprecated.state, "deprecated");
  });

  it("decommission from deprecated", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    m.deprecate("a1");
    const decom = m.decommission("a1");
    assert.equal(decom.state, "decommissioned");
    assert.equal(decom.isTerminal, true);
  });

  it("emergency decommission from active", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const decom = m.emergencyDecommission("a1", "compromised");
    assert.equal(decom.state, "decommissioned");
  });

  it("emergency decommission from suspended", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    m.suspend("a1");
    const decom = m.emergencyDecommission("a1");
    assert.equal(decom.state, "decommissioned");
  });

  it("emergency decommission rejects terminal state", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    m.emergencyDecommission("a1");
    assert.throws(
      () => m.emergencyDecommission("a1"),
      LifecycleError,
    );
  });

  it("fail transitions provisioning to failed", () => {
    const m = makeManager();
    m.genesis({ agentId: "a1" });
    const failed = m.fail("a1", "startup error");
    assert.equal(failed.state, "failed");
    assert.equal(failed.isTerminal, true);
  });

  it("invalid transition throws", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    assert.throws(() => m.fail("a1"), LifecycleError);
  });

  it("agent not found throws", () => {
    const m = makeManager();
    assert.throws(() => m.activate("nonexistent"), LifecycleError);
  });

  it("pre-hook can block transition", () => {
    const m = makeManager();
    m.genesis({ agentId: "a1" });
    m.registerPreHook("activate", () => ({
      success: false,
      error: "blocked by policy",
      data: {},
    }));
    assert.throws(
      () => m.activate("a1"),
      (err: Error) => err.message.includes("blocked by policy"),
    );
  });

  it("post-hook fires after transition", () => {
    const m = makeManager();
    m.genesis({ agentId: "a1" });
    let called = false;
    m.registerPostHook("activate", () => {
      called = true;
      return { success: true, error: "", data: {} };
    });
    m.activate("a1");
    assert.equal(called, true);
  });

  it("events are recorded in store", () => {
    const m = makeManager();
    m.genesis({ agentId: "a1" });
    m.activate("a1");
    const events = m.store.getEventsFor("a1");
    assert.equal(events.length, 2);
    assert.equal(events[0].eventType, "genesis");
    assert.equal(events[1].eventType, "activate");
  });

  it("validateTransition rejects bad event type", () => {
    const m = makeManager();
    assert.throws(
      () => m.validateTransition("active", "suspended", "genesis"),
      LifecycleError,
    );
  });
});

// ========================================================================
// fork.ts
// ========================================================================

describe("fork.ts", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("forkAgent creates child in provisioning", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    const record = forkAgent(m, "parent", "child-1");
    assert.equal(record.parentId, "parent");
    assert.equal(record.childId, "child-1");
    assert.equal(record.forkType, "specialization");

    const child = m.getAgent("child-1");
    assert.ok(child !== null);
    assert.equal(child!.state, "provisioning");
    assert.equal(child!.parentId, "parent");
    assert.equal(child!.generation, 2);
  });

  it("fork inherits genetic profile by default", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    forkAgent(m, "parent", "child-1");
    const child = m.getAgent("child-1")!;
    assert.equal(child.geneticProfile.modelFamily, "claude");
  });

  it("fork computes reputation inheritance", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    const record = forkAgent(m, "parent", "child-1");
    assert.ok(record.reputationInheritance !== null);
    assert.equal(record.reputationInheritance!.alpha, DEFAULT_FORK_ALPHA);
  });

  it("fork updates parent children list", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    forkAgent(m, "parent", "child-1");
    const parent = m.getAgent("parent")!;
    assert.ok(parent.children.includes("child-1"));
  });

  it("fork rejects inactive parent", () => {
    const m = makeManager();
    m.genesis({ agentId: "parent" });
    assert.throws(
      () => forkAgent(m, "parent", "child"),
      LifecycleError,
    );
  });

  it("fork rejects duplicate child", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    createActiveAgent(m, "child");
    assert.throws(
      () => forkAgent(m, "parent", "child"),
      LifecycleError,
    );
  });

  it("fork rejects invalid fork type", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    assert.throws(
      () => forkAgent(m, "parent", "child", { forkType: "invalid" }),
      LifecycleError,
    );
  });

  it("InheritanceConfig roundtrips", () => {
    const ic = new InheritanceConfig({
      reputationFactor: 0.5,
      memoryScope: "full",
    });
    const d = ic.toDict();
    const ic2 = InheritanceConfig.fromDict(d);
    assert.ok(Math.abs(ic2.reputationFactor - 0.5) < 0.001);
    assert.equal(ic2.memoryScope, "full");
  });

  it("ForkRecord roundtrips", () => {
    const fr = new ForkRecord({
      parentId: "p1",
      childId: "c1",
      forkType: "full_clone",
      reputationInheritance: new ReputationInheritance({ predecessorScore: 0.8 }),
    });
    const d = fr.toDict();
    const fr2 = ForkRecord.fromDict(d);
    assert.equal(fr2.parentId, "p1");
    assert.equal(fr2.forkType, "full_clone");
    assert.ok(fr2.reputationInheritance !== null);
  });

  it("fork with custom genetic profile", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    const customGen = new GeneticProfile({ modelFamily: "gpt", modelVersion: "4.1" });
    forkAgent(m, "parent", "child", { childGenetic: customGen });
    const child = m.getAgent("child")!;
    assert.equal(child.geneticProfile.modelFamily, "gpt");
  });

  it("fork with no genetic inheritance", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    const inh = new InheritanceConfig({ geneticInherited: false });
    forkAgent(m, "parent", "child", { inheritance: inh });
    const child = m.getAgent("child")!;
    assert.equal(child.geneticProfile.modelFamily, "");
  });
});

// ========================================================================
// succession.ts
// ========================================================================

describe("succession.ts", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("full succession lifecycle: announce -> transfer -> verify -> cutover", () => {
    const m = makeManager();
    createActiveAgent(m, "old-agent");
    createActiveAgent(m, "new-agent");

    // Set predecessor reputation for meaningful inheritance
    const oldAgent = m.getAgent("old-agent")!;
    oldAgent.reputationEarned = 0.8;
    m.store.saveAgent(oldAgent);

    let plan = new SuccessionPlan({
      predecessorId: "old-agent",
      successorId: "new-agent",
    });

    plan = announceSuccession(m, plan);
    assert.equal(plan.phase, "announced");
    assert.ok(plan.plannedCutover.length > 0);
    assert.ok(plan.reputationInheritance.inheritedScore > 0);

    const pred = m.getAgent("old-agent")!;
    assert.equal(pred.state, "deprecated");

    plan = transferEstate(m, plan, {
      obligationsTransferred: 5,
      knowledgeTransferred: true,
    });
    assert.equal(plan.phase, "transferred");
    assert.equal(plan.obligationsTransferred, 5);

    const succ = m.getAgent("new-agent")!;
    assert.ok(succ.reputationInherited > 0);

    plan = verifySuccession(m, plan);
    assert.equal(plan.phase, "verified");
    assert.equal(plan.verificationPassed, true);

    plan = executeCutover(m, plan);
    assert.equal(plan.phase, "complete");
    assert.equal(m.getAgent("old-agent")!.state, "decommissioned");
  });

  it("announceSuccession rejects non-active predecessor", () => {
    const m = makeManager();
    m.genesis({ agentId: "old" });
    createActiveAgent(m, "new");
    const plan = new SuccessionPlan({
      predecessorId: "old",
      successorId: "new",
    });
    assert.throws(
      () => announceSuccession(m, plan),
      LifecycleError,
    );
  });

  it("transferEstate rejects wrong phase", () => {
    const m = makeManager();
    const plan = new SuccessionPlan({ phase: "planned" });
    assert.throws(
      () => transferEstate(m, plan),
      LifecycleError,
    );
  });

  it("verifySuccession fails on incomplete knowledge transfer", () => {
    const m = makeManager();
    createActiveAgent(m, "old");
    createActiveAgent(m, "new");

    let plan = new SuccessionPlan({
      predecessorId: "old",
      successorId: "new",
    });
    plan = announceSuccession(m, plan);
    plan = transferEstate(m, plan, { knowledgeTransferred: false });

    assert.throws(
      () => verifySuccession(m, plan),
      LifecycleError,
    );
  });

  it("verifySuccession fails on pending consent", () => {
    const m = makeManager();
    createActiveAgent(m, "old");
    createActiveAgent(m, "new");

    let plan = new SuccessionPlan({
      predecessorId: "old",
      successorId: "new",
      counterpartyNotifications: [
        new CounterpartyNotification({
          counterpartyId: "agent-b",
          consentRequired: true,
          consentReceived: false,
        }),
      ],
    });
    plan = announceSuccession(m, plan);
    plan = transferEstate(m, plan);

    assert.throws(
      () => verifySuccession(m, plan),
      LifecycleError,
    );
  });

  it("abortSuccession restores predecessor to active", () => {
    const m = makeManager();
    createActiveAgent(m, "old");
    createActiveAgent(m, "new");

    let plan = new SuccessionPlan({
      predecessorId: "old",
      successorId: "new",
    });
    plan = announceSuccession(m, plan);
    assert.equal(m.getAgent("old")!.state, "deprecated");

    plan = abortSuccession(m, plan, "changed mind");
    assert.equal(plan.phase, "aborted");
    assert.equal(m.getAgent("old")!.state, "active");
    assert.equal(m.getAgent("new")!.reputationInherited, 0);
  });

  it("abortSuccession rejects planned/complete/aborted phases", () => {
    const m = makeManager();
    const plan = new SuccessionPlan({ phase: "planned" });
    assert.throws(() => abortSuccession(m, plan), LifecycleError);
  });

  it("executeCutover rejects non-verified phase", () => {
    const m = makeManager();
    const plan = new SuccessionPlan({ phase: "transferred" });
    assert.throws(
      () => executeCutover(m, plan),
      LifecycleError,
    );
  });

  it("SuccessionPlan roundtrips", () => {
    const plan = new SuccessionPlan({
      predecessorId: "old",
      successorId: "new",
      successionType: "upgrade",
      transitionWindowDays: 7,
    });
    const d = plan.toDict();
    const plan2 = SuccessionPlan.fromDict(d);
    assert.equal(plan2.predecessorId, "old");
    assert.equal(plan2.successionType, "upgrade");
    assert.equal(plan2.transitionWindowDays, 7);
  });
});

// ========================================================================
// migration.ts
// ========================================================================

describe("migration.ts", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("full migration: begin -> complete", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");

    let plan = new MigrationPlan({
      agentId: "a1",
      migrationType: "cold",
      source: new PlatformInfo({ provider: "aws" }),
      destination: new PlatformInfo({ provider: "gcp" }),
    });

    plan = beginMigration(m, plan);
    assert.equal(plan.phase, "migrating");
    assert.ok(plan.stateHashBefore.startsWith("sha256:"));
    assert.equal(m.getAgent("a1")!.state, "migrating");

    plan = completeMigration(m, plan, plan.stateHashBefore);
    assert.equal(plan.phase, "complete");
    assert.equal(m.getAgent("a1")!.state, "active");
  });

  it("migration abort rolls back to active", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");

    let plan = new MigrationPlan({ agentId: "a1" });
    plan = beginMigration(m, plan);
    plan = abortMigration(m, plan, "network failure");
    assert.equal(plan.phase, "aborted");
    assert.equal(m.getAgent("a1")!.state, "active");
  });

  it("beginMigration rejects non-active agent", () => {
    const m = makeManager();
    m.genesis({ agentId: "a1" });
    const plan = new MigrationPlan({ agentId: "a1" });
    assert.throws(
      () => beginMigration(m, plan),
      LifecycleError,
    );
  });

  it("beginMigration rejects invalid type", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const plan = new MigrationPlan({
      agentId: "a1",
      migrationType: "teleport",
    });
    assert.throws(
      () => beginMigration(m, plan),
      LifecycleError,
    );
  });

  it("completeMigration rejects wrong phase", () => {
    const m = makeManager();
    const plan = new MigrationPlan({ phase: "planned" });
    assert.throws(
      () => completeMigration(m, plan),
      LifecycleError,
    );
  });

  it("abortMigration rejects wrong phase", () => {
    const m = makeManager();
    const plan = new MigrationPlan({ phase: "complete" });
    assert.throws(
      () => abortMigration(m, plan),
      LifecycleError,
    );
  });

  it("PlatformInfo roundtrips", () => {
    const pi = new PlatformInfo({
      provider: "aws",
      runtime: "lambda",
      region: "us-east-1",
    });
    const d = pi.toDict();
    const pi2 = PlatformInfo.fromDict(d);
    assert.equal(pi2.provider, "aws");
    assert.equal(pi2.runtime, "lambda");
    assert.equal(pi2.region, "us-east-1");
  });

  it("MigrationPlan roundtrips", () => {
    const plan = new MigrationPlan({
      agentId: "a1",
      migrationType: "warm",
      source: new PlatformInfo({ provider: "azure" }),
    });
    const d = plan.toDict();
    const plan2 = MigrationPlan.fromDict(d);
    assert.equal(plan2.agentId, "a1");
    assert.equal(plan2.migrationType, "warm");
    assert.equal(plan2.source.provider, "azure");
  });

  it("live migration allows hash mismatch", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");

    let plan = new MigrationPlan({
      agentId: "a1",
      migrationType: "live",
    });
    plan = beginMigration(m, plan);
    plan = completeMigration(m, plan, "sha256:different");
    assert.equal(plan.phase, "complete");
  });
});

// ========================================================================
// retraining.ts
// ========================================================================

describe("retraining.ts", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("classifyRetraining", () => {
    assert.equal(classifyRetraining("prompt_revision"), "minor");
    assert.equal(classifyRetraining("model_upgrade"), "moderate");
    assert.equal(classifyRetraining("fine_tuning"), "moderate");
    assert.equal(classifyRetraining("capability_addition"), "minor");
    assert.equal(classifyRetraining("unknown_type"), "major");
  });

  it("counterpartyActionForClass", () => {
    assert.equal(counterpartyActionForClass("minor"), "none");
    assert.equal(counterpartyActionForClass("moderate"), "acknowledge");
    assert.equal(counterpartyActionForClass("major"), "consent");
    assert.equal(counterpartyActionForClass("unknown"), "consent");
  });

  it("checkIdentityContinuity all true", () => {
    const ic = new IdentityContinuity();
    assert.equal(checkIdentityContinuity(ic), true);
  });

  it("checkIdentityContinuity fails on broken chain", () => {
    const ic = new IdentityContinuity({ sameCocChain: false });
    assert.equal(checkIdentityContinuity(ic), false);
  });

  it("recordRetraining for model_upgrade", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");

    const retraining = new RetrainingEvent({
      agentId: "a1",
      changeType: "model_upgrade",
      before: new CapabilitySnapshot({ modelVersion: "4.5" }),
      after: new CapabilitySnapshot({ modelVersion: "4.6" }),
    });

    const event = recordRetraining(m, retraining);
    assert.equal(event.eventType, "retraining");
    assert.equal(retraining.retrainingClass, "moderate");
    assert.equal(retraining.counterpartyActionRequired, "acknowledge");

    const agent = m.getAgent("a1")!;
    assert.equal(agent.geneticProfile.modelVersion, "4.6");
  });

  it("recordRetraining rejects non-active agent", () => {
    const m = makeManager();
    m.genesis({ agentId: "a1" });
    const retraining = new RetrainingEvent({
      agentId: "a1",
      changeType: "model_upgrade",
    });
    assert.throws(
      () => recordRetraining(m, retraining),
      LifecycleError,
    );
  });

  it("recordRetraining rejects invalid change type", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const retraining = new RetrainingEvent({
      agentId: "a1",
      changeType: "invalid_type",
    });
    assert.throws(
      () => recordRetraining(m, retraining),
      LifecycleError,
    );
  });

  it("recordRetraining rejects failed identity continuity", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const retraining = new RetrainingEvent({
      agentId: "a1",
      changeType: "model_upgrade",
      identityContinuity: new IdentityContinuity({
        sameIdentityKey: false,
      }),
    });
    assert.throws(
      () => recordRetraining(m, retraining),
      (err: Error) => err.message.includes("Identity continuity"),
    );
  });

  it("CapabilitySnapshot roundtrips", () => {
    const cs = new CapabilitySnapshot({
      modelVersion: "4.6",
      capabilityHash: "abc",
    });
    const d = cs.toDict();
    const cs2 = CapabilitySnapshot.fromDict(d);
    assert.equal(cs2.modelVersion, "4.6");
    assert.equal(cs2.capabilityHash, "abc");
  });

  it("IdentityContinuity roundtrips", () => {
    const ic = new IdentityContinuity({
      sameIdentityKey: true,
      sameCocChain: false,
      rationale: "chain migrated",
    });
    const d = ic.toDict();
    assert.equal(d.identity_preserved, false);
    const ic2 = IdentityContinuity.fromDict(d);
    assert.equal(ic2.sameCocChain, false);
    assert.equal(ic2.rationale, "chain migrated");
  });

  it("RetrainingEvent roundtrips", () => {
    const re = new RetrainingEvent({
      agentId: "a1",
      changeType: "fine_tuning",
      retrainingClass: "moderate",
    });
    const d = re.toDict();
    const re2 = RetrainingEvent.fromDict(d);
    assert.equal(re2.agentId, "a1");
    assert.equal(re2.changeType, "fine_tuning");
  });
});

// ========================================================================
// decommission.ts
// ========================================================================

describe("decommission.ts", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("gracefulDecommission from deprecated", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    m.deprecate("a1");

    let plan = new DecommissionPlan({
      agentId: "a1",
      reason: "end_of_life",
    });
    plan = gracefulDecommission(m, plan);
    assert.equal(plan.phase, "complete");
    assert.equal(m.getAgent("a1")!.state, "decommissioned");
  });

  it("gracefulDecommission rejects non-deprecated", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const plan = new DecommissionPlan({ agentId: "a1" });
    assert.throws(
      () => gracefulDecommission(m, plan),
      LifecycleError,
    );
  });

  it("emergencyDecommission from active", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    let plan = new DecommissionPlan({
      agentId: "a1",
      reason: "compromised",
    });
    plan = emergencyDecommission(m, plan);
    assert.equal(plan.phase, "complete");
    assert.equal(plan.emergency, true);
    assert.equal(m.getAgent("a1")!.state, "decommissioned");
  });

  it("validateDecommissionChecklist all incomplete", () => {
    const plan = new DecommissionPlan({ agentId: "a1" });
    const issues = validateDecommissionChecklist(plan);
    assert.ok(issues.length >= 7);
    assert.ok(issues.includes("API keys not revoked"));
    assert.ok(issues.includes("Counterparties not yet notified"));
    assert.ok(issues.includes("Fleet coordinator not notified"));
  });

  it("validateDecommissionChecklist all complete", () => {
    const plan = new DecommissionPlan({
      agentId: "a1",
      estate: new EstateDisposition({
        counterpartiesNotified: true,
        fleetCoordinatorNotified: true,
        credentials: new CredentialRevocation({
          apiKeysRevoked: true,
          oauthTokensInvalidated: true,
          serviceAccountsDeleted: true,
          trustRelationshipsTerminated: true,
          certificatesRevoked: true,
          identityKeyArchived: true,
        }),
      }),
    });
    const issues = validateDecommissionChecklist(plan);
    assert.equal(issues.length, 0);
  });

  it("CredentialRevocation.allRevoked", () => {
    const cr = new CredentialRevocation();
    assert.equal(cr.allRevoked, false);

    const crFull = new CredentialRevocation({
      apiKeysRevoked: true,
      oauthTokensInvalidated: true,
      serviceAccountsDeleted: true,
      trustRelationshipsTerminated: true,
      certificatesRevoked: true,
      identityKeyArchived: true,
    });
    assert.equal(crFull.allRevoked, true);
  });

  it("CredentialRevocation roundtrips", () => {
    const cr = new CredentialRevocation({
      apiKeysRevoked: true,
      certificatesRevoked: true,
    });
    const d = cr.toDict();
    const cr2 = CredentialRevocation.fromDict(d);
    assert.equal(cr2.apiKeysRevoked, true);
    assert.equal(cr2.certificatesRevoked, true);
    assert.equal(cr2.oauthTokensInvalidated, false);
  });

  it("DataDisposition roundtrips", () => {
    const dd = new DataDisposition({ memoryState: "archived" });
    const d = dd.toDict();
    const dd2 = DataDisposition.fromDict(d);
    assert.equal(dd2.memoryState, "archived");
    assert.equal(dd2.cocChain, "sealed_permanent");
  });

  it("EstateDisposition roundtrips", () => {
    const ed = new EstateDisposition({
      obligationsTransferred: 3,
      counterpartiesNotified: true,
    });
    const d = ed.toDict();
    const ed2 = EstateDisposition.fromDict(d);
    assert.equal(ed2.obligationsTransferred, 3);
    assert.equal(ed2.counterpartiesNotified, true);
  });

  it("DecommissionPlan roundtrips", () => {
    const plan = new DecommissionPlan({
      agentId: "a1",
      reason: "superseded",
      successorId: "a2",
      emergency: true,
    });
    const d = plan.toDict();
    const plan2 = DecommissionPlan.fromDict(d);
    assert.equal(plan2.agentId, "a1");
    assert.equal(plan2.reason, "superseded");
    assert.equal(plan2.successorId, "a2");
    assert.equal(plan2.emergency, true);
  });
});

// ========================================================================
// registry.ts
// ========================================================================

describe("registry.ts", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("getEntry returns registry entry", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const registry = new LineageRegistry(m.store);

    const entry = registry.getEntry("a1", "operator_only");
    assert.ok(entry !== null);
    assert.equal(entry!.agentId, "a1");
    assert.equal(entry!.lifecycleStatus, "active");
  });

  it("getEntry returns null for unknown agent", () => {
    const m = makeManager();
    const registry = new LineageRegistry(m.store);
    assert.equal(registry.getEntry("nonexistent"), null);
  });

  it("ancestors returns lineage chain", () => {
    const m = makeManager();
    createActiveAgent(m, "root");
    forkAgent(m, "root", "gen2");
    m.activate("gen2");
    forkAgent(m, "gen2", "gen3");

    const registry = new LineageRegistry(m.store);
    const ancestors = registry.ancestors("gen3");
    assert.deepEqual(ancestors, ["gen2", "root"]);
  });

  it("descendants returns all children recursively", () => {
    const m = makeManager();
    createActiveAgent(m, "root");
    forkAgent(m, "root", "c1");
    forkAgent(m, "root", "c2");
    m.activate("c1");
    forkAgent(m, "c1", "gc1");

    const registry = new LineageRegistry(m.store);
    const desc = registry.descendants("root");
    assert.ok(desc.includes("c1"));
    assert.ok(desc.includes("c2"));
    assert.ok(desc.includes("gc1"));
    assert.equal(desc.length, 3);
  });

  it("siblings returns shared-parent agents", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    forkAgent(m, "parent", "s1");
    forkAgent(m, "parent", "s2");
    forkAgent(m, "parent", "s3");

    const registry = new LineageRegistry(m.store);
    const sibs = registry.siblings("s1");
    assert.ok(sibs.includes("s2"));
    assert.ok(sibs.includes("s3"));
    assert.ok(!sibs.includes("s1"));
  });

  it("siblings returns empty for root agent", () => {
    const m = makeManager();
    createActiveAgent(m, "root");
    const registry = new LineageRegistry(m.store);
    assert.deepEqual(registry.siblings("root"), []);
  });

  it("familyTree builds complete tree", () => {
    const m = makeManager();
    createActiveAgent(m, "root");
    forkAgent(m, "root", "c1");
    forkAgent(m, "root", "c2");

    const registry = new LineageRegistry(m.store);
    const tree = registry.familyTree("c1");
    assert.equal(tree.agent_id, "root");
    assert.equal((tree.children as Array<Record<string, unknown>>).length, 2);
  });

  it("geneticMatch finds agents by model family", () => {
    const m = makeManager();
    m.genesis({
      agentId: "a1",
      geneticProfile: new GeneticProfile({ modelFamily: "claude" }),
    });
    m.genesis({
      agentId: "a2",
      geneticProfile: new GeneticProfile({ modelFamily: "gpt" }),
    });

    const registry = new LineageRegistry(m.store);
    const matches = registry.geneticMatch("claude");
    assert.ok(matches.includes("a1"));
    assert.ok(!matches.includes("a2"));
  });

  it("epigeneticMatch finds agents by role", () => {
    const m = makeManager();
    m.genesis({
      agentId: "a1",
      epigeneticProfile: new EpigeneticProfile({ role: "coordinator" }),
    });
    m.genesis({
      agentId: "a2",
      epigeneticProfile: new EpigeneticProfile({ role: "builder" }),
    });

    const registry = new LineageRegistry(m.store);
    const matches = registry.epigeneticMatch("coordinator");
    assert.ok(matches.includes("a1"));
    assert.ok(!matches.includes("a2"));
  });

  it("redactEntry applies partial redaction", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    m.deprecate("a1");
    m.decommission("a1");

    const registry = new LineageRegistry(m.store);
    const agent = registry.redactEntry("a1", "partial");
    assert.ok(agent !== null);
    assert.equal(agent!.redactionLevel, "partial");
  });

  it("redactEntry rejects non-decommissioned", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const registry = new LineageRegistry(m.store);
    assert.throws(() => registry.redactEntry("a1", "partial"));
  });

  it("redactEntry rejects invalid level", () => {
    const m = makeManager();
    const registry = new LineageRegistry(m.store);
    assert.throws(() => registry.redactEntry("a1", "invalid"));
  });

  it("access level public strips children and siblings", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    forkAgent(m, "parent", "child");

    const registry = new LineageRegistry(m.store);
    const entry = registry.getEntry("parent", "public");
    assert.ok(entry !== null);
    assert.deepEqual(entry!.children, []);
    assert.deepEqual(entry!.siblings, []);
  });

  it("access level authorized strips epigenetic only", () => {
    const m = makeManager();
    createActiveAgent(m, "parent");
    forkAgent(m, "parent", "child");

    const registry = new LineageRegistry(m.store);
    const entry = registry.getEntry("parent", "authorized");
    assert.ok(entry !== null);
    assert.ok(entry!.children.includes("child"));
    assert.deepEqual(entry!.epigeneticProfile, {});
  });

  it("access level operator_only shows everything", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const registry = new LineageRegistry(m.store);
    const entry = registry.getEntry("a1", "operator_only");
    assert.ok(entry !== null);
    assert.ok(Object.keys(entry!.geneticProfile).length > 0);
  });

  it("RegistryEntry.fromAgent", () => {
    const agent = new AgentRecord({
      agentId: "a1",
      state: "active",
      generation: 2,
      parentId: "root",
    });
    const entry = RegistryEntry.fromAgent(agent);
    assert.equal(entry.agentId, "a1");
    assert.equal(entry.parentId, "root");
    assert.equal(entry.generation, 2);
  });

  it("RegistryEntry roundtrips", () => {
    const entry = new RegistryEntry({
      agentId: "a1",
      generation: 3,
      forkType: "specialization",
    });
    const d = entry.toDict();
    assert.equal(d.agent_id, "a1");
    assert.equal(d.generation, 3);
  });
});

// ========================================================================
// Integration tests
// ========================================================================

describe("integration — complex lifecycle", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("genesis -> activate -> fork -> migrate child -> retrain -> succession -> decommission", () => {
    const m = makeManager();

    const root = createActiveAgent(m, "root-agent");
    assert.equal(root.state, "active");

    const forkRec = forkAgent(m, "root-agent", "fork-1", {
      forkType: "capability_fork",
    });
    assert.equal(forkRec.childId, "fork-1");

    const child = m.activate("fork-1");
    assert.equal(child.state, "active");
    assert.equal(child.generation, 2);

    let migPlan = new MigrationPlan({
      agentId: "fork-1",
      migrationType: "warm",
      source: new PlatformInfo({ provider: "aws" }),
      destination: new PlatformInfo({ provider: "gcp" }),
    });
    migPlan = beginMigration(m, migPlan);
    migPlan = completeMigration(m, migPlan);
    assert.equal(m.getAgent("fork-1")!.state, "active");

    const retraining = new RetrainingEvent({
      agentId: "fork-1",
      changeType: "model_upgrade",
      before: new CapabilitySnapshot({ modelVersion: "4.5" }),
      after: new CapabilitySnapshot({ modelVersion: "4.6" }),
    });
    recordRetraining(m, retraining);
    assert.equal(m.getAgent("fork-1")!.geneticProfile.modelVersion, "4.6");

    createActiveAgent(m, "successor-agent");
    let succPlan = new SuccessionPlan({
      predecessorId: "root-agent",
      successorId: "successor-agent",
    });
    succPlan = announceSuccession(m, succPlan);
    succPlan = transferEstate(m, succPlan);
    succPlan = verifySuccession(m, succPlan);
    succPlan = executeCutover(m, succPlan);
    assert.equal(m.getAgent("root-agent")!.state, "decommissioned");
    assert.equal(succPlan.phase, "complete");

    const events = m.store.getEvents();
    assert.ok(events.length >= 8);

    const eventTypes = events.map((e) => e.eventType);
    assert.ok(eventTypes.includes("genesis"));
    assert.ok(eventTypes.includes("activate"));
    assert.ok(eventTypes.includes("fork"));
    assert.ok(eventTypes.includes("begin_migration"));
    assert.ok(eventTypes.includes("complete_migration"));
    assert.ok(eventTypes.includes("retraining"));
    assert.ok(eventTypes.includes("deprecate"));
    assert.ok(eventTypes.includes("decommission"));
  });

  it("full lineage tracking across multiple generations", () => {
    const m = makeManager();
    createActiveAgent(m, "gen1");
    forkAgent(m, "gen1", "gen2a");
    forkAgent(m, "gen1", "gen2b");
    m.activate("gen2a");
    forkAgent(m, "gen2a", "gen3");

    const registry = new LineageRegistry(m.store);

    assert.deepEqual(registry.ancestors("gen3"), ["gen2a", "gen1"]);
    assert.deepEqual(registry.siblings("gen2a"), ["gen2b"]);

    const desc = registry.descendants("gen1");
    assert.equal(desc.length, 3);
    assert.ok(desc.includes("gen2a"));
    assert.ok(desc.includes("gen2b"));
    assert.ok(desc.includes("gen3"));

    const tree = registry.familyTree("gen3");
    assert.equal(tree.agent_id, "gen1");
  });

  it("emergency decommission during migration", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    const plan = new MigrationPlan({ agentId: "a1" });
    beginMigration(m, plan);
    assert.equal(m.getAgent("a1")!.state, "migrating");

    m.emergencyDecommission("a1", "compromised");
    assert.equal(m.getAgent("a1")!.state, "decommissioned");
  });

  it("store stats track everything", () => {
    const m = makeManager();
    createActiveAgent(m, "a1");
    createActiveAgent(m, "a2");
    m.suspend("a1");

    const stats = m.store.stats() as Record<string, Record<string, unknown>>;
    const agents = stats.agents as Record<string, unknown>;
    assert.equal(agents.unique_count, 2);
    const byState = agents.by_state as Record<string, number>;
    assert.equal(byState.suspended, 1);
    assert.equal(byState.active, 1);
  });
});
