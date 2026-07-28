"use client";

import { useEffect } from "react";
import { SitWindow } from "@/lib/types";

interface Props {
  window: SitWindow;
  hasAfternoonLeft: boolean;
  onDismiss: () => void;
}

/** First sit of the day done: short positive confirmation, then back. */
export function SitDoneOverlay({ window: win, hasAfternoonLeft, onDismiss }: Props) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 3200);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-8"
      onClick={onDismiss}
    >
      <div className="pop-in flex flex-col items-center gap-4 rounded-3xl bg-white px-10 py-12 text-center text-slate-800 shadow-2xl">
        <div className="bounce-slow text-6xl">✅</div>
        <div className="text-2xl font-extrabold">
          {win === "morning" ? "Morning sit done." : "Afternoon sit done."}
        </div>
        <div className="text-lg font-medium text-slate-500">
          {hasAfternoonLeft ? "One more later today." : "Nice work!"}
        </div>
      </div>
    </div>
  );
}
