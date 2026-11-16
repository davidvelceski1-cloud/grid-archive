"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { usePageContext } from "./pageContext";

/** Floating "Ask the Archive" button available on every page (except /ask itself). */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const ctx = usePageContext();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (pathname.startsWith("/ask") || pathname.startsWith("/admin")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="chat-widget"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-signal px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white shadow-[0_8px_30px_rgba(0,0,0,.5)] transition-colors hover:bg-white hover:text-ink sm:bottom-6 sm:right-6"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
        {ctx ? "Ask about this page" : "Ask the Archive"}
      </button>
      {open && (
        <div
          id="chat-widget"
          role="dialog"
          aria-label="Ask the Archive"
          className="fixed inset-0 z-[55] flex flex-col bg-carbon sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,calc(100vh-8rem))] sm:w-[440px] sm:border sm:border-rule sm:shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-rule px-4 py-3">
            <div>
              <p className="eyebrow-accent">Ask the Archive</p>
              {ctx && <p className="text-xs text-mist">Context: {ctx.title}</p>}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-mist hover:text-white" aria-label="Close assistant">
              <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg>
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel context={ctx} compact key={ctx ? `${ctx.type}:${ctx.id}` : "global"} />
          </div>
        </div>
      )}
    </>
  );
}
