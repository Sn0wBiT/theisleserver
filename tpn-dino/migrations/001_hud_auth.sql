CREATE TABLE IF NOT EXISTS tpn_hud_steam_profiles (
  steam_id varchar(17) PRIMARY KEY, display_name text NOT NULL, avatar_url text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tpn_hud_login_attempts (
  id bigserial PRIMARY KEY, device_code_hash char(64) UNIQUE NOT NULL, browser_code_hash char(64) UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','cancelled','expired','consumed')),
  steam_id varchar(17) REFERENCES tpn_hud_steam_profiles(steam_id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, approved_at timestamptz, consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS tpn_hud_login_attempts_expiry_idx ON tpn_hud_login_attempts (expires_at);
CREATE TABLE IF NOT EXISTS tpn_hud_refresh_sessions (
  id bigserial PRIMARY KEY, token_hash char(64) UNIQUE NOT NULL, family_id varchar(32) NOT NULL,
  steam_id varchar(17) NOT NULL REFERENCES tpn_hud_steam_profiles(steam_id), created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, last_used_at timestamptz, revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS tpn_hud_refresh_family_idx ON tpn_hud_refresh_sessions (family_id);
CREATE TABLE IF NOT EXISTS tpn_hud_rate_limits (
  rate_key text PRIMARY KEY, window_started_at timestamptz NOT NULL, count integer NOT NULL
);
