import { getAccessToken, sharedRefresh, type AuthResult } from "@/services/auth";
import { apiUrl, rawRequest } from "@/services/api";
import { positionEventSchema, type PositionEvent } from "./types";

export const reconnectDelay = (attempt: number) => [1000, 2000, 5000, 10000][Math.min(attempt, 3)];

export function parsePositionEvent(value: string): PositionEvent | null {
  try { return positionEventSchema.parse(JSON.parse(value)); }
  catch { return null; }
}

export async function consumePositionStream(
  signal: AbortSignal,
  onEvent: (event: PositionEvent) => void,
): Promise<Response> {
  const baseUrl = apiUrl.replace(/\/$/, "");
  const headers = new Headers({ Accept: "text/event-stream" });
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}/api/minimap/stream`, { credentials: "include", cache: "no-store", headers, signal });
  if (!response.ok || !response.body) return response;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const eventName = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
      const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
      if (eventName === "position" && data) {
        const event = parsePositionEvent(data);
        if (event) onEvent(event);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
  return response;
}

export async function consumeAuthenticatedPositionStream(signal: AbortSignal, onEvent: (event: PositionEvent) => void) {
  let response = await consumePositionStream(signal, onEvent);
  if (response.status !== 401 || signal.aborted) return response;
  const refreshed = await sharedRefresh((refreshToken) => rawRequest<AuthResult>("/api/hud-auth/refresh", {
    method: "POST", body: JSON.stringify({ refreshToken }),
  }));
  if (!refreshed || signal.aborted) return response;
  response = await consumePositionStream(signal, onEvent);
  return response;
}
