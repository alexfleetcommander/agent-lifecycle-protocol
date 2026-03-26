"""Fork registry and lineage tracking (Section 6).

Provides genealogical queries: ancestors, descendants, siblings,
family tree, genetic match, epigenetic match.
Implements access control (public/authorized/operator_only) and
decommissioned agent redaction.
"""

import hashlib
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from .schema import (
    ACCESS_LEVELS,
    REDACTION_LEVELS,
    AgentRecord,
)
from .store import LifecycleStore


@dataclass
class RegistryEntry:
    """A registry entry for lineage queries (Section 6.2)."""
    agent_id: str = ""
    parent_id: Optional[str] = None
    children: List[str] = field(default_factory=list)
    siblings: List[str] = field(default_factory=list)
    generation: int = 1
    fork_type: str = ""
    genesis_timestamp: str = ""
    lifecycle_status: str = "provisioning"
    genetic_profile: Dict[str, Any] = field(default_factory=dict)
    epigenetic_profile: Dict[str, Any] = field(default_factory=dict)
    redaction_level: str = "none"
    last_updated: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "parent_id": self.parent_id,
            "children": list(self.children),
            "siblings": list(self.siblings),
            "generation": self.generation,
            "fork_type": self.fork_type,
            "genesis_timestamp": self.genesis_timestamp,
            "lifecycle_status": self.lifecycle_status,
            "genetic_profile": dict(self.genetic_profile),
            "epigenetic_profile": dict(self.epigenetic_profile),
            "redaction_level": self.redaction_level,
            "last_updated": self.last_updated,
        }

    @classmethod
    def from_agent(cls, agent: AgentRecord) -> "RegistryEntry":
        return cls(
            agent_id=agent.agent_id,
            parent_id=agent.parent_id,
            children=list(agent.children),
            generation=agent.generation,
            lifecycle_status=agent.state,
            genetic_profile=agent.genetic_profile.to_dict(),
            epigenetic_profile=agent.epigenetic_profile.to_dict(),
            redaction_level=agent.redaction_level,
            last_updated=agent.updated_at,
            genesis_timestamp=agent.created_at,
        )


def _pseudonymous_hash(agent_id: str) -> str:
    """Generate pseudonymous hash for redacted entries (Section 6.5)."""
    return "anon:" + hashlib.sha256(agent_id.encode("utf-8")).hexdigest()[:16]


class LineageRegistry:
    """Fork registry with lineage queries (Section 6.3).

    Builds an in-memory graph from the LifecycleStore's agent records.
    """

    def __init__(self, store: LifecycleStore) -> None:
        self.store = store

    def _build_index(self) -> Dict[str, AgentRecord]:
        """Build latest-snapshot index of all agents."""
        latest: Dict[str, AgentRecord] = {}
        for a in self.store.get_all_agents():
            latest[a.agent_id] = a
        return latest

    def get_entry(
        self, agent_id: str, access_level: str = "public"
    ) -> Optional[RegistryEntry]:
        """Get a registry entry with access-level filtering (Section 6.5)."""
        index = self._build_index()
        agent = index.get(agent_id)
        if agent is None:
            return None

        entry = RegistryEntry.from_agent(agent)

        # Compute siblings
        if agent.parent_id and agent.parent_id in index:
            parent = index[agent.parent_id]
            entry.siblings = [
                c for c in parent.children if c != agent_id
            ]

        # Apply redaction for decommissioned agents
        entry = self._apply_redaction(entry)

        # Apply access level filtering
        entry = self._apply_access_filter(entry, access_level)

        return entry

    def ancestors(self, agent_id: str, max_depth: int = 100) -> List[str]:
        """Return the complete ancestor chain (Section 6.3)."""
        index = self._build_index()
        chain: List[str] = []
        current = agent_id
        depth = 0
        while depth < max_depth:
            agent = index.get(current)
            if agent is None or agent.parent_id is None:
                break
            chain.append(agent.parent_id)
            current = agent.parent_id
            depth += 1
        return chain

    def descendants(
        self, agent_id: str, max_depth: int = 100
    ) -> List[str]:
        """Return all agents forked from this agent, recursively."""
        index = self._build_index()
        result: List[str] = []
        queue: List[str] = [agent_id]
        visited: Set[str] = {agent_id}
        depth = 0

        while queue and depth < max_depth:
            next_queue: List[str] = []
            for aid in queue:
                agent = index.get(aid)
                if agent is None:
                    continue
                for child in agent.children:
                    if child not in visited:
                        visited.add(child)
                        result.append(child)
                        next_queue.append(child)
            queue = next_queue
            depth += 1

        return result

    def siblings(self, agent_id: str) -> List[str]:
        """Return all agents sharing the same parent (Section 6.3)."""
        index = self._build_index()
        agent = index.get(agent_id)
        if agent is None or agent.parent_id is None:
            return []

        parent = index.get(agent.parent_id)
        if parent is None:
            return []

        return [c for c in parent.children if c != agent_id]

    def family_tree(
        self, agent_id: str, max_depth: int = 100
    ) -> Dict[str, Any]:
        """Return the complete genealogy tree (Section 6.3)."""
        index = self._build_index()

        def _build_node(aid: str, depth: int) -> Dict[str, Any]:
            agent = index.get(aid)
            if agent is None:
                return {"agent_id": aid, "status": "unknown", "children": []}
            node: Dict[str, Any] = {
                "agent_id": aid,
                "state": agent.state,
                "generation": agent.generation,
                "children": [],
            }
            if depth < max_depth:
                for child_id in agent.children:
                    node["children"].append(_build_node(child_id, depth + 1))
            return node

        # Walk up to root
        root = agent_id
        while True:
            agent = index.get(root)
            if agent is None or agent.parent_id is None:
                break
            root = agent.parent_id

        return _build_node(root, 0)

    def genetic_match(
        self, model_family: str = "", architecture: str = ""
    ) -> List[str]:
        """Find agents sharing genetic lineage (Section 6.3)."""
        index = self._build_index()
        results: List[str] = []
        for agent in index.values():
            if model_family and agent.genetic_profile.model_family != model_family:
                continue
            if architecture and agent.genetic_profile.architecture != architecture:
                continue
            results.append(agent.agent_id)
        return results

    def epigenetic_match(
        self, role: str = "", specialization: str = ""
    ) -> List[str]:
        """Find agents sharing epigenetic profiles (Section 6.3)."""
        index = self._build_index()
        results: List[str] = []
        for agent in index.values():
            if role and agent.epigenetic_profile.role != role:
                continue
            if specialization and agent.epigenetic_profile.specialization != specialization:
                continue
            results.append(agent.agent_id)
        return results

    def redact_entry(
        self, agent_id: str, level: str = "partial"
    ) -> Optional[AgentRecord]:
        """Apply redaction to a decommissioned agent's registry entry (Section 9.5)."""
        if level not in REDACTION_LEVELS:
            raise ValueError(f"Invalid redaction level: {level}")

        agent = self.store.get_agent(agent_id)
        if agent is None:
            return None
        if agent.state != "decommissioned":
            raise ValueError("Only decommissioned agents can be redacted")

        agent.redaction_level = level
        self.store.save_agent(agent)
        return agent

    def _apply_redaction(self, entry: RegistryEntry) -> RegistryEntry:
        """Apply redaction based on the entry's redaction level."""
        if entry.redaction_level == "none":
            return entry

        if entry.redaction_level == "partial":
            # Keep: agent_id, lineage links, genetic_profile, status, timestamp
            # Remove: epigenetic_profile details
            entry.epigenetic_profile = {}
            return entry

        if entry.redaction_level == "full":
            # Replace agent_id with pseudonymous hash
            original_id = entry.agent_id
            entry.agent_id = _pseudonymous_hash(original_id)
            if entry.parent_id:
                entry.parent_id = _pseudonymous_hash(entry.parent_id)
            entry.children = [_pseudonymous_hash(c) for c in entry.children]
            entry.siblings = [_pseudonymous_hash(s) for s in entry.siblings]
            entry.genetic_profile = {}
            entry.epigenetic_profile = {}
            return entry

        return entry

    def _apply_access_filter(
        self, entry: RegistryEntry, access_level: str
    ) -> RegistryEntry:
        """Filter entry fields based on access level (Section 6.5)."""
        if access_level == "operator_only":
            return entry  # full access

        if access_level == "authorized":
            # Remove operator-only fields
            entry.epigenetic_profile = {}
            return entry

        # Public access: minimal fields
        entry.epigenetic_profile = {}
        entry.children = []
        entry.siblings = []
        return entry
