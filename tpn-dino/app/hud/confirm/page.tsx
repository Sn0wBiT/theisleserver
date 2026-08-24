import { approveAttempt, browserBindingCookie, getAttempt, getPlayer, readBrowserBinding } from "@/lib/hud-auth";
import { getSession } from "@/lib/auth";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ConfirmHud({ searchParams }: { searchParams: Promise<{ approved?: string; error?: string }> }) {
  const params = await searchParams;
  const code = readBrowserBinding((await cookies()).get(browserBindingCookie)?.value);
  const attempt = code ? await getAttempt(code) : null;
  if (!code || !attempt || params.error) return <main className="error-shell"><h1>Invalid or expired HUD link</h1></main>;
  const session = await getSession();
  if (!session) redirect(`/auth/steam?returnTo=${encodeURIComponent("/hud/confirm")}`);
  if (params.approved === "1" || attempt.status === "approved" || attempt.status === "consumed") {
    return <main className="login-shell"><section className="login-card"><p className="eyebrow">HUD connected</p><h1>You can return to the game.</h1><p className="lede">This browser window may now be closed.</p></section></main>;
  }
  if (attempt.status !== "pending") return <main className="error-shell"><h1>This HUD request is {attempt.status}.</h1></main>;
  const player = await getPlayer(session.steamId);
  async function approve() {
    "use server";
    const current = await getSession();
    const boundCode = readBrowserBinding((await cookies()).get(browserBindingCookie)?.value);
    if (!current || !boundCode || !await approveAttempt(boundCode, current.steamId)) redirect("/hud/confirm?error=invalid");
    redirect("/hud/confirm?approved=1");
  }
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Connect game HUD</p><h1>{player.displayName}</h1><p className="lede">Allow this HUD installation to access your public profile and quest progress?</p><form action={approve}><button className="steam-button" type="submit">Connect HUD</button></form><Link className="text-link" href="/">Cancel</Link></section></main>;
}
