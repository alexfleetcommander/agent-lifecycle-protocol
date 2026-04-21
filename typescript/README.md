# agent-lifecycle-protocol (TypeScript)

TypeScript reference implementation of the Agent Lifecycle Protocol (ALP) — managing agent birth, fork, succession, migration, retraining, and decommission.

## What it does

- **Lifecycle state machine**: Genesis → Provisioning → Active → Suspended/Migrating/Deprecated → Decommissioned/Failed
- **Fork operations**: Full clone, partial clone, capability fork, specialization with configurable genetic/epigenetic inheritance
- **Succession protocol**: Four-phase handoff (announce → transfer → verify → cutover) with reputation inheritance
- **Migration**: Cold, warm, and live migration between platforms with state integrity verification
- **Retraining**: Identity continuity testing, impact classification, counterparty notification
- **Decommission**: Graceful (apoptosis) and emergency (necrosis) with credential revocation tracking
- **Lineage registry**: Ancestors, descendants, siblings, family tree, genetic/epigenetic matching, access-level filtering, redaction

## Install

```bash
npm install agent-lifecycle-protocol
```

## Quick start

```typescript
import {
  LifecycleManager,
  GeneticProfile,
  EpigeneticProfile,
  forkAgent,
} from "agent-lifecycle-protocol";

const manager = new LifecycleManager({ storeDir: ".alp" });

// Create and activate an agent
const agent = manager.genesis({
  agentId: "agent-alpha",
  creatorId: "operator-1",
  geneticProfile: new GeneticProfile({ modelFamily: "claude", modelVersion: "4.6" }),
  epigeneticProfile: new EpigeneticProfile({ role: "coordinator" }),
});
manager.activate("agent-alpha");

// Fork a child agent
const fork = forkAgent(manager, "agent-alpha", "agent-beta", {
  forkType: "specialization",
});
```

## Build & test

```bash
npm install
npm run build
npm test
```

Requires Node.js >= 18. Zero external dependencies (only `@types/node` and `typescript` as dev deps).

## Architecture

| Module | Purpose |
|--------|---------|
| `types.ts` | Constants, enums, data structures, reputation math |
| `store.ts` | Append-only JSONL persistence |
| `lifecycle.ts` | State machine, hook system, core transitions |
| `fork.ts` | Fork operations with inheritance config |
| `succession.ts` | Four-phase succession protocol |
| `migration.ts` | Platform migration (cold/warm/live) |
| `retraining.ts` | Identity continuity test, impact classification |
| `decommission.ts` | Graceful and emergency decommission |
| `registry.ts` | Lineage queries, access control, redaction |

## Config

Set `storeDir` in the `LifecycleManager` constructor to control where JSONL files are written (default: `.alp`).

## License

Apache-2.0
