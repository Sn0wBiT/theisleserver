import { Check, CircleAlert, Clock3, Copy, RefreshCw, Shield, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/old_button";
import { closePanelMode } from "@/services/native-bridge";
import {
  approveFactionJoinRequest,
  cancelFactionJoinRequest,
  createFaction,
  getFactionJoinRequests,
  getMyFaction,
  rejectFactionJoinRequest,
  rotateFactionInvite,
  submitFactionJoinRequest,
  type Faction,
  type FactionJoinRequest,
  type PendingFactionJoinRequest,
} from "@/services/territory-api";

let savedPosition = { x: 0, y: 0 };

export function GangPanel() {
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number; rect: DOMRect } | null>(null);
  const [position, setPosition] = useState(savedPosition);
  const [faction, setFaction] = useState<Faction | null>(null);
  const [joinRequest, setJoinRequest] = useState<FactionJoinRequest | null>(null);
  const [leaderRequests, setLeaderRequests] = useState<PendingFactionJoinRequest[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshingRequests, setRefreshingRequests] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, x: position.x, y: position.y, rect };
  }

  function drag(event: ReactPointerEvent<HTMLElement>) {
    const start = dragRef.current;
    if (!start) return;
    const deltaX = Math.min(window.innerWidth - start.rect.right, Math.max(-start.rect.left, event.clientX - start.pointerX));
    const deltaY = Math.min(window.innerHeight - start.rect.bottom, Math.max(-start.rect.top, event.clientY - start.pointerY));
    const next = { x: start.x + deltaX, y: start.y + deltaY };
    savedPosition = next;
    setPosition(next);
  }

  function stopDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  const refreshMembership = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const result = await getMyFaction();
      setFaction(result.faction);
      setJoinRequest(result.joinRequest);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải thông tin bầy đàn");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  const refreshLeaderRequests = useCallback(async (factionId: string) => {
    setRefreshingRequests(true);
    try {
      const result = await getFactionJoinRequests(factionId);
      setLeaderRequests(result.joinRequests);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải danh sách yêu cầu");
    } finally {
      setRefreshingRequests(false);
    }
  }, []);

  useEffect(() => { void refreshMembership(true); }, [refreshMembership]);
  useEffect(() => {
    if (faction?.role === "leader") void refreshLeaderRequests(faction.id);
    else setLeaderRequests([]);
  }, [faction?.id, faction?.role, refreshLeaderRequests]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createFaction(name.trim(), color);
      setName("");
      setShowCreate(false);
      await refreshMembership();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo bầy đàn");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitFactionJoinRequest(inviteCode.trim().toUpperCase());
      setInviteCode("");
      await refreshMembership();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi yêu cầu tham gia");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelOrDismiss() {
    if (!joinRequest) return;
    setSubmitting(true);
    setError(null);
    try {
      await cancelFactionJoinRequest(joinRequest.id);
      await refreshMembership();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật yêu cầu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRotateInvite() {
    if (!faction) return;
    setSubmitting(true);
    setError(null);
    try {
      await rotateFactionInvite(faction.id);
      await refreshMembership();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo mã mời");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(requestId: string, decision: "approve" | "reject") {
    if (!faction) return;
    setSubmitting(true);
    setError(null);
    try {
      if (decision === "approve") await approveFactionJoinRequest(faction.id, requestId);
      else await rejectFactionJoinRequest(faction.id, requestId);
      await Promise.all([refreshMembership(), refreshLeaderRequests(faction.id)]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInviteCode() {
    if (!faction?.inviteCode) return;
    await navigator.clipboard?.writeText(faction.inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section ref={panelRef} className="hud-panel pointer-events-auto relative flex max-h-[min(760px,calc(100vh-32px))] w-[min(440px,calc(100vw-32px))] flex-col overflow-hidden border border-stone shadow-hud-heavy" style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }} aria-label="Thông tin bầy đàn">
      <header className="flex cursor-grab touch-none select-none items-center justify-between border-b border-stone/50 px-4 py-3 active:cursor-grabbing" aria-label="Kéo bảng bầy đàn" onPointerDown={startDrag} onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center border border-stone/60 bg-soil"><Users className="size-4 text-amber" /></div>
          <h1 className="font-display text-xl font-medium uppercase leading-none tracking-[0.1em] text-bone">Bầy đàn</h1>
        </div>
        <Button className="cursor-pointer" aria-label="Đóng bảng bầy đàn" size="icon" variant="ghost" onPointerDown={(event) => event.stopPropagation()} onClick={() => closePanelMode("gang")}><X className="size-4" /></Button>
      </header>

      <div className="overflow-y-auto">
        {loading && <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-ash"><RefreshCw className="size-4 animate-spin" /> Đang tải thông tin bầy đàn…</div>}
        {error && <div className="m-4 flex items-center gap-2 border border-rust/40 bg-rust/10 p-3 text-sm text-bone"><CircleAlert className="size-4 shrink-0 text-rust" />{error}</div>}

        {!loading && faction && (
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3 border border-stone/50 bg-soil/70 p-4">
              <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: faction.color, boxShadow: `0 0 12px ${faction.color}` }} />
              <div className="min-w-0">
                <p className="truncate font-display text-lg uppercase tracking-[0.08em] text-bone">{faction.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ash"><Shield className="size-3 text-amber" /> {faction.role === "leader" ? "Thủ lĩnh" : "Thành viên"}</p>
              </div>
            </div>

            {faction.role === "leader" && (
              <>
                <div className="border border-stone/40 bg-charcoal/50 p-4">
                  <div className="mb-2 flex items-center justify-between"><span className="text-[9px] uppercase tracking-widest text-ash">Mã mời hiện tại</span><span className="text-[9px] uppercase tracking-widest text-amber">Chia sẻ với đồng đàn</span></div>
                  <div className="flex items-center gap-2">
                    <code className="select-text min-w-0 flex-1 border border-stone/60 bg-black/20 px-3 py-2 font-mono text-base tracking-[0.18em] text-bone">{faction.inviteCode}</code>
                    <Button className="cursor-pointer" size="icon" variant="ghost" onClick={() => void copyInviteCode()} aria-label="Sao chép mã mời" title={copied ? "Đã sao chép" : "Sao chép mã mời"}><Copy className="size-3.5" /></Button>
                  </div>
                  <Button className="mt-3 w-full cursor-pointer" variant="ghost" onClick={() => void handleRotateInvite()} disabled={submitting}><RefreshCw className="size-3.5" /> Tạo mã mời mới</Button>
                </div>

                <div className="border border-stone/40 bg-charcoal/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div><p className="text-[9px] uppercase tracking-widest text-ash">Yêu cầu tham gia</p><p className="mt-1 text-xs text-bone">{leaderRequests.length} yêu cầu đang chờ</p></div>
                    <Button size="icon" variant="ghost" disabled={refreshingRequests || submitting} onClick={() => void refreshLeaderRequests(faction.id)} aria-label="Làm mới yêu cầu"><RefreshCw className={`size-3.5 ${refreshingRequests ? "animate-spin" : ""}`} /></Button>
                  </div>
                  <div className="space-y-2">
                    {!refreshingRequests && leaderRequests.length === 0 && <p className="py-3 text-center text-xs text-ash">Chưa có yêu cầu mới.</p>}
                    {leaderRequests.map((request) => (
                      <div className="border border-stone/50 bg-soil/60 p-3" key={request.id}>
                        <p className="truncate text-sm text-bone">{request.displayName}</p>
                        <p className="mt-1 font-mono text-[10px] text-ash">{request.steamId}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button disabled={submitting} onClick={() => void handleDecision(request.id, "approve")}><Check className="size-3.5" /> Duyệt</Button>
                          <Button variant="ghost" disabled={submitting} onClick={() => void handleDecision(request.id, "reject")}><X className="size-3.5" /> Từ chối</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && !faction && joinRequest && (
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3 border border-stone/50 bg-soil/70 p-4">
              <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: joinRequest.faction.color }} />
              <div className="min-w-0">
                <p className="truncate font-display text-lg uppercase tracking-[0.08em] text-bone">{joinRequest.faction.name}</p>
                <p className={`mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest ${joinRequest.status === "rejected" ? "text-rust" : "text-amber"}`}><Clock3 className="size-3" /> {joinRequest.status === "pending" ? "Đang chờ thủ lĩnh duyệt" : "Yêu cầu đã bị từ chối"}</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-ash">{joinRequest.status === "pending" ? "Yêu cầu không hết hạn. Bạn có thể hủy hoặc làm mới trạng thái thủ công." : "Hãy đóng thông báo này trước khi gửi yêu cầu đến bầy đàn khác."}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" disabled={submitting} onClick={() => void handleCancelOrDismiss()}>{joinRequest.status === "pending" ? "Hủy yêu cầu" : "Đóng thông báo"}</Button>
              <Button variant="ghost" disabled={submitting} onClick={() => void refreshMembership()}><RefreshCw className="size-3.5" /> Làm mới</Button>
            </div>
          </div>
        )}

        {!loading && !faction && !joinRequest && !showCreate && (
          <form className="space-y-4 p-5" onSubmit={(event) => void handleJoin(event)}>
            <div><p className="font-display text-lg uppercase tracking-[0.08em] text-bone">Tham gia bầy đàn</p><p className="mt-1 text-xs leading-relaxed text-ash">Nhập mã mời và gửi yêu cầu đến thủ lĩnh.</p></div>
            <label className="block text-[9px] uppercase tracking-widest text-ash">Mã mời<input className="mt-2 block h-9 w-full select-text border border-stone/60 bg-charcoal/70 px-3 font-mono text-sm uppercase tracking-[0.14em] text-bone outline-none focus:border-amber" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} maxLength={32} required autoComplete="off" placeholder="NHẬP MÃ MỜI" /></label>
            <Button className="w-full cursor-pointer" type="submit" disabled={submitting}>{submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} {submitting ? "Đang gửi…" : "Gửi yêu cầu"}</Button>
            <button className="w-full text-[10px] uppercase tracking-widest text-ash underline-offset-4 hover:text-bone hover:underline" type="button" onClick={() => setShowCreate(true)}>Tạo bầy đàn mới</button>
          </form>
        )}

        {!loading && !faction && !joinRequest && showCreate && (
          <form className="space-y-4 p-5" onSubmit={(event) => void handleCreate(event)}>
            <div><p className="font-display text-lg uppercase tracking-[0.08em] text-bone">Tạo bầy đàn mới</p><p className="mt-1 text-xs leading-relaxed text-ash">Tập hợp đồng đội và cùng nhau tranh giành lãnh thổ.</p></div>
            <label className="block text-[9px] uppercase tracking-widest text-ash">Tên bầy đàn<input className="mt-2 block h-9 w-full select-text border border-stone/60 bg-charcoal/70 px-3 text-sm text-bone outline-none focus:border-amber" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={64} required placeholder="Ví dụ: Raptor Pack" /></label>
            <label className="flex items-center justify-between text-[9px] uppercase tracking-widest text-ash">Màu bầy đàn<input className="size-9 cursor-pointer border-0 bg-transparent" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
            <Button className="w-full cursor-pointer" type="submit" disabled={submitting}>{submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Users className="size-3.5" />} {submitting ? "Đang tạo…" : "Tạo bầy đàn"}</Button>
            <button className="w-full text-[10px] uppercase tracking-widest text-ash underline-offset-4 hover:text-bone hover:underline" type="button" onClick={() => setShowCreate(false)}>Quay lại nhập mã mời</button>
          </form>
        )}
      </div>

      <footer className="border-t border-stone/40 px-4 py-2 text-[9px] uppercase tracking-widest text-ash">{faction ? "Bầy đàn của bạn" : joinRequest ? "Yêu cầu tham gia" : "Bạn chưa thuộc bầy đàn nào"}<span className="float-right">Esc để đóng</span></footer>
    </section>
  );
}
