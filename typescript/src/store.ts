import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { AgentRecord, LifecycleEvent } from "./types";

export class LifecycleStore {
  readonly directory: string;

  constructor(directory: string = ".alp") {
    this.directory = directory;
    mkdirSync(directory, { recursive: true });
  }

  private filePath(recordType: string): string {
    return join(this.directory, `${recordType}.jsonl`);
  }

  private append(recordType: string, data: Record<string, unknown>): void {
    const path = this.filePath(recordType);
    const line = JSON.stringify(data) + "\n";
    writeFileSync(path, line, { flag: "a", encoding: "utf-8" });
  }

  private readAllRaw(recordType: string): Array<Record<string, unknown>> {
    const path = this.filePath(recordType);
    if (!existsSync(path)) return [];
    const content = readFileSync(path, "utf-8");
    const records: Array<Record<string, unknown>> = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed));
      } catch {
        continue;
      }
    }
    return records;
  }

  // -- Events --

  appendEvent(event: LifecycleEvent): string {
    if (!event.eventHash) event.computeHash();
    this.append("events", event.toDict() as unknown as Record<string, unknown>);
    return event.eventId;
  }

  getEvents(): LifecycleEvent[] {
    return this.readAllRaw("events").map((d) =>
      LifecycleEvent.fromDict(d as Record<string, unknown>),
    );
  }

  getEvent(eventId: string): LifecycleEvent | null {
    for (const e of this.getEvents()) {
      if (e.eventId === eventId) return e;
    }
    return null;
  }

  getEventsFor(agentId: string): LifecycleEvent[] {
    return this.getEvents().filter((e) => e.agentId === agentId);
  }

  // -- Agent Records --

  saveAgent(agent: AgentRecord): string {
    this.append("agents", agent.toDict() as unknown as Record<string, unknown>);
    return agent.agentId;
  }

  getAllAgents(): AgentRecord[] {
    return this.readAllRaw("agents").map((d) =>
      AgentRecord.fromDict(d as Record<string, unknown>),
    );
  }

  getAgent(agentId: string): AgentRecord | null {
    let latest: AgentRecord | null = null;
    for (const a of this.getAllAgents()) {
      if (a.agentId === agentId) latest = a;
    }
    return latest;
  }

  getAgentsByState(state: string): AgentRecord[] {
    const latest = new Map<string, AgentRecord>();
    for (const a of this.getAllAgents()) {
      latest.set(a.agentId, a);
    }
    return [...latest.values()].filter((a) => a.state === state);
  }

  // -- Statistics --

  stats(): Record<string, unknown> {
    const events = this.getEvents();
    const agentsRaw = this.getAllAgents();

    const latest = new Map<string, AgentRecord>();
    for (const a of agentsRaw) {
      latest.set(a.agentId, a);
    }

    const fileSize = (name: string): number => {
      const p = this.filePath(name);
      try {
        return statSync(p).size;
      } catch {
        return 0;
      }
    };

    const stateCounts: Record<string, number> = {};
    for (const a of latest.values()) {
      stateCounts[a.state] = (stateCounts[a.state] ?? 0) + 1;
    }

    return {
      directory: this.directory,
      events: {
        count: events.length,
        file_size_bytes: fileSize("events"),
      },
      agents: {
        unique_count: latest.size,
        snapshots_count: agentsRaw.length,
        file_size_bytes: fileSize("agents"),
        by_state: stateCounts,
      },
    };
  }
}
