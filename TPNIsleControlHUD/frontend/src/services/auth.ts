const REFRESH_TOKEN_STORAGE_KEY = "tpn_hud_refresh_token";

function readPersistedRefreshToken() {
  try {
    return globalThis.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistRefreshToken(token: string | null) {
  try {
    if (token) globalThis.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    else globalThis.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // Keep the current session usable in memory if persistent storage is unavailable.
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = readPersistedRefreshToken();
let refreshOperation: Promise<AuthResult | null> | null = null;

export type Player = { steamId: string; displayName: string; avatarUrl: string | null };
export type AuthResult = { player: Player; accessToken: string; refreshToken: string; expiresIn: number };

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getRefreshToken() { return refreshToken; }
export function storeSession(result: AuthResult) {
  accessToken = result.accessToken;
  refreshToken = result.refreshToken;
  persistRefreshToken(result.refreshToken);
}
export function clearSession() {
  accessToken = null;
  refreshToken = null;
  persistRefreshToken(null);
}
export function sharedRefresh(run: (token: string) => Promise<AuthResult>) {
  const token = getRefreshToken();
  if (!token) return Promise.resolve(null);
  if (!refreshOperation) {
    refreshOperation = run(token).then((result) => { storeSession(result); return result; }).catch((error: { status?: number }) => {
      if (error?.status === 400 || error?.status === 401) clearSession();
      return null;
    }).finally(() => { refreshOperation = null; });
  }
  return refreshOperation;
}
