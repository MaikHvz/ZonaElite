"use client";

import { createClient } from "@/lib/supabase/client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 30_000;

interface UserPendingTransferContextValue {
  count: number;
  loading: boolean;
  refresh: () => void;
}

const UserPendingTransferContext = createContext<UserPendingTransferContextValue>({
  count: 0,
  loading: true,
  refresh: () => {},
});

export function useUserPendingTransferCount() {
  return useContext(UserPendingTransferContext);
}

export async function fetchUserPendingTransferCount(userId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("method", "transferencia")
    .eq("status", "pendiente");
  if (error) {
    console.error("[UserPendingTransferProvider] error:", error);
    return 0;
  }
  return count || 0;
}

export default function UserPendingTransferProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef<() => void>(() => {});

  const refresh = () => {
    fetchUserPendingTransferCount(userId).then((n) => {
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
  }, [userId]);

  return (
    <UserPendingTransferContext.Provider value={{ count, loading, refresh }}>
      {children}
    </UserPendingTransferContext.Provider>
  );
}
