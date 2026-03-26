"""Tests for decommission.py — graceful and emergency decommission."""

import pytest

from agent_lifecycle_protocol.store import LifecycleStore
from agent_lifecycle_protocol.lifecycle import LifecycleError, LifecycleManager
from agent_lifecycle_protocol.decommission import (
    CredentialRevocation,
    DataDisposition,
    DecommissionPlan,
    EstateDisposition,
    emergency_decommission,
    graceful_decommission,
    validate_decommission_checklist,
)


@pytest.fixture
def manager(tmp_path):
    store = LifecycleStore(str(tmp_path / "test_alp"))
    return LifecycleManager(store=store)


@pytest.fixture
def deprecated_agent(manager):
    manager.genesis("agent-001")
    manager.activate("agent-001")
    manager.deprecate("agent-001")
    return "agent-001"


class TestGracefulDecommission:
    def test_decommissions_deprecated_agent(self, manager, deprecated_agent):
        plan = DecommissionPlan(
            agent_id="agent-001",
            reason="end_of_life",
        )
        plan = graceful_decommission(manager, plan)
        assert plan.phase == "complete"

        agent = manager.get_agent("agent-001")
        assert agent.state == "decommissioned"

    def test_requires_deprecated_state(self, manager):
        manager.genesis("agent-002")
        manager.activate("agent-002")
        plan = DecommissionPlan(agent_id="agent-002")
        with pytest.raises(LifecycleError, match="requires Deprecated"):
            graceful_decommission(manager, plan)


class TestEmergencyDecommission:
    def test_from_active(self, manager):
        manager.genesis("agent-001")
        manager.activate("agent-001")
        plan = DecommissionPlan(
            agent_id="agent-001",
            reason="compromised",
        )
        plan = emergency_decommission(manager, plan)
        assert plan.phase == "complete"
        assert plan.emergency

        agent = manager.get_agent("agent-001")
        assert agent.state == "decommissioned"

    def test_from_suspended(self, manager):
        manager.genesis("agent-001")
        manager.activate("agent-001")
        manager.suspend("agent-001")
        plan = DecommissionPlan(
            agent_id="agent-001",
            reason="policy_violation",
        )
        plan = emergency_decommission(manager, plan)
        assert plan.phase == "complete"


class TestCredentialRevocation:
    def test_all_revoked(self):
        cred = CredentialRevocation(
            api_keys_revoked=True,
            oauth_tokens_invalidated=True,
            service_accounts_deleted=True,
            trust_relationships_terminated=True,
            certificates_revoked=True,
            identity_key_archived=True,
        )
        assert cred.all_revoked

    def test_partial_revocation(self):
        cred = CredentialRevocation(api_keys_revoked=True)
        assert not cred.all_revoked

    def test_roundtrip(self):
        cred = CredentialRevocation(
            api_keys_revoked=True,
            oauth_tokens_invalidated=True,
        )
        d = cred.to_dict()
        cred2 = CredentialRevocation.from_dict(d)
        assert cred2.api_keys_revoked
        assert cred2.oauth_tokens_invalidated


class TestValidateChecklist:
    def test_complete_checklist(self):
        plan = DecommissionPlan(
            agent_id="agent-001",
            estate=EstateDisposition(
                counterparties_notified=True,
                fleet_coordinator_notified=True,
                credentials=CredentialRevocation(
                    api_keys_revoked=True,
                    oauth_tokens_invalidated=True,
                    service_accounts_deleted=True,
                    trust_relationships_terminated=True,
                    certificates_revoked=True,
                    identity_key_archived=True,
                ),
            ),
        )
        issues = validate_decommission_checklist(plan)
        assert issues == []

    def test_incomplete_checklist(self):
        plan = DecommissionPlan(agent_id="agent-001")
        issues = validate_decommission_checklist(plan)
        assert len(issues) > 0
        assert any("API keys" in i for i in issues)
        assert any("Counterparties" in i for i in issues)


class TestEstateDisposition:
    def test_roundtrip(self):
        estate = EstateDisposition(
            obligations_transferred=10,
            obligations_terminated=2,
            counterparties_notified=True,
        )
        d = estate.to_dict()
        estate2 = EstateDisposition.from_dict(d)
        assert estate2.obligations_transferred == 10
        assert estate2.counterparties_notified
