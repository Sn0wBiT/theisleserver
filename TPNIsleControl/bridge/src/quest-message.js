function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function compactNumber(value, digits = 1) {
  const rounded = Number(value.toFixed(digits));
  return String(rounded);
}

function progressText(quest) {
  const target = Math.max(0, finiteNumber(quest.target));
  const progress = Math.max(0, Math.min(finiteNumber(quest.progress), target));

  if (quest.type === "play_seconds") {
    if (target >= 3600) {
      return `${compactNumber(progress / 3600)}/${compactNumber(target / 3600)} giờ`;
    }
    return `${Math.floor(progress / 60)}/${compactNumber(target / 60)} phút`;
  }

  if (quest.type === "reach_growth") {
    return `${Math.floor(progress * 100)}/${Math.floor(target * 100)}%`;
  }

  return `${compactNumber(progress)}/${compactNumber(target)}`;
}

function statusText(quest) {
  if (quest.accepted === false) return ` (chưa nhận: /accept ${quest.id})`;
  if (quest.claimed) return " (đã nhận)";
  if (quest.completed) return " (đã hoàn thành)";
  return "";
}

function questEntries(quests, tokenBalance) {
  const entries = quests.map((quest) => {
    const period = String(quest.period || "quest");
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    const id = quest.id ? ` [${quest.id}]` : "";
    return `${periodLabel}: ${quest.name}${id} ${progressText(quest)}${statusText(quest)}`;
  });

  if (entries.length === 0) entries.push("Không có nhiệm vụ nào hiện đang khả dụng");
  entries.push(`Tokens: ${Math.max(0, finiteNumber(tokenBalance))}`);

  return entries;
}

export function formatQuestMessage(quests, tokenBalance) {
  return `Nhiệm vụ | ${questEntries(quests, tokenBalance).join(" | ")}`;
}

// ClientShowNotification has a small display buffer. Split only at quest
// boundaries so no quest ID or acceptance instruction is cut in half.
export function formatQuestMessages(quests, tokenBalance, maxLength = 300) {
  const entries = questEntries(quests, tokenBalance);
  const chunks = [];
  let chunk = [];

  for (const entry of entries) {
    const candidate = [...chunk, entry].join(" | ");
    if (chunk.length > 0 && `Nhiệm vụ | ${candidate}`.length > maxLength) {
      chunks.push(chunk);
      chunk = [entry];
    } else {
      chunk.push(entry);
    }
  }
  if (chunk.length > 0) chunks.push(chunk);

  return chunks.map((items, index) =>
    `Nhiệm vụ (${index + 1}/${chunks.length}) | ${items.join(" | ")}`);
}
