import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearSession, getRefreshToken, sharedRefresh, storeSession, type AuthResult, type Player } from "@/services/auth";
import { rawRequest } from "@/services/api";
import { openLogin } from "@/services/native-bridge";

type State = "restoring" | "signedOut" | "starting" | "waiting" | "authenticated" | "error";
type Start = { deviceCode: string; browserCode: string; expiresIn: number; pollInterval: number };

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("restoring");
  const [player, setPlayer] = useState<Player | null>(null);
  const [message, setMessage] = useState("");
  const active = useRef<{ cancelled: boolean; deviceCode?: string }>({ cancelled: false });
  const queryClient = useQueryClient();

  useEffect(() => {
    let alive = true;
    if (!getRefreshToken()) { setState("signedOut"); return; }
    sharedRefresh((refreshToken) => rawRequest<AuthResult>("/api/hud-auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }))
      .then((result) => { if (!alive) return; if (result) { setPlayer(result.player); setState("authenticated"); } else setState("signedOut"); });
    return () => { alive = false; };
  }, []);

  async function login() {
    active.current.cancelled = false; setState("starting"); setMessage("");
    try {
      const attempt = await rawRequest<Start>("/api/hud-auth/start", { method: "POST" });
      active.current.deviceCode = attempt.deviceCode;
      openLogin(attempt.browserCode); setState("waiting");
      const deadline = Date.now() + attempt.expiresIn * 1000;
      while (!active.current.cancelled && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, attempt.pollInterval * 1000));
        if (active.current.cancelled) return;
        try {
          const result = await rawRequest<AuthResult & { status: string }>("/api/hud-auth/poll", { method: "POST", body: JSON.stringify({ deviceCode: attempt.deviceCode }) });
          if (result.status === "pending") continue;
          storeSession(result); setPlayer(result.player); setState("authenticated");
          await queryClient.invalidateQueries(); return;
        } catch (error) {
          if ((error as { status?: number }).status === 202) continue;
          throw error;
        }
      }
      if (!active.current.cancelled) { setMessage("The login request expired."); setState("error"); }
    } catch (error) { if (!active.current.cancelled) { setMessage(error instanceof Error ? error.message : "Login failed"); setState("error"); } }
  }

  async function cancel() {
    active.current.cancelled = true;
    const deviceCode = active.current.deviceCode;
    if (deviceCode) await rawRequest("/api/hud-auth/cancel", { method: "POST", body: JSON.stringify({ deviceCode }) }).catch(() => undefined);
    setState("signedOut");
  }
  async function logout() {
    const refreshToken = getRefreshToken(); clearSession(); setPlayer(null); setState("signedOut");
    if (refreshToken) await rawRequest("/api/hud-auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
    await queryClient.clear();
  }

  if (state === "authenticated") return <><div className="absolute right-6 top-20 z-[900] flex items-center gap-2 text-[10px] text-bone">{player?.avatarUrl && <img className="size-6 rounded-full" src={player.avatarUrl} alt="" />}<span>{player?.displayName}</span><button onClick={logout}>Sign out</button></div>{children}</>;
  return <div className="absolute inset-0 z-[1000] grid place-items-center bg-black/40"><section className="hud-panel relative w-80 border border-stone p-6 text-center shadow-hud"><p className="eyebrow">Steam account</p><h1 className="my-3 text-xl text-bone">{state === "waiting" ? "Finish signing in in your browser" : "Connect your HUD"}</h1>{message && <p className="mb-3 text-xs text-rust">{message}</p>}{state === "restoring" && <p className="text-xs text-ash">Restoring your session…</p>}{state === "waiting" ? <button className="text-xs text-ash underline" onClick={cancel}>Cancel</button> : state !== "restoring" && <button className="border border-stone px-4 py-2 text-xs text-bone" disabled={state === "starting"} onClick={login}>{state === "starting" ? "Starting…" : "Sign in with Steam"}</button>}</section></div>;
}
