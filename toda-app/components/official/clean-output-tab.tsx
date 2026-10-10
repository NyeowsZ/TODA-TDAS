"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { DispatchLogWithDriver } from "@/types/supabase";
import { formatManilaTime } from "@/lib/utils/format-timezone";
import { cn } from "@/lib/utils";
import {
  Download,
  Printer,
  CheckCircle2,
  Circle,
  RotateCcw,
  User,
  ArrowUpDown,
} from "lucide-react";

interface CleanDriverTally {
  driverId: string;
  bodyNumber: string;
  driverName: string;
  driverPhotoUrl: string | null;
  totalTrips: number;
  lastLoggedAt: string;
  isReconciled: boolean;
}

interface CleanOutputTabProps {
  dispatches: DispatchLogWithDriver[];
  activeDate: string;
}

type SortKey = "bodyNumber" | "name" | "tally";

export function CleanOutputTab({ dispatches, activeDate }: CleanOutputTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("bodyNumber");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "reconciled">("all");
  const [reconciledIds, setReconciledIds] = useState<Set<string>>(new Set());

  // Load persisted reconciliation checklist from localStorage for this date
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`toda-reconciled-${activeDate}`);
      if (saved) {
        setReconciledIds(new Set(JSON.parse(saved)));
      } else {
        setReconciledIds(new Set());
      }
    } catch {
      setReconciledIds(new Set());
    }
  }, [activeDate]);

  // Persist reconciliation state
  const toggleReconciled = (driverId: string) => {
    setReconciledIds((prev) => {
      const next = new Set(prev);
      if (next.has(driverId)) {
        next.delete(driverId);
      } else {
        next.add(driverId);
      }
      try {
        localStorage.setItem(`toda-reconciled-${activeDate}`, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error("Storage error:", e);
      }
      return next;
    });
  };

  const handleResetChecklist = () => {
    setReconciledIds(new Set());
    try {
      localStorage.removeItem(`toda-reconciled-${activeDate}`);
    } catch {}
  };

  // Group and consolidate dispatches by driver
  const driverTallies = useMemo(() => {
    const map = new Map<string, CleanDriverTally>();

    dispatches.forEach((d) => {
      if (d.is_voided) return; // Skip voided entries

      const versions = d.drivers?.driver_profile_versions || [];
      const driverName = versions[0]?.full_name || "Unknown Driver";
      const photoUrl = versions[0]?.driver_photo_url || null;
      const bodyNum = d.drivers?.body_number || "???";

      const existing = map.get(d.driver_id);
      if (!existing) {
        map.set(d.driver_id, {
          driverId: d.driver_id,
          bodyNumber: bodyNum,
          driverName,
          driverPhotoUrl: photoUrl,
          totalTrips: d.launch_count,
          lastLoggedAt: d.logged_at,
          isReconciled: reconciledIds.has(d.driver_id),
        });
      } else {
        existing.totalTrips += d.launch_count;
        if (new Date(d.logged_at) > new Date(existing.lastLoggedAt)) {
          existing.lastLoggedAt = d.logged_at;
        }
      }
    });

    return Array.from(map.values()).map((t) => ({
      ...t,
      isReconciled: reconciledIds.has(t.driverId),
    }));
  }, [dispatches, reconciledIds]);

  // Sorted and filtered list
  const filteredList = useMemo(() => {
    let list = [...driverTallies];

    if (filterMode === "pending") {
      list = list.filter((t) => !t.isReconciled);
    } else if (filterMode === "reconciled") {
      list = list.filter((t) => t.isReconciled);
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "bodyNumber") {
        cmp = a.bodyNumber.localeCompare(b.bodyNumber, undefined, { numeric: true });
      } else if (sortKey === "name") {
        cmp = a.driverName.localeCompare(b.driverName);
      } else if (sortKey === "tally") {
        cmp = a.totalTrips - b.totalTrips;
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [driverTallies, filterMode, sortKey, sortAsc]);

  const totalTripsAll = useMemo(() => {
    return driverTallies.reduce((sum, d) => sum + d.totalTrips, 0);
  }, [driverTallies]);

  const reconciledCount = driverTallies.filter((d) => d.isReconciled).length;
  const pendingCount = driverTallies.length - reconciledCount;

  // CSV Export
  const handleExportCSV = () => {
    const headers = ["Line #", "Body Number", "Driver Name", "Total Launches", "Status", "Last Dispatched"];
    const rows = filteredList.map((d, index) => [
      index + 1,
      `#${d.bodyNumber}`,
      `"${d.driverName.replace(/"/g, '""')}"`,
      d.totalTrips,
      d.isReconciled ? "Reconciled" : "Pending",
      formatManilaTime(d.lastLoggedAt),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DACOTODA_Attendance_${activeDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-border-subtle p-4 shadow-sm">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 bg-surface-subtle p-1 rounded-2xl self-start">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer",
              filterMode === "all"
                ? "bg-white text-text-primary shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            All Drivers ({driverTallies.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("pending")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer",
              filterMode === "pending"
                ? "bg-white text-text-primary shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("reconciled")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer",
              filterMode === "reconciled"
                ? "bg-white text-status-success-text shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            Reconciled ({reconciledCount})
          </button>
        </div>

        {/* Action Buttons: Sort, Reset, CSV, Print */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort Selector */}
          <button
            type="button"
            onClick={() => {
              if (sortKey === "bodyNumber") {
                setSortKey("name");
              } else if (sortKey === "name") {
                setSortKey("tally");
              } else {
                setSortKey("bodyNumber");
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-surface-subtle hover:bg-slate-200 text-text-primary rounded-xl transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort: {sortKey === "bodyNumber" ? "Body #" : sortKey === "name" ? "Name" : "Trips"}
          </button>

          <button
            type="button"
            onClick={() => setSortAsc(!sortAsc)}
            className="px-2.5 py-2 text-xs font-mono font-bold bg-surface-subtle hover:bg-slate-200 text-text-secondary rounded-xl transition-colors cursor-pointer"
            title="Toggle sort direction"
          >
            {sortAsc ? "ASC ↑" : "DESC ↓"}
          </button>

          {reconciledCount > 0 && (
            <button
              type="button"
              onClick={handleResetChecklist}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-text-muted hover:text-status-danger-text rounded-xl transition-colors cursor-pointer"
              title="Reset verified checklist"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-surface-subtle hover:bg-slate-200 text-text-primary rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-brand-primary hover:bg-brand-hover text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-5 py-3.5 bg-surface-subtle/60 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold text-text-primary uppercase tracking-wider">
              Shift Masterlist Reconciliation
            </span>
            <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-brand-soft text-brand-primary border border-blue-200">
              {totalTripsAll} Total Shift Trips
            </span>
          </div>

          <div className="text-[11px] font-mono text-text-muted">
            Click any row to toggle reconciliation check-off
          </div>
        </div>

        {/* Tabular Output */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-subtle/30 border-b border-border-subtle text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center">CHECK</th>
                <th className="py-3 px-3 w-16">LINE</th>
                <th className="py-3 px-3 w-28">BODY #</th>
                <th className="py-3 px-3">DRIVER NAME</th>
                <th className="py-3 px-3 w-32 text-center">TOTAL TRIPS</th>
                <th className="py-3 px-4 w-36 text-right">LAST DISPATCH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60 text-sm">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-text-muted">
                    No active drivers recorded for {activeDate}.
                  </td>
                </tr>
              ) : (
                filteredList.map((driver, index) => {
                  return (
                    <tr
                      key={driver.driverId}
                      onClick={() => toggleReconciled(driver.driverId)}
                      className={cn(
                        "transition-all cursor-pointer group select-none",
                        driver.isReconciled
                          ? "bg-slate-50/80 text-text-muted opacity-60"
                          : "hover:bg-brand-soft/30 text-text-primary"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        {driver.isReconciled ? (
                          <CheckCircle2 className="w-5 h-5 text-status-success-text mx-auto" />
                        ) : (
                          <Circle className="w-5 h-5 text-border-subtle group-hover:text-brand-primary mx-auto transition-colors" />
                        )}
                      </td>

                      {/* Line Number */}
                      <td className="py-3 px-3 font-mono text-xs text-text-muted">
                        {index + 1}
                      </td>

                      {/* Body # */}
                      <td className="py-3 px-3">
                        <span
                          className={cn(
                            "font-mono font-extrabold text-xs px-2.5 py-1 rounded-xl border",
                            driver.isReconciled
                              ? "bg-slate-100 text-text-muted border-slate-200"
                              : "bg-slate-100 text-slate-800 border-slate-200"
                          )}
                        >
                          #{driver.bodyNumber}
                        </span>
                      </td>

                      {/* Driver Name & Photo */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          {driver.driverPhotoUrl ? (
                            <img
                              src={driver.driverPhotoUrl}
                              alt={driver.driverName}
                              className={cn(
                                "w-7 h-7 rounded-full object-cover ring-1 ring-border-subtle shrink-0",
                                driver.isReconciled && "grayscale"
                              )}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-surface-subtle flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 text-text-muted" />
                            </div>
                          )}
                          <span
                            className={cn(
                              "font-bold text-sm",
                              driver.isReconciled && "line-through text-text-muted"
                            )}
                          >
                            {driver.driverName}
                          </span>
                        </div>
                      </td>

                      {/* Total Trips */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "font-mono font-extrabold text-sm px-3 py-1 rounded-xl border",
                            driver.isReconciled
                              ? "bg-slate-100 text-text-muted border-slate-200"
                              : "bg-brand-soft text-brand-primary border-blue-200"
                          )}
                        >
                          {driver.totalTrips}x
                        </span>
                      </td>

                      {/* Last Dispatched */}
                      <td className="py-3 px-4 text-right font-mono text-xs text-text-muted">
                        {formatManilaTime(driver.lastLoggedAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
