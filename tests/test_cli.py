"""Tests for cli.py — CLI entry point."""

import pytest

from agent_lifecycle_protocol.cli import main


@pytest.fixture
def store_dir(tmp_path):
    return str(tmp_path / "test_alp")


class TestCLI:
    def test_no_command_shows_help(self, store_dir, capsys):
        ret = main(["--store", store_dir])
        assert ret == 0

    def test_genesis(self, store_dir):
        ret = main(["--store", store_dir, "genesis", "--agent-id", "a1"])
        assert ret == 0

    def test_genesis_then_activate(self, store_dir):
        main(["--store", store_dir, "genesis", "--agent-id", "a1"])
        ret = main(["--store", store_dir, "activate", "--agent-id", "a1"])
        assert ret == 0

    def test_fork(self, store_dir):
        main(["--store", store_dir, "genesis", "--agent-id", "parent"])
        main(["--store", store_dir, "activate", "--agent-id", "parent"])
        ret = main([
            "--store", store_dir, "fork",
            "--parent-id", "parent", "--child-id", "child",
        ])
        assert ret == 0

    def test_retrain(self, store_dir):
        main(["--store", store_dir, "genesis", "--agent-id", "a1"])
        main(["--store", store_dir, "activate", "--agent-id", "a1"])
        ret = main([
            "--store", store_dir, "retrain",
            "--agent-id", "a1",
            "--change-type", "prompt_revision",
        ])
        assert ret == 0

    def test_migrate_begin_complete(self, store_dir):
        main(["--store", store_dir, "genesis", "--agent-id", "a1"])
        main(["--store", store_dir, "activate", "--agent-id", "a1"])
        ret = main([
            "--store", store_dir, "migrate",
            "--agent-id", "a1", "--action", "begin",
        ])
        assert ret == 0
        ret = main([
            "--store", store_dir, "migrate",
            "--agent-id", "a1", "--action", "complete",
        ])
        assert ret == 0

    def test_emergency_decommission(self, store_dir):
        main(["--store", store_dir, "genesis", "--agent-id", "a1"])
        main(["--store", store_dir, "activate", "--agent-id", "a1"])
        ret = main([
            "--store", store_dir, "decommission",
            "--agent-id", "a1", "--emergency",
        ])
        assert ret == 0

    def test_status(self, store_dir):
        main(["--store", store_dir, "genesis", "--agent-id", "a1"])
        ret = main(["--store", store_dir, "status"])
        assert ret == 0

    def test_query_lineage(self, store_dir):
        main(["--store", store_dir, "genesis", "--agent-id", "a1"])
        main(["--store", store_dir, "activate", "--agent-id", "a1"])
        main([
            "--store", store_dir, "fork",
            "--parent-id", "a1", "--child-id", "a2",
        ])
        ret = main([
            "--store", store_dir, "query-lineage",
            "--agent-id", "a1", "--query", "descendants",
        ])
        assert ret == 0

    def test_error_returns_1(self, store_dir):
        ret = main([
            "--store", store_dir, "activate", "--agent-id", "nonexistent",
        ])
        assert ret == 1

    def test_json_output(self, store_dir, capsys):
        main(["--store", store_dir, "--json", "genesis", "--agent-id", "a1"])
        captured = capsys.readouterr()
        assert "agent_id" in captured.out
