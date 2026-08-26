const SQRT3 = Math.sqrt(3);

export function worldToHex(point, size) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y) || !Number.isFinite(size) || size <= 0) {
    throw new Error("invalid-hex-position");
  }
  const q = (SQRT3 / 3 * point.x - 1 / 3 * point.y) / size;
  const r = (2 / 3 * point.y) / size;
  return roundAxial(q, r);
}

function roundAxial(q, r) {
  let x = q;
  let z = r;
  let y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

export function hexCenter(hex, size) {
  return { x: size * SQRT3 * (hex.q + hex.r / 2), y: size * 1.5 * hex.r };
}

export function hexPolygon(hex, size) {
  const center = hexCenter(hex, size);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 180 * (30 + 60 * index);
    return { x: center.x + size * Math.cos(angle), y: center.y + size * Math.sin(angle) };
  });
}

export function generateHexZones(bounds, size, revision = "default") {
  if (!bounds || !Number.isFinite(size) || size <= 0 || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
    throw new Error("invalid-hex-grid");
  }
  const min = worldToHex({ x: bounds.minX, y: bounds.minY }, size);
  const max = worldToHex({ x: bounds.maxX, y: bounds.maxY }, size);
  const zones = [];
  for (let r = min.r - 1; r <= max.r + 1; r += 1) {
    for (let q = min.q - 1; q <= max.q + 1; q += 1) {
      const center = hexCenter({ q, r }, size);
      if (center.x < bounds.minX - size || center.x > bounds.maxX + size || center.y < bounds.minY - size || center.y > bounds.maxY + size) continue;
      zones.push({ zoneId: `${revision}:${q}:${r}`, hexQ: q, hexR: r, polygon: hexPolygon({ q, r }, size), terrainType: null, landmarks: [] });
    }
  }
  return zones;
}

export function calculateInfluence(points, memberCount = 1) {
  const value = Number(points);
  const members = Math.max(1, Number(memberCount) || 1);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(1, Math.floor(value / Math.sqrt(members)));
}
