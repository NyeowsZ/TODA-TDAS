"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useDriverCache } from "@/hooks/use-driver-cache";
import { logDispatch, voidDispatch } from "@/lib/actions/dispatch-actions";
import { createClient } from "@/lib/supabase/client";
import { OmniboxSearch } from "./omnibox-search";
import { RouteSelector } from "./route-selector";
import { DriverInfoPanel } from "./driver-info-panel";
import { LiveStackFeed, type StackFeedItem } from "./live-stack-feed";
import { QuickDriverModal } from "./quick-driver-modal";
import { UndoConfirmModal } from "./undo-confirm-modal";
import { Loader2, AlertCircle } from "lucide-react";
import type { DispatchLog, DriverSummary } from "@/types/supabase";

export function ControllerTerminal() {
  const { searchDrivers, isLoading: cacheLoading, totalDrivers } = useDriverCache();

  // 3-Card focus step: "omnibox" -> "route" -> "amount"
  const [focusStep, setFocusStep] = useState<"omnibox" | "route" | "amount">("omnibox");
  const [selectedDriver, setSelectedDriver] = useState<DriverSummary | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>("Guinsay");

  // Control sheet & feed state
  const [feed, setFeed] = useState<StackFeedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debounceActive, setDebounceActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Manila clock
  const [currentTime, setCurrentTime] = useState<string>("");

  // Modals state
  const [undoTarget, setUndoTarget] = useState<StackFeedItem | null>(null);
  const [quickRegisterPrefill, setQuickRegisterPrefill] = useState<string | null>(null);

  // Load last-used route from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dacotoda_last_route");
      if (saved) {
        setSelectedRoute(saved);
      }
    } catch (_) {}
  }, []);

  // Update live clock
  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-PH", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

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
        .limit(200);

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
            route: (d.route as string) || "Guinsay",
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

  // Compute total trips today for the selected driver
  const driverTripsToday = useMemo(() => {
    if (!selectedDriver) return 0;
    return feed
      .filter((f) => f.driver_id === selectedDriver.id && !f.is_voided)
      .reduce((sum, item) => sum + (item.launch_count || 1), 0);
  }, [feed, selectedDriver]);

  // Handle final dispatch submission
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
        route: selectedRoute,
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
          route: selectedRoute,
        });

        if (!result.success) {
          console.error("Dispatch failed:", result.error);
          setError(result.error || "Failed to log dispatch");
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
        // Reset focus back to Omnibox
        setFocusStep("omnibox");
        setTimeout(() => setDebounceActive(false), 500);
      }
    },
    [debounceActive, isSubmitting, feed.length, selectedRoute]
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
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">
          Loading driver roster...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-[100dvh] overflow-hidden p-3 md:p-4 flex flex-col bg-slate-100 text-slate-800 antialiased font-sans">
      {/* Header (Compact Fixed Top) */}
      <header className="shrink-0 bg-white border border-slate-200/90 rounded-2xl px-5 py-2.5 mb-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-base shadow-xs">
            DA
          </div>
          <div>
            <h1 className="font-extrabold text-base text-slate-900 leading-tight">
              DACOTODA Dispatch Terminal
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              3-Stack Flow: Omnibox → Route Box (←/→) → Driver Info / Launch Num
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* 3-Step Flow Indicator */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs">
              Omnibox →{" "}
              <kbd className="bg-white border px-1 py-0.5 rounded text-[10px] font-mono font-bold">
                ↵
              </kbd>{" "}
              → Route (←/→) →{" "}
              <kbd className="bg-white border px-1 py-0.5 rounded text-[10px] font-mono font-bold">
                ↵
              </kbd>{" "}
              → Amount →{" "}
              <kbd className="bg-white border px-1 py-0.5 rounded text-[10px] font-mono font-bold">
                ↵
              </kbd>
            </span>
          </div>

          {/* Driver Cache Indicator */}
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{totalDrivers} Cached</span>
          </div>

          {/* Live Manila Clock */}
          <div className="text-xs font-mono text-slate-600 font-bold bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
            {currentTime || "--:--:--"} GMT+8
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="shrink-0 mb-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2 animate-scale-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs hover:underline cursor-pointer font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Strict 100dvh Fit */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch overflow-hidden">
        {/* LEFT COLUMN: Past Inputs (7 of 12 cols, Internal Scroll Only) */}
        <LiveStackFeed
          items={feed}
          onUndo={(item) => setUndoTarget(item)}
        />

        {/* RIGHT COLUMN: 3-CARD VERTICAL STACK (5 of 12 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-3 h-full min-h-0">
          {/* Card 1: Omnibox */}
          <OmniboxSearch
            isActive={focusStep === "omnibox"}
            searchDrivers={searchDrivers}
            selectedDriver={selectedDriver}
            onDriverSelect={(driver) => setSelectedDriver(driver)}
            onAdvanceToRoute={(driver) => {
              setSelectedDriver(driver);
              setFocusStep("route");
            }}
            onLockoutAlert={(msg) => setError(msg)}
            onOpenQuickRegister={(prefill) => setQuickRegisterPrefill(prefill)}
          />

          {/* Card 2: Route Selector */}
          <RouteSelector
            isActive={focusStep === "route"}
            selectedRoute={selectedRoute}
            onRouteChange={(route) => setSelectedRoute(route)}
            onAdvance={() => setFocusStep("amount")}
            onBackToOmnibox={() => setFocusStep("omnibox")}
          />

          {/* Card 3: Driver Info + Launch Amount */}
          <DriverInfoPanel
            isActive={focusStep === "amount"}
            driver={selectedDriver}
            selectedRoute={selectedRoute}
            tripsToday={driverTripsToday}
            isSubmitting={isSubmitting}
            onDispatch={(driver, amount) => handleDispatchDriver(driver, amount)}
            onBackToRoute={() => setFocusStep("route")}
          />
        </section>
      </main>

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
