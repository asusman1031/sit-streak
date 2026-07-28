"use client";

import { useState } from "react";
import { AppData, OutputEntry } from "@/lib/types";
import { creditDayManually, newId, setStreakManually } from "@/lib/logic";
import { downloadFile, exportCSV, exportJSON, restoreLatestBackup } from "@/lib/storage";
import { addDays, dayKey } from "@/lib/time";

interface Props {
  data: AppData;
  now: number;
  onCommit: (d: AppData) => void;
  onClose: () => void;
}

export function ParentPanel({ data, now, onCommit, onClose }: Props) {
  const todayKey = dayKey(now);
  const [creditDate, setCreditDate] = useState(addDays(todayKey, -1));
  const [streakInput, setStreakInput] = useState(String(data.meta.current_streak));
  const [morningEnd, setMorningEnd] = useState(data.meta.settings.morningEnd);
  const [afternoonStart, setAfternoonStart] = useState(data.meta.settings.afternoonStart);
  const [logOccurred, setLogOccurred] = useState(true);
  const [logNote, setLogNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleCreditDay = () => {
    if (!creditDate) return;
    onCommit(creditDayManually(data, creditDate));
    flash(`${creditDate} credited`);
  };

  const handleSetStreak = () => {
    const v = Number(streakInput);
    if (!Number.isFinite(v) || v < 0) return;
    onCommit(setStreakManually(data, v, now));
    flash(`Streak set to ${Math.floor(v)}`);
  };

  const handleSaveWindows = () => {
    if (!/^\d{2}:\d{2}$/.test(morningEnd) || !/^\d{2}:\d{2}$/.test(afternoonStart)) return;
    onCommit({
      ...data,
      meta: { ...data.meta, settings: { morningEnd, afternoonStart } },
    });
    flash("Window times saved");
  };

  const handleAddLog = () => {
    const entry: OutputEntry = {
      id: newId(),
      timestamp: Date.now(),
      occurred: logOccurred,
      note: logNote.trim(),
    };
    onCommit({ ...data, outputLog: [...data.outputLog, entry] });
    setLogNote("");
    flash("Logged");
  };

  const handleDeleteLog = (id: string) => {
    onCommit({ ...data, outputLog: data.outputLog.filter((e) => e.id !== id) });
  };

  const stamp = new Date(now).toISOString().slice(0, 10);

  const handleRestore = () => {
    const restored = restoreLatestBackup();
    if (restored) {
      onCommit(restored);
      flash("Restored from latest backup");
    } else {
      flash("No backup found");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900 text-slate-100">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-5 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Parent panel</h1>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        {message && (
          <div className="rounded-lg bg-emerald-600/30 px-4 py-2 text-sm font-semibold text-emerald-200">
            {message}
          </div>
        )}

        <Section title="Credit a day">
          <p className="text-xs text-slate-400">
            Marks a full day complete (travel, illness, real life). Keeps a
            legitimate streak alive.
          </p>
          <div className="flex gap-2">
            <input
              type="date"
              value={creditDate}
              max={todayKey}
              onChange={(e) => setCreditDate(e.target.value)}
              className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm"
            />
            <button onClick={handleCreditDay} className="btn-primary">
              Credit
            </button>
          </div>
        </Section>

        <Section title="Adjust streak">
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={streakInput}
              onChange={(e) => setStreakInput(e.target.value)}
              className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm"
            />
            <button onClick={handleSetStreak} className="btn-primary">
              Set
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Current: {data.meta.current_streak} · Longest: {data.meta.longest_streak}
          </p>
        </Section>

        <Section title="Sit windows">
          <div className="flex items-center gap-2 text-sm">
            <label className="flex-1">
              Morning until
              <input
                type="time"
                value={morningEnd}
                onChange={(e) => setMorningEnd(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2"
              />
            </label>
            <label className="flex-1">
              Afternoon from
              <input
                type="time"
                value={afternoonStart}
                onChange={(e) => setAfternoonStart(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2"
              />
            </label>
          </div>
          <button onClick={handleSaveWindows} className="btn-primary self-start">
            Save windows
          </button>
        </Section>

        <Section title="Output log (parent only)">
          <p className="text-xs text-slate-400">
            Never shown in the child UI. For the doctors.
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={logOccurred}
                onChange={(e) => setLogOccurred(e.target.checked)}
              />
              BM occurred
            </label>
            <input
              type="text"
              placeholder="note (optional)"
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
              className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm"
            />
            <button onClick={handleAddLog} className="btn-primary">
              Add
            </button>
          </div>
          {data.outputLog.length > 0 && (
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs text-slate-300">
              {[...data.outputLog]
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 30)
                .map((e) => (
                  <li key={e.id} className="flex items-center gap-2 rounded bg-slate-800/60 px-2 py-1.5">
                    <span className="whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString("en-US", {
                        timeZone: "America/New_York",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>{e.occurred ? "✓ BM" : "— none"}</span>
                    <span className="flex-1 truncate">{e.note}</span>
                    <button
                      onClick={() => handleDeleteLog(e.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Section>

        <Section title="Export data">
          <p className="text-xs text-slate-400">
            Full history for the psychiatrist / GI.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                downloadFile(`sit-streak-${stamp}.json`, exportJSON(data), "application/json")
              }
              className="btn-primary"
            >
              Export JSON
            </button>
            <button
              onClick={() =>
                downloadFile(`sit-streak-${stamp}.csv`, exportCSV(data), "text/csv")
              }
              className="btn-primary"
            >
              Export CSV
            </button>
          </div>
        </Section>

        <Section title="Recovery">
          <p className="text-xs text-slate-400">
            Every change is backed up locally. If data ever looks wrong, restore
            the latest backup.
          </p>
          <button onClick={handleRestore} className="btn-secondary self-start">
            Restore latest backup
          </button>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-slate-800/50 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}
