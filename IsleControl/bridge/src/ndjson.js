export function completeNdjsonChunk(buffer) {
  const lastNewline = buffer.lastIndexOf(0x0a);

  if (lastNewline < 0) {
    return { bytesConsumed: 0, lines: [] };
  }

  const bytesConsumed = lastNewline + 1;
  const text = buffer.subarray(0, bytesConsumed).toString("utf8");

  return {
    bytesConsumed,
    lines: text.split(/\r?\n/).filter((line) => line.trim())
  };
}
