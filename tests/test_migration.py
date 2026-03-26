"""Tests for migration.py — cold, warm, live migration."""

import pytest

from agent_lifecycle_protocol.store import LifecycleStore
from agent_lifecycle_protocol.lifecycle import LifecycleError, LifecycleManager
from agent_lifecycle_protocol.migration import (
    MigrationPlan,
    PlatformInfo,
    abort_migration,
    begin_migration,
    complete_migration,
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


class TestBeginMigration:
    def test_transitions_to_migrating(self, manager, active_agent):
        plan = MigrationPlan(
            agent_id="agent-001",
            migration_type="cold",
            source=PlatformInfo(provider="source-host"),
            destination=PlatformInfo(provider="dest-host"),
        )
        plan = begin_migration(manager, plan)
        assert plan.phase == "migrating"
        assert plan.state_hash_before != ""

        agent = manager.get_agent("agent-001")
        assert agent.state == "migrating"

    def test_invalid_migration_type(self, manager, active_agent):
        plan = MigrationPlan(
            agent_id="agent-001",
            migration_type="teleport",
        )
        with pytest.raises(LifecycleError, match="Invalid migration type"):
            begin_migration(manager, plan)

    def test_non_active_fails(self, manager):
        manager.genesis("agent-002")
        plan = MigrationPlan(agent_id="agent-002")
        with pytest.raises(LifecycleError, match="must be Active"):
            begin_migration(manager, plan)


class TestCompleteMigration:
    def test_transitions_back_to_active(self, manager, active_agent):
        plan = MigrationPlan(
            agent_id="agent-001",
            migration_type="warm",
        )
        plan = begin_migration(manager, plan)
        plan = complete_migration(manager, plan, state_hash_after=plan.state_hash_before)
        assert plan.phase == "complete"

        agent = manager.get_agent("agent-001")
        assert agent.state == "active"

    def test_complete_wrong_phase_fails(self, manager, active_agent):
        plan = MigrationPlan(agent_id="agent-001", phase="planned")
        with pytest.raises(LifecycleError, match="Cannot complete"):
            complete_migration(manager, plan)


class TestAbortMigration:
    def test_aborts_to_active(self, manager, active_agent):
        plan = MigrationPlan(agent_id="agent-001")
        plan = begin_migration(manager, plan)
        plan = abort_migration(manager, plan, reason="network failure")
        assert plan.phase == "aborted"

        agent = manager.get_agent("agent-001")
        assert agent.state == "active"

    def test_abort_wrong_phase_fails(self, manager, active_agent):
        plan = MigrationPlan(agent_id="agent-001", phase="complete")
        with pytest.raises(LifecycleError, match="Cannot abort"):
            abort_migration(manager, plan)


class TestMigrationTypes:
    def test_all_types(self, manager, active_agent):
        for mtype in ("cold", "warm", "live"):
            # Reset agent to active
            agent = manager.get_agent("agent-001")
            if agent.state == "migrating":
                complete_migration(
                    manager,
                    MigrationPlan(agent_id="agent-001", phase="migrating"),
                )

            plan = MigrationPlan(
                agent_id="agent-001",
                migration_type=mtype,
            )
            plan = begin_migration(manager, plan)
            plan = complete_migration(manager, plan)
            assert plan.phase == "complete"
