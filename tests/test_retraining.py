"""Tests for retraining.py — identity continuity and classification."""

import pytest

from agent_lifecycle_protocol.store import LifecycleStore
from agent_lifecycle_protocol.lifecycle import LifecycleError, LifecycleManager
from agent_lifecycle_protocol.retraining import (
    CapabilitySnapshot,
    IdentityContinuity,
    RetrainingEvent,
    check_identity_continuity,
    classify_retraining,
    counterparty_action_for_class,
    record_retraining,
)


@pytest.fixture
def manager(tmp_path):
    store = LifecycleStore(str(tmp_path / "test_alp"))
    return LifecycleManager(store=store)


@pytest.fixture
def active_agent(manager):
    manager.genesis("agent-001")
    manager.activate("agent-001")
    return "agent-001"


class TestClassification:
    def test_minor_types(self):
        assert classify_retraining("prompt_revision") == "minor"
        assert classify_retraining("capability_addition") == "minor"
        assert classify_retraining("capability_removal") == "minor"

    def test_moderate_types(self):
        assert classify_retraining("model_upgrade") == "moderate"
        assert classify_retraining("fine_tuning") == "moderate"

    def test_major_fallback(self):
        assert classify_retraining("unknown") == "major"


class TestCounterpartyAction:
    def test_minor_no_action(self):
        assert counterparty_action_for_class("minor") == "none"

    def test_moderate_acknowledge(self):
        assert counterparty_action_for_class("moderate") == "acknowledge"

    def test_major_consent(self):
        assert counterparty_action_for_class("major") == "consent"


class TestIdentityContinuity:
    def test_all_true_preserves(self):
        ic = IdentityContinuity(
            same_identity_key=True,
            same_coc_chain=True,
            operator_assertion=True,
        )
        assert check_identity_continuity(ic)
        assert ic.identity_preserved

    def test_no_key_fails(self):
        ic = IdentityContinuity(same_identity_key=False)
        assert not check_identity_continuity(ic)

    def test_no_chain_fails(self):
        ic = IdentityContinuity(same_coc_chain=False)
        assert not check_identity_continuity(ic)

    def test_no_assertion_fails(self):
        ic = IdentityContinuity(operator_assertion=False)
        assert not check_identity_continuity(ic)


class TestRecordRetraining:
    def test_records_minor_retraining(self, manager, active_agent):
        rt = RetrainingEvent(
            agent_id="agent-001",
            change_type="prompt_revision",
            identity_continuity=IdentityContinuity(),
        )
        event = record_retraining(manager, rt)
        assert event.event_type == "retraining"
        assert rt.retraining_class == "minor"
        assert rt.counterparty_action_required == "none"

    def test_records_model_upgrade(self, manager, active_agent):
        rt = RetrainingEvent(
            agent_id="agent-001",
            change_type="model_upgrade",
            before=CapabilitySnapshot(model_version="v1"),
            after=CapabilitySnapshot(model_version="v2"),
            identity_continuity=IdentityContinuity(),
        )
        event = record_retraining(manager, rt)
        assert rt.retraining_class == "moderate"

        # Check model version was updated
        agent = manager.get_agent("agent-001")
        assert agent.genetic_profile.model_version == "v2"

    def test_identity_failure_raises(self, manager, active_agent):
        rt = RetrainingEvent(
            agent_id="agent-001",
            change_type="model_upgrade",
            identity_continuity=IdentityContinuity(same_identity_key=False),
        )
        with pytest.raises(LifecycleError, match="Identity continuity test failed"):
            record_retraining(manager, rt)

    def test_non_active_fails(self, manager):
        manager.genesis("agent-002")
        rt = RetrainingEvent(
            agent_id="agent-002",
            change_type="prompt_revision",
            identity_continuity=IdentityContinuity(),
        )
        with pytest.raises(LifecycleError, match="must be Active"):
            record_retraining(manager, rt)

    def test_agent_stays_active(self, manager, active_agent):
        rt = RetrainingEvent(
            agent_id="agent-001",
            change_type="capability_addition",
            identity_continuity=IdentityContinuity(),
        )
        record_retraining(manager, rt)
        agent = manager.get_agent("agent-001")
        assert agent.state == "active"
