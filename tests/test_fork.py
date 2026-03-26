"""Tests for fork.py — fork operations and inheritance."""

import pytest

from agent_lifecycle_protocol.schema import GeneticProfile, EpigeneticProfile
from agent_lifecycle_protocol.store import LifecycleStore
from agent_lifecycle_protocol.lifecycle import LifecycleError, LifecycleManager
from agent_lifecycle_protocol.fork import InheritanceConfig, fork_agent


@pytest.fixture
def manager(tmp_path):
    store = LifecycleStore(str(tmp_path / "test_alp"))
    return LifecycleManager(store=store)


@pytest.fixture
def active_parent(manager):
    manager.genesis(
        "parent-001",
        genetic_profile=GeneticProfile(model_family="claude-opus-4-6"),
        epigenetic_profile=EpigeneticProfile(role="Coordinator"),
    )
    manager.activate("parent-001")
    return manager.get_agent("parent-001")


class TestForkAgent:
    def test_basic_fork(self, manager, active_parent):
        record = fork_agent(manager, "parent-001", "child-001")
        assert record.parent_id == "parent-001"
        assert record.child_id == "child-001"

        child = manager.get_agent("child-001")
        assert child.state == "provisioning"
        assert child.parent_id == "parent-001"
        assert child.generation == 2

    def test_fork_inherits_genetic(self, manager, active_parent):
        record = fork_agent(manager, "parent-001", "child-001")
        child = manager.get_agent("child-001")
        assert child.genetic_profile.model_family == "claude-opus-4-6"

    def test_fork_inherits_epigenetic(self, manager, active_parent):
        record = fork_agent(manager, "parent-001", "child-001")
        child = manager.get_agent("child-001")
        assert child.epigenetic_profile.role == "Coordinator"

    def test_fork_reputation_inheritance(self, manager, active_parent):
        # Give parent some earned reputation
        parent = manager.get_agent("parent-001")
        parent.reputation_earned = 0.8
        manager.store.save_agent(parent)

        record = fork_agent(manager, "parent-001", "child-001")
        child = manager.get_agent("child-001")
        # Default fork alpha = 0.3
        assert child.reputation_inherited == pytest.approx(0.24, abs=0.01)

    def test_fork_updates_parent_children(self, manager, active_parent):
        fork_agent(manager, "parent-001", "child-001")
        parent = manager.get_agent("parent-001")
        assert "child-001" in parent.children

    def test_fork_parent_stays_active(self, manager, active_parent):
        fork_agent(manager, "parent-001", "child-001")
        parent = manager.get_agent("parent-001")
        assert parent.state == "active"

    def test_fork_custom_alpha(self, manager, active_parent):
        parent = manager.get_agent("parent-001")
        parent.reputation_earned = 1.0
        manager.store.save_agent(parent)

        inh = InheritanceConfig(reputation_factor=0.5)
        record = fork_agent(
            manager, "parent-001", "child-001",
            inheritance=inh,
        )
        child = manager.get_agent("child-001")
        assert child.reputation_inherited == pytest.approx(0.5, abs=0.01)

    def test_fork_inactive_parent_fails(self, manager):
        manager.genesis("inactive-001")
        with pytest.raises(LifecycleError, match="must be Active"):
            fork_agent(manager, "inactive-001", "child-001")

    def test_fork_duplicate_child_fails(self, manager, active_parent):
        fork_agent(manager, "parent-001", "child-001")
        with pytest.raises(LifecycleError, match="already exists"):
            fork_agent(manager, "parent-001", "child-001")

    def test_fork_types(self, manager, active_parent):
        for ft in ("full_clone", "partial_clone", "capability_fork", "specialization"):
            child_id = f"child-{ft}"
            record = fork_agent(
                manager, "parent-001", child_id, fork_type=ft,
            )
            assert record.fork_type == ft

    def test_invalid_fork_type(self, manager, active_parent):
        with pytest.raises(LifecycleError, match="Invalid fork type"):
            fork_agent(manager, "parent-001", "child-001", fork_type="invalid")


class TestMultiGenerationFork:
    def test_three_generations(self, manager, active_parent):
        fork_agent(manager, "parent-001", "child-001")
        manager.activate("child-001")
        fork_agent(manager, "child-001", "grandchild-001")

        grandchild = manager.get_agent("grandchild-001")
        assert grandchild.generation == 3
        assert grandchild.parent_id == "child-001"
