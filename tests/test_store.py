"""Tests for store.py — append-only JSONL store."""

import pytest

from agent_lifecycle_protocol.schema import AgentRecord, LifecycleEvent
from agent_lifecycle_protocol.store import LifecycleStore


@pytest.fixture
def store(tmp_path):
    return LifecycleStore(str(tmp_path / "test_alp"))


class TestEventStorage:
    def test_append_and_retrieve(self, store):
        event = LifecycleEvent(
            event_type="genesis",
            agent_id="agent-001",
            agent_state_after="provisioning",
        )
        event.compute_hash()
        eid = store.append_event(event)
        assert eid == event.event_id

        events = store.get_events()
        assert len(events) == 1
        assert events[0].event_type == "genesis"

    def test_get_event_by_id(self, store):
        event = LifecycleEvent(
            event_type="genesis",
            agent_id="agent-001",
        )
        event.compute_hash()
        store.append_event(event)

        found = store.get_event(event.event_id)
        assert found is not None
        assert found.agent_id == "agent-001"

    def test_get_events_for_agent(self, store):
        for i in range(3):
            e = LifecycleEvent(event_type="test", agent_id="agent-001")
            e.compute_hash()
            store.append_event(e)
        e2 = LifecycleEvent(event_type="test", agent_id="agent-002")
        e2.compute_hash()
        store.append_event(e2)

        events = store.get_events_for("agent-001")
        assert len(events) == 3


class TestAgentStorage:
    def test_save_and_retrieve(self, store):
        agent = AgentRecord(agent_id="agent-001", state="active")
        store.save_agent(agent)

        found = store.get_agent("agent-001")
        assert found is not None
        assert found.state == "active"

    def test_latest_snapshot_wins(self, store):
        agent = AgentRecord(agent_id="agent-001", state="provisioning")
        store.save_agent(agent)
        agent.state = "active"
        store.save_agent(agent)

        found = store.get_agent("agent-001")
        assert found.state == "active"

    def test_agents_by_state(self, store):
        for i, state in enumerate(["active", "active", "suspended"]):
            store.save_agent(AgentRecord(agent_id=f"agent-{i}", state=state))

        active = store.get_agents_by_state("active")
        assert len(active) == 2


class TestStats:
    def test_empty_store(self, store):
        stats = store.stats()
        assert stats["events"]["count"] == 0
        assert stats["agents"]["unique_count"] == 0

    def test_populated_store(self, store):
        e = LifecycleEvent(event_type="genesis", agent_id="a1")
        e.compute_hash()
        store.append_event(e)
        store.save_agent(AgentRecord(agent_id="a1", state="active"))

        stats = store.stats()
        assert stats["events"]["count"] == 1
        assert stats["agents"]["unique_count"] == 1
        assert stats["agents"]["by_state"].get("active") == 1
