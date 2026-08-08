"use client";

import { useSession } from "@/providers/SessionProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardNav from "@/components/dashboard/DashboardNav";
import UserPendingTransferProvider from "@/components/dashboard/UserPendingTransferProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useSession();
  const router = useRouter();
  const [isFlowReturn, setIsFlowReturn] = useState(false);

  useEffect(() => {
    setIsFlowReturn(new URLSearchParams(window.location.search).has("token"));
  }, []);

  useEffect(() => {
    if (!loading && !user && !isFlowReturn) router.push("/auth");
  }, [user, loading, router, isFlowReturn]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user && !isFlowReturn) return null;

  return (
    <div className="min-h-screen bg-background pt-24 md:pt-28 pb-28 md:pb-16 px-4 md:px-6">
      {/* Subtle decorative gradient */}
      <div className="fixed top-0 left-0 w-full h-[300px] pointer-events-none z-0 opacity-40 bg-gradient-to-b from-primary-container/5 via-transparent to-transparent" />

      <div className="max-w-[1200px] mx-auto relative z-10">
        {user && (
          <UserPendingTransferProvider userId={user.id}>
            <div className="flex gap-6">
              <DashboardNav />
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </UserPendingTransferProvider>
        )}
      </div>
    </div>
  );
}
