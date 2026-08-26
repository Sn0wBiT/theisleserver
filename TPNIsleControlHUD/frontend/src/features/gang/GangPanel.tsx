import { CircleAlert, Copy, RefreshCw, Shield, Users, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/old_button";
import { closeInteractiveMode } from "@/services/native-bridge";
import { createFaction, getMyFaction, rotateFactionInvite, type Faction } from "@/services/territory-api";

export function GangPanel() {
  const [faction, setFaction] = useState<Faction | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    getMyFaction()
      .then(({ faction: currentFaction }) => { if (active) setFaction(currentFaction); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải thông tin bang"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await createFaction(name.trim(), color);
      setFaction(result.faction);
      setInviteCode(result.faction.inviteCode);
      setName("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo bang");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRotateInvite() {
    if (!faction) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await rotateFactionInvite(faction.id);
      setInviteCode(result.inviteCode);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo mã mời");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInviteCode() {
    if (!inviteCode) return;
    await navigator.clipboard?.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="hud-panel pointer-events-auto relative flex w-[min(440px,calc(100vw-32px))] flex-col overflow-hidden border border-stone shadow-hud-heavy" aria-label="Thông tin bang">
      <header className="flex items-center justify-between border-b border-stone/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center border border-stone/60 bg-soil"><Users className="size-4 text-amber" /></div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-lichen">Hệ thống phe phái</p>
            <h1 className="font-display text-xl font-medium uppercase leading-none tracking-[0.1em] text-bone">Bang hội</h1>
          </div>
        </div>
        <Button className="cursor-pointer" aria-label="Đóng bảng bang hội" size="icon" variant="ghost" onClick={closeInteractiveMode}><X className="size-4" /></Button>
      </header>

      {loading && <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-ash"><RefreshCw className="size-4 animate-spin" /> Đang tải thông tin bang…</div>}
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
          <div className="border border-stone/40 bg-charcoal/50 p-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-[9px] uppercase tracking-widest text-ash">Mã mời</span><span className="text-[9px] uppercase tracking-widest text-amber">Chia sẻ với đồng đội</span></div>
            {inviteCode ? (
              <div className="flex items-center gap-2">
                <code className="select-text min-w-0 flex-1 border border-stone/60 bg-black/20 px-3 py-2 font-mono text-base tracking-[0.18em] text-bone">{inviteCode}</code>
                <Button className="cursor-pointer" size="icon" variant="ghost" onClick={() => void copyInviteCode()} aria-label="Sao chép mã mời" title={copied ? "Đã sao chép" : "Sao chép mã mời"}><Copy className="size-3.5" /></Button>
              </div>
            ) : <p className="text-xs text-ash">Mã mời chỉ hiển thị sau khi tạo hoặc làm mới.</p>}
            {faction.role === "leader" && <Button className="mt-3 w-full cursor-pointer" variant="ghost" onClick={() => void handleRotateInvite()} disabled={submitting}><RefreshCw className="size-3.5" /> Tạo mã mời mới</Button>}
          </div>
        </div>
      )}

      {!loading && !faction && (
        <form className="space-y-4 p-5" onSubmit={(event) => void handleCreate(event)}>
          <div><p className="font-display text-lg uppercase tracking-[0.08em] text-bone">Tạo bang mới</p><p className="mt-1 text-xs leading-relaxed text-ash">Tập hợp đồng đội và cùng nhau tranh giành lãnh thổ.</p></div>
          <label className="block text-[9px] uppercase tracking-widest text-ash">Tên bang<input className="mt-2 block h-9 w-full select-text border border-stone/60 bg-charcoal/70 px-3 text-sm text-bone outline-none focus:border-amber" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={64} required placeholder="Ví dụ: Raptor Pack" /></label>
          <label className="flex items-center justify-between text-[9px] uppercase tracking-widest text-ash">Màu bang<input className="size-9 cursor-pointer border-0 bg-transparent" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
          <Button className="w-full cursor-pointer" type="submit" disabled={submitting}>{submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Users className="size-3.5" />} {submitting ? "Đang tạo…" : "Tạo bang"}</Button>
        </form>
      )}
      <footer className="border-t border-stone/40 px-4 py-2 text-[9px] uppercase tracking-widest text-ash">{faction ? "Bang của bạn" : "Bạn chưa thuộc bang nào"}<span className="float-right">Esc để đóng</span></footer>
    </section>
  );
}
