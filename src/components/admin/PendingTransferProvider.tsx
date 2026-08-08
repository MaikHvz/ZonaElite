"use client";

import { createClient } from "@/lib/supabase/client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 30_000;

interface PendingTransferContextValue {
  count: number;
  loading: boolean;
  refresh: () => void;
}

const PendingTransferContext = createContext<PendingTransferContextValue>({
  count: 0,
  loading: true,
  refresh: () => {},
});

export function usePendingTransferCount() {
  return useContext(PendingTransferContext);
}

export async function fetchPendingTransferCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("method", "transferencia")
    .eq("status", "pendiente");
  if (error) {
    console.error("[PendingTransferProvider] error:", error);
    return 0;
  }
  return count || 0;
}

export default function PendingTransferProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef<() => void>(() => {});

  const refresh = () => {
    fetchPendingTransferCount().then((n) => {
      setCount(n);
      setLoading(false);
    });
  };

  refreshRef.current = refresh;

  useEffect(() => {
    refresh();

    const interval = setInterval(() => {
      refreshRef.current();
    }, POLL_INTERVAL_MS);

    const onFocus = () => refreshRef.current();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <PendingTransferContext.Provider value={{ count, loading, refresh }}>
      {children}
    </PendingTransferContext.Provider>
  );
}
