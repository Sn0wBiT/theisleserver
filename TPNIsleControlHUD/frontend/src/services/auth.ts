let accessToken: string | null = null;
const refreshKey = "tpn.hud.refreshToken";
let refreshOperation: Promise<AuthResult | null> | null = null;

export type Player = { steamId: string; displayName: string; avatarUrl: string | null };
export type AuthResult = { player: Player; accessToken: string; refreshToken: string; expiresIn: number };

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getRefreshToken() { return localStorage.getItem(refreshKey); }
export function storeSession(result: AuthResult) {
  accessToken = result.accessToken;
  localStorage.setItem(refreshKey, result.refreshToken);
}
export function clearSession() { accessToken = null; localStorage.removeItem(refreshKey); }
export function sharedRefresh(run: (token: string) => Promise<AuthResult>) {
  const token = getRefreshToken();
  if (!token) return Promise.resolve(null);
  if (!refreshOperation) {
    refreshOperation = run(token).then((result) => { storeSession(result); return result; }).catch(() => { clearSession(); return null; }).finally(() => { refreshOperation = null; });
  }
  return refreshOperation;
}
