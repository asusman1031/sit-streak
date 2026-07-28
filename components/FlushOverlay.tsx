"use client";

import { useEffect, useRef, useState } from "react";
import { playFlush } from "@/lib/sound";

interface Props {
  onDone: () => void;
}

/**
 * Sawyer's timer-done finale: a dancing poop emoji that flushes away with a
 * swirl. Copy stays neutral; this is his chosen mascot being silly, nothing
 * more. Parents can turn it off in the parent panel.
 */
export function FlushOverlay({ onDone }: Props) {
  const [phase, setPhase] = useState<"dance" | "swirl">("dance");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t1 = setTimeout(() => {
      playFlush();
      setPhase("swirl");
    }, 1700);
    const t2 = setTimeout(() => onDoneRef.current(), 3100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      className="app-bg fixed inset-0 z-40 flex flex-col items-center justify-center"
      onClick={() => onDoneRef.current()}
    >
      <div className="pop-in text-3xl font-black text-white">5 minutes done!</div>
      <div className={phase === "dance" ? "poop-dance mt-10 text-[7rem]" : "swirl-out mt-10 text-[7rem]"}>
        💩
      </div>
    </div>
  );
}
