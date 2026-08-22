const MAX_SNAPSHOTS = 500;
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
    events: arrayField(input, "events", MAX_EVENTS),
    acknowledgements: arrayField(input, "acknowledgements", MAX_ACKS)
      .map(String)
      .filter(Boolean)
  };
}

export class PendingCommandQueue {
  constructor() {
    this.commands = new Map();
  }

  add(command) {
    this.commands.set(command.id, command);
    return command;
  }

  acknowledge(ids) {
    for (const id of ids) this.commands.delete(String(id));
  }

  list() {
    return [...this.commands.values()];
  }
}
