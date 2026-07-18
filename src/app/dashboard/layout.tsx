"use client";

import { useSession } from "@/providers/SessionProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardNav from "@/components/dashboard/DashboardNav";

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
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <div className="max-w-[1000px] mx-auto">
        <DashboardNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
