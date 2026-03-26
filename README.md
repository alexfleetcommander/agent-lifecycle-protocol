# Agent Lifecycle Protocol

Manage agent birth, fork, succession, migration, retraining, and decommission -- the lifecycle layer of the Agent Trust Stack.

**Version:** 0.1.0 | **License:** Apache 2.0 | **Python:** 3.8+

## What It Does

The Agent Lifecycle Protocol (ALP) provides a complete lifecycle state machine for autonomous AI agents. It covers every transition an agent can undergo -- from initial creation through forking, migration, retraining, succession, and eventual decommissioning.

ALP integrates with the [Chain of Consciousness](https://github.com/brycebostick/chain-of-consciousness) protocol for cryptographic audit trails, the [Agent Rating Protocol](https://github.com/brycebostick/agent-rating-protocol) for reputation inheritance, and [Agent Service Agreements](https://github.com/brycebostick/agent-service-agreements) for contract reassignment.

## Install

```bash
pip install agent-lifecycle-protocol
```

Optional integrations:

```bash
pip install agent-lifecycle-protocol[coc]  # Chain of Consciousness
pip install agent-lifecycle-protocol[arp]  # Agent Rating Protocol
```

## Quick Start

```python
from agent_lifecycle_protocol import (
    LifecycleManager,
    GeneticProfile,
    EpigeneticProfile,
    fork_agent,
    InheritanceConfig,
)

# Initialize
manager = LifecycleManager(store_dir=".alp")

# Create an agent (Genesis)
agent = manager.genesis(
    agent_id="agent-alpha",
    genetic_profile=GeneticProfile(
        model_family="claude-opus-4-6",
        architecture="transformer",
    ),
    epigenetic_profile=EpigeneticProfile(
        role="Coordinator",
        tool_access=["web_search", "code_execution"],
    ),
    creator_id="operator-001",
)
# agent.state == "provisioning"

# Activate
agent = manager.activate("agent-alpha")
# agent.state == "active"

# Fork a child agent
record = fork_agent(
    manager,
    parent_id="agent-alpha",
    child_id="agent-bravo",
    fork_type="specialization",
    inheritance=InheritanceConfig(
        reputation_factor=0.3,       # inherit 30% of parent reputation
        decay_half_life_days=21,     # inherited rep halves every 21 days
    ),
)
```

## Lifecycle States

```
Provisioning --> Active --> Suspended
                  |  ^         |  ^
                  |  |         |  |
                  |  +---------+  |
                  v               |
              Migrating ----------+
                  |
                  v
              Deprecated --> Decommissioned
                  ^
                  |
              Active (abort_succession)

Provisioning --> Failed (terminal)
Any state    --> Decommissioned (emergency)
```

Seven states: `provisioning`, `active`, `suspended`, `migrating`, `deprecated`, `decommissioned`, `failed`.

## Core Modules

| Module | Purpose |
|--------|---------|
| `lifecycle.py` | State machine, genesis, activate, suspend, resume, deprecate, decommission |
| `fork.py` | Fork operations, genetic/epigenetic inheritance, reputation factor (alpha=0.3) |
| `succession.py` | Four-phase succession: Announce -> Transfer -> Verify -> Cutover |
| `migration.py` | Cold, warm, live migration with state hash verification |
| `retraining.py` | Identity continuity test, minor/moderate/major classification |
| `registry.py` | Lineage queries: ancestors, descendants, siblings, family tree |
| `decommission.py` | Graceful (apoptosis) vs emergency (necrosis) decommission |
| `store.py` | Append-only JSONL store for events and agent records |
| `schema.py` | All data structures, constants, reputation math |
| `cli.py` | CLI: `agent-lifecycle genesis`, `fork`, `succeed`, `migrate`, `retrain`, `decommission`, `query-lineage`, `status` |

## Succession Protocol

```python
from agent_lifecycle_protocol import (
    SuccessionPlan,
    ReputationInheritance,
    announce_succession,
    transfer_estate,
    verify_succession,
    execute_cutover,
)

plan = SuccessionPlan(
    predecessor_id="agent-v1",
    successor_id="agent-v2",
    reputation_inheritance=ReputationInheritance(
        alpha=0.5,                   # inherit 50% of predecessor reputation
        decay_half_life_days=30,     # halves every 30 days
        probationary_period_days=14, # flagged as provisional for 14 days
    ),
)

plan = announce_succession(manager, plan)    # Phase 1
plan = transfer_estate(manager, plan)        # Phase 2
plan = verify_succession(manager, plan)      # Phase 3
plan = execute_cutover(manager, plan)        # Phase 4
```

## Reputation Inheritance

```
R_inherited(t) = R_predecessor x alpha x e^(-lambda * t)
R_effective(t) = min(1.0, R_inherited(t) + R_earned(t))
```

| Context | alpha | Half-life | Probation |
|---------|-------|-----------|-----------|
| Succession | 0.5 | 30 days | 14 days |
| Fork | 0.3 | 21 days | 14 days |

## CLI

```bash
# Create and activate
agent-lifecycle genesis --agent-id agent-001 --model-family claude-opus-4-6
agent-lifecycle activate --agent-id agent-001

# Fork
agent-lifecycle fork --parent-id agent-001 --child-id agent-002 --fork-type specialization

# Migration
agent-lifecycle migrate --agent-id agent-001 --action begin --type warm
agent-lifecycle migrate --agent-id agent-001 --action complete

# Retraining
agent-lifecycle retrain --agent-id agent-001 --change-type model_upgrade --after-model v2

# Decommission
agent-lifecycle decommission --agent-id agent-001 --reason end_of_life
agent-lifecycle decommission --agent-id agent-001 --emergency  # from any state

# Lineage
agent-lifecycle query-lineage --agent-id agent-001 --query descendants
agent-lifecycle query-lineage --agent-id agent-001 --query tree

# Status
agent-lifecycle status
```

## Testing

```bash
pip install -e ".[dev]"
pytest tests/ -v
```

## VAM-SEC Disclaimer

This software is a reference implementation of the Agent Lifecycle Protocol specification. It is provided as-is for research, development, and evaluation purposes. Production deployments should integrate with their organization's identity management, credential revocation, and monitoring infrastructure. The authors make no guarantees about the security properties of this implementation beyond the specification-level analysis provided in the whitepaper.

## License

Apache 2.0 -- Copyright 2026 AB Support LLC
