import { Minus, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/old_button";
import { AuthGate } from "@/features/auth/AuthGate";
import { request } from "@/services/api";
import { postNativeMessage } from "@/services/native-bridge";
import bgImage from "../../assets/images/bg.jpg";

type ServerInfo = { address: string; serverIp: string; serverPort: number };
type LauncherPosition = { x: number; y: number };

export function Launcher() {
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [message, setMessage] = useState("Resolving server address…");
  const [launching, setLaunching] = useState(false);
  const [position, setPosition] = useState<LauncherPosition>({ x: 0, y: 0 });
  const launcherRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; position: LauncherPosition; rect: DOMRect } | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    let alive = true;
    request<ServerInfo>("/api/game/server")
      .then((result) => { if (alive) { setServer(result); setMessage("Server ready"); } })
      .catch(() => { if (alive) setMessage("Server address unavailable. Check the launcher configuration."); });
    return () => { alive = false; };
  }, []);

  useLayoutEffect(() => {
    if (!launcherRef.current) return;
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const clampToViewport = () => {
      const rect = launcherRef.current?.getBoundingClientRect();
      if (!rect) return;
      const current = positionRef.current;
      const baseRect = { left: rect.left - current.x, right: rect.right - current.x, top: rect.top - current.y, bottom: rect.bottom - current.y };
      const next = {
        x: Math.min(window.innerWidth - baseRect.right, Math.max(-baseRect.left, current.x)),
        y: Math.min(window.innerHeight - baseRect.bottom, Math.max(-baseRect.top, current.y)),
      };
      positionRef.current = next;
      setPosition(next);
    };
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, []);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    const rect = launcherRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, position, rect };
  }

  function drag(event: ReactPointerEvent<HTMLElement>) {
    const start = dragRef.current;
    if (!start) return;
    const next = {
      x: start.position.x + Math.min(window.innerWidth - start.rect.right, Math.max(-start.rect.left, event.clientX - start.pointerX)),
      y: start.position.y + Math.min(window.innerHeight - start.rect.bottom, Math.max(-start.rect.top, event.clientY - start.pointerY)),
    };
    positionRef.current = next;
    setPosition(next);
  }

  function stopDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  function launch() {
    if (!server) return;
    setLaunching(true);
    postNativeMessage({ type: "app.launchGame", serverAddress: server.address });
    if (!window.chrome?.webview) window.open(`steam://run/376210//+connect%20${encodeURIComponent(server.address)}`, "_self");
  }

  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <section
        ref={launcherRef}
        className="hud-panel relative w-full max-w-[800px] border border-stone shadow-hud"
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div className="flex">
          <div className="relative w-[400px] shrink-0">
            <img src={bgImage} alt="" className="h-full w-[400px] object-cover" />
          </div>
          <div className="w-full">
            <header
              className="flex cursor-grab touch-none select-none items-center justify-between border-b border-stone/50 px-5 py-4 active:cursor-grabbing"
              aria-label="Kéo trình khởi động"
            >
              <div>
                <p className="eyebrow">THE ISLE</p>
                <h1 className="mt-2 text-2xl tracking-[0.12em] text-bone">TPN Dino</h1>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="icon" aria-label="Thu nhỏ trình khởi động" onPointerDown={(event) => event.stopPropagation()} onClick={() => postNativeMessage({ type: "app.minimize" })}>
                  <Minus className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Đóng trình khởi động" onPointerDown={(event) => event.stopPropagation()} onClick={() => postNativeMessage({ type: "app.exit" })}>
                  <X className="size-4" />
                </Button>
              </div>
            </header>
            <AuthGate embedded>
              <div className="p-8 flex flex-col gap-4 justify-between h-[calc(100%-81px)]">
                <div>
                  <p className="text-sm leading-6 text-ash">Tính năng: Minimap, HUD, Quests, Chiếm đóng.</p>
                </div>
                <div>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.12em] text-ash">{message}</p>
                  <button
                    type="button"
                    className="mt-8 w-full border border-amber bg-charcoal px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber transition hover:bg-control-hover disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!server || launching}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={launch}
                  >
                    {launching ? "Đang khởi động..." : "Vào game"}
                  </button>
                </div>
              </div>
            </AuthGate>
          </div>
        </div>
      </section>
    </div>
  );
}
