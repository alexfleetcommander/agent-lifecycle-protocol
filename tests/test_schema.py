"""Tests for schema.py — data structures and helpers."""

import math
import pytest

from agent_lifecycle_protocol.schema import (
    AGENT_STATES,
    PROTOCOL_VERSION,
    AgentRecord,
    ChainReference,
    EpigeneticProfile,
    GeneticProfile,
    Initiator,
    LifecycleEvent,
    ReputationInheritance,
    compute_effective_reputation,
    compute_inherited_reputation,
    _hash_dict,
)


class TestConstants:
    def test_agent_states(self):
        assert "provisioning" in AGENT_STATES
        assert "active" in AGENT_STATES
        assert "decommissioned" in AGENT_STATES
        assert len(AGENT_STATES) == 7

    def test_protocol_version(self):
        assert PROTOCOL_VERSION == "1.0.0"


class TestGeneticProfile:
    def test_roundtrip(self):
        gp = GeneticProfile(
            model_family="claude-opus-4-6",
            architecture="transformer",
        )
        d = gp.to_dict()
        gp2 = GeneticProfile.from_dict(d)
        assert gp2.model_family == "claude-opus-4-6"
        assert gp2.architecture == "transformer"


class TestEpigeneticProfile:
    def test_roundtrip(self):
        ep = EpigeneticProfile(
            role="Research Agent",
            tool_access=["web_search", "code_execution"],
        )
        d = ep.to_dict()
        ep2 = EpigeneticProfile.from_dict(d)
        assert ep2.role == "Research Agent"
        assert "web_search" in ep2.tool_access


class TestLifecycleEvent:
    def test_create_and_hash(self):
        event = LifecycleEvent(
            event_type="genesis",
            agent_id="agent-001",
            agent_state_after="provisioning",
        )
        h = event.compute_hash()
        assert h.startswith("sha256:")
        assert event.event_hash == h

    def test_canonical_string(self):
        event = LifecycleEvent(
            event_type="genesis",
            timestamp="2026-03-26T14:30:00Z",
            agent_id="agent-001",
            agent_state_before=None,
            agent_state_after="provisioning",
        )
        cs = event.canonical_string()
        assert cs.startswith("ALP|1.0.0|genesis|")
        assert "null>provisioning" in cs

    def test_roundtrip(self):
        event = LifecycleEvent(
            event_type="fork",
            agent_id="agent-001",
            agent_state_before="active",
            agent_state_after="active",
            details={"fork_type": "specialization"},
        )
        event.compute_hash()
        d = event.to_dict()
        event2 = LifecycleEvent.from_dict(d)
        assert event2.event_type == "fork"
        assert event2.event_hash == event.event_hash


class TestReputationInheritance:
    def test_compute_initial(self):
        rep = ReputationInheritance(
            predecessor_score=0.9, alpha=0.5,
        )
        initial = rep.compute_initial()
        assert initial == pytest.approx(0.45)

    def test_decay_at_half_life(self):
        rep = ReputationInheritance(
            predecessor_score=1.0, alpha=1.0,
            decay_half_life_days=30,
        )
        value = rep.compute_at(30)
        assert value == pytest.approx(0.5, abs=0.01)

    def test_decay_at_three_half_lives(self):
        rep = ReputationInheritance(
            predecessor_score=1.0, alpha=0.5,
            decay_half_life_days=30,
        )
        value = rep.compute_at(90)
        assert value == pytest.approx(0.0625, abs=0.01)


class TestComputeFunctions:
    def test_inherited_reputation(self):
        r = compute_inherited_reputation(0.92, 0.5, 30, 0)
        assert r == pytest.approx(0.46)

    def test_effective_reputation_clamped(self):
        r = compute_effective_reputation(0.6, 0.7)
        assert r == 1.0

    def test_effective_reputation_normal(self):
        r = compute_effective_reputation(0.3, 0.4)
        assert r == pytest.approx(0.7)


class TestAgentRecord:
    def test_terminal_states(self):
        agent = AgentRecord(state="decommissioned")
        assert agent.is_terminal
        agent.state = "active"
        assert not agent.is_terminal

    def test_roundtrip(self):
        agent = AgentRecord(
            agent_id="agent-001",
            state="active",
            genetic_profile=GeneticProfile(model_family="claude"),
        )
        d = agent.to_dict()
        agent2 = AgentRecord.from_dict(d)
        assert agent2.agent_id == "agent-001"
        assert agent2.genetic_profile.model_family == "claude"
