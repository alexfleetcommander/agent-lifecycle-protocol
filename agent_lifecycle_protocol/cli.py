"""CLI entry point for agent-lifecycle-protocol.

Commands:
  genesis           Create a new agent
  activate          Activate a provisioned agent
  fork              Fork an agent
  succeed           Run succession (announce/transfer/verify/cutover)
  migrate           Migrate an agent (begin/complete/abort)
  retrain           Record a retraining event
  decommission      Decommission an agent (graceful or emergency)
  query-lineage     Query lineage (ancestors/descendants/siblings/tree)
  status            Show store statistics and agent status
"""

import argparse
import json
import sys
from typing import List, Optional

from .schema import (
    EpigeneticProfile,
    GeneticProfile,
    Initiator,
    ReputationInheritance,
)
from .store import LifecycleStore
from .lifecycle import LifecycleManager, LifecycleError
from .fork import InheritanceConfig, fork_agent
from .succession import (
    SuccessionPlan,
    announce_succession,
    transfer_estate,
    verify_succession,
    execute_cutover,
    abort_succession,
)
from .migration import (
    MigrationPlan,
    PlatformInfo,
    begin_migration,
    complete_migration,
    abort_migration,
)
from .retraining import (
    CapabilitySnapshot,
    IdentityContinuity,
    RetrainingEvent,
    record_retraining,
)
from .decommission import (
    DecommissionPlan,
    EstateDisposition,
    graceful_decommission,
    emergency_decommission,
)
from .registry import LineageRegistry


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="agent-lifecycle",
        description="Agent Lifecycle Protocol — manage agent birth, fork, "
                    "succession, migration, and decommission",
    )
    parser.add_argument(
        "--store",
        default=".alp",
        help="Path to the ALP data directory (default: .alp)",
    )
    parser.add_argument(
        "--json", action="store_true", dest="json_output",
        help="Output as JSON",
    )

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # genesis
    p_gen = sub.add_parser("genesis", help="Create a new agent")
    p_gen.add_argument("--agent-id", required=True, help="Agent ID")
    p_gen.add_argument("--creator", default="", help="Creator ID")
    p_gen.add_argument("--model-family", default="", help="Model family")
    p_gen.add_argument("--architecture", default="", help="Architecture")
    p_gen.add_argument("--role", default="", help="Agent role")

    # activate
    p_act = sub.add_parser("activate", help="Activate a provisioned agent")
    p_act.add_argument("--agent-id", required=True, help="Agent ID")

    # fork
    p_fork = sub.add_parser("fork", help="Fork an existing agent")
    p_fork.add_argument("--parent-id", required=True, help="Parent agent ID")
    p_fork.add_argument("--child-id", required=True, help="Child agent ID")
    p_fork.add_argument(
        "--fork-type", default="specialization",
        choices=["full_clone", "partial_clone", "capability_fork", "specialization"],
        help="Fork type",
    )
    p_fork.add_argument(
        "--alpha", type=float, default=0.3,
        help="Reputation inheritance factor (default: 0.3)",
    )

    # succeed
    p_succ = sub.add_parser("succeed", help="Run succession protocol")
    p_succ.add_argument("--predecessor-id", required=True, help="Predecessor agent ID")
    p_succ.add_argument("--successor-id", required=True, help="Successor agent ID")
    p_succ.add_argument(
        "--phase",
        choices=["announce", "transfer", "verify", "cutover", "abort"],
        default="announce",
        help="Succession phase to execute",
    )
    p_succ.add_argument(
        "--alpha", type=float, default=0.5,
        help="Reputation inheritance factor (default: 0.5)",
    )

    # migrate
    p_mig = sub.add_parser("migrate", help="Migrate an agent")
    p_mig.add_argument("--agent-id", required=True, help="Agent ID")
    p_mig.add_argument(
        "--action", choices=["begin", "complete", "abort"],
        default="begin", help="Migration action",
    )
    p_mig.add_argument(
        "--type", dest="migration_type", default="cold",
        choices=["cold", "warm", "live"],
        help="Migration type",
    )
    p_mig.add_argument("--source", default="", help="Source platform")
    p_mig.add_argument("--destination", default="", help="Destination platform")

    # retrain
    p_ret = sub.add_parser("retrain", help="Record a retraining event")
    p_ret.add_argument("--agent-id", required=True, help="Agent ID")
    p_ret.add_argument(
        "--change-type", default="model_upgrade",
        choices=[
            "model_upgrade", "fine_tuning", "prompt_revision",
            "capability_addition", "capability_removal",
        ],
        help="Type of change",
    )
    p_ret.add_argument("--before-model", default="", help="Model version before")
    p_ret.add_argument("--after-model", default="", help="Model version after")

    # decommission
    p_dec = sub.add_parser("decommission", help="Decommission an agent")
    p_dec.add_argument("--agent-id", required=True, help="Agent ID")
    p_dec.add_argument(
        "--reason", default="end_of_life",
        choices=[
            "end_of_life", "superseded", "compromised",
            "policy_violation", "resource_constraint",
        ],
        help="Decommission reason",
    )
    p_dec.add_argument(
        "--emergency", action="store_true",
        help="Emergency decommission (from any state)",
    )

    # query-lineage
    p_lin = sub.add_parser("query-lineage", help="Query agent lineage")
    p_lin.add_argument("--agent-id", required=True, help="Agent ID")
    p_lin.add_argument(
        "--query", default="tree",
        choices=["ancestors", "descendants", "siblings", "tree",
                 "genetic-match", "epigenetic-match"],
        help="Query type",
    )
    p_lin.add_argument("--model-family", default="", help="For genetic-match")
    p_lin.add_argument("--role", default="", help="For epigenetic-match")

    # status
    sub.add_parser("status", help="Show store statistics and agent status")

    return parser


def _output(data: object, as_json: bool = False) -> None:
    if as_json:
        if hasattr(data, "to_dict"):
            data = data.to_dict()  # type: ignore[union-attr]
        print(json.dumps(data, indent=2))
    else:
        if isinstance(data, dict):
            for k, v in data.items():
                print(f"  {k}: {v}")
        elif isinstance(data, list):
            for item in data:
                print(f"  - {item}")
        else:
            print(data)


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 0

    store = LifecycleStore(args.store)
    manager = LifecycleManager(store=store)
    registry = LineageRegistry(store)
    json_out = args.json_output

    try:
        if args.command == "genesis":
            agent = manager.genesis(
                agent_id=args.agent_id,
                creator_id=args.creator,
                genetic_profile=GeneticProfile(
                    model_family=args.model_family,
                    architecture=args.architecture,
                ),
                epigenetic_profile=EpigeneticProfile(role=args.role),
            )
            print(f"Created agent: {agent.agent_id} (state: {agent.state})")
            if json_out:
                _output(agent.to_dict(), True)

        elif args.command == "activate":
            agent = manager.activate(args.agent_id)
            print(f"Activated: {agent.agent_id} (state: {agent.state})")

        elif args.command == "fork":
            inh = InheritanceConfig(reputation_factor=args.alpha)
            record = fork_agent(
                manager, args.parent_id, args.child_id,
                fork_type=args.fork_type, inheritance=inh,
            )
            print(f"Forked: {record.parent_id} -> {record.child_id}")
            print(f"  Type: {record.fork_type}")
            if record.reputation_inheritance:
                print(f"  Inherited reputation: {record.reputation_inheritance.inherited_score:.4f}")
            if json_out:
                _output(record.to_dict(), True)

        elif args.command == "succeed":
            plan = SuccessionPlan(
                predecessor_id=args.predecessor_id,
                successor_id=args.successor_id,
                reputation_inheritance=ReputationInheritance(alpha=args.alpha),
            )

            if args.phase == "announce":
                plan = announce_succession(manager, plan)
                print(f"Succession announced: {plan.predecessor_id} -> {plan.successor_id}")
                print(f"  Planned cutover: {plan.planned_cutover}")
            elif args.phase == "transfer":
                plan.phase = "announced"
                plan = transfer_estate(manager, plan)
                print(f"Estate transferred")
            elif args.phase == "verify":
                plan.phase = "transferred"
                plan.knowledge_transfer_complete = True
                plan = verify_succession(manager, plan)
                print(f"Verification: {'PASSED' if plan.verification_passed else 'FAILED'}")
            elif args.phase == "cutover":
                plan.phase = "verified"
                plan.verification_passed = True
                plan = execute_cutover(manager, plan)
                print(f"Cutover complete: {plan.predecessor_id} decommissioned")
            elif args.phase == "abort":
                plan.phase = "announced"
                plan = abort_succession(manager, plan, reason="manual abort")
                print(f"Succession aborted")

            if json_out:
                _output(plan.to_dict(), True)

        elif args.command == "migrate":
            plan = MigrationPlan(
                agent_id=args.agent_id,
                migration_type=args.migration_type,
                source=PlatformInfo(provider=args.source),
                destination=PlatformInfo(provider=args.destination),
            )

            if args.action == "begin":
                plan = begin_migration(manager, plan)
                print(f"Migration started: {plan.agent_id} ({plan.migration_type})")
            elif args.action == "complete":
                plan.phase = "migrating"
                plan = complete_migration(manager, plan)
                print(f"Migration complete: {plan.agent_id}")
            elif args.action == "abort":
                plan.phase = "migrating"
                plan = abort_migration(manager, plan, reason="manual abort")
                print(f"Migration aborted: {plan.agent_id}")

            if json_out:
                _output(plan.to_dict(), True)

        elif args.command == "retrain":
            retraining = RetrainingEvent(
                agent_id=args.agent_id,
                change_type=args.change_type,
                before=CapabilitySnapshot(model_version=args.before_model),
                after=CapabilitySnapshot(model_version=args.after_model),
                identity_continuity=IdentityContinuity(),
            )
            event = record_retraining(manager, retraining)
            print(f"Retraining recorded: {event.event_id}")
            print(f"  Class: {retraining.retraining_class}")
            print(f"  Counterparty action: {retraining.counterparty_action_required}")

        elif args.command == "decommission":
            plan = DecommissionPlan(
                agent_id=args.agent_id,
                reason=args.reason,
            )
            if args.emergency:
                plan = emergency_decommission(manager, plan)
                print(f"Emergency decommission complete: {plan.agent_id}")
            else:
                plan = graceful_decommission(manager, plan)
                print(f"Graceful decommission complete: {plan.agent_id}")

            if json_out:
                _output(plan.to_dict(), True)

        elif args.command == "query-lineage":
            if args.query == "ancestors":
                result = registry.ancestors(args.agent_id)
                print(f"Ancestors of {args.agent_id}:")
                _output(result, json_out)
            elif args.query == "descendants":
                result = registry.descendants(args.agent_id)
                print(f"Descendants of {args.agent_id}:")
                _output(result, json_out)
            elif args.query == "siblings":
                result = registry.siblings(args.agent_id)
                print(f"Siblings of {args.agent_id}:")
                _output(result, json_out)
            elif args.query == "tree":
                tree = registry.family_tree(args.agent_id)
                print(f"Family tree for {args.agent_id}:")
                _output(tree, True)  # tree always JSON
            elif args.query == "genetic-match":
                result = registry.genetic_match(model_family=args.model_family)
                print(f"Genetic matches:")
                _output(result, json_out)
            elif args.query == "epigenetic-match":
                result = registry.epigenetic_match(role=args.role)
                print(f"Epigenetic matches:")
                _output(result, json_out)

        elif args.command == "status":
            stats = store.stats()
            print("Agent Lifecycle Protocol Store")
            print(f"  Directory: {stats['directory']}")
            print(f"  Events: {stats['events']['count']}")
            print(f"  Agents: {stats['agents']['unique_count']}")
            if stats["agents"]["by_state"]:
                print("  By state:")
                for state, count in stats["agents"]["by_state"].items():
                    print(f"    {state}: {count}")
            if json_out:
                _output(stats, True)

    except LifecycleError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
