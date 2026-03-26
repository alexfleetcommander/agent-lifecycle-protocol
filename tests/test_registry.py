"""Tests for registry.py — lineage queries and access control."""

import pytest

from agent_lifecycle_protocol.schema import GeneticProfile, EpigeneticProfile
from agent_lifecycle_protocol.store import LifecycleStore
from agent_lifecycle_protocol.lifecycle import LifecycleManager
from agent_lifecycle_protocol.fork import fork_agent
from agent_lifecycle_protocol.registry import LineageRegistry


@pytest.fixture
def manager(tmp_path):
    store = LifecycleStore(str(tmp_path / "test_alp"))
    return LifecycleManager(store=store)


@pytest.fixture
def registry(manager):
    return LineageRegistry(manager.store)


@pytest.fixture
def fleet(manager):
    """Create a small fleet: alex -> bravo, charlie, delta."""
    manager.genesis(
        "alex", genetic_profile=GeneticProfile(model_family="claude-opus-4-6"),
        epigenetic_profile=EpigeneticProfile(role="Coordinator"),
    )
    manager.activate("alex")

    for child_id, role in [
        ("bravo", "Research"),
        ("charlie", "Deep Dive"),
        ("delta", "Developer"),
    ]:
        fork_agent(manager, "alex", child_id)
        manager.activate(child_id)
        child = manager.get_agent(child_id)
        child.epigenetic_profile.role = role
        manager.store.save_agent(child)

    return manager


class TestAncestors:
    def test_child_ancestors(self, fleet, registry):
        ancestors = registry.ancestors("bravo")
        assert ancestors == ["alex"]

    def test_root_has_no_ancestors(self, fleet, registry):
        ancestors = registry.ancestors("alex")
        assert ancestors == []

    def test_grandchild_ancestors(self, fleet, registry):
        fork_agent(fleet, "bravo", "bravo-jr")
        ancestors = registry.ancestors("bravo-jr")
        assert ancestors == ["bravo", "alex"]


class TestDescendants:
    def test_root_descendants(self, fleet, registry):
        desc = registry.descendants("alex")
        assert set(desc) == {"bravo", "charlie", "delta"}

    def test_leaf_has_no_descendants(self, fleet, registry):
        desc = registry.descendants("bravo")
        assert desc == []

    def test_multi_generation_descendants(self, fleet, registry):
        # bravo is already active from the fleet fixture
        fork_agent(fleet, "bravo", "bravo-jr")
        desc = registry.descendants("alex")
        assert "bravo-jr" in desc


class TestSiblings:
    def test_siblings(self, fleet, registry):
        sibs = registry.siblings("bravo")
        assert set(sibs) == {"charlie", "delta"}

    def test_root_has_no_siblings(self, fleet, registry):
        sibs = registry.siblings("alex")
        assert sibs == []


class TestFamilyTree:
    def test_tree_structure(self, fleet, registry):
        tree = registry.family_tree("bravo")
        assert tree["agent_id"] == "alex"  # walks up to root
        assert len(tree["children"]) == 3


class TestGeneticMatch:
    def test_match_by_family(self, fleet, registry):
        matches = registry.genetic_match(model_family="claude-opus-4-6")
        assert "alex" in matches
        # Children inherit genetic profile
        assert len(matches) >= 1


class TestEpigeneticMatch:
    def test_match_by_role(self, fleet, registry):
        matches = registry.epigenetic_match(role="Research")
        assert "bravo" in matches
        assert "alex" not in matches


class TestAccessControl:
    def test_public_hides_children(self, fleet, registry):
        entry = registry.get_entry("alex", access_level="public")
        assert entry is not None
        assert entry.children == []  # hidden at public level

    def test_authorized_shows_structure(self, fleet, registry):
        entry = registry.get_entry("alex", access_level="authorized")
        assert entry is not None
        assert len(entry.children) == 3

    def test_operator_shows_everything(self, fleet, registry):
        entry = registry.get_entry("bravo", access_level="operator_only")
        assert entry is not None
        assert entry.epigenetic_profile != {}


class TestRedaction:
    def test_partial_redaction(self, fleet, registry):
        fleet.deprecate("delta")
        fleet.decommission("delta")
        registry.redact_entry("delta", level="partial")

        entry = registry.get_entry("delta", access_level="operator_only")
        assert entry.epigenetic_profile == {}
        assert entry.agent_id == "delta"  # preserved

    def test_full_redaction(self, fleet, registry):
        fleet.deprecate("delta")
        fleet.decommission("delta")
        registry.redact_entry("delta", level="full")

        entry = registry.get_entry("delta", access_level="operator_only")
        assert entry.agent_id.startswith("anon:")
        assert entry.genetic_profile == {}

    def test_redact_non_decommissioned_fails(self, fleet, registry):
        with pytest.raises(ValueError, match="Only decommissioned"):
            registry.redact_entry("alex", level="partial")
