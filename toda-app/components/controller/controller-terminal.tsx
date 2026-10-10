"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useDriverCache } from "@/hooks/use-driver-cache";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { logDispatch, voidDispatch } from "@/lib/actions/dispatch-actions";
import { createClient } from "@/lib/supabase/client";
import { DriverMatchCard } from "./driver-match-card";
import { RecentFeed } from "./recent-feed";
import { UndoConfirmModal } from "./undo-confirm-modal";
import { DispatchKeypad } from "./dispatch-keypad";
import { Loader2, WifiOff } from "lucide-react";
import type { DispatchLog } from "@/types/supabase";

interface FeedItem extends DispatchLog {
  body_number: string;
  driver_name: string;
  driver_photo_url: string | null;
  _optimistic?: boolean;
}

export function ControllerTerminal() {
  const { lookupByBodyNumber, searchByPrefix, isLoading: cacheLoading, totalDrivers } = useDriverCache();

  const [bodyNumber, setBodyNumber] = useState("");
  const [launchCount, setLaunchCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debounceActive, setDebounceActive] = useState(false);
  const [showSanityConfirm, setShowSanityConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);

  // Feed state (top 50)
  const [feed, setFeed] = useState<FeedItem[]>([]);

  // Undo modal state
  const [undoTarget, setUndoTarget] = useState<FeedItem | null>(null);

  const bodyInputRef = useRef<HTMLInputElement>(null);
  const launchInputRef = useRef<HTMLInputElement>(null);

  // Matched driver from cache
  const matchedDriver = bodyNumber.trim()
    ? lookupByBodyNumber(bodyNumber.trim())
    : null;
  const suggestions = bodyNumber.trim()
    ? searchByPrefix(bodyNumber.trim())
    : [];

  // Load initial feed & subscribe to Realtime
  useEffect(() => {
    const supabase = createClient();
    let currentUserId: string | null = null;

    async function loadFeed() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      currentUserId = user.id;

      const { data, error: loadError } = await supabase
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
        .limit(50);

      if (loadError) {
        console.error("loadFeed error:", loadError);
        return;
      }

      if (data) {
        const items: FeedItem[] = data.map((d: Record<string, unknown>) => {
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
          };
        });
        setFeed(items);
      }
    }

    loadFeed();

    // Subscribe to realtime dispatch updates for this booth
    const channel = supabase
      .channel("controller-feed-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dispatch_logs" },
        (payload) => {
          const row = (payload.new || payload.old) as { controller_id?: string };
          if (!row || !currentUserId || row.controller_id === currentUserId) {
            loadFeed();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-focus body number input
  useEffect(() => {
    if (bodyInputRef.current && !showSanityConfirm && !undoTarget) {
      bodyInputRef.current.focus();
    }
  }, [showSanityConfirm, undoTarget, isSubmitting]);

  const resetForm = useCallback(() => {
    setBodyNumber("");
    setLaunchCount(1);
    setError(null);
    setShowSanityConfirm(false);
    setTimeout(() => bodyInputRef.current?.focus(), 50);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (debounceActive || isSubmitting) return;
    if (!matchedDriver) return;
    if (matchedDriver.status !== "active") return;

    // Sanity check for launch count > 10
    if (launchCount > 10 && !showSanityConfirm) {
      setShowSanityConfirm(true);
      return;
    }

    setIsSubmitting(true);
    setDebounceActive(true);
    setError(null);

    const tempId = Date.now();
    // Optimistic feed update
    const optimisticItem: FeedItem = {
      id: tempId,
      driver_id: matchedDriver.id,
      controller_id: "",
      launch_count: launchCount,
      logged_at: new Date().toISOString(),
      is_voided: false,
      voided_at: null,
      voided_by: null,
      void_reason: null,
      body_number: matchedDriver.body_number,
      driver_name: matchedDriver.full_name,
      driver_photo_url: matchedDriver.driver_photo_url,
      _optimistic: true,
    };

    setFeed((prev) => [optimisticItem, ...prev].slice(0, 50));

    try {
      const result = await logDispatch({
        driver_id: matchedDriver.id,
        launch_count: launchCount,
      });

      if (!result.success) {
        console.error("Dispatch failed:", result.error);
        setError(result.error || "Failed to log dispatch");
        // Remove optimistic item on failure
        setFeed((prev) => prev.filter((item) => item.id !== tempId));
      } else {
        // True success! Flash green
        setSuccessFlash(true);
        setTimeout(() => setSuccessFlash(false), 1000);

        if (result.data) {
          // Replace optimistic item with real data
          setFeed((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    ...(result.data as unknown as Partial<FeedItem>),
                    _optimistic: false,
                  }
                : item
            )
          );
        }

        // Reset inputs on success only
        setBodyNumber("");
        setLaunchCount(1);
        setShowSanityConfirm(false);
        setTimeout(() => bodyInputRef.current?.focus(), 50);
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
  }, [
    debounceActive,
    isSubmitting,
    matchedDriver,
    launchCount,
    showSanityConfirm,
  ]);

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

  // Keyboard navigation
  useKeyboardNav({
    onEnter: handleSubmit,
    onEscape: resetForm,
    onTab: () => launchInputRef.current?.focus(),
    enabled: !undoTarget,
  });

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
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Roster Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-status-success-text rounded-full animate-pulse-soft" />
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            {totalDrivers} drivers cached
          </span>
        </div>
        <span className="font-mono text-[11px] text-text-muted">
          {new Date().toLocaleTimeString("en-PH", {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          GMT+8
        </span>
      </div>

      {/* Body Number Search */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider pl-3">
          Body Number
        </label>
        <div
          className={`flex items-center bg-surface-subtle rounded-2xl px-4 py-3.5 transition-all focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-brand-primary focus-within:shadow-sm ${
            successFlash ? "ring-2 ring-status-success-text" : ""
          }`}
        >
          <span className="text-text-muted font-mono font-bold mr-1">#</span>
          <input
            ref={bodyInputRef}
            type="text"
            inputMode="numeric"
            name="body_number"
            value={bodyNumber}
            onChange={(e) => {
              setBodyNumber(e.target.value);
              setShowSanityConfirm(false);
              setError(null);
            }}
            placeholder="e.g. 042"
            className="w-full bg-transparent text-lg font-bold font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
            autoFocus
            autoComplete="off"
          />
        </div>
      </div>

      {/* Driver Match Card */}
      {bodyNumber.trim() && (
        <div className="animate-scale-in">
          <DriverMatchCard
            driver={matchedDriver || null}
            suggestions={suggestions}
            query={bodyNumber}
            onSelect={(bn) => setBodyNumber(bn)}
          />
        </div>
      )}

      {/* Launch Count & Submit */}
      {matchedDriver && matchedDriver.status === "active" && (
        <div className="space-y-4 animate-slide-up">
          <DispatchKeypad
            launchCount={launchCount}
            setLaunchCount={setLaunchCount}
            launchInputRef={launchInputRef}
          />

          {/* Sanity Warning */}
          {showSanityConfirm && (
            <div className="bg-status-warning-bg rounded-2xl p-4 border border-amber-200 animate-scale-in">
              <p className="text-sm font-bold text-status-warning-text mb-3">
                Confirm {launchCount} launches for Body #{matchedDriver.body_number}?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="flex-1 h-11 bg-status-warning-text text-white font-bold text-sm rounded-full transition-all active:scale-[0.98]"
                >
                  Yes, Confirm
                </button>
                <button
                  onClick={() => setShowSanityConfirm(false)}
                  className="flex-1 h-11 bg-surface-subtle text-text-secondary font-bold text-sm rounded-full transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          {!showSanityConfirm && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || debounceActive}
              className="w-full h-14 bg-brand-primary hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold rounded-full shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : debounceActive ? (
                "Wait..."
              ) : (
                `Log ${launchCount}x Dispatch (Enter)`
              )}
            </button>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-status-danger-bg text-status-danger-text text-xs font-semibold px-4 py-3 rounded-2xl animate-scale-in flex items-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Recent Feed */}
      <RecentFeed
        items={feed}
        onUndo={(item) => setUndoTarget(item)}
      />

      {/* Undo Modal */}
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
