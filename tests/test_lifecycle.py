"""Tests for lifecycle.py — state machine and transitions."""

import os
import shutil
import tempfile
import pytest

from agent_lifecycle_protocol.schema import (
    GeneticProfile,
    EpigeneticProfile,
    Initiator,
)
from agent_lifecycle_protocol.store import LifecycleStore
from agent_lifecycle_protocol.lifecycle import (
    LifecycleError,
    LifecycleManager,
    HookResult,
)


@pytest.fixture
def tmp_store(tmp_path):
    store = LifecycleStore(str(tmp_path / "test_alp"))
    return store


@pytest.fixture
def manager(tmp_store):
    return LifecycleManager(store=tmp_store)


class TestGenesis:
    def test_creates_agent_in_provisioning(self, manager):
        agent = manager.genesis("agent-001", creator_id="operator-001")
        assert agent.state == "provisioning"
        assert agent.agent_id == "agent-001"

    def test_genesis_with_profiles(self, manager):
        agent = manager.genesis(
            "agent-001",
            genetic_profile=GeneticProfile(model_family="claude-opus-4-6"),
            epigenetic_profile=EpigeneticProfile(role="Coordinator"),
            creator_id="operator-001",
        )
        assert agent.genetic_profile.model_family == "claude-opus-4-6"
        assert agent.epigenetic_profile.role == "Coordinator"

    def test_duplicate_genesis_fails(self, manager):
        manager.genesis("agent-001")
        with pytest.raises(LifecycleError, match="already exists"):
            manager.genesis("agent-001")

    def test_genesis_records_event(self, manager):
        manager.genesis("agent-001")
        events = manager.store.get_events_for("agent-001")
        assert len(events) == 1
        assert events[0].event_type == "genesis"


class TestActivate:
    def test_activate_from_provisioning(self, manager):
        manager.genesis("agent-001")
        agent = manager.activate("agent-001")
        assert agent.state == "active"

    def test_activate_nonexistent_fails(self, manager):
        with pytest.raises(LifecycleError, match="not found"):
            manager.activate("nonexistent")


class TestSuspendResume:
    def test_suspend_and_resume(self, manager):
        manager.genesis("agent-001")
        manager.activate("agent-001")
        agent = manager.suspend("agent-001", reason="maintenance")
        assert agent.state == "suspended"
        agent = manager.resume("agent-001")
        assert agent.state == "active"


class TestDeprecateDecommission:
    def test_deprecate_then_decommission(self, manager):
        manager.genesis("agent-001")
        manager.activate("agent-001")
        agent = manager.deprecate("agent-001", reason="replaced")
        assert agent.state == "deprecated"
        agent = manager.decommission("agent-001")
        assert agent.state == "decommissioned"
        assert agent.is_terminal

    def test_decommission_not_from_active(self, manager):
        manager.genesis("agent-001")
        manager.activate("agent-001")
        with pytest.raises(LifecycleError, match="not allowed"):
            manager.decommission("agent-001")


class TestEmergencyDecommission:
    def test_from_active(self, manager):
        manager.genesis("agent-001")
        manager.activate("agent-001")
        agent = manager.emergency_decommission("agent-001", reason="compromised")
        assert agent.state == "decommissioned"

    def test_from_suspended(self, manager):
        manager.genesis("agent-001")
        manager.activate("agent-001")
        manager.suspend("agent-001")
        agent = manager.emergency_decommission("agent-001")
        assert agent.state == "decommissioned"

    def test_from_terminal_fails(self, manager):
        manager.genesis("agent-001")
        manager.activate("agent-001")
        manager.emergency_decommission("agent-001")
        with pytest.raises(LifecycleError, match="terminal state"):
            manager.emergency_decommission("agent-001")


class TestFail:
    def test_fail_from_provisioning(self, manager):
        manager.genesis("agent-001")
        agent = manager.fail("agent-001", error="resource unavailable")
        assert agent.state == "failed"
        assert agent.is_terminal


class TestHooks:
    def test_pre_hook_can_abort(self, manager):
        def blocking_hook(event, agent):
            return HookResult(success=False, error="blocked")

        manager.register_pre_hook("activate", blocking_hook)
        manager.genesis("agent-001")
        with pytest.raises(LifecycleError, match="blocked"):
            manager.activate("agent-001")

    def test_post_hook_runs(self, manager):
        called = []

        def tracking_hook(event, agent):
            called.append(event.event_type)
            return HookResult()

        manager.register_post_hook("activate", tracking_hook)
        manager.genesis("agent-001")
        manager.activate("agent-001")
        assert "activate" in called


class TestEventHistory:
    def test_event_history_accumulates(self, manager):
        manager.genesis("agent-001")
        manager.activate("agent-001")
        manager.suspend("agent-001")
        manager.resume("agent-001")
        agent = manager.get_agent("agent-001")
        assert len(agent.event_history) == 4
