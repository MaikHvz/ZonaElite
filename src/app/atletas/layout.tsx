"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/providers/SessionProvider";

// Los perfiles de atleta son solo para la comunidad: requieren sesión.
export default function AtletasLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.push(`/auth?redirect=${encodeURIComponent(pathname)}`);
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 md:pt-28 pb-24 md:pb-16">
      <div className="max-w-[935px] mx-auto">{children}</div>
    </div>
  );
}
