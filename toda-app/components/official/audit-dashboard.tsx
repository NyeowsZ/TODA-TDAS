"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { getDailyAuditData, getAuditAdjustments, submitAuditAdjustment } from "@/lib/actions/audit-actions";
import { formatManilaTime, formatManilaDate } from "@/lib/utils/format-timezone";
import { createClient } from "@/lib/supabase/client";
import {
  Calendar,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileText,
  User,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { DispatchLogWithDriver, AuditAdjustment } from "@/types/supabase";

export function AuditDashboard() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Current date in Manila timezone (UTC+8)
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const manilaTime = new Date(utc + 3600000 * 8);
    return manilaTime.toISOString().split("T")[0];
  });

  const [dispatches, setDispatches] = useState<DispatchLogWithDriver[]>([]);
  const [adjustments, setAdjustments] = useState<AuditAdjustment[]>([]);
  const [metrics, setMetrics] = useState<{
    totalLaunches: number;
    totalRecords: number;
    totalVoids: number;
    voidRate: string;
    activeDrivers: number;
    peakHour: string;
    hourlyData: Record<number, number>;
    controllerStats: Array<{ launches: number; voids: number; controllerId: string }>;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "voided">("all");
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"ledger" | "adjustments">("ledger");

  // Adjustment modal state
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchLogWithDriver | null>(null);
  const [adjType, setAdjType] = useState<
    "manual_credit_void" | "duplicate_correction" | "cash_discrepancy" | "system_error" | "other"
  >("duplicate_correction");
  const [adjNotes, setAdjNotes] = useState("");
  const [adjError, setAdjError] = useState<string | null>(null);
  const [adjSuccess, setAdjSuccess] = useState<string | null>(null);
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

  // Load audit data
  const loadData = (date: string) => {
    startTransition(async () => {
      try {
        const [auditRes, adjRes] = await Promise.all([
          getDailyAuditData(date),
          getAuditAdjustments(date),
        ]);
        setDispatches(auditRes.dispatches as DispatchLogWithDriver[]);
        setMetrics(auditRes.metrics);
        setAdjustments(adjRes as unknown as AuditAdjustment[]);
      } catch (err) {
        console.error("Error loading audit data:", err);
      }
    });
  };

  useEffect(() => {
    loadData(selectedDate);

    const supabase = createClient();
    const channel = supabase
      .channel("audit-realtime-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dispatch_logs" },
        () => {
          loadData(selectedDate);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_adjustments" },
        () => {
          loadData(selectedDate);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  // Filtered dispatches
  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      const bodyNum = d.drivers?.body_number || "";
      const driverName = d.drivers?.driver_profile_versions?.[0]?.full_name || "";
      const queryMatch =
        bodyNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
        driverName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!queryMatch) return false;

      if (statusFilter === "active") return !d.is_voided;
      if (statusFilter === "voided") return d.is_voided;
      return true;
    });
  }, [dispatches, searchQuery, statusFilter]);

  // Check if dispatch is within 36-hour adjustment window
  const isWithin36Hours = (loggedAt: string) => {
    const logTime = new Date(loggedAt).getTime();
    const now = Date.now();
    const diffHours = (now - logTime) / (1000 * 60 * 60);
    return diffHours <= 36;
  };

  const handleOpenAdjustModal = (d: DispatchLogWithDriver) => {
    setSelectedDispatch(d);
    setAdjType("duplicate_correction");
    setAdjNotes("");
    setAdjError(null);
    setAdjSuccess(null);
  };

  const handleCloseAdjustModal = () => {
    setSelectedDispatch(null);
    setAdjError(null);
    setAdjSuccess(null);
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch) return;

    if (adjNotes.trim().length < 5) {
      setAdjError("Notes must be at least 5 characters explaining the rationale.");
      return;
    }

    setIsSubmittingAdj(true);
    setAdjError(null);

    try {
      const res = await submitAuditAdjustment({
        dispatch_id: selectedDispatch.id,
        adjustment_type: adjType,
        notes: adjNotes.trim(),
      });

      if (!res.success) {
        setAdjError(res.error || "Failed to submit adjustment");
      } else {
        setAdjSuccess("Adjustment filed successfully and added to audit records.");
        setTimeout(() => {
          handleCloseAdjustModal();
          loadData(selectedDate);
        }, 1200);
      }
    } catch (err: unknown) {
      setAdjError((err as Error).message || "An unexpected error occurred");
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  // Find max hourly count for scale
  const maxHourlyCount = useMemo(() => {
    if (!metrics?.hourlyData) return 1;
    const values = Object.values(metrics.hourlyData);
    return Math.max(...values, 1);
  }, [metrics]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Header & Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-light">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Audit & Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Append-only dispatch logs, reconciliations, and 36-hour adjustment controls
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-surface-card border border-border-light rounded-2xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent">
            <Calendar className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={() => loadData(selectedDate)}
            disabled={isPending}
            className="p-2.5 rounded-full bg-surface-card border border-border-light text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Blueprint 5.5: Official Audit Hero Card */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-slate-900/10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Dispatches ({formatManilaDate(selectedDate)})
            </span>
            <div className="flex items-baseline gap-3 mt-1.5">
              <span className="text-4xl md:text-5xl font-extrabold tracking-tight font-mono text-white">
                {metrics?.totalLaunches.toLocaleString() ?? "0"}
              </span>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active Shift
              </span>
            </div>
          </div>
          <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-mono font-medium rounded-full border border-slate-700">
            Asia/Manila (GMT+8)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-800/80">
          <div>
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Active Units</p>
            <p className="text-lg md:text-xl font-bold font-mono text-slate-100 mt-1">
              {metrics?.activeDrivers ?? 0}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Voided Logs</p>
            <p className="text-lg md:text-xl font-bold font-mono text-rose-400 mt-1">
              {metrics?.totalVoids ?? 0} ({metrics?.voidRate ?? "0.0"}%)
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Total Entries</p>
            <p className="text-lg md:text-xl font-bold font-mono text-slate-100 mt-1">
              {metrics?.totalRecords ?? 0}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Peak Rush Hour</p>
            <p className="text-lg md:text-xl font-bold font-mono text-blue-400 mt-1">
              {metrics?.peakHour ?? "None"}
            </p>
          </div>
        </div>
      </div>

      {/* Rush Hour Distribution Chart */}
      <div className="bg-surface-card rounded-2xl p-6 border border-border-light shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Hourly Launch Activity</h2>
            <p className="text-xs text-slate-400">Dispatches recorded between 05:00 and 22:00 PST</p>
          </div>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            18-Hour Operating Window
          </span>
        </div>

        {/* Hourly Bars */}
        <div className="pt-4">
          <div className="grid grid-cols-18 gap-1.5 h-32 items-end">
            {Array.from({ length: 18 }, (_, i) => i + 5).map((hour) => {
              const count = metrics?.hourlyData?.[hour] || 0;
              const heightPercent = maxHourlyCount > 0 ? (count / maxHourlyCount) * 100 : 0;
              const isPeak = count === maxHourlyCount && count > 0;

              return (
                <div key={hour} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="relative w-full flex justify-center">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                      {count} launches
                    </div>
                    <div
                      style={{ height: `${Math.max(heightPercent, 4)}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                        isPeak
                          ? "bg-blue-600 shadow-md shadow-blue-500/20"
                          : count > 0
                          ? "bg-blue-400 hover:bg-blue-500"
                          : "bg-slate-100"
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-900">
                    {String(hour).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Tab Navigation */}
          <div className="flex bg-slate-100 p-1 rounded-full self-start">
            <button
              onClick={() => setActiveTab("ledger")}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                activeTab === "ledger"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Dispatch Ledger ({dispatches.length})
            </button>
            <button
              onClick={() => setActiveTab("adjustments")}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                activeTab === "adjustments"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Audit Adjustments ({adjustments.length})
            </button>
          </div>

          {activeTab === "ledger" && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="flex items-center bg-slate-100 rounded-2xl px-3 py-2 text-xs focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600 transition-all">
                <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
                <input
                  type="text"
                  placeholder="Filter by body # or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent focus:outline-none text-slate-900 placeholder:text-slate-400 w-44 font-medium"
                />
              </div>

              {/* Status Chips */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-full">
                {(["all", "active", "voided"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setStatusFilter(mode)}
                    className={`px-3 py-1 text-xs font-bold rounded-full capitalize transition-all ${
                      statusFilter === mode
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tab Content: Ledger */}
        {activeTab === "ledger" && (
          <div className="bg-surface-card rounded-2xl border border-border-light shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-border-light text-slate-500 text-xs uppercase font-semibold tracking-wider">
                    <th className="py-3.5 px-4">Time (PST)</th>
                    <th className="py-3.5 px-4">Body #</th>
                    <th className="py-3.5 px-4">Driver Name</th>
                    <th className="py-3.5 px-4 text-center">Launches</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Controller</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light/60">
                  {filteredDispatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                        No dispatch records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredDispatches.map((d) => {
                      const canAdjust = isWithin36Hours(d.logged_at);
                      const currentProfile = d.drivers?.driver_profile_versions?.[0];

                      return (
                        <tr
                          key={d.id}
                          className={`hover:bg-slate-50/50 transition-colors ${
                            d.is_voided ? "bg-rose-50/20 text-slate-400" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                            {formatManilaTime(d.logged_at)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md">
                              #{d.drivers?.body_number || "---"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 text-xs">
                              {currentProfile?.full_name || "Unknown Driver"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                                d.is_voided
                                  ? "line-through text-slate-400 bg-slate-100"
                                  : "text-blue-700 bg-blue-50"
                              }`}
                            >
                              {d.launch_count}x
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {d.is_voided ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 bg-rose-100 text-rose-700 text-[11px] font-bold rounded-full">
                                  Voided
                                </span>
                                {d.void_reason && (
                                  <p className="text-[11px] text-rose-600 truncate max-w-xs">
                                    {d.void_reason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-full">
                                Valid
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {d.controller_id.slice(0, 8)}...
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleOpenAdjustModal(d)}
                              disabled={!canAdjust}
                              title={
                                canAdjust
                                  ? "Submit 36-hour Official Adjustment"
                                  : "Adjustment window has expired (>36h)"
                              }
                              className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                                canAdjust
                                  ? "bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                                  : "opacity-40 cursor-not-allowed text-slate-400 bg-slate-100"
                              }`}
                            >
                              Adjust
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Adjustments */}
        {activeTab === "adjustments" && (
          <div className="bg-surface-card rounded-2xl border border-border-light shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-border-light text-slate-500 text-xs uppercase font-semibold tracking-wider">
                    <th className="py-3.5 px-4">Timestamp (PST)</th>
                    <th className="py-3.5 px-4">Dispatch Ref</th>
                    <th className="py-3.5 px-4">Adjustment Type</th>
                    <th className="py-3.5 px-4">Auditor Notes</th>
                    <th className="py-3.5 px-4">Official ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light/60">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                        No audit adjustments recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {formatManilaTime(adj.created_at)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                            Log #{adj.dispatch_id}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 text-xs font-bold rounded-full capitalize">
                            {adj.adjustment_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 max-w-md">
                          {adj.notes}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {adj.official_id.slice(0, 8)}...
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 36-Hour Adjustment Modal */}
      {selectedDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Audit Adjustment</h3>
              </div>
              <button
                onClick={handleCloseAdjustModal}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Dispatch Details */}
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-white text-slate-800 rounded-md shadow-xs">
                    #{selectedDispatch.drivers?.body_number}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {selectedDispatch.drivers?.driver_profile_versions?.[0]?.full_name || "Driver"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  Log #{selectedDispatch.id} · {formatManilaTime(selectedDispatch.logged_at)} ·{" "}
                  {selectedDispatch.launch_count}x Launch
                </p>
              </div>
              <span className="text-[11px] font-mono text-amber-700 bg-amber-50 px-2 py-1 rounded-full font-bold">
                Within 36h Window
              </span>
            </div>

            {adjError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adjError}</span>
              </div>
            )}

            {adjSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{adjSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAdjustment} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Adjustment Type
                </label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as typeof adjType)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                >
                  <option value="duplicate_correction">Duplicate Entry Correction</option>
                  <option value="manual_credit_void">Manual Credit Void</option>
                  <option value="cash_discrepancy">Cash Ledger Discrepancy</option>
                  <option value="system_error">Terminal Technical Glitch</option>
                  <option value="other">Other Official Resolution</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Official Justification Notes
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="State the reason, driver dispute outcome, or physical receipt reference..."
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseAdjustModal}
                  className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-full transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdj}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingAdj ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Filing...
                    </>
                  ) : (
                    "Save Adjustment"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
