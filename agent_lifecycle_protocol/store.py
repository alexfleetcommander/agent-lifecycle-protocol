"""Local append-only JSONL store for ALP records.

Same pattern as Chain of Consciousness and Agent Rating Protocol:
one JSON record per line, append-only, no deletion.
"""

import json
import threading
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar

from .schema import AgentRecord, LifecycleEvent

T = TypeVar("T")


class LifecycleStore:
    """Append-only local store backed by JSONL files.

    Maintains separate files for:
    - events.jsonl   -- LifecycleEvent records
    - agents.jsonl   -- AgentRecord snapshots (latest wins)
    """

    def __init__(self, directory: str = ".alp") -> None:
        self.directory = Path(directory)
        self._lock = threading.Lock()
        self.directory.mkdir(parents=True, exist_ok=True)

    def _file_path(self, record_type: str) -> Path:
        return self.directory / f"{record_type}.jsonl"

    def _append(self, record_type: str, data: Dict[str, Any]) -> None:
        path = self._file_path(record_type)
        line = json.dumps(data, separators=(",", ":"), ensure_ascii=True)
        with self._lock:
            with open(path, "a", encoding="utf-8") as f:
                f.write(line + "\n")

    def _read_all_raw(self, record_type: str) -> List[Dict[str, Any]]:
        path = self._file_path(record_type)
        if not path.exists():
            return []
        records: List[Dict[str, Any]] = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return records

    def _read_all(
        self,
        record_type: str,
        from_dict: Callable[[Dict[str, Any]], T],
    ) -> List[T]:
        results: List[T] = []
        for d in self._read_all_raw(record_type):
            try:
                results.append(from_dict(d))
            except (KeyError, ValueError):
                continue
        return results

    # -- Events --

    def append_event(self, event: LifecycleEvent) -> str:
        if not event.event_hash:
            event.compute_hash()
        self._append("events", event.to_dict())
        return event.event_id

    def get_events(self) -> List[LifecycleEvent]:
        return self._read_all("events", LifecycleEvent.from_dict)

    def get_event(self, event_id: str) -> Optional[LifecycleEvent]:
        for e in self.get_events():
            if e.event_id == event_id:
                return e
        return None

    def get_events_for(self, agent_id: str) -> List[LifecycleEvent]:
        return [e for e in self.get_events() if e.agent_id == agent_id]

    # -- Agent Records --

    def save_agent(self, agent: AgentRecord) -> str:
        self._append("agents", agent.to_dict())
        return agent.agent_id

    def get_all_agents(self) -> List[AgentRecord]:
        return self._read_all("agents", AgentRecord.from_dict)

    def get_agent(self, agent_id: str) -> Optional[AgentRecord]:
        """Get the latest snapshot of an agent (last write wins)."""
        latest = None
        for a in self.get_all_agents():
            if a.agent_id == agent_id:
                latest = a
        return latest

    def get_agents_by_state(self, state: str) -> List[AgentRecord]:
        """Get latest snapshot for each agent currently in the given state."""
        latest: Dict[str, AgentRecord] = {}
        for a in self.get_all_agents():
            latest[a.agent_id] = a
        return [a for a in latest.values() if a.state == state]

    # -- Statistics --

    def stats(self) -> Dict[str, Any]:
        events = self.get_events()
        agents_raw = self.get_all_agents()

        # Deduplicate agents to latest snapshot
        latest: Dict[str, AgentRecord] = {}
        for a in agents_raw:
            latest[a.agent_id] = a

        def _file_size(name: str) -> int:
            p = self._file_path(name)
            return p.stat().st_size if p.exists() else 0

        state_counts: Dict[str, int] = {}
        for a in latest.values():
            state_counts[a.state] = state_counts.get(a.state, 0) + 1

        return {
            "directory": str(self.directory),
            "events": {
                "count": len(events),
                "file_size_bytes": _file_size("events"),
            },
            "agents": {
                "unique_count": len(latest),
                "snapshots_count": len(agents_raw),
                "file_size_bytes": _file_size("agents"),
                "by_state": state_counts,
            },
        }
