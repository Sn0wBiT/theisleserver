const MAX_SNAPSHOTS = 500;
const MAX_POSITIONS = 500;
const MAX_EVENTS = 1000;
const MAX_ACKS = 1000;

function arrayField(input, name, limit) {
  const value = input?.[name] ?? [];
  if (!Array.isArray(value)) throw new Error(`${name}-must-be-array`);
  if (value.length > limit) throw new Error(`${name}-limit-exceeded`);
  return value;
}

export function parseGameSync(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("body-must-be-object");
  }

  return {
    snapshots: arrayField(input, "snapshots", MAX_SNAPSHOTS),
    positions: arrayField(input, "positions", MAX_POSITIONS),
    events: arrayField(input, "events", MAX_EVENTS).map(validateEvent),
    acknowledgements: arrayField(input, "acknowledgements", MAX_ACKS)
      .map(String)
      .filter(Boolean)
  };
}

function validateEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("event-must-be-object");
  if (event.type === "territory_activity") {
    if (typeof event.event_id !== "string" && typeof event.eventId !== "string") throw new Error("territory-event-id-required");
    if (typeof event.zone_id !== "string" && typeof event.zoneId !== "string") throw new Error("territory-zone-required");
  }
  return event;
}

export class PendingCommandQueue {
  constructor({ journalPath = null, maxSize = 1000 } = {}) {
    this.commands = new Map();
    this.journalPath = journalPath;
    this.maxSize = Math.max(1, Number(maxSize) || 1000);
    if (journalPath && fs.existsSync(journalPath)) {
      for (const line of fs.readFileSync(journalPath, "utf8").split(/\r?\n/).filter(Boolean)) {
        try { const command = JSON.parse(line); if (command?.id) this.commands.set(String(command.id), command); }
        catch { /* A corrupt private journal entry must not prevent startup. */ }
      }
    }
  }

  add(command) {
    if (!this.commands.has(String(command.id)) && this.commands.size >= this.maxSize) {
      throw new Error("command-queue-full");
    }
    this.commands.set(command.id, command);
    this.persist();
    return command;
  }

  acknowledge(ids) {
    let changed = false;
    for (const id of ids) changed = this.commands.delete(String(id)) || changed;
    if (changed) this.persist();
  }

  list() {
    return [...this.commands.values()];
  }

  remove(ids) { this.acknowledge(ids); }

  persist() {
    if (!this.journalPath) return;
    fs.mkdirSync(path.dirname(this.journalPath), { recursive: true });
    const temporary = `${this.journalPath}.tmp`;
    const body = this.list().map((command) => JSON.stringify(command)).join("\n");
    fs.writeFileSync(temporary, body ? `${body}\n` : "");
    fs.renameSync(temporary, this.journalPath);
  }
}
import fs from "node:fs";
import path from "node:path";
