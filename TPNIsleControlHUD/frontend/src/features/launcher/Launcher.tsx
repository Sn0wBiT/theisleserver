import { useEffect, useState } from "react";
import { apiUrl, request } from "@/services/api";
import { postNativeMessage } from "@/services/native-bridge";

type ServerInfo = { address: string; serverIp: string; serverPort: number };

export function Launcher() {
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [message, setMessage] = useState("Resolving server address…");
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    let alive = true;
    request<ServerInfo>("/api/game/server")
      .then((result) => { if (alive) { setServer(result); setMessage("Server ready"); } })
      .catch(() => { if (alive) setMessage("Server address unavailable. Check the launcher configuration."); });
    return () => { alive = false; };
  }, []);

  function launch() {
    if (!server) return;
    setLaunching(true);
    postNativeMessage({ type: "app.launchGame", serverAddress: server.address });
    if (!window.chrome?.webview) window.open(`steam://run/376210//+connect%20${encodeURIComponent(server.address)}`, "_self");
  }

  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <section className="hud-panel relative w-full max-w-xl border border-stone p-8 shadow-hud">
        <p className="eyebrow">THE ISLE</p>
        <h1 className="mt-3 text-4xl tracking-[0.12em] text-bone">TPN Dino</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-ash">Tính năng: Minimap, HUD, Quests, Chiếm đóng.</p>
        <div className="mt-8 flex items-center justify-between border-y border-stone/40 py-4 text-xs uppercase tracking-[0.14em]">
          <span className="text-ash">Target server</span>
          <span className={server ? "text-moss" : "text-amber"}>{server?.address ?? "—"}</span>
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.12em] text-ash">{message}</p>
        <button
          type="button"
          className="mt-8 w-full border border-amber bg-charcoal px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber transition hover:bg-control-hover disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!server || launching}
          onClick={launch}
        >
          {launching ? "Đang khởi động..." : "Vào game"}
        </button>
        <p className="mt-4 text-center text-[10px] text-ash">API: {apiUrl}</p>
      </section>
    </div>
  );
}
