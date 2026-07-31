"use client";

import { useState } from "react";
import { AppData } from "@/lib/types";
import { normalizeData } from "@/lib/storage";
import {
  deriveFamilyId,
  markLoggedIn,
  mergeData,
  pullRemoteBy,
  pushRemote,
  setSyncId,
} from "@/lib/sync";

interface Props {
  data: AppData; // whatever this device already holds; merged in on login
  onDone: (merged: AppData) => void;
}

/**
 * The family login. One password, chosen by a parent, typed once per
 * device. The sync record id derives from the password, so the same
 * password always lands on the same family — and a typo says "not found"
 * instead of silently forking the streak.
 */
export function LoginScreen({ data, onDone }: Props) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null); // holds the derived id offered for creation
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (pw.trim().length < 6) {
      setError("Password needs at least 6 letters");
      return;
    }
    setBusy(true);
    setError(null);
    setNotFound(null);
    try {
      const id = await deriveFamilyId(pw);
      const remote = await pullRemoteBy(id);
      if (remote) {
        setSyncId(id);
        markLoggedIn();
        const merged = mergeData(data, normalizeData(remote));
        void pushRemote(merged);
        onDone(merged);
      } else {
        setNotFound(id);
      }
    } finally {
      setBusy(false);
    }
  };

  const create = () => {
    if (!notFound) return;
    setSyncId(notFound);
    markLoggedIn();
    void pushRemote(data);
    onDone(data);
  };

  return (
    <main className="app-bg flex min-h-dvh flex-col items-center justify-center px-8 text-white">
      <div className="mb-6 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <div className="text-3xl font-black tracking-tight">
          <span className="text-white">Poppy</span>{" "}
          <span className="text-amber-300">Streaks</span>
        </div>
      </div>

      <div className="mb-2 text-center text-xl font-bold">
        What&apos;s your family password?
      </div>
      <div className="mb-6 text-center text-sm text-white/60">
        A grown-up types it once, then this phone is set forever.
      </div>

      <input
        type="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={pw}
        onChange={(e) => {
          setPw(e.target.value);
          setNotFound(null);
          setError(null);
        }}
        placeholder="family password"
        className="w-full max-w-xs rounded-2xl bg-white/15 px-5 py-4 text-center text-lg font-semibold text-white placeholder-white/40 outline-none focus:bg-white/25"
      />

      {error && <div className="mt-3 text-sm font-semibold text-amber-300">{error}</div>}

      {notFound ? (
        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          <div className="text-sm font-semibold text-amber-300">
            No family found with that password. Check the spelling —
            or start a new family with it.
          </div>
          <div className="flex gap-3">
            <button
              onClick={join}
              disabled={busy}
              className="rounded-2xl bg-white/15 px-6 py-3 font-bold"
            >
              Try again
            </button>
            <button
              onClick={create}
              disabled={busy}
              className="rounded-2xl bg-amber-400 px-6 py-3 font-black text-amber-950"
            >
              Create new family
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={join}
          disabled={busy || pw.trim().length === 0}
          className="mt-5 w-full max-w-xs rounded-2xl bg-amber-400 py-4 text-xl font-black text-amber-950 shadow-lg shadow-amber-500/30 transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Let's go"}
        </button>
      )}

      <div className="mt-8 max-w-xs text-center text-xs text-white/40">
        Anything already on this phone is kept and merged in — a streak can
        never be lost by logging in.
      </div>
    </main>
  );
}
