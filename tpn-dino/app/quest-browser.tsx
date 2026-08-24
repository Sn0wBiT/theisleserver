"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CurrentDinosaur, Quest } from "@/lib/quests";

type StatusFilter = "all" | "available" | "locked" | "active" | "completed";

function questStatus(quest: Quest) {
  if (quest.claimed) return "Claimed";
  if (quest.completed) return "Complete";
  if (quest.accepted) return "In progress";
  if (!quest.canAccept) return "Locked";
  return "Available";
}

function matchesStatus(quest: Quest, status: StatusFilter) {
  if (status === "available") return !quest.accepted && quest.canAccept;
  if (status === "locked") return !quest.accepted && !quest.canAccept;
  if (status === "active") return quest.accepted && !quest.completed && !quest.claimed;
  if (status === "completed") return quest.completed || quest.claimed;
  return true;
}

function speciesName(species: string | null | undefined) {
  return species?.replace(/^BP_/, "").replace(/_C$/, "").replaceAll("_", " ") || "No live dinosaur";
}

function QuestCard({ quest }: { quest: Quest }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const progress = Math.max(0, Number(quest.progress) || 0);
  const target = Math.max(1, Number(quest.target) || 1);
  const percent = Math.min(100, Math.round((progress / target) * 100));
  const status = questStatus(quest);
  const minimumGrowth = Math.max(0, Number(quest.takeRequirement?.minimumGrowth) || 0);
  const disabled = submitting || quest.accepted || quest.claimed || !quest.canAccept;

  async function takeQuest() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/quests/${encodeURIComponent(quest.id)}/accept`, { method: "POST" });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error || "Could not take quest");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not take quest");
      setSubmitting(false);
    }
  }

  return (
    <article className={`quest-card${!quest.canAccept && !quest.accepted ? " quest-card--locked" : ""}`}>
      <div className="quest-card__top">
        <span className={`period period--${quest.period}`}>{quest.period}</span>
        <span className={`status status--${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>
      </div>
      <h3>{quest.name}</h3><p className="quest-id">{quest.id}</p>
      {!quest.canAccept && !quest.accepted && <p className="quest-requirement">Requires {minimumGrowth * 100}% dinosaur growth</p>}
      <div className="progress-copy"><span>Progress</span><strong>{progress.toLocaleString()} / {target.toLocaleString()}</strong></div>
      <div className="progress-track" aria-label={`${percent}% complete`}><span style={{ width: `${percent}%` }} /></div>
      <div className="reward"><span>Reward</span><strong>+{quest.rewardTokens} tokens</strong></div>
      <button className="take-quest" type="button" disabled={disabled} onClick={takeQuest}>
        {submitting ? "Taking…" : quest.accepted ? "Quest accepted" : !quest.canAccept ? "Growth required" : "Take quest"}
      </button>
      {error && <p className="quest-error" role="alert">{error}</p>}
    </article>
  );
}

export default function QuestBrowser({ quests, dinosaur }: { quests: Quest[]; dinosaur: CurrentDinosaur | null }) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => quests.filter((quest) =>
    (!normalizedQuery || `${quest.name} ${quest.id}`.toLowerCase().includes(normalizedQuery)) &&
    (period === "all" || quest.period === period) && matchesStatus(quest, status)
  ), [quests, normalizedQuery, period, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    const updatePageSize = () => setPageSize(window.innerWidth <= 620 ? 2 : window.innerWidth <= 900 ? 4 : 6);
    updatePageSize();
    window.addEventListener("resize", updatePageSize);
    return () => window.removeEventListener("resize", updatePageSize);
  }, []);

  return <>
    <div className="dinosaur-strip">
      <div><span>Current dinosaur</span><strong>{speciesName(dinosaur?.species)}</strong></div>
      <div><span>Growth</span><strong>{dinosaur?.growth == null ? "Unknown" : `${Math.floor(dinosaur.growth * 100)}%`}</strong></div>
      <p>{dinosaur ? "Quest availability is based on this dinosaur's latest growth snapshot." : "Join the server with a dinosaur to unlock growth-gated quests."}</p>
    </div>
    <div className="quest-tools" role="search">
      <label className="quest-search"><span>Search quests</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name or quest ID" /></label>
      <label><span>Cycle</span><select value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }}><option value="all">All cycles</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }}><option value="all">All statuses</option><option value="available">Available</option><option value="locked">Locked</option><option value="active">In progress</option><option value="completed">Completed</option></select></label>
      <span className="result-count" aria-live="polite">{filtered.length} / {quests.length}</span>
    </div>
    <div className="quest-results">
      {visible.length ? <div className="quest-grid">{visible.map((quest) => <QuestCard key={quest.id} quest={quest} />)}</div> : <div className="empty">No quests match your search and filters.</div>}
    </div>
    <nav className="quest-pagination" aria-label="Quest pages">
      <button type="button" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>← Previous</button>
      <span>Page <strong>{currentPage}</strong> / {pageCount}</span>
      <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))}>Next →</button>
    </nav>
  </>;
}
