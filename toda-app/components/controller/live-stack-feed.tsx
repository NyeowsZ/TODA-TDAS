"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { DispatchLog } from "@/types/supabase";
import { useGraceTimer } from "@/hooks/use-grace-timer";
import { formatManilaTime } from "@/lib/utils/format-timezone";
import { cn } from "@/lib/utils";
import { User, Undo2, RotateCcw, Plus, Minus, AlertTriangle } from "lucide-react";

export interface StackFeedItem extends DispatchLog {
  body_number: string;
  driver_name: string;
  driver_photo_url: string | null;
  global_seq?: number;
  _optimistic?: boolean;
}

export interface GroupedDispatchRun {
  runId: string | number;
  driverId: string;
  bodyNumber: string;
  driverName: string;
  driverPhotoUrl: string | null;
  count: number;
  globalSequences: number[];
  latestLoggedAt: string;
  isVoided: boolean;
  voidReason: string | null;
  dispatchIds: number[];
  feedItems: StackFeedItem[];
}

interface LiveStackFeedProps {
  items: StackFeedItem[];
  activeSheet?: number;
  onUndo: (item: StackFeedItem) => void;
  onUpdateRunCount?: (driverId: string, dispatchIds: number[], targetCount: number) => Promise<void>;
  onIncrement?: (driverId: string) => Promise<void>;
  activeEditingId?: string | number | null;
}

const SHEET_SIZE = 90;

export function LiveStackFeed({
  items,
  activeSheet = 1,
  onUndo,
  onUpdateRunCount,
  onIncrement,
  activeEditingId,
}: LiveStackFeedProps) {
  // In-line trip editing state
  const [editingRunId, setEditingRunId] = useState<string | number | null>(null);
  const [editCountValue, setEditCountValue] = useState<string>("1");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Filter items for current sheet (90 entries per sheet)
  const displayedItems = useMemo(() => {
    return items.filter((item, idx) => {
      // Use 1-based index or global sequence
      const seq = item.global_seq || (items.length - idx);
      const sheet = Math.ceil(seq / SHEET_SIZE);
      return sheet === activeSheet;
    });
  }, [items, activeSheet]);

  // Group consecutive runs of the same driver
  const runs = useMemo(() => {
    const list: GroupedDispatchRun[] = [];
    let currentRun: GroupedDispatchRun | null = null;

    // Items are ordered newest first (descending)
    items.forEach((item, index) => {
      const seq = item.global_seq || (items.length - index);
      const sheet = Math.ceil(seq / SHEET_SIZE);

      if (sheet !== activeSheet) return;

      if (!currentRun || currentRun.driverId !== item.driver_id || currentRun.isVoided !== item.is_voided) {
        if (currentRun) list.push(currentRun);
        currentRun = {
          runId: item.id,
          driverId: item.driver_id,
          bodyNumber: item.body_number,
          driverName: item.driver_name,
          driverPhotoUrl: item.driver_photo_url,
          count: item.launch_count,
          globalSequences: [seq],
          latestLoggedAt: item.logged_at,
          isVoided: item.is_voided,
          voidReason: item.void_reason,
          dispatchIds: [item.id],
          feedItems: [item],
        };
      } else {
        currentRun.count += item.launch_count;
        currentRun.globalSequences.push(seq);
        currentRun.dispatchIds.push(item.id);
        currentRun.feedItems.push(item);
      }
    });

    if (currentRun) list.push(currentRun);
    return list;
  }, [items, activeSheet]);

  // Total trips summary
  const totalTrips = useMemo(() => {
    return items.filter((i) => !i.is_voided).reduce((sum, i) => sum + i.launch_count, 0);
  }, [items]);

  // Focus input when editingRunId is active
  useEffect(() => {
    if (editingRunId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingRunId]);

  if (items.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex p-4 rounded-full bg-surface-subtle text-text-muted mb-3">
          <RotateCcw className="w-8 h-8 opacity-40" />
        </div>
        <h3 className="text-base font-bold text-text-primary">
          No dispatches logged yet today
        </h3>
        <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
          Type a body number or driver name in the search box above and press{" "}
          <kbd className="px-1.5 py-0.5 bg-surface-subtle rounded border font-mono font-bold text-text-primary">
            Enter
          </kbd>{" "}
          to dispatch immediately.
        </p>
      </div>
    );
  }

  const handleTripInputKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>,
    run: GroupedDispatchRun
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = parseInt(editCountValue);
      if (!isNaN(val) && val > 0 && val !== run.count) {
        await onUpdateRunCount?.(run.driverId, run.dispatchIds, val);
      }
      setEditingRunId(null);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setEditingRunId(null);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const val = parseInt(editCountValue) || 1;
      setEditCountValue(String(val + 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const val = parseInt(editCountValue) || 1;
      if (val > 1) setEditCountValue(String(val - 1));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 pb-12">
      {/* Control Sheet Card */}
      <div className="bg-white rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        {/* Table Top Header / Status Bar */}
        <div className="px-5 py-3.5 bg-surface-subtle/60 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-extrabold text-text-primary uppercase tracking-wider">
              Control Sheet — Sheet {activeSheet}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-soft text-brand-primary border border-blue-200 font-mono">
              {totalTrips} Total Launches
            </span>
            <span className="text-xs font-semibold text-text-muted font-mono">
              {runs.length} Grouped Runs
            </span>
          </div>

          <div className="text-[11px] font-mono text-text-muted hidden sm:block">
            Enter body # ↵ dispatch • Stepper to adjust launches
          </div>
        </div>

        {/* Tabular Control Sheet Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-subtle/30 border-b border-border-subtle text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4 w-28">SEQ / LINE</th>
                <th className="py-3 px-3 w-28">BODY #</th>
                <th className="py-3 px-3">DRIVER NAME</th>
                <th className="py-3 px-3 w-36 text-center">LAUNCHES</th>
                <th className="py-3 px-3 w-28 text-center">TIME</th>
                <th className="py-3 px-4 w-36 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60 text-sm">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-text-muted">
                    No dispatches recorded on Sheet {activeSheet} yet.
                  </td>
                </tr>
              ) : (
                runs.map((run, index) => {
                  const minSeq = Math.min(...run.globalSequences);
                  const maxSeq = Math.max(...run.globalSequences);
                  const isMulti = minSeq !== maxSeq;

                  // Line on sheet (1..90)
                  const minLine = ((minSeq - 1) % SHEET_SIZE) + 1;
                  const maxLine = ((maxSeq - 1) % SHEET_SIZE) + 1;

                  const isEditingThis = editingRunId === run.runId;
                  const isLatest = index === 0;

                  return (
                    <RunRow
                      key={`${run.runId}-${index}`}
                      run={run}
                      minLine={minLine}
                      maxLine={maxLine}
                      isMulti={isMulti}
                      isLatest={isLatest}
                      isEditingThis={isEditingThis}
                      editCountValue={editCountValue}
                      setEditCountValue={setEditCountValue}
                      editInputRef={editInputRef}
                      onStartEdit={() => {
                        setEditingRunId(run.runId);
                        setEditCountValue(String(run.count));
                      }}
                      onTripInputKeyDown={(e) => handleTripInputKeyDown(e, run)}
                      onIncrement={() => onIncrement?.(run.driverId)}
                      onUpdateRunCount={(target) =>
                        onUpdateRunCount?.(run.driverId, run.dispatchIds, target)
                      }
                      onUndoClick={() => onUndo(run.feedItems[0])}
                    />
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

function RunRow({
  run,
  minLine,
  maxLine,
  isMulti,
  isLatest,
  isEditingThis,
  editCountValue,
  setEditCountValue,
  editInputRef,
  onStartEdit,
  onTripInputKeyDown,
  onIncrement,
  onUpdateRunCount,
  onUndoClick,
}: {
  run: GroupedDispatchRun;
  minLine: number;
  maxLine: number;
  isMulti: boolean;
  isLatest: boolean;
  isEditingThis: boolean;
  editCountValue: string;
  setEditCountValue: (val: string) => void;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onStartEdit: () => void;
  onTripInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onIncrement: () => void;
  onUpdateRunCount: (target: number) => void;
  onUndoClick: () => void;
}) {
  const latestItem = run.feedItems[0];
  const { isWithinGrace, formattedTime } = useGraceTimer(run.latestLoggedAt);

  return (
    <tr
      className={cn(
        "transition-colors group",
        run.isVoided
          ? "bg-rose-50/40 opacity-60"
          : isEditingThis
          ? "bg-brand-soft/70 ring-1 ring-brand-primary"
          : isLatest
          ? "bg-blue-50/20 hover:bg-blue-50/40"
          : "hover:bg-surface-subtle/50"
      )}
    >
      {/* 1. Line on Sheet (1..90) */}
      <td className="py-3 px-4">
        {isMulti ? (
          <span className="font-mono text-xs font-bold text-brand-primary bg-brand-soft border border-blue-200 px-2 py-0.5 rounded-lg">
            {minLine} – {maxLine}
          </span>
        ) : (
          <span className="font-mono text-xs font-bold text-text-primary bg-surface-subtle border border-border-subtle px-2.5 py-0.5 rounded-lg">
            {minLine}
          </span>
        )}
      </td>

      {/* 2. Body # */}
      <td className="py-3 px-3">
        <span className="font-mono font-extrabold text-xs bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-xl">
          #{run.bodyNumber}
        </span>
      </td>

      {/* 3. Driver Name & Photo */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-2.5">
          {run.driverPhotoUrl ? (
            <img
              src={run.driverPhotoUrl}
              alt={run.driverName}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-border-subtle shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-surface-subtle flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-text-muted" />
            </div>
          )}
          <span
            className={cn(
              "font-bold text-sm truncate",
              run.isVoided ? "line-through text-text-muted" : "text-text-primary"
            )}
          >
            {run.driverName}
          </span>
        </div>
      </td>

      {/* 4. Interactive Launches Stepper [ - ] [ count ] [ + ] */}
      <td className="py-3 px-3 text-center">
        {run.isVoided ? (
          <span className="text-xs font-mono font-bold text-status-danger-text px-2 py-0.5 bg-rose-100/60 rounded-md">
            VOIDED
          </span>
        ) : (
          <div className="inline-flex items-center rounded-xl border border-border-subtle bg-surface-subtle/80 p-0.5 shadow-xs">
            {/* Decrement Button */}
            <button
              type="button"
              onClick={() => {
                if (run.count > 1) {
                  onUpdateRunCount(run.count - 1);
                } else if (isWithinGrace) {
                  onUndoClick();
                }
              }}
              title={run.count > 1 ? "Remove 1 launch" : "Undo dispatch"}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-rose-50 hover:text-rose-600 text-text-secondary font-bold text-sm transition-all border border-border-subtle active:scale-95 cursor-pointer shadow-xs"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Editable Trip Count Box */}
            {isEditingThis ? (
              <input
                ref={editInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editCountValue}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  setEditCountValue(digits);
                }}
                onKeyDown={onTripInputKeyDown}
                className="w-11 text-center font-mono font-extrabold text-sm bg-white border border-brand-primary rounded-lg px-1 py-0.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary shadow-xs"
              />
            ) : (
              <span
                onClick={onStartEdit}
                title="Click to edit launch count"
                className="font-mono font-extrabold text-text-primary min-w-[32px] text-center text-sm cursor-pointer hover:bg-surface-subtle px-1.5 py-0.5 rounded-md transition-colors"
              >
                {run.count}x
              </span>
            )}

            {/* Increment Button */}
            <button
              type="button"
              onClick={() => {
                if (onIncrement) onIncrement();
                else onUpdateRunCount(run.count + 1);
              }}
              title="Add 1 launch"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-blue-50 hover:text-brand-primary text-text-secondary font-bold text-sm transition-all border border-border-subtle active:scale-95 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>

      {/* 5. Timestamp (Manila Time) */}
      <td className="py-3 px-3 text-center">
        <span className="font-mono text-xs text-text-muted">
          {formatManilaTime(run.latestLoggedAt)}
        </span>
      </td>

      {/* 6. Action / Undo within 2-Minute Window */}
      <td className="py-3 px-4 text-right">
        {run.isVoided ? (
          <span className="text-[11px] font-mono text-text-muted italic truncate block max-w-[140px] ml-auto">
            {run.voidReason || "Voided"}
          </span>
        ) : isWithinGrace ? (
          <button
            type="button"
            onClick={onUndoClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-status-danger-text bg-status-danger-bg hover:bg-rose-100 rounded-full border border-rose-200 transition-all active:scale-95 cursor-pointer"
            title="Undo this dispatch (2-minute window)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo ({formattedTime})
          </button>
        ) : (
          <span className="text-[11px] font-mono text-text-muted">
            Logged
          </span>
        )}
      </td>
    </tr>
  );
}
