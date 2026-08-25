"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CurrentDinosaur, Quest } from "@/lib/quests";

type StatusFilter = "all" | "available" | "locked" | "active" | "completed";
type QuestStatus = Exclude<StatusFilter, "all" | "active" | "completed"> | "claimed" | "complete" | "in-progress";

const statusLabels: Record<QuestStatus, string> = {
  claimed: "Đã nhận thưởng", complete: "Hoàn thành", "in-progress": "Đang thực hiện", locked: "Chưa đủ điều kiện", available: "Có thể nhận",
};
const periodLabels: Record<string, string> = { daily: "Hằng ngày", weekly: "Hằng tuần", monthly: "Hằng tháng" };

function questStatus(quest: Quest): QuestStatus {
  if (quest.claimed) return "claimed";
  if (quest.completed) return "complete";
  if (quest.accepted) return "in-progress";
  if (!quest.canAccept) return "locked";
  return "available";
}

function matchesStatus(quest: Quest, status: StatusFilter) {
  if (status === "available") return !quest.accepted && quest.canAccept;
  if (status === "locked") return !quest.accepted && !quest.canAccept;
  if (status === "active") return quest.accepted && !quest.completed && !quest.claimed;
  if (status === "completed") return quest.completed || quest.claimed;
  return true;
}

function speciesName(species: string | null | undefined) {
  return species?.replace(/^BP_/, "").replace(/_C$/, "").replaceAll("_", " ") || "Chưa có khủng long trực tuyến";
}

function questErrorMessage(code?: string) {
  const messages: Record<string, string> = {
    "quest-not-found": "Nhiệm vụ này không còn khả dụng.",
    "already-accepted": "Bạn đã nhận nhiệm vụ này.",
    "growth-requirement-not-met": "Mức tăng trưởng hiện tại chưa đủ để nhận nhiệm vụ này.",
    unauthorized: "Phiên đăng nhập đã hết hạn.",
  };
  return (code && messages[code]) ?? "Không thể nhận nhiệm vụ.";
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
      if (!result.ok) throw new Error(questErrorMessage(result.error));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể nhận nhiệm vụ.");
      setSubmitting(false);
    }
  }

  return (
    <article className={`quest-card${!quest.canAccept && !quest.accepted ? " quest-card--locked" : ""}`}>
      <div className="quest-card__top">
        <span className={`period period--${quest.period}`}>{periodLabels[quest.period] ?? quest.period}</span>
        <span className={`status status--${status}`}>{statusLabels[status]}</span>
      </div>
      <h3>{quest.name}</h3><p className="quest-id">{quest.id}</p>
      {!quest.canAccept && !quest.accepted && <p className="quest-requirement">Yêu cầu khủng long đạt {minimumGrowth * 100}% tăng trưởng</p>}
      <div className="progress-copy"><span>Tiến độ</span><strong>{progress.toLocaleString("vi-VN")} / {target.toLocaleString("vi-VN")}</strong></div>
      <div className="progress-track" aria-label={`${percent}% hoàn thành`}><span style={{ width: `${percent}%` }} /></div>
      <div className="reward"><span>Phần thưởng</span><strong>+{quest.rewardTokens.toLocaleString("vi-VN")} token</strong></div>
      <button className="take-quest" type="button" disabled={disabled} onClick={takeQuest}>
        {submitting ? "Đang nhận…" : quest.accepted ? "Đã nhận nhiệm vụ" : !quest.canAccept ? "Chưa đủ tăng trưởng" : "Nhận nhiệm vụ"}
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
      <div><span>Khủng long hiện tại</span><strong>{speciesName(dinosaur?.species)}</strong></div>
      <div><span>Tăng trưởng</span><strong>{dinosaur?.growth == null ? "Không xác định" : `${Math.floor(dinosaur.growth * 100)}%`}</strong></div>
      <p>{dinosaur ? "Khả năng nhận nhiệm vụ dựa trên dữ liệu tăng trưởng mới nhất của khủng long này." : "Vào máy chủ bằng một khủng long để mở các nhiệm vụ yêu cầu tăng trưởng."}</p>
    </div>
    <div className="quest-tools" role="search">
      <label className="quest-search"><span>Tìm nhiệm vụ</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên hoặc mã nhiệm vụ" /></label>
      <label><span>Chu kỳ</span><select value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }}><option value="all">Tất cả chu kỳ</option><option value="daily">Hằng ngày</option><option value="weekly">Hằng tuần</option><option value="monthly">Hằng tháng</option></select></label>
      <label><span>Trạng thái</span><select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }}><option value="all">Tất cả trạng thái</option><option value="available">Có thể nhận</option><option value="locked">Chưa đủ điều kiện</option><option value="active">Đang thực hiện</option><option value="completed">Đã hoàn thành</option></select></label>
      <span className="result-count" aria-live="polite">{filtered.length} / {quests.length}</span>
    </div>
    <div className="quest-results">
      {visible.length ? <div className="quest-grid">{visible.map((quest) => <QuestCard key={quest.id} quest={quest} />)}</div> : <div className="empty">Không có nhiệm vụ phù hợp với nội dung tìm kiếm và bộ lọc.</div>}
    </div>
    <nav className="quest-pagination" aria-label="Các trang nhiệm vụ">
      <button type="button" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>← Trước</button>
      <span>Trang <strong>{currentPage}</strong> / {pageCount}</span>
      <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))}>Sau →</button>
    </nav>
  </>;
}
