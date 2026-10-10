"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useDriverCache } from "@/hooks/use-driver-cache";
import { logDispatch, voidDispatch, updateRunTripCount } from "@/lib/actions/dispatch-actions";
import { createClient } from "@/lib/supabase/client";
import { OmniboxSearch } from "./omnibox-search";
import { LiveStackFeed, type StackFeedItem } from "./live-stack-feed";
import { QuickDriverModal } from "./quick-driver-modal";
import { UndoConfirmModal } from "./undo-confirm-modal";
import { Loader2, WifiOff, AlertCircle } from "lucide-react";
import type { DispatchLog, DriverSummary } from "@/types/supabase";

const SHEET_SIZE = 90;

export function ControllerTerminal() {
  const { searchDrivers, isLoading: cacheLoading, totalDrivers } = useDriverCache();

  // Control sheet & feed state
  const [feed, setFeed] = useState<StackFeedItem[]>([]);
  const [activeSheet, setActiveSheet] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debounceActive, setDebounceActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [undoTarget, setUndoTarget] = useState<StackFeedItem | null>(null);
  const [quickRegisterPrefill, setQuickRegisterPrefill] = useState<string | null>(null);

  // Compute total pages based on max sequence (90 per sheet)
  const totalSheets = useMemo(() => {
    if (feed.length === 0) return 1;
    return Math.max(1, Math.ceil(feed.length / SHEET_SIZE));
  }, [feed]);

  // Load dispatches & subscribe to Supabase Realtime
  useEffect(() => {
    const supabase = createClient();
    let currentUserId: string | null = null;

    async function loadDispatches() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      currentUserId = user.id;

      const { data, error: fetchError } = await supabase
        .from("dispatch_logs")
        .select(
          `
          *,
          drivers (
            body_number,
            driver_profile_versions (
              full_name,
              driver_photo_url
            )
          )
        `
        )
        .eq("controller_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(180);

      if (fetchError) {
        console.error("Error loading dispatches:", fetchError);
        return;
      }

      if (data) {
        // Calculate global sequence (1..N ascending chronologically)
        const total = data.length;
        const items: StackFeedItem[] = data.map((d: Record<string, unknown>, idx: number) => {
          const drivers = d.drivers as {
            body_number: string;
            driver_profile_versions: Array<{
              full_name: string;
              driver_photo_url: string | null;
            }>;
          };
          return {
            ...(d as unknown as DispatchLog),
            body_number: drivers?.body_number || "???",
            driver_name:
              drivers?.driver_profile_versions?.[0]?.full_name || "Unknown",
            driver_photo_url:
              drivers?.driver_profile_versions?.[0]?.driver_photo_url || null,
            global_seq: total - idx,
          };
        });
        setFeed(items);
      }
    }

    loadDispatches();

    // Subscribe to realtime changes on dispatch_logs
    const channel = supabase
      .channel("controller-sheet-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dispatch_logs" },
        (payload) => {
          const row = (payload.new || payload.old) as { controller_id?: string };
          if (!row || !currentUserId || row.controller_id === currentUserId) {
            loadDispatches();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle instant 1-key dispatch from Omnibox
  const handleDispatchDriver = useCallback(
    async (driver: DriverSummary, launchCount = 1) => {
      if (debounceActive || isSubmitting) return;

      if (driver.status !== "active") {
        setError(`Driver #${driver.body_number} is ${driver.status}. Cannot dispatch.`);
        return;
      }

      setIsSubmitting(true);
      setDebounceActive(true);
      setError(null);

      const tempId = Date.now();
      const optimisticItem: StackFeedItem = {
        id: tempId,
        driver_id: driver.id,
        controller_id: "",
        launch_count: launchCount,
        logged_at: new Date().toISOString(),
        is_voided: false,
        voided_at: null,
        voided_by: null,
        void_reason: null,
        body_number: driver.body_number,
        driver_name: driver.full_name,
        driver_photo_url: driver.driver_photo_url,
        global_seq: feed.length + 1,
        _optimistic: true,
      };

      // Add to feed immediately
      setFeed((prev) => [optimisticItem, ...prev]);

      try {
        const result = await logDispatch({
          driver_id: driver.id,
          launch_count: launchCount,
        });

        if (!result.success) {
          console.error("Dispatch failed:", result.error);
          setError(result.error || "Failed to log dispatch");
          // Remove optimistic item
          setFeed((prev) => prev.filter((item) => item.id !== tempId));
        } else if (result.data) {
          // Replace with real database row
          setFeed((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    ...(result.data as unknown as Partial<StackFeedItem>),
                    _optimistic: false,
                  }
                : item
            )
          );
        }
      } catch (err) {
        console.error("Network or dispatch error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Network error. Entry may not have been saved."
        );
        setFeed((prev) => prev.filter((item) => item.id !== tempId));
      } finally {
        setIsSubmitting(false);
        // 1500ms debounce per INV-DISP-03
        setTimeout(() => setDebounceActive(false), 1500);
      }
    },
    [debounceActive, isSubmitting, feed.length]
  );

  // Handle in-place trip adjustments from stepper
  const handleUpdateRunCount = useCallback(
    async (driverId: string, dispatchIds: number[], targetCount: number) => {
      try {
        const res = await updateRunTripCount({
          driver_id: driverId,
          dispatch_ids: dispatchIds,
          target_count: targetCount,
        });

        if (!res.success) {
          setError(res.error || "Failed to update trip count");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error updating trips");
      }
    },
    []
  );

  // Handle 2-minute soft-undo
  const handleUndo = useCallback(
    async (reason: string) => {
      if (!undoTarget) return;

      const result = await voidDispatch({
        dispatch_id: undoTarget.id,
        void_reason: reason,
      });

      if (result.success) {
        setFeed((prev) =>
          prev.map((item) =>
            item.id === undoTarget.id
              ? {
                  ...item,
                  is_voided: true,
                  voided_at: new Date().toISOString(),
                  void_reason: reason,
                }
              : item
          )
        );
      } else {
        setError(result.error || "Failed to void entry");
      }
      setUndoTarget(null);
    },
    [undoTarget]
  );

  if (cacheLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        <p className="text-sm font-semibold text-text-secondary">
          Loading driver roster...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-4 font-sans">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-status-success-text rounded-full animate-pulse-soft" />
          <span className="text-xs font-bold text-text-secondary">
            {totalDrivers} Drivers Cached
          </span>
          <span className="text-xs text-text-muted">• Sub-5ms Instant Lookup</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-text-muted">
          <span>
            {new Date().toLocaleTimeString("en-PH", {
              timeZone: "Asia/Manila",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            GMT+8
          </span>
        </div>
      </div>

      {/* Hero Omnibox Search Bar (Inspired by DONOTPUSH attendance system) */}
      <OmniboxSearch
        onDispatch={(driver) => handleDispatchDriver(driver, 1)}
        onOpenQuickRegister={(prefill) => setQuickRegisterPrefill(prefill)}
        searchDrivers={searchDrivers}
        pagination={{
          currentPage: activeSheet,
          totalPages: totalSheets,
          onPageChange: (page) => setActiveSheet(page),
        }}
        isSubmitting={isSubmitting}
      />

      {/* Error Banner */}
      {error && (
        <div className="max-w-3xl mx-auto p-3.5 rounded-2xl bg-status-danger-bg text-status-danger-text text-xs font-semibold flex items-center justify-between gap-2 animate-scale-in">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Stack Control Sheet (90 Lines / Sheet) */}
      <LiveStackFeed
        items={feed}
        activeSheet={activeSheet}
        onUndo={(item) => setUndoTarget(item)}
        onUpdateRunCount={handleUpdateRunCount}
        onIncrement={async (driverId) => {
          const match = feed.find((f) => f.driver_id === driverId);
          if (match) {
            handleDispatchDriver(
              {
                id: match.driver_id,
                body_number: match.body_number,
                full_name: match.driver_name,
                driver_photo_url: match.driver_photo_url,
                status: "active",
              },
              1
            );
          }
        }}
      />

      {/* Quick Driver Registration Modal */}
      <QuickDriverModal
        isOpen={quickRegisterPrefill !== null}
        onClose={() => setQuickRegisterPrefill(null)}
        prefillQuery={quickRegisterPrefill || ""}
        onSuccessDispatch={() => {
          setQuickRegisterPrefill(null);
        }}
      />

      {/* 2-Minute Undo Confirmation Modal */}
      {undoTarget && (
        <UndoConfirmModal
          dispatch={undoTarget}
          onConfirm={handleUndo}
          onCancel={() => setUndoTarget(null)}
        />
      )}
    </div>
  );
}
