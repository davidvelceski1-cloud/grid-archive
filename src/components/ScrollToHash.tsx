"use client";

import { useEffect } from "react";

/**
 * Scroll to the element named in the URL hash once the page has hydrated.
 * Next.js resets the scroll position after loading, which cancels the browser's
 * own jump to "#anchor", so we repeat it.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const t = setTimeout(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(t);
  }, []);
  return null;
}
