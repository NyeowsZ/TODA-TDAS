"use client";

import { useState, useEffect, useTransition } from "react";
import { getSystemSettings, updateSystemSetting } from "@/lib/actions/settings-actions";
import {
  Sliders,
  ShieldAlert,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Save,
  Loader2,
  RefreshCw,
  Info,
} from "lucide-react";
import type { SystemSetting } from "@/types/supabase";

export function SystemSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [isPending, startTransition] = useTransition();

  // Controlled states for settings
  const [controllerUndoSeconds, setControllerUndoSeconds] = useState(120);
  const [auditorWindowHours, setAuditorWindowHours] = useState(36);
  const [sanityThreshold, setSanityThreshold] = useState(10);
  const [operatingStart, setOperatingStart] = useState("05:00");
  const [operatingEnd, setOperatingEnd] = useState("23:00");

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadSettings = () => {
    startTransition(async () => {
      try {
        const data = await getSystemSettings();
        setSettings(data as unknown as SystemSetting[]);

        // Hydrate local states
        data.forEach((s) => {
          const val = s.value as Record<string, unknown> | null;
          if (s.key === "grace_period_controller") {
            if (val?.seconds) setControllerUndoSeconds(Number(val.seconds));
          } else if (s.key === "grace_period_auditor") {
            if (val?.hours) setAuditorWindowHours(Number(val.hours));
          } else if (s.key === "dispatch_sanity_threshold") {
            if (val?.threshold) setSanityThreshold(Number(val.threshold));
          } else if (s.key === "operating_hours") {
            if (val?.start) setOperatingStart(String(val.start));
            if (val?.end) setOperatingEnd(String(val.end));
          }
        });
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    });
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSetting = async (
    key: string,
    value: Record<string, unknown>,
    displayName: string
  ) => {
    setSavingKey(key);
    setFeedback(null);

    try {
      const res = await updateSystemSetting({
        key,
        value,
      });

      if (!res.success) {
        setFeedback({
          type: "error",
          message: res.error || `Failed to update ${displayName}`,
        });
      } else {
        setFeedback({
          type: "success",
          message: `${displayName} updated successfully. Enforced immediately across all terminals.`,
        });
        loadSettings();
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: (err as Error).message || "An unexpected error occurred",
      });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-light">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System & Operational Settings
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure dynamic grace windows, dispatch safety thresholds, and operating schedules
          </p>
        </div>

        <button
          onClick={loadSettings}
          disabled={isPending}
          className="p-2.5 rounded-full bg-surface-card border border-border-light text-slate-600 hover:text-blue-600 transition-all shadow-sm active:scale-95 disabled:opacity-50 self-start"
          title="Refresh Settings"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-blue-600" : ""}`} />
        </button>
      </div>

      {/* RLS Security Notice */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Chairman & Executive Authority:</span> These settings control
          core operational rules across the TODA dispatch terminal. Updates are enforced in real time
          and protected by PostgreSQL Row-Level Security policies.
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="space-y-6">
        {/* Setting 1: Controller Undo Grace Window */}
        <div className="bg-surface-card rounded-2xl p-6 border border-border-light shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1 max-w-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Controller Undo Grace Window</h3>
            </div>
            <p className="text-xs text-slate-500">
              The duration (in seconds) during which a booth controller can immediately void a mistake
              with zero penalty. Default is 120 seconds (2 minutes).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-2xl px-3 py-2 w-28">
              <input
                type="number"
                min={30}
                max={600}
                step={10}
                value={controllerUndoSeconds}
                onChange={(e) => setControllerUndoSeconds(Number(e.target.value))}
                className="w-full bg-transparent font-mono text-sm font-bold text-slate-900 focus:outline-none text-right"
              />
              <span className="text-xs font-semibold text-slate-400 ml-1">sec</span>
            </div>

            <button
              onClick={() =>
                handleSaveSetting(
                  "grace_period_controller",
                  { seconds: controllerUndoSeconds },
                  "Controller Undo Window"
                )
              }
              disabled={savingKey === "grace_period_controller"}
              className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingKey === "grace_period_controller" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save</span>
            </button>
          </div>
        </div>

        {/* Setting 2: Auditor Adjustment Window */}
        <div className="bg-surface-card rounded-2xl p-6 border border-border-light shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1 max-w-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Auditor Adjustment Window</h3>
            </div>
            <p className="text-xs text-slate-500">
              The time window (in hours) following a dispatch during which TODA Officials and Auditors
              may submit reconciliation adjustments. Enforced by PostgreSQL RLS. Default is 36 hours.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-2xl px-3 py-2 w-28">
              <input
                type="number"
                min={1}
                max={168}
                value={auditorWindowHours}
                onChange={(e) => setAuditorWindowHours(Number(e.target.value))}
                className="w-full bg-transparent font-mono text-sm font-bold text-slate-900 focus:outline-none text-right"
              />
              <span className="text-xs font-semibold text-slate-400 ml-1">hrs</span>
            </div>

            <button
              onClick={() =>
                handleSaveSetting(
                  "grace_period_auditor",
                  { hours: auditorWindowHours },
                  "Auditor Adjustment Window"
                )
              }
              disabled={savingKey === "grace_period_auditor"}
              className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingKey === "grace_period_auditor" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save</span>
            </button>
          </div>
        </div>

        {/* Setting 3: Launch Multiplier Sanity Check Threshold */}
        <div className="bg-surface-card rounded-2xl p-6 border border-border-light shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1 max-w-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900">
                Launch Multiplier Sanity Barrier
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Any dispatch input where launch count exceeds this number triggers a high-visibility
              amber confirmation barrier to prevent accidental fat-finger entries. Default is 10.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-2xl px-3 py-2 w-28">
              <input
                type="number"
                min={3}
                max={50}
                value={sanityThreshold}
                onChange={(e) => setSanityThreshold(Number(e.target.value))}
                className="w-full bg-transparent font-mono text-sm font-bold text-slate-900 focus:outline-none text-right"
              />
              <span className="text-xs font-semibold text-slate-400 ml-1">units</span>
            </div>

            <button
              onClick={() =>
                handleSaveSetting(
                  "dispatch_sanity_threshold",
                  { threshold: sanityThreshold },
                  "Sanity Threshold"
                )
              }
              disabled={savingKey === "dispatch_sanity_threshold"}
              className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingKey === "dispatch_sanity_threshold" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save</span>
            </button>
          </div>
        </div>

        {/* Setting 4: Operational Hours */}
        <div className="bg-surface-card rounded-2xl p-6 border border-border-light shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1 max-w-lg">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">Operational Daily Shift Schedule</h3>
            </div>
            <p className="text-xs text-slate-500">
              The association daily schedule in Manila Time (PST). Used for shift aggregations and
              peak load baselines.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-2">
              <input
                type="time"
                value={operatingStart}
                onChange={(e) => setOperatingStart(e.target.value)}
                className="bg-transparent font-mono text-xs font-bold text-slate-900 focus:outline-none"
              />
              <span className="text-xs text-slate-400 font-bold">-</span>
              <input
                type="time"
                value={operatingEnd}
                onChange={(e) => setOperatingEnd(e.target.value)}
                className="bg-transparent font-mono text-xs font-bold text-slate-900 focus:outline-none"
              />
            </div>

            <button
              onClick={() =>
                handleSaveSetting(
                  "operating_hours",
                  { start: operatingStart, end: operatingEnd },
                  "Operating Schedule"
                )
              }
              disabled={savingKey === "operating_hours"}
              className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingKey === "operating_hours" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
