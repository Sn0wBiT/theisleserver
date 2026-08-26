import { CircleAlert, RefreshCw, RotateCcw, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/old_button";
import { QuestTabs } from "@/features/quests/components/QuestTabs";
import { useQuests } from "@/features/quests/hooks/useQuests";
import { closeInteractiveMode } from "@/services/native-bridge";
import { clampPanelPosition, loadPanelPosition, savePanelPosition, type PanelPosition } from "@/features/quests/panel-position";

export function QuestPanel() {
  const quests = useQuests();
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number; rect: DOMRect } | null>(null);
  const [position, setPosition] = useState<PanelPosition>({ x: 0, y: 0 });
  const positionRef = useRef(position);
  positionRef.current = position;

  useLayoutEffect(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(clampPanelPosition(loadPanelPosition(), rect));
  }, []);

  useEffect(() => {
    const clampToViewport = () => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      const current = positionRef.current;
      const baseRect = { left: rect.left - current.x, right: rect.right - current.x, top: rect.top - current.y, bottom: rect.bottom - current.y };
      const clamped = clampPanelPosition(current, baseRect);
      positionRef.current = clamped;
      setPosition(clamped);
      savePanelPosition(clamped);
    };
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, []);

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
    positionRef.current = next;
    setPosition(next);
  }

  function stopDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    savePanelPosition(positionRef.current);
  }

  function resetPosition() {
    const next = { x: 0, y: 0 };
    setPosition(next);
    savePanelPosition(next);
  }

  return (
    <section
      ref={panelRef}
      aria-label="Danh sách nhiệm vụ"
      className="hud-panel pointer-events-auto relative flex w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden border border-stone shadow-hud-heavy"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <header
        className="flex cursor-grab touch-none select-none items-center justify-between border-b border-stone/50 px-4 py-3 active:cursor-grabbing"
        aria-label="Kéo bảng nhiệm vụ"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-lichen"></p>
          <h1 className="font-display text-xl font-medium uppercase leading-none tracking-[0.1em] text-bone">Nhiệm vụ</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block text-[9px] uppercase tracking-widest text-ash">Số dư</span>
            <strong className="font-mono text-sm text-amber">{quests.data?.tokenBalance.toLocaleString("vi-VN") ?? "—"}</strong>
          </div>
          <Button className="cursor-pointer" aria-label="Đặt lại vị trí bảng nhiệm vụ" size="icon" variant="ghost" onPointerDown={(event) => event.stopPropagation()} onClick={resetPosition}>
            <RotateCcw className="size-4" />
          </Button>
          <Button
            className="cursor-pointer"
            aria-label="Đóng bảng nhiệm vụ"
            size="icon"
            variant="ghost"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={closeInteractiveMode}
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {quests.isLoading && <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-ash"><RefreshCw className="size-4 animate-spin" /> Đang tải nhiệm vụ…</div>}
      {quests.isError && (
        <div className="m-5 flex min-h-52 flex-col items-center justify-center border border-rust/40 bg-rust/10 p-7 text-center">
          <CircleAlert className="mb-3 size-6 text-rust" />
          <p className="text-sm text-bone">{quests.error instanceof Error ? quests.error.message : "Dữ liệu nhiệm vụ hiện không khả dụng"}</p>
          <Button className="mt-5" variant="ghost" onClick={() => void quests.refetch()}>Thử kết nối lại</Button>
        </div>
      )}
      {quests.data && <QuestTabs quests={quests.data.quests} />}
      <footer className="flex items-center justify-between border-t border-stone/40 px-4 py-2 text-[9px] uppercase tracking-widest text-ash">
        <span>{quests.isFetching ? "Đang đồng bộ" : "Theo dõi trực tiếp"}</span><span>F6 / Esc để đóng</span>
      </footer>
    </section>
  );
}
