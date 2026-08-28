/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getRefreshToken, sharedRefresh, storeSession, type AuthResult, type Player } from "@/services/auth";
import { rawRequest } from "@/services/api";
import { openLogin } from "@/services/native-bridge";


type State = "restoring" | "signedOut" | "starting" | "waiting" | "authenticated" | "error";
type Start = { deviceCode: string; browserCode: string; expiresIn: number; pollInterval: number };

export function AuthGate({ children, embedded = false }: { children: React.ReactNode; embedded?: boolean }) {
  const [state, setState] = useState<State>("restoring");
  const [_, setPlayer] = useState<Player | null>(null);
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

  if (state === "authenticated") {
    return (
      <>
        {children}
      </>
    )
  }
  return (
    <div className={embedded ? "grid place-items-center p-8" : "absolute inset-0 z-[1000] grid place-items-center"}>
      <section className="hud-panel relative w-full max-w-80 border border-stone p-6 text-center shadow-hud">
        <p className="eyebrow">Tài khoản Steam</p>
        <h1 className="my-3 text-xl text-bone">{state === "waiting" ? "Hoàn tất đăng nhập trong trình duyệt" : "Kết nối HUD"}</h1>
        {message && <p className="mb-3 text-xs text-rust">{message}</p>}
        {state === "restoring" && (
          <p className="text-xs text-ash">Đang khôi phục phiên đăng nhập…</p>
        )}
        {state === "waiting" ? (
          <button className="text-xs text-ash underline" onClick={cancel}>Hủy</button>
        ) : state !== "restoring" && <button className="border border-stone px-4 py-2 text-xs text-bone" disabled={state === "starting"} onClick={login}>{state === "starting" ? "Đang bắt đầu…" : "Đăng nhập với Steam"}</button>}
      </section>
    </div>
  )
}
