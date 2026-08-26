import { getSession } from "@/lib/auth";
import { getQuests, type QuestState } from "@/lib/quests";
import Link from "next/link";
import QuestBrowser from "./quest-browser";
import Image from "next/image";

function SteamIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-9.8 8.1l5.2 2.1a2.9 2.9 0 0 1 1.6-.6l2.3-3.4a3.8 3.8 0 1 1 3.4 5.4l-3.8 2.7a2.9 2.9 0 0 1-5.6.7l-2.4-1A10 10 0 1 0 12 2Zm-4.1 15.2a1.7 1.7 0 1 0 1.3-3.1l-1.2-.5a2.8 2.8 0 0 1-.6 2.4l.5 1.2Zm6.8-5a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Zm0-.8a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Z" /></svg>;
}

function Login() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">TPN Dino</div>
        <p className="eyebrow">Cộng đồng The Isle</p>
        <h1>Cuộc săn của bạn.<br />Phần thưởng của bạn.</h1>
        <p className="lede">Đăng nhập bằng Steam để xem tiến độ nhiệm vụ và số dư token trực tiếp.</p>
        <a className="steam-button" href="/auth/steam"><SteamIcon />Đăng nhập qua Steam</a>
        <p className="fine-print">Chúng tôi chỉ dùng Steam ID công khai để đối chiếu tiến độ trong trò chơi của bạn.</p>
      </section>
      <aside className="login-art" aria-hidden="true">
        <Image src={`/images/bg.jpg`} fill alt="TPN Dino Việt Nam" />
      </aside>
    </main>
  );
}

function Dashboard({ state }: { state: QuestState }) {
  const active = state.quests.filter((quest) => quest.accepted && !quest.claimed).length;
  const complete = state.quests.filter((quest) => quest.completed).length;
  return (
    <main className="dashboard">
      <header className="topbar">
        <Link className="logo" href="/">TPN<span>Bảng nhiệm vụ</span></Link>
        <div className="account"><div><span>Tài khoản Steam</span><strong>{state.steam}</strong></div><a href="/auth/logout">Đăng xuất</a></div>
      </header>
      <section className="hero">
        <div><p className="eyebrow">Tiến độ trực tiếp</p><h1>Bảng nhiệm vụ</h1><p>Theo dõi các mục tiêu hiện tại. Tiến độ được cập nhật khi bạn chơi trên máy chủ.</p></div>
        <Link className="refresh" href="/">Làm mới nhiệm vụ ↻</Link>
      </section>
      <section className="stats" aria-label="Tổng quan nhiệm vụ">
        <div><span>Số dư token</span><strong>{state.tokenBalance.toLocaleString("vi-VN")}</strong></div>
        <div><span>Nhiệm vụ đang làm</span><strong>{active}</strong></div>
        <div><span>Đã hoàn thành</span><strong>{complete}</strong></div>
      </section>
      <section className="quest-section">
        <div className="section-title"><div><p className="eyebrow">Chu kỳ hiện tại</p><h2>Nhiệm vụ của bạn</h2></div><span>{state.quests.length} nhiệm vụ</span></div>
        {state.quests.length ? <QuestBrowser quests={state.quests} dinosaur={state.currentDinosaur} /> : <div className="empty">Không có nhiệm vụ nào trong chu kỳ hiện tại.</div>}
      </section>
    </main>
  );
}

export default async function Home() {
  const session = await getSession();
  if (!session) return <Login />;
  let state: QuestState;
  try { state = await getQuests(session.steamId); }
  catch (error) {
    return <main className="error-shell"><p className="eyebrow">Dịch vụ nhiệm vụ đang ngoại tuyến</p><h1>Không thể tải nhiệm vụ của bạn.</h1><p>{error instanceof Error ? "Vui lòng kiểm tra cấu hình dịch vụ hoặc thử lại sau." : "Đã xảy ra lỗi không xác định."}</p><div><Link className="steam-button" href="/">Thử lại</Link><a className="text-link" href="/auth/logout">Đăng xuất</a></div></main>;
  }
  return <Dashboard state={state} />;
}
