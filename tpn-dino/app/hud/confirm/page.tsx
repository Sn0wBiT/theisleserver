import { approveAttempt, browserBindingCookie, getAttempt, getPlayer, readBrowserBinding } from "@/lib/hud-auth";
import { getSession } from "@/lib/auth";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ConfirmHud({ searchParams }: { searchParams: Promise<{ approved?: string; error?: string }> }) {
  const params = await searchParams;
  const code = readBrowserBinding((await cookies()).get(browserBindingCookie)?.value);
  const attempt = code ? await getAttempt(code) : null;
  if (!code || !attempt || params.error) return <main className="error-shell"><h1>Liên kết HUD không hợp lệ hoặc đã hết hạn</h1></main>;
  const session = await getSession();
  if (!session) redirect(`/auth/steam?returnTo=${encodeURIComponent("/hud/confirm")}`);
  if (params.approved === "1" || attempt.status === "approved" || attempt.status === "consumed") {
    return <main className="login-shell"><section className="login-card"><p className="eyebrow">Đã kết nối HUD</p><h1>Bạn có thể quay lại trò chơi.</h1><p className="lede">Bạn có thể đóng cửa sổ trình duyệt này.</p></section></main>;
  }
  if (attempt.status !== "pending") {
    const statusLabels: Record<string, string> = { cancelled: "đã bị hủy", expired: "đã hết hạn", consumed: "đã được sử dụng" };
    const status = statusLabels[String(attempt.status)] ?? "không còn hợp lệ";
    return <main className="error-shell"><h1>Yêu cầu kết nối HUD {status}.</h1></main>;
  }
  const player = await getPlayer(session.steamId);
  async function approve() {
    "use server";
    const current = await getSession();
    const boundCode = readBrowserBinding((await cookies()).get(browserBindingCookie)?.value);
    if (!current || !boundCode || !await approveAttempt(boundCode, current.steamId)) redirect("/hud/confirm?error=invalid");
    redirect("/hud/confirm?approved=1");
  }
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Kết nối HUD trò chơi</p><h1>{player.displayName}</h1><p className="lede">Cho phép bản cài đặt HUD này truy cập hồ sơ công khai và tiến độ nhiệm vụ của bạn?</p><form action={approve}><button className="steam-button" type="submit">Kết nối HUD</button></form><Link className="text-link" href="/">Hủy</Link></section></main>;
}
