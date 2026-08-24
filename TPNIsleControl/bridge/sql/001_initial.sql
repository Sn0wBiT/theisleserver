CREATE TABLE IF NOT EXISTS tpn_bridge_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS tpn_players (
  steam_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tpn_dinosaurs (
  steam_id text NOT NULL REFERENCES tpn_players (steam_id) ON DELETE CASCADE,
  dinosaur_id text NOT NULL,
  snapshot_at bigint NOT NULL,
  hp double precision,
  pawn_address text,
  species text,
  growth double precision,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (steam_id, dinosaur_id)
);

CREATE INDEX IF NOT EXISTS tpn_dinosaurs_player_active
  ON tpn_dinosaurs (steam_id, is_active, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS tpn_token_balances (
  steam_id text PRIMARY KEY,
  balance bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tpn_token_balances_nonnegative CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS tpn_quest_progress (
  steam_id text NOT NULL,
  quest_id text NOT NULL,
  window_key text NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  progress double precision NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  claimed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (steam_id, quest_id, window_key)
);

CREATE INDEX IF NOT EXISTS tpn_quest_progress_player_window
  ON tpn_quest_progress (steam_id, window_key);
