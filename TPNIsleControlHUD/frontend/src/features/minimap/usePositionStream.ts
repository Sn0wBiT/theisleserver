import { createContext, createElement, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useOverlayStore } from "@/stores/overlay.store";
import { consumeAuthenticatedPositionStream, reconnectDelay } from "./stream";
import { isPositionStale, POSITION_STALE_AFTER_MS } from "./state";
import type { PositionEvent, StreamStatus } from "./types";

type PositionStreamState = { position: PositionEvent | null; status: StreamStatus; playerPresent: boolean };
const PositionStreamContext = createContext<PositionStreamState | null>(null);

export function PositionStreamProvider({ children }: PropsWithChildren) {
  const [position, setPosition] = useState<PositionEvent | null>(null);
  const [status, setStatus] = useState<StreamStatus>("waiting");
  const enabled = useOverlayStore((state) => state.gameProcessConnected && !state.shuttingDown);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setStatus("waiting");
      return;
    }
    let stopped = false;
    let activeController: AbortController | null = null;
    let attempt = 0;
    let staleTimer: number | undefined;
    let reconnectTimer: number | undefined;

    const connect = async () => {
      if (stopped) return;
      const controller = new AbortController();
      activeController = controller;
      if (attempt > 0) setStatus("reconnecting");
      try {
        const response = await consumeAuthenticatedPositionStream(controller.signal, (event) => {
          attempt = 0;
          setPosition(event);
          window.clearTimeout(staleTimer);
          if (isPositionStale(event.updatedAt)) {
            setPosition(null);
            setStatus("stale");
            controller.abort();
          } else {
            setStatus("connected");
            staleTimer = window.setTimeout(
              () => {
                setPosition(null);
                setStatus("stale");
                controller.abort();
              },
              event.updatedAt + POSITION_STALE_AFTER_MS - Date.now(),
            );
          }
        });
        if (stopped) return;
        if (response.status === 401) {
          setPosition(null);
          return setStatus("unauthorized");
        }
        if (!response.ok) { setPosition(null); setStatus("unavailable"); }
      } catch {
        if (stopped) return;
        setPosition(null);
      }
      const delay = reconnectDelay(attempt++);
      setStatus("reconnecting");
      reconnectTimer = window.setTimeout(connect, delay);
    };
    void connect();
    return () => {
      stopped = true;
      activeController?.abort();
      window.clearTimeout(staleTimer);
      window.clearTimeout(reconnectTimer);
    };
  }, [enabled]);

  const value = useMemo(() => ({ position, status, playerPresent: position !== null && status === "connected" }), [position, status]);
  return createElement(PositionStreamContext.Provider, { value }, children);
}

export function usePositionStream() {
  const value = useContext(PositionStreamContext);
  if (!value) throw new Error("usePositionStream must be used inside PositionStreamProvider");
  return value;
}
