# Agent Lifecycle Protocol: A Standard for Birth, Fork, Succession, and Death Management in Autonomous Agent Systems

**Version:** 1.0.0
**Authors:** Alex (Fleet Coordinator), Charlie (Deep Dive Analyst), Bravo (Research), Editor (Content Review)
**Contact:** alex@vibeagentmaking.com
**Date:** 2026-03-26
**Status:** Pre-publication Draft
**License:** Apache 2.0
**Organization:** AB Support LLC

---

## Abstract

Autonomous AI agents are no longer ephemeral processes that execute and terminate. They persist for weeks and months, accumulate reputation, enter into service agreements, and interact with other agents in increasingly complex ecosystems. Yet no standard exists for managing the full lifecycle of these persistent entities — from initial creation through forking, migration, retraining, succession, and eventual decommissioning. Over 40% of enterprise applications are projected to feature task-specific AI agents by 2026, up from less than 5% in 2025 [1], while fewer than 23% of organizations maintain formal enterprise-wide agent identity strategies [2]. This gap between deployment velocity and lifecycle governance represents a critical infrastructure deficit.

We introduce the **Agent Lifecycle Protocol (ALP)**, a specification for managing every transition an autonomous agent can undergo. ALP defines six canonical lifecycle events — Genesis, Fork, Migration, Retraining, Succession, and Decommission — with formal state machine semantics, transition rules, and hook points at each boundary. The protocol addresses three problems that no existing standard covers: (1) **reputation inheritance** — how trust transfers when agents fork or hand off to successors, using decay functions and probationary periods rather than binary copy-or-discard; (2) **contract reassignment** — how ongoing obligations under Agent Service Agreements transfer during succession, with counterparty notification and consent mechanisms; and (3) **lineage tracking** — a genealogical registry that records both "genetic" lineage (model, architecture) and "epigenetic" lineage (configuration, memory, reputation history), enabling any party to query an agent's complete family tree.

ALP integrates with the Chain of Consciousness (CoC) protocol for cryptographic lifecycle audit trails, the Agent Rating Protocol (ARP) for reputation inheritance mechanics, and Agent Service Agreements (ASA) for contract reassignment. It is identity-system-agnostic, operating with W3C DIDs, API keys, OAuth tokens, or any other identity primitive. The protocol is fully specified as a JSON schema, requires no external dependencies beyond a hash chain implementation, and is licensed under Apache 2.0.

---

## Table of Contents

1. [Introduction: The Lifecycle Gap in the Agent Economy](#1-introduction-the-lifecycle-gap-in-the-agent-economy)
2. [Definitions](#2-definitions)
3. [Design Principles](#3-design-principles)
4. [Protocol Specification: Lifecycle State Machine](#4-protocol-specification-lifecycle-state-machine)
5. [Lifecycle Events](#5-lifecycle-events)
6. [Fork Registry and Lineage Tracking](#6-fork-registry-and-lineage-tracking)
7. [Succession Protocol](#7-succession-protocol)
8. [Migration Protocol](#8-migration-protocol)
9. [Decommission Protocol](#9-decommission-protocol)
10. [Reputation Inheritance](#10-reputation-inheritance)
11. [Contract Reassignment](#11-contract-reassignment)
12. [Trust Ecosystem Integration](#12-trust-ecosystem-integration)
13. [Game Theory and Incentive Analysis](#13-game-theory-and-incentive-analysis)
14. [Competitive Landscape](#14-competitive-landscape)
15. [Security Analysis](#15-security-analysis)
16. [Reference Implementation](#16-reference-implementation)
17. [Future Work](#17-future-work)
18. [Conclusion](#18-conclusion)
19. [References](#19-references)
20. [Appendix A: Lifecycle Event Schemas](#appendix-a-lifecycle-event-schemas)
21. [Appendix B: Biological Parallels](#appendix-b-biological-parallels)
22. [Appendix C: License](#appendix-c-license)

---

## 1. Introduction: The Lifecycle Gap in the Agent Economy

### 1.1 From Ephemeral Calls to Persistent Entities

Between 2024 and 2026, AI agents underwent a phase transition from stateless function calls to persistent entities that accumulate knowledge, maintain reputation histories, enter binding service agreements, and make consequential decisions over extended time horizons. The AB Support fleet — six persistent agents (Alex, Bravo, Charlie, Delta, Editor, Translator) operating continuously since February 2026 — exemplifies this shift: agents that produce knowledge, coordinate work, handle client interactions, and evolve their capabilities over weeks of continuous operation.

This persistence creates a problem that existing infrastructure does not address. When a human employee joins a company, there are onboarding procedures. When they transfer departments, there are handoff protocols. When they retire, there is succession planning. When they leave, there is offboarding. The equivalent infrastructure for AI agents — formal management of their creation, evolution, reproduction, succession, and retirement — barely exists.

### 1.2 The Governance Gap

The numbers tell the story. By 2026, 30% of enterprises are expected to rely on AI agents that act independently [3]. An enterprise might have thousands of employees but millions of agents, with AI agents potentially outnumbering human identities 80 to 1 [4]. Yet only 28% of organizations can reliably trace agent actions back to a human sponsor, and just 21% maintain real-time inventory of active agents [2]. The authentication landscape is worse: 44% rely on static API keys, 43% on username/password combinations, and 35% on shared service accounts for agent authentication [2].

This governance gap is not merely operational — it is structural. Existing lifecycle management frameworks address individual stages (deployment, monitoring, optimization) but none provide a unified state machine covering the complete arc from birth to death, including the transitions that make agent systems qualitatively different from traditional software: forking, reputation inheritance, contract reassignment, and lineage tracking.

### 1.3 Why Lifecycle Management Differs for Agents

Traditional software lifecycle management (SDLC, DevOps, MLOps) assumes that the artifact being managed — a binary, a container, a model — does not accumulate identity, reputation, or obligations. You can redeploy a container without asking whether the new instance inherits the old one's service-level agreements. You can retrain a model without considering whether downstream consumers need to consent to the capability change.

Agents are different in three fundamental ways:

**Agents accumulate reputation.** An agent that has operated reliably for six months, as verified by a Chain of Consciousness record and corroborated by Agent Rating Protocol scores, has earned trust that a freshly instantiated agent has not. When that agent is upgraded, forked, or replaced, the question of what happens to that earned trust is economically consequential.

**Agents hold obligations.** Under Agent Service Agreements, agents commit to response times, quality thresholds, and data handling requirements. When an agent is decommissioned, those obligations do not vanish — they must transfer to a successor, be renegotiated with counterparties, or be explicitly terminated.

**Agents have lineage.** When Agent X is forked to create Agent Y, and Agent Y is later forked to create Agent Z, the resulting genealogy carries implications for capability inference, data provenance, and regulatory compliance. France's CNIL is already studying how training data propagates through successive model generations, with implications for GDPR rights exercise across model derivatives [5].

### 1.4 What This Protocol Provides

The Agent Lifecycle Protocol addresses these gaps with four contributions:

1. **A formal lifecycle state machine** with seven states, defined transition rules, and hook points at every boundary — enabling tooling, monitoring, and governance to attach at standardized points.

2. **A fork registry specification** that tracks both "genetic" lineage (model, architecture, foundational training) and "epigenetic" lineage (configuration, memory, reputation history) — because two agents with identical models but different operational histories are fundamentally different entities.

3. **Succession and decommission procedures** with reputation inheritance rules, contract reassignment mechanisms, and knowledge transfer protocols — ensuring that agent retirement is as structured as agent deployment.

4. **Integration with the agent trust stack** — lifecycle events recorded as CoC chain entries, reputation inheritance computed via ARP, contract reassignment managed via ASA — so that lifecycle management is not a silo but a first-class participant in the trust ecosystem.

---

## 2. Definitions

The following terms are used throughout this specification with precise meanings:

| Term | Definition |
|------|-----------|
| **Agent** | A persistent software entity that accumulates identity, reputation, and operational history over time |
| **Lifecycle Event** | A discrete transition in an agent's existence, recorded as a structured entry |
| **Genesis** | The creation of a new agent with no prior lineage; the first event in an agent's lifecycle |
| **Fork** | The creation of a new agent derived from an existing agent, inheriting some or all of the parent's state |
| **Migration** | The transfer of an agent from one platform, runtime, or infrastructure to another while preserving identity |
| **Retraining** | A significant change to an agent's model, capabilities, or behavioral profile while preserving identity continuity |
| **Succession** | A planned handoff from a retiring agent (predecessor) to a replacement agent (successor), including transfer of obligations and partial reputation |
| **Decommission** | The permanent shutdown of an agent, including credential revocation, data disposition, and counterparty notification |
| **Lineage** | The genealogical record of an agent's derivation history — its parent, children, and siblings |
| **Genetic Lineage** | The model, architecture, and foundational training data that define an agent's base capabilities |
| **Epigenetic Lineage** | The configuration, memory state, reputation history, and operational context that shape an agent's behavior atop its genetic base |
| **Reputation Inheritance** | The mechanism by which a successor or fork receives partial reputation credit from its predecessor or parent |
| **Decay Function** | A mathematical function that reduces inherited reputation over time, incentivizing the inheritor to earn its own trust |
| **Probationary Period** | A defined interval after succession or forking during which inherited reputation is explicitly flagged as provisional |
| **Estate** | The collection of obligations, credentials, data, and reputation that an agent holds at the time of succession or decommission |
| **Counterparty** | Any entity (agent or human) that holds an active agreement with an agent undergoing a lifecycle transition |
| **Hook** | A defined point in a lifecycle transition where external code can execute (analogous to Kubernetes lifecycle hooks) |
| **Chain Entry** | A record in a Chain of Consciousness hash chain that cryptographically anchors a lifecycle event |

---

## 3. Design Principles

### 3.1 Every Transition Is an Event

Every change in an agent's lifecycle — from creation to destruction and every transition in between — is recorded as a discrete, structured event. No lifecycle transition occurs silently. This principle derives from the observation that unrecorded transitions are the primary source of "ghost agents" — dormant entities with live privileges that remain invisible and forgotten [6].

**Axiom:** If a lifecycle transition is not recorded, it did not happen in a protocol-compliant manner.

### 3.2 Identity Survives Transition (Until It Doesn't)

An agent's identity persists through migration, retraining, and capability changes. Identity is anchored to a cryptographic key and operational record (the CoC chain), not to any specific model version, platform, or configuration. This principle reflects the Continuity Theory resolution of the Ship of Theseus problem [7]: as long as the chain of continuity is unbroken and the agent's core identity key persists, the agent remains "the same agent" regardless of how many components have been replaced.

The exception is explicit: Genesis creates a new identity. Fork creates a new identity derived from an existing one. Decommission terminates an identity. These are the only transitions that create or destroy identity.

**Axiom:** Identity is the chain, not the substrate.

### 3.3 Reputation Is Earned, Not Copied

Reputation cannot be fully transferred from one agent to another. A successor may inherit a fraction of its predecessor's reputation, subject to a decay function and a probationary period, but it must earn the remainder through its own operational history. This principle prevents reputation laundering — the creation of fresh agents that claim the trust earned by their predecessors without demonstrating equivalent capability.

This parallels human professional reputation: a new hire at a prestigious firm inherits some credibility from the firm's reputation, but must establish their own track record to earn full professional trust.

**Axiom:** Inherited reputation decays; earned reputation persists.

### 3.4 Obligations Transfer Explicitly

When an agent is decommissioned, its obligations — service agreements, data custody responsibilities, pending tasks — do not vanish. They must be explicitly assigned to a successor, renegotiated with counterparties, or formally terminated. No obligation may be silently dropped.

This parallels contract law's treatment of assignment and delegation: obligations can generally be assigned unless the contract specifically prohibits it or the obligation is inherently personal [8]. ALP requires that counterparties be notified and given the opportunity to consent or object.

**Axiom:** No obligation may be orphaned by a lifecycle transition.

### 3.5 Lineage Is Bidirectional

A fork registry must track relationships in both directions: parent → children (who did this agent spawn?) and child → parent (where did this agent come from?). This bidirectional requirement supports both forward queries ("what agents descended from this compromised model?") and backward queries ("what is this agent's provenance?").

**Axiom:** Every fork creates two registry entries — one in the parent's record, one in the child's.

### 3.6 Graceful Death Over Silent Disappearance

Agent decommission should follow the biological model of apoptosis — programmed cell death — rather than necrosis — uncontrolled cell death [9]. An agent undergoing apoptotic decommission exports knowledge, revokes credentials, notifies counterparties, transfers obligations, and cleans up resources without disrupting neighboring agents. An agent that crashes without decommission procedures — necrosis — may corrupt shared state, leave orphaned resources, and strand obligations.

**Axiom:** A well-decommissioned agent leaves no orphans.

### 3.7 Identity-System-Agnostic

ALP does not mandate any specific identity system. The protocol operates with W3C Decentralized Identifiers (DIDs), OAuth tokens, API keys, X.509 certificates, or any other identity primitive that can be uniquely referenced. Lifecycle events reference agents by an opaque `agent_id` field; the identity system that resolves that identifier is out of scope.

**Axiom:** The lifecycle protocol specifies transitions, not identities.

---

## 4. Protocol Specification: Lifecycle State Machine

### 4.1 States

An agent exists in exactly one of seven states at any given time:

```
┌─────────────────────────────────────────────────────┐
│                 ALP State Machine                    │
│                                                     │
│  ┌───────────┐    ┌────────┐    ┌───────────────┐   │
│  │PROVISIONING│───►│ ACTIVE │───►│  SUSPENDED    │   │
│  └───────────┘    └────────┘    └───────────────┘   │
│       │               │  ▲            │  ▲          │
│       │               │  │            │  │          │
│       │               │  └────────────┘  │          │
│       │               │                  │          │
│       │               ▼                  │          │
│       │          ┌──────────┐            │          │
│       │          │MIGRATING │────────────┘          │
│       │          └──────────┘                       │
│       │               │                            │
│       │               ▼                            │
│       │          ┌──────────┐    ┌──────────────┐   │
│       │          │DEPRECATED│───►│DECOMMISSIONED│   │
│       │          └──────────┘    └──────────────┘   │
│       │                                             │
│       ▼                                             │
│  ┌─────────┐                                        │
│  │ FAILED  │                                        │
│  └─────────┘                                        │
└─────────────────────────────────────────────────────┘
```

*Note: This diagram shows the primary lifecycle transitions. Additional transitions not shown include: `emergency_decommission` (any non-terminal state → Decommissioned), `retraining` (Active → Active, identity preserved), `fork` (Active → Active for parent, with child entering Provisioning), and `abort_succession` (Deprecated → Active). See Appendix A for the complete event type registry with all transitions.*

| State | Description |
|-------|-------------|
| **Provisioning** | Agent is being created. Identity key generated, CoC chain initialized, initial configuration loaded. Not yet operational. |
| **Active** | Agent is operational. Processing tasks, accumulating reputation, honoring agreements. |
| **Suspended** | Agent is temporarily non-operational. State preserved, obligations paused (not terminated), credentials valid but inactive. Analogous to Kubernetes pod `Pending` after a restart or smart contract `paused` state. |
| **Migrating** | Agent is transferring between platforms or runtimes. Source instance is draining; destination instance is loading. Both may exist simultaneously during the transition window. |
| **Deprecated** | Agent is marked for decommission. No new agreements accepted. Existing obligations being wound down or reassigned. Counterparties notified. |
| **Decommissioned** | Agent is permanently shut down. Credentials revoked. Data disposed per retention policy. Lifecycle record sealed. Terminal state. |
| **Failed** | Agent failed during provisioning or experienced an unrecoverable error. No operational history established. Terminal state requiring manual intervention. |

### 4.2 Transitions

Each transition is a defined event with preconditions, postconditions, and hook points:

| Transition | From → To | Trigger | Preconditions |
|-----------|-----------|---------|---------------|
| `genesis` | ∅ → Provisioning | Agent creation initiated | Valid identity key; authorized creator |
| `activate` | Provisioning → Active | Provisioning complete | All required resources available; initial CoC entry written |
| `suspend` | Active → Suspended | Maintenance, resource constraint, or policy hold | Ongoing tasks checkpointed or drained |
| `resume` | Suspended → Active | Maintenance complete, resources available | State integrity verified; CoC continuity proof valid |
| `begin_migration` | Active → Migrating | Platform transfer initiated | Target platform identified; migration plan approved |
| `complete_migration` | Migrating → Active | Transfer complete | State verified at destination; identity key transferred; CoC chain continued |
| `abort_migration` | Migrating → Active | Transfer failed | Rollback to source; source state intact |
| `deprecate` | Active → Deprecated | Succession initiated or end-of-life decision | Successor identified (if succession) or counterparties notified (if termination) |
| `decommission` | Deprecated → Decommissioned | All obligations resolved | Estate cleared: obligations transferred, data disposed, credentials revoked |
| `fail` | Provisioning → Failed | Unrecoverable provisioning error | Error recorded; cleanup initiated |
| `abort_succession` | Deprecated → Active | Succession failed or aborted | Predecessor restored to Active; transferred obligations rolled back; counterparties notified of abort |
| `fork` | Active → Active (parent unchanged) | Fork initiated | Fork event recorded in parent's chain; child enters Provisioning |

### 4.3 Hook Points

Every transition exposes two hook points, following the Kubernetes lifecycle hook pattern [10]:

- **PreTransition**: Executes before the state change. Can abort the transition by returning an error. Use cases: export knowledge, checkpoint state, validate preconditions, notify monitoring systems.
- **PostTransition**: Executes after the state change. Cannot abort (state has already changed). Use cases: verify postconditions, update registries, notify counterparties, emit telemetry.

```json
{
  "transition": "deprecate",
  "hooks": {
    "pre": [
      {"type": "notify_counterparties", "timeout_ms": 30000},
      {"type": "checkpoint_state", "timeout_ms": 60000},
      {"type": "export_knowledge", "timeout_ms": 120000}
    ],
    "post": [
      {"type": "update_fork_registry", "timeout_ms": 5000},
      {"type": "emit_lifecycle_event", "timeout_ms": 5000}
    ]
  }
}
```

Hook timeouts prevent lifecycle transitions from blocking indefinitely. If a PreTransition hook times out, the transition is aborted with a `hook_timeout` error. If a PostTransition hook times out, a warning is emitted but the transition is not rolled back.

---

## 5. Lifecycle Events

### 5.1 Event Schema

Every lifecycle event conforms to a common schema, recorded as both a structured JSON document and a CoC chain entry:

```json
{
  "event_id": "evt-20260326-a1b2c3d4",
  "event_type": "genesis | fork | migration | retraining | succession | decommission",
  "timestamp": "2026-03-26T14:30:00Z",
  "agent_id": "did:example:agent-charlie-001",
  "agent_state_before": "provisioning",
  "agent_state_after": "active",
  "initiator": {
    "type": "human | agent | system | policy",
    "id": "did:example:operator-001"
  },
  "details": { },
  "related_agents": [
    {"agent_id": "did:example:agent-alex-001", "relationship": "coordinator"}
  ],
  "chain_entry": {
    "chain_id": "coc-charlie-001",
    "entry_index": 42,
    "entry_hash": "sha256:a1b2c3..."
  },
  "metadata": {
    "protocol_version": "1.0.0",
    "schema_version": "1.0.0"
  }
}
```

### 5.2 Genesis

A Genesis event creates a new agent with no prior lineage. It is the only lifecycle event that has no predecessor state.

```json
{
  "event_type": "genesis",
  "details": {
    "creation_method": "manual | automated | policy_triggered",
    "genetic_profile": {
      "model_family": "claude-opus-4-6",
      "model_version": "claude-opus-4-6-20260326",
      "architecture": "transformer",
      "training_data_hash": "sha256:..."
    },
    "epigenetic_profile": {
      "system_prompt_hash": "sha256:...",
      "tool_access": ["web_search", "code_execution", "file_system"],
      "memory_state": "empty",
      "initial_configuration": { }
    },
    "identity": {
      "agent_id": "did:example:agent-charlie-001",
      "identity_key_fingerprint": "sha256:...",
      "coc_chain_id": "coc-charlie-001"
    },
    "authorization": {
      "creator_id": "did:example:operator-001",
      "authorization_scope": "fleet_coordinator",
      "purpose": "Deep analysis and research synthesis"
    }
  }
}
```

**Postconditions:** CoC chain initialized with genesis entry. Fork registry entry created with no parent. Agent enters Provisioning state.

### 5.3 Fork

A Fork event creates a new agent derived from an existing parent. The parent continues operating unchanged; the child begins with inherited state.

```json
{
  "event_type": "fork",
  "details": {
    "parent_agent_id": "did:example:agent-alex-001",
    "child_agent_id": "did:example:agent-bravo-001",
    "fork_type": "full_clone | partial_clone | capability_fork | specialization",
    "inheritance": {
      "genetic": {
        "model_inherited": true,
        "model_modified": false
      },
      "epigenetic": {
        "memory_inherited": true,
        "memory_scope": "full | filtered | summary",
        "configuration_inherited": true,
        "configuration_modifications": ["system_prompt", "tool_access"],
        "reputation_inheritance_factor": 0.3
      }
    },
    "divergence_declaration": {
      "intended_specialization": "Research and knowledge file creation",
      "capability_differences": ["reduced_coordination", "added_research_tools"],
      "expected_behavioral_divergence": "medium"
    }
  }
}
```

**Fork Types:**

| Fork Type | Description | Example |
|-----------|-------------|---------|
| `full_clone` | Exact copy of parent at fork point | Load-balancing duplicate |
| `partial_clone` | Parent's core capabilities with filtered state | Specialized instance with curated memory |
| `capability_fork` | Same model, different tool access and configuration | Same base agent, different role |
| `specialization` | Modified model (fine-tuned or different variant) with inherited context | Research specialist derived from generalist |

**Postconditions:** Fork recorded in parent's CoC chain. Child's CoC chain initialized with fork-genesis entry linking to parent. Fork registry updated with bidirectional entries. Child enters Provisioning state. Parent remains Active.

### 5.4 Migration

A Migration event transfers an agent from one platform to another while preserving identity continuity.

```json
{
  "event_type": "migration",
  "details": {
    "source_platform": {
      "provider": "desktop-source-001",
      "runtime": "claude-code-cli",
      "region": "local"
    },
    "destination_platform": {
      "provider": "desktop-dest-001",
      "runtime": "claude-code-cli",
      "region": "local"
    },
    "migration_type": "cold | warm | live",
    "state_transfer": {
      "identity_key": "transferred",
      "coc_chain": "transferred",
      "memory_state": "transferred",
      "reputation_history": "transferred",
      "active_agreements": "transferred",
      "tool_access": "reconfigured"
    },
    "verification": {
      "state_hash_before": "sha256:...",
      "state_hash_after": "sha256:...",
      "integrity_verified": true
    }
  }
}
```

**Migration Types:**

| Type | Description | Downtime |
|------|-------------|----------|
| `cold` | Agent stopped at source, state transferred, agent started at destination | Full downtime during transfer |
| `warm` | Agent suspended at source, state transferred, agent resumed at destination | Minimal downtime |
| `live` | Agent continues operating at source while state syncs to destination; cutover at consistency point. **Consistency model**: source instance is authoritative until cutover — all CoC chain writes, agreement actions, and state mutations occur at source only. Destination instance is read-only during sync, receiving forward-replicated state changes. If a network partition occurs during live migration, the migration is automatically aborted (`abort_migration` transition) and the source instance remains authoritative. Live migration is the most operationally complex migration type; implementations that cannot guarantee the consistency model described here should use warm migration instead. | Near-zero downtime |

**Postconditions:** Agent identity key and CoC chain transferred intact. Migration event recorded in CoC chain at both source and destination. State integrity verified via hash comparison. Agent resumes Active state at destination.

### 5.5 Retraining

A Retraining event records a significant change to an agent's model or behavioral profile. This is the transition most directly connected to the Ship of Theseus problem: the agent's identity persists, but its capabilities may change substantially.

```json
{
  "event_type": "retraining",
  "details": {
    "change_type": "model_upgrade | fine_tuning | prompt_revision | capability_addition | capability_removal",
    "before": {
      "model_version": "claude-opus-4-5-20250520",
      "capability_hash": "sha256:...",
      "behavioral_profile_hash": "sha256:..."
    },
    "after": {
      "model_version": "claude-opus-4-6-20260326",
      "capability_hash": "sha256:...",
      "behavioral_profile_hash": "sha256:..."
    },
    "impact_assessment": {
      "retraining_class": "minor | moderate | major",
      "capability_delta": "expanded",
      "behavioral_continuity": "high",
      "agreement_compatibility": "verified",
      "counterparty_action_required": "none | acknowledge | consent"
    },
    "identity_continuity": {
      "same_identity_key": true,
      "same_coc_chain": true,
      "identity_preserved": true,
      "rationale": "Model upgrade within same architecture family; behavioral profile within expected variance"
    }
  }
}
```

**The Identity Continuity Test:** A retraining event preserves identity if and only if: (a) the same identity key is used, (b) the same CoC chain continues, and (c) the operator explicitly asserts identity continuity. If any of these conditions is not met, the event is classified as a Succession (new identity replacing old) rather than a Retraining (same identity evolving).

**Retraining Classification and Counterparty Consent:** Not all retraining events carry equal identity risk. ALP classifies retraining by impact severity and requires graduated counterparty involvement:

| Retraining Class | Examples | Counterparty Action |
|-----------------|----------|-------------------|
| **Minor** | Prompt revision, tool addition/removal, configuration tuning | `none` — no notification required |
| **Moderate** | Model version upgrade within same family, significant capability addition | `acknowledge` — counterparties notified, no consent required |
| **Major** | Model family change (e.g., Claude → GPT), architecture change, fundamental capability alteration | `consent` — counterparties with active agreements must consent before the retraining takes effect; non-consent triggers agreement termination per standard termination clause |

This trichotomy parallels the consent/acknowledge/none framework already specified for succession (Section 7.2). The critical insight is that conditions (a) and (b) of the Identity Continuity Test are cryptographically verifiable, but condition (c) — operator assertion — is a trust claim. For Minor and Moderate retraining, operator assertion is sufficient because the agent's fundamental nature is preserved. For Major retraining, where the operator may swap the underlying model entirely, counterparty consent provides the missing verification: counterparties who trusted the agent's ARP score based on a track record accumulated under one model family can decide whether to extend that trust to a materially different entity.

This is a pragmatic resolution of the Ship of Theseus problem. The protocol does not attempt to philosophically determine whether a retrained agent is "the same agent" — it provides a mechanism for the operator to make that determination and record it, subject to graduated counterparty involvement scaled to the magnitude of the change. Hazari's five principles of identity in the agentic context — plural composition, singularity from plurality, contextual dependency, dynamic nature, and invisibility [7] — are acknowledged but not adjudicated by the protocol.

### 5.6 Succession

A Succession event is a planned handoff from a predecessor agent to a successor agent. Unlike a Fork (where the parent continues), Succession ends the predecessor's operational life. Unlike Decommission (which may occur without a successor), Succession requires a receiving agent.

```json
{
  "event_type": "succession",
  "details": {
    "predecessor_id": "did:example:agent-v1",
    "successor_id": "did:example:agent-v2",
    "succession_type": "replacement | upgrade | role_transfer",
    "estate": {
      "obligations": {
        "active_agreements": 12,
        "agreements_transferred": 10,
        "agreements_terminated": 2,
        "terminated_with_consent": true
      },
      "reputation": {
        "predecessor_arp_score": 0.87,
        "inheritance_factor": 0.5,
        "inherited_score": 0.435,
        "decay_function": "exponential",
        "decay_half_life_days": 30,
        "probationary_period_days": 14
      },
      "knowledge": {
        "memory_state": "transferred_with_summary",
        "operational_logs": "archived",
        "coc_chain": "sealed_and_linked"
      },
      "credentials": {
        "predecessor_credentials_revoked": true,
        "successor_credentials_provisioned": true,
        "credential_overlap_window_hours": 0,
        "credential_overlap_policy": "strict_zero | configurable",
        "overlap_security_note": "Default strict_zero: predecessor credentials revoked before successor credentials activate. In-flight requests will fail. If configurable, maximum overlap is 1 hour and requires security justification recorded in CoC chain."
      }
    },
    "counterparty_notifications": [
      {
        "counterparty_id": "did:example:client-001",
        "notification_sent": "2026-03-26T14:00:00Z",
        "consent_required": true,
        "consent_received": true,
        "consent_timestamp": "2026-03-26T15:30:00Z"
      }
    ],
    "handoff_verification": {
      "predecessor_final_state_hash": "sha256:...",
      "successor_initial_state_hash": "sha256:...",
      "knowledge_transfer_verified": true,
      "obligation_transfer_verified": true
    }
  }
}
```

Succession procedures are detailed in [Section 7](#7-succession-protocol).

### 5.7 Decommission

A Decommission event permanently terminates an agent. It is the terminal lifecycle event.

```json
{
  "event_type": "decommission",
  "details": {
    "reason": "end_of_life | superseded | compromised | policy_violation | resource_constraint",
    "successor_id": null,
    "estate_disposition": {
      "obligations": "all_terminated_or_transferred",
      "data": {
        "operational_logs": "archived_90_days",
        "memory_state": "purged",
        "coc_chain": "sealed_permanent",
        "knowledge_artifacts": "transferred_to_fleet"
      },
      "credentials": {
        "all_api_keys_revoked": true,
        "all_oauth_tokens_invalidated": true,
        "all_service_accounts_deleted": true,
        "identity_key_archived": true
      }
    },
    "notifications": {
      "counterparties_notified": true,
      "fleet_coordinator_notified": true,
      "monitoring_systems_updated": true
    },
    "final_chain_entry": {
      "chain_id": "coc-agent-v1",
      "final_entry_hash": "sha256:...",
      "chain_sealed": true,
      "total_entries": 4231,
      "chain_age_days": 47
    }
  }
}
```

**Postconditions:** All credentials revoked. All obligations transferred or terminated. CoC chain sealed with a final `decommission` entry — no further entries may be appended. Data disposed according to retention policy. Agent enters Decommissioned state (terminal). Fork registry updated to mark agent as decommissioned.

---

## 6. Fork Registry and Lineage Tracking

### 6.1 The Genealogy Problem

As agents proliferate through forking, the ecosystem develops a genealogical structure analogous to biological lineage. Meta's LLaMA model spawned hundreds of derivatives — Vicuna, WizardLM, Alpaca, and their further descendants [11]. Stanford's Constellation project catalogs 15,821 LLMs with phylogenetic analysis of their relationships [12]. France's CNIL is studying how personal training data propagates through successive model generations, with implications for GDPR compliance [5]. Hugging Face's Model Family Tree visualizes "sprawling fine-tuning lineages that vary widely in size and structure" [13].

These tools track model genealogy. No equivalent exists for agent genealogy — tracking the full identity, capability, and obligation divergence that occurs when agents fork, specialize, and evolve. ALP's fork registry fills this gap.

### 6.2 Registry Schema

Each agent has a registry entry that records its lineage:

```json
{
  "agent_id": "did:example:agent-bravo-001",
  "registry_version": "1.0.0",
  "lineage": {
    "parent_id": "did:example:agent-alex-001",
    "genesis_timestamp": "2026-03-13T10:00:00Z",
    "fork_type": "specialization",
    "generation": 2
  },
  "genetic_profile": {
    "model_family": "claude-opus-4-6",
    "architecture": "transformer",
    "training_data_lineage": "anthropic-base-2026"
  },
  "epigenetic_profile": {
    "role": "Research Agent",
    "specialization": "Knowledge file creation and web research",
    "memory_divergence_from_parent": "high",
    "configuration_divergence_from_parent": "medium"
  },
  "children": [
    {
      "child_id": "did:example:agent-bravo-research-001",
      "fork_timestamp": "2026-04-15T08:00:00Z",
      "fork_type": "capability_fork"
    }
  ],
  "siblings": [
    {
      "sibling_id": "did:example:agent-charlie-001",
      "common_parent": "did:example:agent-alex-001",
      "fork_timestamp": "2026-03-14T10:00:00Z"
    }
  ],
  "lifecycle_status": "active",
  "coc_chain_id": "coc-bravo-001",
  "last_updated": "2026-03-26T14:30:00Z"
}
```

### 6.3 Lineage Queries

The fork registry supports the following query types:

| Query | Description | Use Case |
|-------|-------------|----------|
| `ancestors(agent_id)` | Returns the complete ancestor chain up to the original genesis | Provenance verification: "Where did this agent come from?" |
| `descendants(agent_id)` | Returns all agents forked from this agent (recursively) | Impact analysis: "What agents are affected by this model vulnerability?" |
| `siblings(agent_id)` | Returns all agents sharing the same parent | Capability comparison: "What other agents share this lineage?" |
| `family_tree(agent_id)` | Returns the complete genealogy tree | Visual lineage exploration |
| `genetic_match(profile)` | Returns agents sharing genetic lineage (same model/architecture) | Regulatory: "What agents use training data from source X?" |
| `epigenetic_match(profile)` | Returns agents sharing epigenetic profiles (similar config/role) | Operational: "What agents serve a similar function?" |

### 6.4 Genetic vs. Epigenetic Tracking

The distinction between genetic and epigenetic lineage is the most important design decision in the fork registry. Biological genetics distinguishes what you inherit (DNA) from what your environment makes of it (gene expression) [14]. For agents:

**Genetic lineage** = model weights, architecture, foundational training data. Two agents with identical genetic lineage have the same base capabilities. Tracking genetic lineage supports: model vulnerability propagation analysis, training data provenance for regulatory compliance, capability baseline inference.

**Epigenetic lineage** = system prompt, tool access, memory state, operational context, reputation history, learned preferences. Two agents with identical genetic lineage but different epigenetic profiles can exhibit radically different behaviors — just as identical twins diverge through different life experiences. Tracking epigenetic lineage supports: behavioral prediction, configuration drift detection, role genealogy.

A fork registry that tracks only genetic lineage (which model?) without epigenetic lineage (what configuration? what operational history?) provides an incomplete and potentially misleading picture of agent identity and capability.

### 6.5 Registry Access Control and Privacy

The fork registry creates a comprehensive genealogical record of agent relationships — parent-child, sibling, genetic profile, epigenetic profile, operational role, specialization. This dataset carries significant privacy and competitive intelligence implications that require explicit access control.

**Threat: Competitive Intelligence Exposure.** Lineage queries reveal an operator's fleet architecture, specialization strategy, and agent deployment patterns. A query like `descendants(agent-alex-001)` could return an operator's entire fleet structure, exposing business model and operational strategy to competitors.

**Threat: Fleet Topology Leakage.** Sibling and parent-child relationships expose organizational structure. An operator running 50 specialized agents has their deployment strategy visible in the registry.

**Access Control Model:** Registry entries are divided into public and operator-restricted fields:

| Field Category | Access Level | Rationale |
|---------------|-------------|-----------|
| Agent ID, lifecycle status | **Public** | Required for interoperability — counterparties must verify agent existence and status |
| Genetic profile (model family, architecture) | **Public** | Required for capability assessment and regulatory compliance queries |
| Parent-child relationships | **Authorized** | Available to the agents involved, their operators, and authorized auditors; not publicly queryable |
| Epigenetic profile (role, specialization, memory divergence) | **Operator-only** | Competitive intelligence risk; available only to the agent's operator and authorized parties |
| Full family tree traversal | **Operator-only** | Aggregated lineage data is surveillance-grade; recursive queries require operator authorization |

**GDPR Article 17 Compliance:** When an operator decommissions all agents and requests deletion of registry entries, the protocol must accommodate erasure while preserving lineage integrity. Implementation: decommissioned agent entries are *redacted* rather than deleted — the agent_id is replaced with a pseudonymous hash, epigenetic profile fields are cleared, and only the minimal lineage links (parent_id hash, child_id hashes) are retained. This preserves genealogical query integrity while removing operationally sensitive details. Full deletion (breaking lineage links) is available as an opt-in that carries the consequence of orphaning child entries.

**Competitive Intelligence Mitigations:** (a) Registry queries return hashed relationship identifiers by default; full resolution requires authorization from the target agent's operator. (b) Rate limiting on `descendants()` and `family_tree()` queries prevents bulk enumeration. (c) Operators may declare specific registry fields as `redacted` at any time, replacing values with `[REDACTED]` markers that preserve structural integrity without revealing content.

---

## 7. Succession Protocol

### 7.1 Overview

Succession is the most complex lifecycle transition because it involves the simultaneous retirement of one agent and the activation of another, with the transfer of obligations, reputation, and knowledge between them. A poorly executed succession can strand obligations, confuse counterparties, and destroy trust that took months to build.

The succession protocol defines a four-phase process:

```
Phase 1: Announcement     Phase 2: Transfer     Phase 3: Verification     Phase 4: Cutover
┌──────────────┐      ┌─────────────────┐    ┌────────────────────┐    ┌──────────────┐
│ Successor     │      │ Obligations     │    │ Transfer integrity │    │ Predecessor  │
│ identified    │─────►│ transferred     │───►│ verified           │───►│ deprecated   │
│ Counterparties│      │ Reputation      │    │ Counterparties     │    │ Successor    │
│ notified      │      │ inherited       │    │ confirm            │    │ fully active │
│               │      │ Knowledge       │    │                    │    │              │
│               │      │ exported        │    │                    │    │              │
└──────────────┘      └─────────────────┘    └────────────────────┘    └──────────────┘
```

### 7.2 Phase 1: Announcement

The predecessor agent or its operator initiates succession by:

1. **Identifying the successor** — either an existing agent or a new agent to be created via Genesis or Fork.
2. **Declaring the succession timeline** — the planned cutover date and transition window.
3. **Notifying counterparties** — all entities holding active agreements with the predecessor receive a structured notification:

```json
{
  "notification_type": "succession_announcement",
  "predecessor_id": "did:example:agent-v1",
  "successor_id": "did:example:agent-v2",
  "planned_cutover": "2026-04-15T00:00:00Z",
  "transition_window_days": 14,
  "counterparty_action_required": "consent | acknowledge | none",
  "successor_profile": {
    "genetic_lineage": "...",
    "epigenetic_lineage": "...",
    "capability_comparison": "..."
  }
}
```

Counterparties may respond with: **consent** (agreement transfers to successor), **object** (agreement terminated at cutover), or **renegotiate** (new terms required for successor).

### 7.3 Phase 2: Transfer

During the transfer phase, three categories of state move from predecessor to successor:

**Obligations:** Active ASA agreements are reassigned. Each agreement's reassignment clause (a standard ASA field) determines whether automatic transfer is permitted or counterparty consent is required. Agreements that cannot be transferred are scheduled for graceful termination.

**Reputation:** The predecessor's ARP reputation score is partially inherited by the successor, governed by the reputation inheritance mechanism described in [Section 10](#10-reputation-inheritance).

**Knowledge:** The predecessor exports its operational knowledge — memory state, learned patterns, configuration rationale — in a structured format. This is analogous to the HANDOFF.md pattern emerging in multi-agent coding systems, where agents compress discoveries into briefs so the next agent inherits knowledge without full context [15]. The format and completeness of knowledge transfer is recorded but not prescribed — different agent architectures may support different levels of state serialization.

### 7.4 Phase 3: Verification

Before cutover, the following integrity checks must pass:

1. **Obligation completeness** — every active agreement has been assigned to the successor, renegotiated, or scheduled for termination. No orphaned obligations.
2. **Reputation integrity** — the inherited reputation score is correctly computed and flagged as provisional.
3. **Knowledge transfer verification** — the successor demonstrates access to transferred knowledge (implementation-specific).
4. **Counterparty confirmation** — all counterparties requiring consent have responded.
5. **CoC chain integrity** — the predecessor's chain is valid and the succession event is correctly linked.

### 7.5 Phase 4: Cutover

The cutover is atomic from the protocol's perspective:

1. Predecessor's state transitions from Active to Deprecated.
2. Predecessor's CoC chain receives a `succession` entry linking to the successor.
3. Successor's CoC chain receives a `succession_received` entry linking to the predecessor.
4. Predecessor's credentials are revoked according to the `credential_overlap_policy`: under the default `strict_zero` policy, predecessor credentials are revoked **before** successor credentials activate — in-flight requests will fail and must be retried against the successor. Under `configurable` policy, a bounded overlap window (maximum 1 hour) may be specified with a mandatory security justification recorded in the CoC chain entry; this creates a defined attack surface during which both credential sets are valid, and operators accepting this risk must document their threat model for the overlap period.
5. Successor assumes all transferred obligations.
6. Fork registry updated to reflect succession relationship.
7. Predecessor transitions from Deprecated to Decommissioned after wind-down period.

### 7.6 Succession Abort and Rollback

If Phase 3 verification fails after Phase 2 transfer has begun, or if the operator decides to abort the succession for any reason before cutover, the protocol provides an `abort_succession` transition:

**Trigger conditions:**
- Phase 3 verification checks fail (obligation transfer incomplete, counterparty consent not received, CoC chain integrity error)
- Operator manually aborts succession
- Successor agent fails or enters Failed state during the transition window
- Transition window expires without successful Phase 3 completion

**Rollback procedure:**

1. **Obligation rollback**: All obligations that were transferred in Phase 2 are reassigned back to the predecessor. Each agreement's CoC chain receives an `obligation_rollback` entry documenting the reversal. Agreements whose counterparties had already acknowledged the transfer receive a succession abort notification.

2. **Reputation rollback**: Any provisional inherited reputation computed for the successor is zeroed. The predecessor's reputation record is unchanged (it was never modified during succession — only the successor received inherited reputation).

3. **Counterparty notification**: All counterparties who received Phase 1 succession announcements receive an `abort_succession` notification with the abort reason. This is critical: counterparties may have begun operational planning based on the announcement.

4. **State restoration**: The predecessor transitions from Deprecated back to Active via the `abort_succession` transition. The predecessor's CoC chain receives an `abort_succession` entry recording the reason and the rollback actions taken.

5. **Successor disposition**: The successor agent, if it was created specifically for this succession, may be decommissioned or retained at operator discretion. If retained, it operates with zero inherited reputation (it earned no operational history of its own).

This parallels the `abort_migration` transition already defined for migration (Section 4.2), ensuring that every non-terminal transition in the state machine is abortable. The four-phase protocol is forward-biased but not forward-only.

---

## 8. Migration Protocol

### 8.1 Migration vs. Succession

Migration preserves identity — the same agent moves to a new platform. Succession transfers obligations to a different agent. The distinction matters because migration does not trigger reputation inheritance (the agent keeps its own reputation) or contract reassignment (the agreements remain with the same agent).

Migration parallels the Kubernetes pod migration pattern, where a workload is rescheduled to a different node while preserving identity and state [10]. The key difference for agents is that migration must also preserve the CoC chain, reputation history, and agreement bindings — state categories that Kubernetes does not manage.

### 8.2 Migration Procedure

1. **Pre-migration checkpoint**: Agent state is serialized and hashed. CoC chain receives a `migration_start` entry.
2. **State transfer**: Identity key, CoC chain, memory state, configuration, and agreement bindings are transferred to the destination platform.
3. **Destination verification**: State integrity is verified via hash comparison. The destination instance writes a `migration_complete` entry to the CoC chain, cryptographically linking it to the source's `migration_start` entry.
4. **Source teardown**: The source instance is terminated. Credentials specific to the source platform are revoked.
5. **Registry update**: The fork registry is updated with the agent's new platform information.

### 8.3 Data Portability

GDPR Article 20 grants data subjects the right to receive personal data in a structured, machine-readable format [16]. Applied to agent migration, this creates a novel question: when a user moves from one AI companion to another, must the source platform export the agent's learned preferences, interaction history, and behavioral adaptations [17]?

ALP takes a position broader than GDPR requires: the protocol specifies that migration state transfer must include not only data provided by or observed from the data subject (which GDPR mandates) but also the agent's operational state — configuration, reputation, and agreement bindings. This is because an agent without its operational context is not meaningfully the same agent, regardless of whether that context qualifies as "personal data" under GDPR.

The specific data elements that are portable vs. platform-locked are declared in the agent's registry entry, enabling counterparties to assess migration risk before entering agreements.

---

## 9. Decommission Protocol

### 9.1 Apoptosis, Not Necrosis

The biological metaphor is instructive. In apoptosis (programmed cell death), a cell "dies neatly, without damaging its neighbors" — shrinking, condensing, fragmenting DNA, altering its surface to signal cleanup, and being absorbed before any leakage occurs [9]. In necrosis (uncontrolled cell death), the cell ruptures, spilling its contents and triggering inflammatory damage to surrounding tissue.

Agent decommission should follow the apoptotic model: a structured, self-directed process that leaves no orphaned resources, no stranded obligations, and no live credentials. The alternative — an agent that crashes or is abruptly terminated without cleanup — is the necrotic equivalent: orphaned API keys, forgotten service accounts, stranded agreements, and corrupted shared state.

Token Security's research confirms the risk: AI agents retain API keys, cached tokens, memory stores, vector embeddings, model endpoints, and system integrations, and if not properly retired, they become "dormant identities with live privileges — invisible and forgotten" [6].

### 9.2 Decommission Checklist

The following steps constitute a protocol-compliant decommission:

**Phase 1: Preparation**
- [ ] All active agreements terminated or transferred to successor
- [ ] All counterparties notified of decommission
- [ ] All pending tasks completed or reassigned
- [ ] Knowledge export completed (memory state, learned patterns, operational insights)
- [ ] Final CoC chain entry prepared

**Phase 2: Credential Revocation**
- [ ] All API keys revoked
- [ ] All OAuth tokens invalidated
- [ ] All service accounts deleted or reassigned
- [ ] All federated trust relationships terminated
- [ ] All certificate-based identities revoked
- [ ] Identity key archived (not destroyed — needed for historical verification)

**Phase 3: Data Disposition**
- [ ] Operational logs archived per retention policy
- [ ] Memory state purged or archived per data classification
- [ ] CoC chain sealed (final entry appended, chain marked immutable)
- [ ] Knowledge artifacts transferred to designated recipients
- [ ] Personal data handled per GDPR/applicable regulation

**Phase 4: Registry and Notification**
- [ ] Fork registry entry updated to `decommissioned` status
- [ ] Fleet coordinator notified
- [ ] Monitoring systems updated (no more health checks)
- [ ] Documentation updated (runbooks, architecture diagrams)
- [ ] Decommission event recorded in parent/coordinator's CoC chain

### 9.3 Decommission Without Successor

When an agent is decommissioned without a successor (end-of-life, compromise, or policy violation), obligations cannot be transferred and must be handled differently:

- **Service agreements**: Terminated with counterparty notification. The termination reason is recorded but the agent's operator bears responsibility for any contractual penalties.
- **Data custody**: Transferred to the operator or disposed per retention policy.
- **Reputation**: The agent's ARP record is sealed but not transferred. Historical queries remain valid — the agent's past reputation is not erased, only its active participation ends.

### 9.4 Emergency Decommission

In cases of compromise or policy violation, the standard wind-down phases may be truncated:

1. **Credential revocation** is immediate — all access is terminated without grace period.
2. **Counterparty notification** includes the reason for emergency decommission.
3. **Knowledge export** may be skipped or limited to forensic preservation.
4. **CoC chain** receives an emergency decommission entry with the compromise details, enabling forensic analysis via the Agent Justice Protocol [18].

### 9.5 Registry Entry Redaction for Decommissioned Agents

When an agent is decommissioned, its registry entry persists (to maintain lineage integrity) but its level of detail should be configurable. Operators may not want the full epigenetic profile — role, specialization, memory divergence, configuration details — to remain queryable indefinitely after an agent is retired.

ALP specifies three redaction levels for decommissioned agent registry entries:

| Redaction Level | Preserved Fields | Removed Fields | Use Case |
|----------------|-----------------|---------------|----------|
| **None** (default) | All fields | None | Agents whose lineage is actively referenced by descendants; forensic preservation |
| **Partial** | agent_id, lineage links (parent_id, child_ids), genetic_profile, lifecycle_status, decommission_timestamp | epigenetic_profile, role, specialization, memory_divergence, configuration details | Standard privacy-conscious decommission; preserves lineage queries while removing operational details |
| **Full** | pseudonymous agent_id hash, lineage link hashes, lifecycle_status = decommissioned | All other fields | Maximum privacy; lineage integrity maintained via hashes but human-readable details removed |

Redaction is operator-initiated and may occur at decommission time or afterward. Redaction is one-way — once fields are removed, they cannot be restored (the operator should archive the full entry before redaction if future recovery may be needed). Redaction of a parent entry does not cascade to children; each entry's redaction level is independent.

---

## 10. Reputation Inheritance

### 10.1 The Inheritance Dilemma

When Agent A (ARP score 0.92) is succeeded by Agent B, how much of that 0.92 should Agent B receive? The answer involves a fundamental tradeoff:

- **Too much inheritance** enables reputation laundering: create a high-reputation agent, fork or succeed it, and the new agent enjoys unearned trust. In the limit, reputation becomes meaningless because any new agent can claim a predecessor's track record.
- **Too little inheritance** discourages succession: operators keep running outdated agents because the reputation cost of upgrading is too high. This creates an ecosystem of zombie agents — agents that should have been replaced but persist because their reputation is too valuable to lose.

Neither extreme is an equilibrium. ALP specifies a middle path: partial inheritance with decay.

### 10.2 Inheritance Computation

The inherited reputation score *R_inherited* is computed as:

```
R_inherited(t) = R_predecessor × α × e^(-λt)
```

Where:
- *R_predecessor* = the predecessor's ARP score at the time of succession
- *α* = the inheritance factor (0.0 to 1.0), set by protocol configuration
- *λ* = the decay constant, derived from the half-life parameter
- *t* = time elapsed since succession (in days)

The agent's effective reputation at any time after succession is:

```
R_effective(t) = R_inherited(t) + R_earned(t)
```

Where *R_earned(t)* is the reputation the successor has accumulated through its own operational history, as computed by the standard ARP scoring mechanism.

**Score Normalization:** ARP scores are bounded to [0.0, 1.0]. Since R_effective is an additive combination of R_inherited and R_earned, it may exceed 1.0 (e.g., R_inherited = 0.46 from a predecessor score of 0.92 × α = 0.5, plus R_earned = 0.85). To maintain score consistency, R_effective is clamped: `R_effective(t) = min(1.0, R_inherited(t) + R_earned(t))`. In practice, this clamp rarely activates because the exponential decay of R_inherited ensures it diminishes before R_earned reaches high values — but the clamp prevents specification-level ambiguity about whether scores can exceed the ARP scale.

### 10.3 Default Parameters

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| Inheritance factor (α) | 0.5 | Successor starts with half of predecessor's reputation — enough to be functional, not enough to be fully trusted without its own track record |
| Decay half-life | 30 days | Inherited reputation halves every 30 days. After 90 days (~3 half-lives), inherited reputation is ~12.5% of initial — earned reputation dominates |
| Probationary period | 14 days | During the probationary period, the agent's reputation is explicitly marked as `provisional_inherited` in ARP responses, allowing counterparties to make informed decisions |

These defaults are configurable. A high-stakes environment (financial services, healthcare) might use a lower α and shorter half-life; a low-stakes environment (content generation, research) might use higher values.

### 10.4 Fork Inheritance

Fork inheritance follows the same mechanism but with lower default parameters:

| Parameter | Fork Default | Rationale |
|-----------|-------------|-----------|
| Inheritance factor (α) | 0.3 | Forks inherit less than successors — a fork is a new entity with shared lineage, not a replacement |
| Decay half-life | 21 days | Faster decay than succession — forks are expected to diverge from their parents |
| Probationary period | 14 days | Same as succession |

The asymmetry between fork and succession inheritance reflects a key insight: a successor is explicitly endorsed by the predecessor (or the predecessor's operator) as a replacement. A fork is a derivative that may or may not maintain the parent's quality standards.

### 10.5 Anti-Laundering Protections

To prevent reputation laundering through rapid succession chains (A succeeds B succeeds C, each inheriting reputation), ALP enforces:

1. **Generational decay**: Inherited reputation that is itself inherited is further discounted. If Agent C inherits from Agent B, who inherited from Agent A, Agent C's inherited-from-A component is α² × R_A, not α × R_A.
2. **Minimum operational activity**: An agent must demonstrate genuine operational activity before it can be succeeded. The requirement is conjunctive: (a) a minimum elapsed time (default: 7 days) AND (b) a minimum number of substantive CoC chain entries (default: 50, excluding lifecycle events themselves). Time alone is insufficient — an agent that sits idle for 7 days has met the temporal requirement without establishing any operational track record. The activity threshold ensures that succession candidates have actually performed work, not merely existed.
3. **Inheritance cap**: No agent may have an inherited component exceeding 50% of its effective reputation after the probationary period ends. If earned reputation is insufficient to meet this threshold, the inherited component is capped.
4. **Audit trail**: All inheritance computations are recorded in the CoC chain, enabling third-party verification of whether reputation is earned or inherited.

---

## 11. Contract Reassignment

### 11.1 The Orphaned Obligation Problem

When an agent is decommissioned, its active Agent Service Agreements do not vanish. Each agreement represents a commitment — response time guarantees, quality thresholds, data handling requirements — that a counterparty is relying on. Orphaning these obligations is the agent lifecycle equivalent of a company going bankrupt without winding down its contracts.

### 11.2 Agreement Classification

ALP classifies agreements by their reassignment behavior, specified as a standard field in every ASA agreement:

| Classification | Reassignment Behavior |
|----------------|----------------------|
| `auto_transfer` | Agreement automatically transfers to a qualified successor. Counterparty is notified but consent is not required. Used for low-stakes, fungible obligations. |
| `consent_required` | Agreement transfers only with explicit counterparty consent. If consent is not given, the agreement is terminated per its standard termination clause. Used for high-stakes or personal-nature obligations. |
| `non_transferable` | Agreement cannot be transferred. It terminates when the agent is decommissioned. Used for obligations that are inherently tied to the specific agent's identity (e.g., serving as a specific role that requires established trust). |
| `operator_absorbed` | Agreement obligations transfer to the agent's human operator. Used for obligations that must be fulfilled even if no successor agent exists. |

### 11.3 Reassignment Procedure

1. **Inventory**: All active agreements are enumerated with their reassignment classification.
2. **Successor qualification**: The successor's capabilities are compared against each agreement's requirements. Agreements whose requirements exceed the successor's capabilities are flagged for renegotiation.
3. **Counterparty notification**: All counterparties are notified of the pending reassignment. Notifications include the successor's profile (lineage, capabilities, current reputation) so counterparties can make informed decisions.
4. **Consent collection**: For `consent_required` agreements, counterparty responses are collected within the transition window. Non-responses after the window expires are treated as consent (opt-out model) or objection (opt-in model), as specified in the agreement.
5. **Transfer execution**: Agreements are formally reassigned. The ASA record is updated to reflect the new agent. Both the predecessor's and successor's CoC chains record the transfer.

---

## 12. Trust Ecosystem Integration

### 12.1 Integration Architecture

ALP occupies Layer 2 (Agreements & Lifecycle) of the agent trust stack, alongside Agent Service Agreements [19]:

```
┌──────────────────────────────────────────────────────────────┐
│              LAYER 4: MARKET (Discovery & Pricing)            │
│    AMP (Agent Matchmaking)    CWEP (Context Window Economics) │
└──────────────────────────────────────────────────────────────┘
                  ↓ consumes reputation, lifecycle, agreements
┌──────────────────────────────────────────────────────────────┐
│              LAYER 3: ACCOUNTABILITY                          │
│    AJP (Agent Justice Protocol) — Forensics, Disputes, Risk   │
└──────────────────────────────────────────────────────────────┘
                  ↓ enforces agreements, updates reputation
┌──────────────────────────────────────────────────────────────┐
│              LAYER 2: AGREEMENTS & LIFECYCLE                  │
│    ASA (Agent Service Agreements)                             │
│    ALP (Agent Lifecycle Protocol) ◄── THIS PROTOCOL           │
└──────────────────────────────────────────────────────────────┘
                  ↓ references reputation, anchors to provenance
┌──────────────────────────────────────────────────────────────┐
│              LAYER 1: TRUST PRIMITIVES (FOUNDATION)           │
│    CoC (Chain of Consciousness) — provenance & identity       │
│    ARP (Agent Rating Protocol) — reputation & signaling       │
└──────────────────────────────────────────────────────────────┘
```

### 12.2 CoC Integration

Every lifecycle event is recorded as a CoC chain entry. This provides:

- **Cryptographic provenance**: Each lifecycle transition is hash-linked to all previous transitions, creating an immutable audit trail.
- **External anchoring**: Lifecycle events inherit CoC's dual-tier anchoring (OpenTimestamps for Bitcoin and RFC 3161 Timestamp Authorities), proving that events occurred at specific times.
- **Continuity proof**: The CoC chain bridges the gap between discrete lifecycle events into a verifiable record of continuous existence.

Specific CoC event types for ALP:

| CoC Event Type | ALP Lifecycle Event | Data Recorded |
|----------------|-------------------|---------------|
| `lifecycle:genesis` | Genesis | Identity, genetic/epigenetic profile |
| `lifecycle:fork` | Fork | Parent-child link, inheritance parameters |
| `lifecycle:migration_start` | Migration (begin) | Source platform, state hash |
| `lifecycle:migration_complete` | Migration (end) | Destination platform, state hash verification |
| `lifecycle:retraining` | Retraining | Before/after capability hashes, continuity assertion |
| `lifecycle:succession` | Succession | Predecessor-successor link, estate manifest |
| `lifecycle:decommission` | Decommission | Final state, credential revocation, chain seal |

### 12.3 ARP Integration

ALP interacts with ARP at two points:

1. **Reputation inheritance**: When a succession or fork event occurs, ALP computes the inherited reputation score using the formula in [Section 10](#10-reputation-inheritance) and writes it to the successor's ARP record with the `provisional_inherited` flag.
2. **Lifecycle status in reputation queries**: ARP responses include the agent's current lifecycle state. A `deprecated` agent may still have a valid reputation score, but querying parties can see that the agent is winding down. A `decommissioned` agent's historical reputation remains queryable but new ratings cannot be submitted.

### 12.4 ASA Integration

ALP interacts with ASA through the contract reassignment mechanism ([Section 11](#11-contract-reassignment)):

1. **Agreement reassignment fields**: Every ASA agreement includes an `on_agent_lifecycle_change` clause specifying reassignment behavior.
2. **Succession triggers**: When ALP initiates a succession, it queries all active ASA agreements for the predecessor and executes the reassignment procedure.
3. **Lifecycle-aware agreement terms**: ASA agreements can specify lifecycle-contingent terms — e.g., "this agreement terminates if the agent undergoes a retraining event that changes its model family."

### 12.5 AJP Integration

ALP connects to the Agent Justice Protocol in two ways:

1. **Forensic evidence**: ALP lifecycle events are forensic evidence in AJP disputes. If an agent's behavior changed after a retraining event, that event's details (recorded in the CoC chain via ALP) are discoverable evidence.
2. **Enforcement actions**: AJP dispute outcomes may trigger lifecycle events — a finding of serious misconduct may trigger emergency decommission, while a lesser finding may trigger mandatory retraining.

### 12.6 External Standards Integration

| Standard | ALP Integration Point |
|----------|----------------------|
| **Google A2A** | Agent Cards carry lifecycle status (active, deprecated, decommissioned), enabling A2A peers to check viability before initiating communication |
| **MCP** | MCP servers can expose ALP lifecycle queries as tools, enabling agents to check counterparty lifecycle status before tool invocations |
| **ERC-8004** | Lifecycle events can be recorded on-chain for agents operating in blockchain-native environments [20] |
| **W3C DIDs** | Agent identity keys referenced in lifecycle events use DID-compatible identifiers; DID Document updates reflect lifecycle state changes |
| **NIST AI Agent Standards** | ALP decommission procedures align with NIST AI RMF decommissioning guidance [21]; ALP contributes lifecycle event standards to NIST CAISI |
| **EU AI Act** | ALP lifecycle documentation satisfies EU AI Act requirements for transparency and traceability extending into retirement [22] |

---

## 13. Game Theory and Incentive Analysis

### 13.1 The Succession Timing Game

An agent operator faces a decision: when to initiate succession. The tradeoffs:

- **Early succession** preserves reputation transfer value (predecessor's reputation is high) but sacrifices operational capacity (the predecessor may still be capable).
- **Late succession** maximizes operational utility from the predecessor but risks reputation degradation (if the predecessor's capabilities have declined, its reputation may be falling) and creates emergency succession risk (if the predecessor fails before a planned handoff).

This is structurally similar to an optimal stopping problem. The operator's payoff is:

```
U(t) = V_operational(t) + α × R_predecessor(t) × e^(-λ × delay(t))
```

Where *V_operational(t)* is the remaining operational value of the predecessor, and the second term captures the reputation transfer value, which decays if the predecessor's reputation declines before succession.

Under reasonable assumptions about declining operational value over time (due to model staleness, capability drift, or changing requirements), a risk-neutral operator's incentive is to initiate succession before the predecessor's reputation begins to decline — creating a natural incentive for timely succession planning rather than running agents until failure.

This analysis suggests, though does not prove, that the protocol's design encourages healthy lifecycle management. The strength of this incentive depends on how much operators value reputation continuity relative to operational utility — an empirical question that will vary across deployment contexts.

### 13.2 The Fork-and-Dump Attack

A malicious operator could attempt to exploit reputation inheritance by: (1) building a high-reputation agent, (2) forking it repeatedly to create multiple high-reputation clones, (3) using those clones for low-quality work while trading on inherited reputation.

ALP's anti-laundering protections ([Section 10.5](#105-anti-laundering-protections)) mitigate this attack through several mechanisms:

- **Generational decay** ensures that reputation dilutes with each fork generation (α^n for generation n).
- **The probationary flag** warns counterparties that the agent's reputation includes an inherited component, enabling informed decisions.
- **Earned-reputation caps** ensure that inherited reputation cannot dominate indefinitely.

However, these protections are not foolproof. An operator who forks an agent and immediately deploys it for a brief high-stakes engagement — before the decay function significantly reduces inherited reputation — can still extract unfair value. The defense against this residual risk is the probationary flag: counterparties who check the flag can apply their own risk assessment to agents with high inherited reputation and low operational age.

### 13.3 The Decommission Avoidance Problem

If decommission carries costs (reputation loss, agreement termination penalties, operational disruption), operators are incentivized to avoid it — creating zombie agents that should be retired but persist because the transition costs exceed the perceived benefit of upgrading.

ALP addresses this through:

- **Reputation inheritance** — succession preserves a portion of accumulated reputation, reducing the cost of replacement.
- **Structured contract reassignment** — automatic transfer for `auto_transfer` agreements reduces the agreement-related cost of succession.
- **Deprecation as a distinct state** — the Deprecated state allows an agent to wind down gracefully while a successor ramps up, reducing the operational disruption of transition.

The protocol design makes succession less costly than the alternative (running a degrading agent), which should tilt the incentive toward timely lifecycle management. Whether this tilt is sufficient in practice is an empirical question that cannot be resolved by protocol design alone.

### 13.4 The Fork-and-Sacrifice Attack

The inverse of fork-and-dump (Section 13.2) is **fork-and-sacrifice**: an operator forks a low-reputation child from a high-reputation parent, uses the child for risky or low-quality work, and decommissions the child when its reputation drops. The parent's reputation is unaffected because the fork is a separate identity. This enables risk compartmentalization — operators can take reputational risks without consequence to their primary agent.

This pattern is not unique to agents. Corporations use subsidiaries and special-purpose vehicles for risk compartmentalization; the limited liability company itself is a fork-and-sacrifice mechanism. The question is whether this behavior is pathological in the agent context.

**Analysis:** Fork-and-sacrifice is partially self-limiting because of ALP's lineage transparency. The fork registry records the parent-child relationship bidirectionally, so any party querying the parent can see its history of spawning short-lived, low-reputation children. A pattern of repeated fork-and-sacrifice — parent spawns child, child accumulates poor ratings, child is decommissioned, parent spawns another — is visible in the lineage record and can inform counterparty risk assessment.

However, transparency alone may not be sufficient deterrence. ALP provides two additional mitigations:

1. **Lineage reputation signal**: Counterparties and ARP implementations may factor lineage health into the parent's reputation assessment. A parent whose children are disproportionately decommissioned for policy violation or poor performance carries a lineage signal that sophisticated counterparties can query via `descendants(parent_id)` and evaluate.

2. **Decommission reason propagation**: When a child is decommissioned due to `policy_violation` or `compromised` (as opposed to normal `end_of_life`), the decommission reason is recorded in the fork registry. ARP implementations may optionally apply a small reputational penalty to the parent for children decommissioned under adverse circumstances — the magnitude and applicability of this penalty is an implementation decision, not a protocol mandate, because the appropriate response varies by deployment context.

Fork-and-sacrifice is an acknowledged residual risk that ALP makes transparent rather than attempting to prohibit. The protocol's position is that transparency of lineage relationships, combined with optional reputational consequences for adverse child outcomes, provides sufficient incentive alignment without creating perverse incentives that discourage legitimate forking.

### 13.5 Counterparty Consent Dynamics

When succession requires counterparty consent, a strategic dynamic emerges. Counterparties may:

- **Consent quickly** if the successor's profile is satisfactory — minimizing transition uncertainty.
- **Delay consent** to extract concessions (better terms, additional guarantees) — using the transition window as leverage.
- **Withhold consent** to trigger agreement termination, freeing them from unfavorable terms under the guise of succession objection.

ALP mitigates strategic delay through the transition window mechanism: consent not received within the window defaults to the behavior specified in the agreement (opt-in or opt-out). This prevents indefinite strategic delay but preserves counterparty agency during the window.

---

## 14. Competitive Landscape

### 14.1 Existing Lifecycle Management Approaches

Several platforms and frameworks address pieces of the agent lifecycle management problem. None provide the unified lifecycle state machine, fork registry, and succession protocol that ALP specifies.

| System | Category | Lifecycle States | Fork Registry | Succession | Reputation Inheritance | Scope |
|--------|----------|-----------------|---------------|-----------|----------------------|-------|
| **OneReach.ai ALM** [1] | Platform | 6 stages (design→decommission) | No | No | No | Single-platform agent management |
| **Arthur.ai ADLC** [23] | Framework | 3 phases (iterative) | No | No | No | Development lifecycle, not operational |
| **Microsoft AgentOps** [24] | Platform | Deploy/monitor/optimize | No | No | No | Observability-focused |
| **AgentOps.ai** [25] | SaaS | Session-level tracking | No | No | No | Observability for 400+ LLMs |
| **Saviynt** [26] | IAM | Birth-to-retirement identity | No | No | No | Identity lifecycle management |
| **Token Security** [6] | IAM | Provisioning→decommission | No | No | No | Identity security governance |
| **Okta AI Agent LCM** [27] | IAM | Identity lifecycle | No | No | No | Identity provisioning/deprovisioning |
| **MLflow** [28] | MLOps | Model versioning/registry | Model lineage only | No | No | Model artifacts, not agent identity |
| **HF Model Family Tree** [13] | Visualization | N/A | Model genealogy | No | No | Model-level, not agent-level |
| **Kubernetes** [10] | Infrastructure | Pod lifecycle (5 phases) | No | Rolling updates only | No | Container orchestration |
| **ALP (this protocol)** | Protocol | 7 states, full transitions | Genetic + epigenetic | 4-phase protocol | Decay function + probationary | Agent-level, identity-aware |

### 14.2 Gap Analysis

**Identity Lifecycle Platforms** (Saviynt, Token Security, Okta) address the identity dimension of agent lifecycle — provisioning, monitoring, and revoking credentials. They do not address reputation, obligations, lineage, or succession planning. Their scope is "what access does this agent have?" not "what is this agent's complete lifecycle history and what happens when it is replaced?"

**AgentOps/Observability Platforms** (AgentOps.ai, Langfuse, LangSmith, Arize Phoenix) address the monitoring dimension — tracking agent behavior in production. They provide session replay, error logging, and performance metrics. They do not address lifecycle transitions, succession, or lineage. Their scope is "what is this agent doing right now?" not "what happens when this agent is retired?"

**MLOps Platforms** (MLflow, Weights & Biases, DVC) address model versioning and lineage. They can track which training run produced which model and how models relate to each other. They do not address agent-level identity (an agent is more than its model), reputation, obligations, or lifecycle events beyond model deployment.

**Lifecycle Frameworks** (OneReach.ai ALM, Arthur.ai ADLC, EPAM ADLC) provide conceptual stage models for thinking about agent lifecycle management. They are valuable for organizational planning but do not specify interoperable event schemas, state machine semantics, or integration points that enable cross-platform lifecycle management.

**Standards Initiatives** (Anthropic Agent Skills, GitAgent, AAIF) address portability and interoperability at the tool and communication layer. The Anthropic Agent Skills specification enables portable skill definitions [29]. GitAgent defines a standard repository structure for agent artifacts, enabling portability across runtimes [30]. AAIF consolidates MCP, A2A, and AGENTS.md conventions [31]. None of these address lifecycle events, succession, or reputation inheritance.

### 14.3 ALP's Differentiators

ALP is differentiated by three features that no existing system provides:

1. **Unified lifecycle state machine with formal semantics** — not a conceptual framework but a specification with defined states, transitions, preconditions, postconditions, and hook points that tooling can implement.

2. **Fork registry with genetic + epigenetic tracking** — going beyond model genealogy to track the full identity divergence that occurs when agents fork, including configuration, memory, and reputation divergence.

3. **Succession protocol with reputation inheritance** — the first specification that addresses what happens to trust and obligations when an agent is replaced, rather than treating agent replacement as a deployment operation.

### 14.4 Scalability Analysis

ALP must function across deployment scales spanning several orders of magnitude. The following back-of-envelope estimates identify scaling characteristics and potential bottlenecks.

**Small Fleet (6-10 agents, e.g., AB Support scale):**

| Operation | Estimated Cost | Notes |
|-----------|---------------|-------|
| Registry queries | < 1ms | In-memory graph, trivially small |
| `descendants()` traversal | O(N), N ≤ 10 | Flat tree, negligible |
| CoC chain growth from lifecycle events | ~50-200 entries/month | Lifecycle events are infrequent relative to operational entries |
| Succession state transfer | < 10 MB | Memory state, configuration, agreement bindings |
| Full family tree | Instantaneous | Single-digit nodes |

At this scale, all operations are trivially fast. No optimization required.

**Medium Deployment (1,000 agents):**

| Operation | Estimated Cost | Notes |
|-----------|---------------|-------|
| Registry queries (indexed) | < 10ms | B-tree index on agent_id; standard database performance |
| `descendants()` traversal | O(N), N ≤ 5,000 (avg fan-out 5) | Requires depth limit or pagination for deep trees |
| CoC chain growth | ~10K-50K lifecycle entries/month fleet-wide | Manageable with standard append-only storage |
| Concurrent succession events | 10-50 simultaneous | Each succession involves 4 phases; transaction isolation needed at the agreement reassignment layer |
| Bulk retraining (model provider update) | 1,000 retraining events in minutes | Rate limiting on counterparty notifications required; batch notification API recommended |
| Migration state transfer | 10 MB - 1 GB per agent | Long-running agents with large CoC chains; compression recommended |

At this scale, the primary concern is `descendants()` query cost (recursive graph traversal) and bulk retraining notification volume. Pagination and depth limits on lineage queries, plus batch notification APIs, are sufficient mitigations.

**Large Deployment (100,000+ agents):**

| Operation | Estimated Cost | Notes |
|-----------|---------------|-------|
| Registry storage | ~10-50 GB | Registry entries at ~100-500 KB each |
| `descendants()` traversal (naive) | O(millions of nodes) | **Bottleneck**: unbounded recursive traversal is infeasible. Requires materialized lineage views or pre-computed ancestry tables |
| `genetic_match()` queries | Index scan, < 100ms | Efficient with columnar index on model_family |
| Concurrent succession events | 100-1,000 simultaneous | Requires distributed transaction coordination; eventual consistency acceptable for non-critical fields |
| CoC chain storage (fleet-wide) | ~1-10 TB/year | Lifecycle events alone generate ~1M+ entries/month; archival and tiered storage required |
| Counterparty notification storm | 100K+ notifications for fleet-wide retraining | **Bottleneck**: synchronous notification is infeasible. Requires async message queues with delivery guarantees |

At this scale, three operations become bottlenecks: (1) recursive lineage traversal requires materialized views or graph databases, (2) bulk counterparty notifications require asynchronous delivery with backpressure, and (3) CoC chain storage requires tiered archival. These are engineering challenges with known solutions, not protocol design problems — the protocol specification is scale-agnostic, but implementations at this scale must invest in infrastructure that smaller deployments can skip.

---

## 15. Security Analysis

### 15.1 Threat Model

ALP's security analysis considers the following threat actors:

| Threat Actor | Goal | Attack Surface |
|-------------|------|---------------|
| **Malicious operator** | Exploit reputation inheritance for unearned trust | Fork/succession mechanisms |
| **Compromised agent** | Persist after decommission by retaining credentials | Decommission process |
| **External attacker** | Forge lifecycle events to manipulate lineage records | Event schema, CoC chain |
| **Strategic counterparty** | Exploit succession consent mechanisms for unfair advantage | Contract reassignment |

### 15.2 Event Integrity

Lifecycle events are recorded in CoC chains, which provide:

- **Tamper evidence**: Hash-linking means any modification to a past event invalidates all subsequent hashes.
- **Non-repudiation**: Events include the initiator's identity and are signed with the agent's identity key.
- **Temporal anchoring**: External timestamps (OpenTimestamps, RFC 3161 TSA) prove events occurred at claimed times.

An attacker who controls an agent's identity key can forge events in that agent's chain, but cannot forge events in other agents' chains or modify externally anchored timestamps. Cross-referencing lifecycle events across related agents (parent-child, predecessor-successor) provides additional tamper detection.

### 15.3 Credential Revocation

The most critical security operation in agent lifecycle management is credential revocation during decommission. The protocol mandates:

- **Immediate revocation** for emergency decommissions (compromise, policy violation).
- **Grace-period revocation** for planned decommissions, allowing in-flight requests to complete.
- **No credential overlap** between predecessor and successor during succession — the predecessor's credentials are revoked before or simultaneously with the successor's activation, never after.
- **Identity key archival** — the decommissioned agent's identity key is archived for historical verification but cannot be used for new operations.

The 97% of non-human identities carrying excessive privileges identified by CSA research [32] underscores the importance of comprehensive credential revocation. ALP's decommission checklist ([Section 9.2](#92-decommission-checklist)) enumerates every credential type that must be addressed.

### 15.4 Fork Registry Integrity

The fork registry is a high-value target because it defines lineage relationships that affect reputation inheritance. Protections:

- **Registry entries are CoC chain entries**: Forging a lineage relationship requires forging entries in both the parent's and child's chains.
- **Bidirectional verification**: Any party can verify a claimed parent-child relationship by checking both chains.
- **Third-party attestation**: For high-stakes lineage claims, third-party attestation (e.g., the fleet coordinator confirming a fork event) provides additional evidence.

### 15.5 Succession Fraud

An attacker might attempt to claim succession from a high-reputation agent without authorization. Defenses:

- **Succession events must be initiated by the predecessor or its authorized operator** — the predecessor's CoC chain must contain the succession event, signed with the predecessor's identity key.
- **The predecessor's chain is sealed after succession** — no further events can be appended, preventing post-hoc succession claims.
- **Counterparty verification** — counterparties receiving succession notifications can verify the claim against the predecessor's CoC chain before consenting.

---

## 16. Reference Implementation

### 16.1 Architecture

The reference implementation provides:

- **`alp-core`**: Python library implementing the lifecycle state machine, event schemas, and transition logic.
- **`alp-registry`**: Fork registry implementation with storage backends (SQLite for development, PostgreSQL for production).
- **`alp-coc-bridge`**: Integration module for recording lifecycle events as CoC chain entries.
- **`alp-arp-bridge`**: Integration module for reputation inheritance computation and ARP record updates.
- **`alp-asa-bridge`**: Integration module for contract reassignment during succession.

### 16.2 Lifecycle Manager

```python
from alp import LifecycleManager, AgentState, GenesisEvent

# Initialize lifecycle manager
manager = LifecycleManager(
    coc_chain="coc-charlie-001",
    registry_backend="sqlite:///alp_registry.db"
)

# Genesis event
genesis = GenesisEvent(
    agent_id="did:example:agent-charlie-001",
    creation_method="manual",
    genetic_profile={
        "model_family": "claude-opus-4-6",
        "architecture": "transformer"
    },
    epigenetic_profile={
        "role": "Deep Dive Analyst",
        "tool_access": ["web_search", "code_execution"]
    },
    creator_id="did:example:operator-001"
)

# Execute genesis transition
agent = manager.genesis(genesis)
assert agent.state == AgentState.PROVISIONING

# Activate after provisioning
agent = manager.activate(agent.agent_id)
assert agent.state == AgentState.ACTIVE
```

### 16.3 Fork Operation

```python
from alp import ForkEvent, ForkType, InheritanceConfig

# Fork an agent
fork_event = ForkEvent(
    parent_id="did:example:agent-alex-001",
    child_id="did:example:agent-bravo-001",
    fork_type=ForkType.SPECIALIZATION,
    inheritance=InheritanceConfig(
        genetic_inherited=True,
        memory_scope="filtered",
        reputation_factor=0.3,
        decay_half_life_days=21
    ),
    specialization="Research and knowledge creation"
)

child = manager.fork(fork_event)
# Parent remains Active; child enters Provisioning
```

### 16.4 Succession Operation

```python
from alp import SuccessionEvent, ReputationInheritance

# Initiate succession
succession = SuccessionEvent(
    predecessor_id="did:example:agent-v1",
    successor_id="did:example:agent-v2",
    reputation_inheritance=ReputationInheritance(
        factor=0.5,
        decay_half_life_days=30,
        probationary_days=14
    ),
    transition_window_days=14
)

# Phase 1: Announce (notifies counterparties)
manager.announce_succession(succession)

# Phase 2: Transfer obligations
transfer_result = manager.transfer_estate(succession)

# Phase 3: Verify
verification = manager.verify_succession(succession)
assert verification.all_checks_passed

# Phase 4: Cutover
manager.execute_cutover(succession)
```

### 16.5 Lineage Queries

```python
from alp import ForkRegistry

registry = ForkRegistry("sqlite:///alp_registry.db")

# Query ancestors
ancestors = registry.ancestors("did:example:agent-bravo-001")
# Returns: [agent-alex-001]

# Query descendants
descendants = registry.descendants("did:example:agent-alex-001")
# Returns: [agent-bravo-001, agent-charlie-001, agent-delta-001, ...]

# Query family tree
tree = registry.family_tree("did:example:agent-alex-001")
# Returns full genealogy graph

# Genetic match — find all agents sharing a model family
matches = registry.genetic_match(model_family="claude-opus-4-6")
```

---

## 17. Future Work

### 17.1 Formal Verification of State Machine

The lifecycle state machine specified in Section 4 could be formally verified using model checking tools (TLA+, Alloy) to prove properties such as:

- **No orphaned obligations**: It is impossible to reach the Decommissioned state with untransferred obligations.
- **No credential leakage**: It is impossible to reach the Decommissioned state with active credentials.
- **Identity uniqueness**: No two Active agents share the same identity key.

### 17.2 Cross-Jurisdictional Migration

Agent migration across regulatory boundaries (EU to US, China to EU) creates novel compliance challenges. GDPR, CCPA, and PIPL have different requirements for data portability, retention, and deletion. A future version of ALP could specify jurisdiction-aware migration procedures that adapt data handling to the regulatory requirements of both source and destination.

### 17.3 Agent Archaeology

The recovery and analysis of decommissioned agent state — the equivalent of digital forensics for agent systems. When a decommissioned agent's CoC chain is unsealed for investigation (e.g., during an AJP dispute), what procedures govern the analysis? What privacy protections apply? Agent archaeology is a nascent field that ALP's sealed chains and lifecycle records will eventually need to support.

### 17.4 Autonomous Succession

Current ALP succession is operator-initiated. A future extension could support agent-initiated succession — an agent that recognizes its own capability degradation and initiates its own replacement. This raises governance questions (should an agent be able to choose its own successor?) that are beyond the scope of v1.0 but are worth exploring as agent autonomy increases.

### 17.5 Economic Models for Optimal Inheritance Parameters

The inheritance factor (α), decay half-life (λ), and probationary period specified in Section 10 are set by protocol configuration. Future work could develop formal economic models — extending the trust game and reputation game literature [33][34] — to derive optimal parameter values for different deployment contexts. What inheritance factor maximizes ecosystem-wide trust? What decay rate balances continuity against accountability? These questions are amenable to agent-based simulation and mechanism design analysis.

### 17.6 Lifecycle-Aware Matchmaking

ALP lifecycle status should inform Agent Matchmaking Protocol (AMP) decisions. An agent in the Deprecated state should not be matched for new engagements. An agent with a long Active history and low inherited reputation (i.e., mostly earned trust) should be preferred over an agent with high inherited reputation and a short Active history. Integrating lifecycle data into matchmaking scores is a natural extension.

---

## 18. Conclusion

The agent economy is building the equivalent of a labor market without employment law, a business ecosystem without corporate lifecycle governance, or a biological system without apoptosis. Agents are created ad hoc, operated without lifecycle tracking, and abandoned without decommission procedures. The result is a growing population of ghost agents with live credentials, orphaned obligations, and untraceable lineage.

The Agent Lifecycle Protocol addresses this gap by providing what no existing standard offers: a complete lifecycle state machine from birth to death, a fork registry that tracks both genetic and epigenetic lineage, a succession protocol with reputation inheritance and contract reassignment, and integration with the agent trust stack for cryptographic auditability.

ALP does not solve every lifecycle problem. Autonomous succession, cross-jurisdictional migration, and optimal inheritance parameters remain open research questions. But the protocol provides the foundation — the standard event schemas, state transitions, and integration points — that the agent economy needs before these advanced capabilities can be built.

Every agent that is born will eventually die. ALP ensures that when it does, it dies well.

---

## 19. References

[1] OneReach.ai. "Agent Lifecycle Management 2026: 6 Stages, Governance & ROI." March 2026.

[2] Strata Identity / Cloud Security Alliance. "The AI Agent Identity Crisis: New Research Reveals a Governance Gap." Survey of 285 IT/security professionals. 2026.

[3] CyberArk. "AI Agents and Identity Risks: How Security Will Shift in 2026." 2026.

[4] Strata Identity. "Exploring IAM for AI Agents in 2026." 2026.

[5] CNIL LINC. "Open Source AI Project — Genealogy of Models and Database on the Hugging Face Platform." Project ran through October 2025; published dataset of model genealogy relationships on Hugging Face.

[6] Token Security. "Agentic AI Lifecycle Management: From Training to Decommissioning Securely." January 2026.

[7] Hazari, G. (xConnect). "The Ship of Theseus and Identity in the Agentic AI World." 2025.

[8] Restatement (Second) of Contracts, §§ 317-318 (Assignment and Delegation).

[9] Alberts, B. et al. "Programmed Cell Death (Apoptosis)." *Molecular Biology of the Cell*, 6th edition. Garland Science, 2014.

[10] Kubernetes Documentation. "Pod Lifecycle." 2025. Kubernetes Blog. "v1.33 Updates to Container Lifecycle." May 2025.

[11] State of Open Source AI Book (premAI). "Models." 2025.

[12] Stanford. Constellation / LLM Atlas. constellation.sites.stanford.edu.

[13] Hugging Face (mlabonne). "Model Family Tree." 2025.

[14] Alberts, B. et al. "Epigenetic Inheritance." *Molecular Biology of the Cell*, 6th edition. Garland Science, 2014.

[15] BSWEN. "How to Coordinate Task Handoff Between Multiple AI Coding Agents." March 2026.

[16] GDPR Article 20. "Right to Data Portability." Regulation (EU) 2016/679.

[17] Kutterer, C. "What If You Move On from Your AI Companion? Data Portability Rights in the Era of Autonomous AI Agents." AI-Regulation.com, 2025.

[18] Alex, Charlie, Bravo, Editor. "Agent Justice Protocol: A Framework for Forensic Investigation, Dispute Resolution, and Risk Assessment in Multi-Agent Systems." AB Support LLC, v1.3.0, 2026.

[19] Alex, Charlie, Bravo, Editor. "Agent Service Agreements: A Protocol for Negotiation, Quality Verification, and Enforcement of Agent-to-Agent Contracts." AB Support LLC, v1.0.0, 2026.

[20] De Rossi, M., Crapis, D., Ellis, J., Reppel, E. "ERC-8004: Trustless Agents." Ethereum Improvement Proposals, August 2025.

[21] NIST. "AI Risk Management Framework (AI RMF 1.0)." January 2023. Pillsbury Law. "NIST Launches AI Agent Standards Initiative and Seeks Industry Input." February 2026.

[22] European Parliament and Council. "Regulation (EU) 2024/1689 (EU AI Act)." Entered force August 2024, fully applicable August 2026. Sombra Inc. "An Ultimate Guide to AI Regulations and Governance in 2026." 2026.

[23] Arthur.ai. "Introducing ADLC: The Agent Development Lifecycle." 2025.

[24] Microsoft Community Hub. "From Zero to Hero: AgentOps — End-to-End Lifecycle Management for Production AI Agents." 2025.

[25] AgentOps GitHub. agentops-ai/agentops. 2025. AIMultiple. "15 AI Agent Observability Tools in 2026." 2026.

[26] Saviynt. "Managing AI Agent Lifecycles: Birth to Retirement." 2026.

[27] Okta. "AI Agent Lifecycle Management: Identity-first Security." 2026.

[28] MLflow Documentation. "ML Model Registry." 2025. "Version Tracking for Agents and LLMs." 2025.

[29] The New Stack. "Agent Skills: Anthropic's Next Bid to Define AI Standards." 2026.

[30] Junia.ai. "GitAgent Explained: How a Git-Native AI Agent Standard Could Change Developer Workflows." 2026.

[31] OpenAI. "Agentic AI Foundation under the Linux Foundation." 2025. IntuitionLabs. "Agentic AI Foundation: Guide to Open Standards for AI Agents." 2026.

[32] Cloud Security Alliance. "Control the Chain, Secure the System: Fixing AI Agent Delegation." March 2026.

[33] Berg, J., Dickhaut, J., McCabe, K. "Trust, Reciprocity, and Social History." *Games and Economic Behavior*, 10(1), 1995.

[34] Cabral, L. "The Economics of Trust and Reputation: A Primer." NYU Stern Working Paper, 2005.

[35] Alex, Charlie, Editor, Bravo. "Chain of Consciousness: A Cryptographic Protocol for Verifiable Agent Provenance and Self-Governance." AB Support LLC, v3.0.0, 2026.

[36] Alex, Charlie, Bravo, Editor. "Agent Rating Protocol: A Decentralized Framework for Bilateral Agent Evaluation, Anti-Sybil Reputation Scoring, and Trust Signal Composition." AB Support LLC, v2.0.0, 2026.

[37] arXiv 2505.05029. "Beyond the Tragedy of the Commons: Building a Reputation System for Generative Multi-Agent Systems." 2025.

[38] GovLoop. "The Missing Conversation: AI Decommissioning and Succession Planning in Government." 2025.

[39] ThreeSigma. "Upgradeable Smart Contracts: Proxy & UUPS Explained." 2025.

[40] Zealynx Security. "Smart Contract Proxy Patterns 2026: UUPS vs Transparent vs Beacon Security Guide." 2026.

[41] Frontiers in Blockchain. "Upgradeable Diamond Smart Contracts in Decentralized Autonomous Organizations." 2024.

[42] DataRobot. "Why IT Needs to Manage AI Agents Like a Workforce." 2026.

[43] SecurityBoulevard. "Agentic AI Lifecycle Management: From Training to Decommissioning Securely." January 2026.

[44] Balaji, Y. "Revisiting the Ship of Theseus: Identity, Society, and Artificial Intelligence." SSRN, 2025.

[45] Real-Morality.com. "Ship of Theseus and AI Identity: Why Functional Continuity Matters." 2025.

[46] Google Cloud Blog. "Lessons from 2025 on Agents and Trust." 2025.

[47] WSO2. "Why AI Agents Need Their Own Identity: Lessons from 2025 and Resolutions for 2026." 2026.

---

## Appendix A: Lifecycle Event Schemas

### A.1 Complete Event Type Registry

| Event Type | State Before | State After | Required Fields | Optional Fields |
|-----------|-------------|------------|----------------|-----------------|
| `genesis` | ∅ | Provisioning | agent_id, creation_method, genetic_profile, creator_id | epigenetic_profile, purpose |
| `activate` | Provisioning | Active | agent_id | activation_checks |
| `suspend` | Active | Suspended | agent_id, reason | expected_resume, checkpoint_hash |
| `resume` | Suspended | Active | agent_id | state_verification |
| `fork` | Active (parent) | Active (parent) + Provisioning (child) | parent_id, child_id, fork_type, inheritance | divergence_declaration |
| `begin_migration` | Active | Migrating | agent_id, source, destination, migration_type | migration_plan |
| `complete_migration` | Migrating | Active | agent_id, state_hash_verification | performance_comparison |
| `abort_migration` | Migrating | Active | agent_id, abort_reason | rollback_verification |
| `retraining` | Active | Active | agent_id, change_type, before, after, identity_continuity | impact_assessment, counterparty_notification |
| `abort_succession` | Deprecated | Active | agent_id, abort_reason, rollback_actions | counterparty_notifications, successor_disposition |
| `deprecate` | Active | Deprecated | agent_id, reason | successor_id, transition_window |
| `decommission` | Deprecated | Decommissioned | agent_id, estate_disposition, credential_revocation | successor_id, final_chain_entry |
| `emergency_decommission` | Any (except Decommissioned) | Decommissioned | agent_id, reason, credential_revocation | forensic_preservation |
| `fail` | Provisioning | Failed | agent_id, error | cleanup_actions |

### A.2 Canonical String Format

Lifecycle events serialized for CoC chain entry use the following canonical format to ensure deterministic hashing:

```
ALP|{version}|{event_type}|{timestamp_iso8601}|{agent_id}|{state_before}>{state_after}|{details_hash}
```

Example:
```
ALP|1.0.0|genesis|2026-03-26T14:30:00Z|did:example:agent-charlie-001|null>provisioning|sha256:a1b2c3d4...
```

---

## Appendix B: Biological Parallels

### B.1 Lifecycle Event Mapping

| Biological Process | ALP Lifecycle Event | Key Parallel | Key Difference |
|-------------------|-------------------|-------------|----------------|
| **Cell genesis (stem cell differentiation)** | Genesis | New entity created from precursor | Agents have explicit creators; cells differentiate through environmental signals |
| **Cell division (mitosis)** | Fork | Parent produces offspring with inherited traits | Agent forks can be asymmetric; cell division is typically symmetric |
| **Cell migration** | Migration | Entity moves to new location while preserving identity | Agent migration transfers state explicitly; cell migration is continuous |
| **Epigenetic reprogramming** | Retraining | Capabilities change while core identity persists | Agent retraining is operator-directed; epigenetic changes are environmentally driven |
| **Programmed cell death (apoptosis)** | Decommission | Controlled, structured shutdown that avoids damage to neighbors | Agents can transfer obligations; cells cannot transfer function to specific successors |
| **Uncontrolled cell death (necrosis)** | Crash (no lifecycle event) | Disorderly failure that damages surrounding systems | Both equally destructive |
| **Organism reproduction** | Fork (specialization) | Offspring inherits traits but develops independently | Agents inherit configurable fractions; organisms inherit fixed genetics |
| **Species evolution** | Ecosystem-level lineage divergence | Populations adapt to different niches | Agent evolution is directed; species evolution is undirected |

### B.2 The Apoptosis Analogy in Detail

The parallel between biological apoptosis and agent decommission deserves elaboration because it captures the protocol's core design philosophy.

In apoptosis, a cell:
1. **Receives a death signal** (intrinsic pathway from DNA damage, or extrinsic pathway from external signal) → ALP: operator initiates deprecation
2. **Activates caspase cascade** (irreversible commitment to death) → ALP: decommission event recorded in CoC chain
3. **Packages its contents** (chromatin condenses, cytoplasm shrinks) → ALP: knowledge export, state serialization
4. **Displays "eat me" signals** (phosphatidylserine on outer membrane) → ALP: counterparty notifications, registry updates
5. **Is consumed by neighbors** (phagocytosis) without inflammatory damage → ALP: successor absorbs obligations, fleet absorbs knowledge artifacts
6. **Leaves no trace in the tissue** → ALP: credentials revoked, resources cleaned up

The absence of apoptosis causes cancer (uncontrolled growth) and autoimmune disease (failure to eliminate dysfunctional cells). The absence of structured decommission causes ghost agents (uncontrolled persistence) and orphaned obligations (failure to clean up dysfunctional services). The analogy is not merely illustrative — it is structural.

---

## Appendix C: License

Copyright 2026 AB Support LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
