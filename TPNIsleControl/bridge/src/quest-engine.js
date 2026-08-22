function windowKey(period, date = new Date()) {
  const y = date.getUTCFullYear();

  if (period === "daily") {
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (period === "monthly") {
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  // ISO-ish Monday-based weekly key. Good enough for local quest windows.
  const copy = new Date(Date.UTC(y, date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export class QuestEngine {
  constructor(definitions, store) {
    this.definitions = definitions;
    this.store = store;
  }

  getPlayerState(steam) {
    const now = new Date();

    return this.definitions.map((q) => {
      const key = `${steam}:${q.id}:${windowKey(q.period, now)}`;
      const state = this.store.data.questProgress[key] ?? {
        progress: 0,
        completed: false,
        claimed: false
      };

      return {
        ...q,
        window: windowKey(q.period, now),
        progress: state.progress,
        completed: state.completed,
        claimed: state.claimed
      };
    });
  }

  _entry(steam, q) {
    const key = `${steam}:${q.id}:${windowKey(q.period, new Date())}`;
    if (!this.store.data.questProgress[key]) {
      this.store.data.questProgress[key] = {
        progress: 0,
        completed: false,
        claimed: false
      };
    }
    return this.store.data.questProgress[key];
  }

  _apply(steam, type, value, mode = "add") {
    let changed = false;

    for (const q of this.definitions) {
      if (q.type !== type) continue;

      const state = this._entry(steam, q);
      if (state.claimed) continue;

      if (mode === "max") {
        state.progress = Math.max(Number(state.progress || 0), Number(value || 0));
      } else {
        state.progress = Number(state.progress || 0) + Number(value || 0);
      }

      if (state.progress >= q.target) {
        state.progress = Math.max(state.progress, q.target);
        state.completed = true;
      }

      changed = true;
    }

    if (changed) this.store.save();
  }

  onSnapshot(snapshot) {
    const steam = snapshot.steam;
    if (!steam) return;

    const previous = this.store.data.lastSnapshots[steam];
    const ts = Number(snapshot.ts || 0);

    if (previous && ts > previous.ts) {
      // Clamp to prevent downtime / file replay from awarding huge playtime.
      const delta = Math.min(10, Math.max(0, ts - previous.ts));
      if (delta > 0) this._apply(steam, "play_seconds", delta, "add");
    }

    const growth = Number(snapshot.growth);
    if (Number.isFinite(growth)) {
      this._apply(steam, "reach_growth", growth, "max");
    }

    this.store.data.lastSnapshots[steam] = {
      ts,
      hp: snapshot?.vitals?.hp ?? null,
      addr: snapshot.addr ?? null,
      growth: snapshot.growth ?? null
    };

    this.store.save();
  }

  onPlayerKill(killerSteam) {
    if (!killerSteam) return;
    this._apply(killerSteam, "player_kills", 1, "add");
  }

  claim(steam, questId) {
    const q = this.definitions.find((x) => x.id === questId);
    if (!q) return { ok: false, error: "quest-not-found" };

    const state = this._entry(steam, q);

    if (!state.completed) return { ok: false, error: "not-complete" };
    if (state.claimed) return { ok: false, error: "already-claimed" };

    state.claimed = true;

    const reward = Number(q.rewardTokens || 0);
    const old = Number(this.store.data.tokenBalances[steam] || 0);
    this.store.data.tokenBalances[steam] = old + reward;
    this.store.save();

    return {
      ok: true,
      rewardTokens: reward,
      tokenBalance: this.store.data.tokenBalances[steam]
    };
  }
}
