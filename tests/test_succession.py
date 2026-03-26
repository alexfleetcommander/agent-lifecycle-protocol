"""Tests for succession.py — four-phase succession protocol."""

import pytest

from agent_lifecycle_protocol.schema import ReputationInheritance
from agent_lifecycle_protocol.store import LifecycleStore
from agent_lifecycle_protocol.lifecycle import LifecycleError, LifecycleManager
from agent_lifecycle_protocol.succession import (
    SuccessionPlan,
    announce_succession,
    transfer_estate,
    verify_succession,
    execute_cutover,
    abort_succession,
)


@pytest.fixture
def manager(tmp_path):
    store = LifecycleStore(str(tmp_path / "test_alp"))
    return LifecycleManager(store=store)


@pytest.fixture
def predecessor_and_successor(manager):
    manager.genesis("pred-001")
    manager.activate("pred-001")
    # Give predecessor earned reputation
    pred = manager.get_agent("pred-001")
    pred.reputation_earned = 0.87
    manager.store.save_agent(pred)

    manager.genesis("succ-001")
    manager.activate("succ-001")
    return "pred-001", "succ-001"


class TestAnnounceSuccession:
    def test_announces_and_deprecates_predecessor(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
        )
        plan = announce_succession(manager, plan)
        assert plan.phase == "announced"
        assert plan.planned_cutover != ""

        pred = manager.get_agent(pred_id)
        assert pred.state == "deprecated"

    def test_computes_reputation_inheritance(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
            reputation_inheritance=ReputationInheritance(alpha=0.5),
        )
        plan = announce_succession(manager, plan)
        # 0.87 * 0.5 = 0.435
        assert plan.reputation_inheritance.inherited_score == pytest.approx(0.435, abs=0.01)


class TestTransferEstate:
    def test_transfers_reputation_to_successor(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
            reputation_inheritance=ReputationInheritance(
                alpha=0.5, predecessor_score=0.87,
            ),
        )
        plan = announce_succession(manager, plan)
        plan = transfer_estate(manager, plan, obligations_transferred=10)

        assert plan.phase == "transferred"
        assert plan.obligations_transferred == 10

        succ = manager.get_agent(succ_id)
        assert succ.reputation_inherited > 0

    def test_transfer_wrong_phase_fails(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
            phase="planned",
        )
        with pytest.raises(LifecycleError, match="Cannot transfer"):
            transfer_estate(manager, plan)


class TestVerifySuccession:
    def test_passes_when_complete(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
            reputation_inheritance=ReputationInheritance(alpha=0.5),
        )
        plan = announce_succession(manager, plan)
        plan = transfer_estate(manager, plan, knowledge_transferred=True)
        plan = verify_succession(manager, plan)
        assert plan.verification_passed
        assert plan.phase == "verified"

    def test_fails_without_knowledge_transfer(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
        )
        plan = announce_succession(manager, plan)
        plan = transfer_estate(manager, plan, knowledge_transferred=False)
        with pytest.raises(LifecycleError, match="Knowledge transfer incomplete"):
            verify_succession(manager, plan)


class TestExecuteCutover:
    def test_full_succession_flow(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
            reputation_inheritance=ReputationInheritance(alpha=0.5),
        )
        plan = announce_succession(manager, plan)
        plan = transfer_estate(manager, plan, knowledge_transferred=True)
        plan = verify_succession(manager, plan)
        plan = execute_cutover(manager, plan)

        assert plan.phase == "complete"
        pred = manager.get_agent(pred_id)
        assert pred.state == "decommissioned"


class TestAbortSuccession:
    def test_abort_restores_predecessor(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
            reputation_inheritance=ReputationInheritance(alpha=0.5),
        )
        plan = announce_succession(manager, plan)
        plan = transfer_estate(manager, plan)
        plan = abort_succession(manager, plan, reason="test abort")

        assert plan.phase == "aborted"
        pred = manager.get_agent(pred_id)
        assert pred.state == "active"

    def test_abort_zeros_successor_reputation(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
            reputation_inheritance=ReputationInheritance(alpha=0.5),
        )
        plan = announce_succession(manager, plan)
        plan = transfer_estate(manager, plan)
        plan = abort_succession(manager, plan, reason="test abort")

        succ = manager.get_agent(succ_id)
        assert succ.reputation_inherited == 0.0

    def test_abort_from_wrong_phase_fails(self, manager, predecessor_and_successor):
        pred_id, succ_id = predecessor_and_successor
        plan = SuccessionPlan(
            predecessor_id=pred_id,
            successor_id=succ_id,
            phase="complete",
        )
        with pytest.raises(LifecycleError, match="Cannot abort"):
            abort_succession(manager, plan)
