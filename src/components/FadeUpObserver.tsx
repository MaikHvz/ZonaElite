"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function FadeUpObserver() {
  const pathname = usePathname();

  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    const observe = (el: Element) => {
      if (el.classList.contains("visible")) return;
      observer?.observe(el);
    };

    const reveal = (el: Element) => {
      if (el.classList.contains("visible")) return;
      el.classList.add("visible");
      observer?.unobserve(el);
    };

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) reveal(entry.target);
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.1 }
    );

    // Initial scan + re-scan on route changes. The root layout stays mounted
    // during client-side navigation (e.g. admin -> "/"), so sections added by
    // the new page were never observed and would remain hidden at opacity 0.
    document.querySelectorAll(".fade-up:not(.visible)").forEach(observe);

    // Catch sections mounted after the scan (async/data-driven content) without
    // re-scanning the whole DOM on every mutation.
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.classList.contains("fade-up")) observe(node);
          node.querySelectorAll(".fade-up:not(.visible)").forEach(observe);
        }
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutationObserver.disconnect();
    };
  }, [pathname]);

  return null;
}
