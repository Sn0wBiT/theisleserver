export const VOICE_POSITION_MAX_AGE_MS = 5_000;
export const UNREAL_UNITS_PER_METER = 100;
export const FULL_VOLUME_METERS = 5;
export const MAX_AUDIBLE_METERS = 30;

export function proximityGain(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters >= MAX_AUDIBLE_METERS) return 0;
  if (distanceMeters <= FULL_VOLUME_METERS) return 1;
  return (MAX_AUDIBLE_METERS - distanceMeters) / (MAX_AUDIBLE_METERS - FULL_VOLUME_METERS);
}

function rotateInverse(vector, rotation) {
  const radians = Math.PI / 180;
  const pitch = -rotation.pitch * radians;
  const yaw = -rotation.yaw * radians;
  const roll = -rotation.roll * radians;
  let { x, y, z } = vector;
  [x, y] = [x * Math.cos(yaw) - y * Math.sin(yaw), x * Math.sin(yaw) + y * Math.cos(yaw)];
  [x, z] = [x * Math.cos(pitch) + z * Math.sin(pitch), -x * Math.sin(pitch) + z * Math.cos(pitch)];
  [y, z] = [y * Math.cos(roll) - z * Math.sin(roll), y * Math.sin(roll) + z * Math.cos(roll)];
  return { x, y, z };
}

export function relativeDirection(listener, speaker) {
  const vector = {
    x: speaker.pos.x - listener.pos.x,
    y: speaker.pos.y - listener.pos.y,
    z: speaker.pos.z - listener.pos.z
  };
  const rotated = rotateInverse(vector, listener.rotation);
  const length = Math.hypot(rotated.x, rotated.y, rotated.z);
  return length === 0 ? { x: 0, y: 0, z: 0 } : {
    x: rotated.x / length, y: rotated.y / length, z: rotated.z / length
  };
}

export class VoiceCoordinator {
  constructor({ gameServerId, maxAgeMs = VOICE_POSITION_MAX_AGE_MS, now = () => Date.now() }) {
    this.gameServerId = gameServerId;
    this.maxAgeMs = maxAgeMs;
    this.now = now;
    this.players = new Map();
    this.cells = new Map();
    this.subscribers = new Map();
  }

  update(steamId, position) {
    const previous = this.players.get(steamId);
    if (previous) this.removeFromCell(steamId, previous);
    this.players.set(steamId, position);
    const key = this.cellKey(position.pos);
    const cell = this.cells.get(key) || new Set(); cell.add(steamId); this.cells.set(key, cell);
    this.publishAll();
  }

  cellKey(pos) { const size = MAX_AUDIBLE_METERS * UNREAL_UNITS_PER_METER; return `${Math.floor(pos.x / size)}:${Math.floor(pos.y / size)}:${Math.floor(pos.z / size)}`; }
  removeFromCell(steamId, player) { const key = this.cellKey(player.pos); const cell = this.cells.get(key); cell?.delete(steamId); if (!cell?.size) this.cells.delete(key); }
  candidates(pos) {
    const size = MAX_AUDIBLE_METERS * UNREAL_UNITS_PER_METER; const origin = [Math.floor(pos.x / size), Math.floor(pos.y / size), Math.floor(pos.z / size)]; const ids = new Set();
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (const id of this.cells.get(`${origin[0] + x}:${origin[1] + y}:${origin[2] + z}`) || []) ids.add(id);
    return ids;
  }

  isFresh(steamId) {
    const player = this.players.get(steamId);
    return Boolean(player && player.gameServerId === this.gameServerId && this.now() - player.updatedAt <= this.maxAgeMs);
  }

  stateFor(steamId) {
    const listener = this.players.get(steamId);
    if (!this.isFresh(steamId) || !listener) return { ready: false, stale: true, gameServerId: this.gameServerId, audibleSpeakers: [], permittedListeners: [] };
    const audibleSpeakers = [];
    const permittedListeners = [];
    for (const otherId of this.candidates(listener.pos)) {
      const speaker = this.players.get(otherId);
      if (!speaker) continue;
      if (otherId === steamId || !this.isFresh(otherId)) continue;
      const distanceMeters = Math.hypot(speaker.pos.x - listener.pos.x, speaker.pos.y - listener.pos.y, speaker.pos.z - listener.pos.z) / UNREAL_UNITS_PER_METER;
      const gain = proximityGain(distanceMeters);
      if (gain <= 0) continue;
      audibleSpeakers.push({ identity: otherId, displayName: speaker.displayName || otherId, gain, direction: relativeDirection(listener, speaker), subscribed: true });
      permittedListeners.push(otherId);
    }
    return { ready: true, stale: false, gameServerId: this.gameServerId, audibleSpeakers, permittedListeners };
  }

  subscribe(steamId, response) {
    const set = this.subscribers.get(steamId) || new Set();
    set.add(response);
    this.subscribers.set(steamId, set);
    response.write(this.eventFor(steamId));
    return () => { set.delete(response); if (!set.size) this.subscribers.delete(steamId); };
  }

  eventFor(steamId) { return `event: proximity\ndata: ${JSON.stringify(this.stateFor(steamId))}\n\n`; }
  publishAll() { for (const [steamId, responses] of this.subscribers) for (const response of responses) response.write(this.eventFor(steamId)); }
}
