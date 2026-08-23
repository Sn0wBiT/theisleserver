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

export function formatQuestMessage(quests, tokenBalance) {
  const entries = quests.map((quest) => {
    const period = String(quest.period || "quest");
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    const id = quest.id ? ` [${quest.id}]` : "";
    return `${periodLabel}: ${quest.name}${id} ${progressText(quest)}${statusText(quest)}`;
  });

  if (entries.length === 0) entries.push("Không có nhiệm vụ nào hiện đang khả dụng");
  entries.push(`Tokens: ${Math.max(0, finiteNumber(tokenBalance))}`);

  return `Nhiệm vụ | ${entries.join(" | ")}`;
}
