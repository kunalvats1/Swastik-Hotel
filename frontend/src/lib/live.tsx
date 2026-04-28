import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { tokenStore, BACKEND_URL } from "./api";
import { useAuth } from "./auth";

export type LiveEvent = {
  type: "booking_created" | "booking_checked_out" | "connected";
  booking?: any;
};

type LiveCtx = {
  lastEvent: LiveEvent | null;
  connected: boolean;
};

const LiveContext = createContext<LiveCtx>({ lastEvent: null, connected: false });

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    const token = await tokenStore.get();
    if (!token || !BACKEND_URL) return;
    try {
      const wsUrl = BACKEND_URL.replace(/^http/, "ws") + `/api/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setLastEvent({ ...data, _ts: Date.now() } as any);
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    } catch {
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      if (wsRef.current) try { wsRef.current.close(); } catch {}
      if (retryRef.current) clearTimeout(retryRef.current);
      setConnected(false);
      return;
    }
    connect();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) try { wsRef.current.close(); } catch {}
    };
  }, [user, connect]);

  return (
    <LiveContext.Provider value={{ lastEvent, connected }}>
      {children}
    </LiveContext.Provider>
  );
}

export function useLive() {
  return useContext(LiveContext);
}
