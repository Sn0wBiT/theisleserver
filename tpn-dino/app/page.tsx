import { getSession } from "@/lib/auth";
import { getQuests, type QuestState } from "@/lib/quests";
import Link from "next/link";
import QuestBrowser from "./quest-browser";

function SteamIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-9.8 8.1l5.2 2.1a2.9 2.9 0 0 1 1.6-.6l2.3-3.4a3.8 3.8 0 1 1 3.4 5.4l-3.8 2.7a2.9 2.9 0 0 1-5.6.7l-2.4-1A10 10 0 1 0 12 2Zm-4.1 15.2a1.7 1.7 0 1 0 1.3-3.1l-1.2-.5a2.8 2.8 0 0 1-.6 2.4l.5 1.2Zm6.8-5a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Zm0-.8a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Z" /></svg>;
}

function Login() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">TPN</div><p className="eyebrow">The Isle community</p>
        <h1>Your hunt.<br />Your rewards.</h1>
        <p className="lede">Sign in with Steam to see your live quest progress and token balance.</p>
        <a className="steam-button" href="/auth/steam"><SteamIcon />Sign in through Steam</a>
        <p className="fine-print">We only use your public Steam ID to match your in-game progress.</p>
      </section>
      <aside className="login-art" aria-hidden="true"><div className="sun" /><div className="ridge ridge--back" /><div className="ridge ridge--front" /><div className="dino">◆</div></aside>
    </main>
  );
}

function Dashboard({ state }: { state: QuestState }) {
  const active = state.quests.filter((quest) => quest.accepted && !quest.claimed).length;
  const complete = state.quests.filter((quest) => quest.completed).length;
  return (
    <main className="dashboard">
      <header className="topbar">
        <Link className="logo" href="/">TPN<span>Questboard</span></Link>
        <div className="account"><div><span>Steam account</span><strong>{state.steam}</strong></div><a href="/auth/logout">Sign out</a></div>
      </header>
      <section className="hero">
        <div><p className="eyebrow">Live progression</p><h1>Questboard</h1><p>Track your current objectives. Progress updates while you play on the server.</p></div>
        <Link className="refresh" href="/">Refresh quests ↻</Link>
      </section>
      <section className="stats" aria-label="Quest summary">
        <div><span>Token balance</span><strong>{state.tokenBalance.toLocaleString()}</strong></div>
        <div><span>Active quests</span><strong>{active}</strong></div>
        <div><span>Completed</span><strong>{complete}</strong></div>
      </section>
      <section className="quest-section">
        <div className="section-title"><div><p className="eyebrow">Current cycle</p><h2>Your quests</h2></div><span>{state.quests.length} available</span></div>
        {state.quests.length ? <QuestBrowser quests={state.quests} dinosaur={state.currentDinosaur} /> : <div className="empty">No quests are available in the current cycle.</div>}
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
    return <main className="error-shell"><p className="eyebrow">Quest service offline</p><h1>We couldn&apos;t load your quests.</h1><p>{error instanceof Error ? error.message : "Unknown upstream error"}</p><div><Link className="steam-button" href="/">Try again</Link><a className="text-link" href="/auth/logout">Sign out</a></div></main>;
  }
  return <Dashboard state={state} />;
}
