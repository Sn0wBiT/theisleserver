import { getAccessToken, sharedRefresh, type AuthResult } from "@/services/auth";

export type ApiError = Error & { status: number; code?: string };

export let apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
export function validateApiUrl(value: string) {
  const url = new URL(value);
  if (url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && url.protocol !== "http:")) {
    throw new Error("Invalid runtime API origin");
  }
  return url.origin;
}
export function setApiUrl(value: string) { apiUrl = validateApiUrl(value); }

export async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const baseUrl = apiUrl.replace(/\/$/, "");
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, headers, credentials: "include" });
  } catch (cause) {
    const error = new Error("Không thể kết nối đến dịch vụ nhiệm vụ", { cause }) as ApiError;
    error.status = 0;
    throw error;
  }

  const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  if (response.status === 401 && retry) {
    const refreshed = await sharedRefresh((refreshToken) => rawRequest<AuthResult>("/api/hud-auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }));
    if (refreshed) return request<T>(path, options, false);
  }
  if (!response.ok) {
    const error = new Error(body?.message ?? readableError(body?.error, response.status)) as ApiError;
    error.status = response.status;
    error.code = body?.error;
    throw error;
  }
  if (body === null) {
    const error = new Error("Dịch vụ nhiệm vụ trả về dữ liệu không hợp lệ") as ApiError;
    error.status = response.status;
    error.code = "malformed-response";
    throw error;
  }
  return body as T;
}

export async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, { ...options, headers: { Accept: "application/json", "Content-Type": "application/json", ...options.headers } });
  } catch (cause) {
    const error = new Error("Không thể kết nối đến dịch vụ", { cause }) as ApiError;
    error.status = 0;
    throw error;
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) { const error = new Error(body?.message ?? body?.error ?? `HTTP ${response.status}`) as ApiError; error.status = response.status; error.code = body?.error; throw error; }
  return body as T;
}

export function readableError(code: string | undefined, status: number) {
  const messages: Record<string, string> = {
    unauthorized: "Phiên đăng nhập của bạn đã hết hạn",
    "not-complete": "Nhiệm vụ này chưa hoàn thành",
    "already-claimed": "Phần thưởng này đã được nhận",
    "quest-not-found": "Nhiệm vụ này không còn khả dụng",
    "not-accepted": "Hãy nhận nhiệm vụ trong trò chơi trước khi nhận thưởng",
    "growth-requirement-not-met": "Mức tăng trưởng hiện tại chưa đủ để nhận nhiệm vụ này",
    "already-accepted": "Nhiệm vụ này đã được nhận",
  };
  return (code && messages[code]) ?? `Dịch vụ nhiệm vụ phản hồi mã lỗi ${status}`;
}
