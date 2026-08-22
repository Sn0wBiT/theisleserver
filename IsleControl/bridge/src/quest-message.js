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
      return `${compactNumber(progress / 3600)}/${compactNumber(target / 3600)} hr`;
    }
    return `${Math.floor(progress / 60)}/${compactNumber(target / 60)} min`;
  }

  if (quest.type === "reach_growth") {
    return `${Math.floor(progress * 100)}/${Math.floor(target * 100)}%`;
  }

  return `${compactNumber(progress)}/${compactNumber(target)}`;
}

function statusText(quest) {
  if (quest.claimed) return " (claimed)";
  if (quest.completed) return " (complete)";
  return "";
}

export function formatQuestMessage(quests, tokenBalance) {
  const entries = quests.map((quest) => {
    const period = String(quest.period || "quest");
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    return `${periodLabel}: ${quest.name} ${progressText(quest)}${statusText(quest)}`;
  });

  if (entries.length === 0) entries.push("No quests are currently available");
  entries.push(`Tokens: ${Math.max(0, finiteNumber(tokenBalance))}`);

  return `Quests | ${entries.join(" | ")}`;
}
