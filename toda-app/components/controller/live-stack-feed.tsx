"use client";

import React, { useState, useMemo } from "react";
import type { DispatchLog } from "@/types/supabase";
import { formatManilaTime } from "@/lib/utils/format-timezone";

export interface StackFeedItem extends DispatchLog {
  body_number: string;
  driver_name: string;
  nickname?: string | null;
  driver_photo_url: string | null;
  global_seq?: number;
  route?: string | null;
  _optimistic?: boolean;
}

export interface LiveStackFeedProps {
  items: StackFeedItem[];
  onUndo: (item: StackFeedItem) => void;
  activeSheet?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  onSheetChange?: (sheet: number) => void;
  // Legacy compatibility props during rollout
  onUpdateRunCount?: (driverId: string, dispatchIds: number[], targetCount: number) => Promise<void>;
  onIncrement?: (driverId: string) => Promise<void>;
  activeEditingId?: string | number | null;
}

export function LiveStackFeed({
  items,
  onUndo,
  activeSheet: externalSheet,
  pageSize: externalPageSize,
  onPageSizeChange,
  onSheetChange,
}: LiveStackFeedProps) {
  const [internalPageSize, setInternalPageSize] = useState<number>(30);
  const [internalSheet, setInternalSheet] = useState<number>(1);

  const pageSize = externalPageSize !== undefined ? externalPageSize : internalPageSize;
  const currentSheet = externalSheet !== undefined ? externalSheet : internalSheet;

  const handlePageSizeChange = (size: number) => {
    setInternalPageSize(size);
    setInternalSheet(1);
    if (onPageSizeChange) onPageSizeChange(size);
    if (onSheetChange) onSheetChange(1);
  };

  const handleSheetChange = (sheet: number) => {
    setInternalSheet(sheet);
    if (onSheetChange) onSheetChange(sheet);
  };

  // Chronological items with sequential line numbers
  // Note: items from DB are ordered newest first (descending).
  // Total entries count
  const totalEntries = items.length;
  const totalSheets = Math.max(1, Math.ceil(totalEntries / pageSize));

  // Tally of non-voided dispatches
  const totalLaunches = useMemo(() => {
    return items
      .filter((i) => !i.is_voided)
      .reduce((sum, item) => sum + (item.launch_count || 1), 0);
  }, [items]);

  // Assign 1-based sequential line number to each item (1 = oldest, totalEntries = newest)
  // Since items are newest first: items[0] is line totalEntries, items[totalEntries - 1] is line 1.
  // Alternatively, list chronological order or display sheet slice.
  const sequencedItems = useMemo(() => {
    return items.map((item, idx) => {
      const lineNum = item.global_seq || (totalEntries - idx);
      return {
        ...item,
        lineNum,
      };
    });
  }, [items, totalEntries]);

  // Pagination bounds
  // Sheet 1 shows the latest page or page 1?
  // In Philippine TODA tally sheets: Sheet 1 is lines 1-30, Sheet 2 is lines 31-60.
  // When paginating:
  const startLine = (currentSheet - 1) * pageSize + 1;
  const endLine = startLine + pageSize - 1;

  // Filter items that fall within this sheet's line range [startLine, endLine]
  // and display newest at top of sheet
  const pageItems = useMemo(() => {
    return sequencedItems
      .filter((item) => item.lineNum >= startLine && item.lineNum <= endLine)
      .sort((a, b) => b.lineNum - a.lineNum);
  }, [sequencedItems, startLine, endLine]);

  return (
    <section className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-base text-slate-900">Past Inputs</h2>
            <span
              id="entries-count-badge"
              className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200"
            >
              {totalEntries} Entries
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Sequential ledger • Distinct entries per launch
          </p>
        </div>

        {/* Sheet Pagination Pill (Paginated per 30 / 50) */}
        <div className="flex items-center gap-2">
          {/* Page Size Selector: 30 vs 50 lines */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-mono font-bold border border-slate-200">
            <button
              id="page-size-30-btn"
              type="button"
              onClick={() => handlePageSizeChange(30)}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                pageSize === 30
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              30
            </button>
            <button
              id="page-size-50-btn"
              type="button"
              onClick={() => handlePageSizeChange(50)}
              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                pageSize === 50
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              50
            </button>
          </div>

          {/* Sheet Navigation Pill */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-0.5 text-xs font-medium shadow-xs">
            <button
              id="prev-sheet-btn"
              type="button"
              disabled={currentSheet <= 1}
              onClick={() => handleSheetChange(Math.max(1, currentSheet - 1))}
              className="px-1.5 py-0.5 text-slate-500 hover:text-slate-900 font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              ‹
            </button>
            <span id="sheet-label" className="px-2 text-slate-800 font-bold font-mono text-xs">
              Sheet {currentSheet} ({startLine}–{endLine})
            </span>
            <button
              id="next-sheet-btn"
              type="button"
              disabled={currentSheet >= totalSheets}
              onClick={() => handleSheetChange(Math.min(totalSheets, currentSheet + 1))}
              className="px-1.5 py-0.5 text-slate-500 hover:text-slate-900 font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Past Inputs Table: Scrollable within container */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200/80">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[11px] tracking-wider sticky top-0 border-b border-slate-200 z-10">
            <tr>
              <th className="py-2.5 px-3 w-12 font-mono text-center">Line</th>
              <th className="py-2.5 px-3 w-20 font-mono">Body No.</th>
              <th className="py-2.5 px-3">Driver Name</th>
              <th className="py-2.5 px-3 w-24">Route</th>
              <th className="py-2.5 px-3 w-20 text-center font-mono">Launches</th>
              <th className="py-2.5 px-3 w-20 font-mono text-xs">Time</th>
              <th className="py-2.5 px-3 w-16 text-right text-xs">Action</th>
            </tr>
          </thead>
          <tbody id="past-inputs-tbody" className="divide-y divide-slate-100 text-sm">
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-xs text-slate-400 font-medium">
                  No dispatches recorded on Sheet {currentSheet}
                </td>
              </tr>
            ) : (
              pageItems.map((item) => {
                const timeStr = item.logged_at
                  ? formatManilaTime(item.logged_at)
                  : "--:--";

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      item.is_voided ? "opacity-50 bg-slate-50/40" : ""
                    }`}
                  >
                    {/* Line sequence number */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-600 text-center">
                      {item.lineNum}
                    </td>

                    {/* Body Number */}
                    <td className="py-2.5 px-3 font-mono font-extrabold text-blue-600 text-xs">
                      #{item.body_number}
                    </td>

                    {/* Driver Name with Nickname */}
                    <td className="py-2.5 px-3 font-semibold text-slate-900 text-xs truncate">
                      {item.is_voided ? (
                        <span className="line-through">{item.driver_name}</span>
                      ) : (
                        <>
                          <span>{item.driver_name}</span>{" "}
                          {item.nickname && (
                            <span className="text-slate-400 text-[11px] italic font-normal">
                              (&quot;{item.nickname}&quot;)
                            </span>
                          )}
                        </>
                      )}
                    </td>

                    {/* Route */}
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                        {item.route || "Guinsay"}
                      </span>
                    </td>

                    {/* Launches: Clean neutral badge (NO YELLOWING) */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                        {item.launch_count}x
                      </span>
                    </td>

                    {/* Time */}
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-xs">
                      {timeStr}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right">
                      {item.is_voided ? (
                        <span className="text-[11px] font-bold text-slate-400">Voided</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUndo(item)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold hover:underline cursor-pointer"
                        >
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="shrink-0 pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>No collapsing of distinct launch IDs</span>
        <span id="total-trips-tally" className="font-mono font-bold text-slate-700 text-xs">
          Total: {totalLaunches} Launches
        </span>
      </div>
    </section>
  );
}
