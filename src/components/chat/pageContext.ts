"use client";

import { useEffect, useSyncExternalStore } from "react";

export interface ArchivePageContext {
  type: "SEASON" | "RACE" | "DRIVER" | "TEAM" | "CIRCUIT" | "ERA";
  id: string;
  title: string;
  suggestions?: string[];
}

let current: ArchivePageContext | null = null;
const listeners = new Set<() => void>();

function set(ctx: ArchivePageContext | null) {
  current = ctx;
  listeners.forEach((l) => l());
}

export function usePageContext(): ArchivePageContext | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

/** Rendered by entity pages so the assistant knows what the reader is looking at. */
export function SetPageContext(props: ArchivePageContext) {
  const key = `${props.type}:${props.id}`;
  useEffect(() => {
    set(props);
    return () => set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
