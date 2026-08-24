import { useEffect, useState } from "react";
import { consumePositionStream, reconnectDelay } from "./stream";
import { isPositionStale, POSITION_STALE_AFTER_MS } from "./state";
import type { PositionEvent, StreamStatus } from "./types";

export function usePositionStream() {
  const [position, setPosition] = useState<PositionEvent | null>(null);
  const [status, setStatus] = useState<StreamStatus>("waiting");

  useEffect(() => {
    const controller = new AbortController();
    let attempt = 0;
    let staleTimer: number | undefined;
    let reconnectTimer: number | undefined;

    const connect = async () => {
      if (attempt > 0) setStatus("reconnecting");
      try {
        const response = await consumePositionStream(controller.signal, (event) => {
          attempt = 0;
          setPosition(event);
          window.clearTimeout(staleTimer);
          if (isPositionStale(event.updatedAt)) {
            setStatus("stale");
          } else {
            setStatus("connected");
            staleTimer = window.setTimeout(
              () => setStatus("stale"),
              event.updatedAt + POSITION_STALE_AFTER_MS - Date.now(),
            );
          }
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) return setStatus("unauthorized");
        if (!response.ok) setStatus("unavailable");
      } catch {
        if (controller.signal.aborted) return;
      }
      const delay = reconnectDelay(attempt++);
      setStatus("reconnecting");
      reconnectTimer = window.setTimeout(connect, delay);
    };
    void connect();
    return () => {
      controller.abort();
      window.clearTimeout(staleTimer);
      window.clearTimeout(reconnectTimer);
    };
  }, []);

  return { position, status };
}
