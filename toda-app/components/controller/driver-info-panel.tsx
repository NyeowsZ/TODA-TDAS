"use client";

import React, { useState, useEffect, useRef } from "react";
import type { DriverSummary } from "@/types/supabase";
import { parseDriverName } from "./omnibox-search";
import { User, AlertTriangle, AlertCircle, Check, Loader2 } from "lucide-react";
import Image from "next/image";

export interface DriverInfoPanelProps {
  isActive: boolean;
  driver: DriverSummary | null;
  selectedRoute: string;
  tripsToday?: number;
  rowNumber?: number | string;
  isSubmitting?: boolean;
  onDispatch: (driver: DriverSummary, amount: number) => Promise<void> | void;
  onBackToRoute: () => void;
  amountInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function DriverInfoPanel({
  isActive,
  driver,
  selectedRoute,
  tripsToday = 0,
  rowNumber = "--",
  isSubmitting = false,
  onDispatch,
  onBackToRoute,
  amountInputRef: externalAmountRef,
}: DriverInfoPanelProps) {
  const [amount, setAmount] = useState<string>("1");
  const [isLocked, setIsLocked] = useState(false);
  const [showLoggedNotice, setShowLoggedNotice] = useState(false);
  const [readyForEnter, setReadyForEnter] = useState(false);

  const internalAmountRef = useRef<HTMLInputElement>(null);
  const amountRef = externalAmountRef || internalAmountRef;

  // Auto-focus and auto-select value "1" on becoming active
  useEffect(() => {
    if (isActive) {
      setAmount("1");
      setReadyForEnter(false);

      // Arm Enter only after user releases key from Route Selector
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          setTimeout(() => {
            setReadyForEnter(true);
          }, 80);
          window.removeEventListener("keyup", handleKeyUp);
        }
      };
      window.addEventListener("keyup", handleKeyUp);

      const timer = setTimeout(() => {
        setReadyForEnter(true);
      }, 300);

      const focusTimer = setTimeout(() => {
        if (amountRef.current) {
          amountRef.current.focus();
          amountRef.current.select();
        }
      }, 50);

      return () => {
        window.removeEventListener("keyup", handleKeyUp);
        clearTimeout(timer);
        clearTimeout(focusTimer);
      };
    } else {
      setReadyForEnter(false);
    }
  }, [isActive, amountRef]);

  const parsed = driver ? parseDriverName(driver.full_name) : null;
  const isSuspended = driver?.status === "suspended";
  const isInactive = driver?.status === "inactive";
  const isBlocked = isSuspended || isInactive || !driver;

  const handleExecuteDispatch = async () => {
    if (isLocked || isSubmitting || !driver || isBlocked) return;

    const parsedCount = parseInt(amount, 10);
    const validCount = isNaN(parsedCount) || parsedCount < 1 ? 1 : parsedCount;

    setIsLocked(true);
    setShowLoggedNotice(true);

    try {
      await onDispatch(driver, validCount);
    } finally {
      setTimeout(() => {
        setIsLocked(false);
        setShowLoggedNotice(false);
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!readyForEnter) return;
      handleExecuteDispatch();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onBackToRoute();
    }
  };

  return (
    <div
      id="dispatch-container-card"
      className={`flex-1 min-h-0 bg-white rounded-2xl p-3.5 shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden ${
        isActive
          ? "border-2 border-blue-600 ring-4 ring-blue-50"
          : "border border-slate-200"
      }`}
    >
      {/* Top Header: Driver Info & Status Badge */}
      <div className="min-h-0 flex-1 flex flex-col justify-between">
        <div className="shrink-0 flex items-center justify-between pb-1.5 border-b border-slate-100 mb-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Driver Info
          </span>

          {/* Status Badge: ONLY shown when Inactive or Suspended (Never when Active) */}
          <div>
            {isSuspended && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white px-2.5 py-0.5 rounded-full shadow-xs animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                SUSPENDED
              </span>
            )}
            {isInactive && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                INACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Profile Card (Full dynamic light-up for Suspended vs Inactive vs Active) */}
        <div
          id="driver-profile-card"
          className={`p-2.5 rounded-xl shadow-xs transition-all duration-200 flex flex-col gap-2 ${
            isSuspended
              ? "bg-rose-50 border-2 border-rose-500 ring-4 ring-rose-100 shadow-sm"
              : isInactive
              ? "bg-amber-50 border-2 border-amber-500 ring-4 ring-amber-100 shadow-sm"
              : "bg-slate-50/90 border border-slate-200/90"
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Avatar Container (72px x 72px) */}
            <div
              className={`w-18 h-18 sm:w-20 sm:h-20 rounded-xl shrink-0 flex flex-col items-center justify-center overflow-hidden shadow-inner relative transition-colors duration-200 border ${
                isSuspended
                  ? "bg-rose-100 border-rose-400 text-rose-500"
                  : isInactive
                  ? "bg-amber-100 border-amber-400 text-amber-600"
                  : "bg-slate-200 border-slate-300 text-slate-400"
              }`}
            >
              {driver?.driver_photo_url ? (
                <Image
                  src={driver.driver_photo_url}
                  alt={driver.full_name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10" />
              )}
              <div className="absolute bottom-0 inset-x-0 bg-slate-800/80 py-0.5 text-center text-[8px] font-mono text-white font-medium">
                PHOTO
              </div>
            </div>

            {/* Identity Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl sm:text-3xl font-black font-mono tracking-tight leading-none ${
                    isSuspended
                      ? "text-rose-950"
                      : isInactive
                      ? "text-amber-950"
                      : "text-slate-900"
                  }`}
                >
                  {driver ? `#${driver.body_number}` : "#---"}
                </span>
                <span
                  className={`text-xs italic font-bold ${
                    isSuspended
                      ? "text-rose-700"
                      : isInactive
                      ? "text-amber-800"
                      : "text-blue-700"
                  }`}
                >
                  {parsed ? `"${parsed.nickname}"` : '""'}
                </span>
              </div>

              <div
                className={`text-base font-extrabold truncate mt-0.5 ${
                  isSuspended
                    ? "text-rose-950"
                    : isInactive
                    ? "text-amber-950"
                    : "text-slate-900"
                }`}
              >
                {driver ? driver.full_name : "No Unit Selected"}
              </div>

              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                <span className="font-mono text-slate-500">
                  Row: <strong className="text-slate-800">{rowNumber}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-500">
                  Today: <strong className="text-blue-700">{tripsToday} trips</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Warning Banner: Displays inline when Suspended or Inactive */}
          {isSuspended && (
            <div className="flex items-center gap-2 p-1.5 px-2.5 rounded-lg bg-rose-100 border border-rose-300 text-xs font-bold text-rose-900">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="leading-tight">
                DISPATCH BLOCKED: Driver is suspended. Entry not permitted.
              </span>
            </div>
          )}

          {isInactive && (
            <div className="flex items-center gap-2 p-1.5 px-2.5 rounded-lg bg-amber-100 border border-amber-300 text-xs font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span className="leading-tight">
                DISPATCH BLOCKED: Driver is inactive. Entry not permitted.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* "Launch Amount" Controls */}
      <div className="shrink-0 mt-3 pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="amount-input"
            className="text-xs font-bold uppercase tracking-wider text-slate-700"
          >
            Launch Amount
          </label>

          {/* Anti-spam feedback */}
          <span
            className={`text-[11px] font-mono font-bold text-emerald-600 transition-opacity duration-200 flex items-center gap-1 ${
              showLoggedNotice ? "opacity-100" : "opacity-0"
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Logged</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <input
              ref={amountRef}
              id="amount-input"
              type="number"
              min="1"
              max="50"
              value={amount}
              disabled={isBlocked || isSubmitting || isLocked}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-11 sm:h-12 bg-white border-2 rounded-xl px-4 text-center text-2xl font-black font-mono text-slate-900 outline-none transition-all border-slate-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-100 shadow-xs disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Dispatch Button with Anti-Spam state */}
          <button
            id="dispatch-action-btn"
            type="button"
            disabled={isBlocked || isSubmitting || isLocked}
            onClick={handleExecuteDispatch}
            className={`h-11 sm:h-12 px-6 rounded-xl text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 select-none ${
              isSuspended
                ? "bg-rose-100 text-rose-600 border border-rose-300 cursor-not-allowed text-xs"
                : isInactive
                ? "bg-amber-100 text-amber-700 border border-amber-300 cursor-not-allowed text-xs"
                : !driver
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : isActive
                ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white ring-4 ring-blue-100 cursor-pointer shadow-md"
                : "bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 cursor-pointer"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Logging...</span>
              </>
            ) : isSuspended ? (
              <span>Blocked (Suspended)</span>
            ) : isInactive ? (
              <span>Blocked (Inactive)</span>
            ) : (
              <>
                <span>Dispatch</span>
                <kbd className="bg-black/10 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold">
                  ↵ Enter
                </kbd>
              </>
            )}
          </button>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>
            Press <kbd className="border px-1 py-0.5 rounded bg-white font-bold text-slate-700">Enter</kbd> to record
          </span>
          <span>
            Press <kbd className="border px-1 py-0.5 rounded bg-white font-bold text-slate-700">Esc</kbd> to go back
          </span>
        </div>
      </div>
    </div>
  );
}
