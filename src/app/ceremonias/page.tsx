"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CeremoniasRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/eventos"); }, [router]);
  return null;
}
