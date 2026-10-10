"use client";

import React, { useState, useEffect, useRef } from "react";
import type { DriverSummary } from "@/types/supabase";

export interface OmniboxSearchProps {
  isActive: boolean;
  searchDrivers: (query: string) => DriverSummary[];
  selectedDriver: DriverSummary | null;
  onDriverSelect: (driver: DriverSummary | null) => void;
  onAdvanceToRoute: (driver: DriverSummary) => void;
  onLockoutAlert?: (message: string) => void;
  onOpenQuickRegister?: (prefill: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function OmniboxSearch({
  isActive,
  searchDrivers,
  selectedDriver,
  onDriverSelect,
  onAdvanceToRoute,
  onLockoutAlert,
  onOpenQuickRegister,
  inputRef: externalInputRef,
}: OmniboxSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DriverSummary[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when isActive becomes true
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isActive, inputRef]);

  // Global focus shortcut: Press '/' or 'Ctrl+K'
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "/" && document.activeElement !== inputRef.current) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [inputRef]);

  // Update suggestions on query change
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSelectedIndex(0);
      if (onDriverSelect) onDriverSelect(null);
      return;
    }

    const matches = searchDrivers(trimmed);
    setResults(matches);
    setSelectedIndex(0);

    if (matches.length > 0) {
      if (onDriverSelect) onDriverSelect(matches[0]);
    } else {
      if (onDriverSelect) onDriverSelect(null);
    }
  }, [query, searchDrivers, onDriverSelect]);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 350);
  };

  const handleSelectDriver = (driver: DriverSummary) => {
    if (onDriverSelect) onDriverSelect(driver);

    // Hard lockout check
    if (driver.status === "suspended" || driver.status === "inactive") {
      triggerShake();
      if (onLockoutAlert) {
        onLockoutAlert(`⛔ BLOCKED: Unit #${driver.body_number} is ${driver.status.toUpperCase()}! Entry not permitted.`);
      }
      return;
    }

    onAdvanceToRoute(driver);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const trimmed = query.trim();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        const nextIdx = (selectedIndex + 1) % results.length;
        setSelectedIndex(nextIdx);
        if (onDriverSelect) onDriverSelect(results[nextIdx]);
        // Scroll item into view
        const child = listRef.current?.children[nextIdx] as HTMLElement | undefined;
        child?.scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        const prevIdx = (selectedIndex - 1 + results.length) % results.length;
        setSelectedIndex(prevIdx);
        if (onDriverSelect) onDriverSelect(results[prevIdx]);
        const child = listRef.current?.children[prevIdx] as HTMLElement | undefined;
        child?.scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "Enter") {
      e.preventDefault();

      // Empty guard: Do nothing if empty, trigger shake
      if (!trimmed) {
        triggerShake();
        return;
      }

      if (results.length > 0) {
        const target = results[selectedIndex];
        handleSelectDriver(target);
      } else {
        // No match found -> if quick register handler exists
        if (onOpenQuickRegister) {
          onOpenQuickRegister(trimmed);
        } else {
          triggerShake();
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      setResults([]);
      if (onDriverSelect) onDriverSelect(null);
    }
  };

  return (
    <div
      id="omnibox-card"
      className={`shrink-0 bg-white rounded-2xl p-3.5 shadow-xs transition-all duration-200 flex flex-col ${
        isActive
          ? "border-2 border-blue-500 ring-4 ring-blue-50"
          : "border border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor="search-box" className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Omnibox
        </label>
        <span className="text-xs text-slate-400 font-medium">
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono text-xs font-bold">
            /
          </kbd>
        </span>
      </div>

      {/* Input Box */}
      <div className={`relative ${isShaking ? "shake" : ""}`}>
        <input
          ref={inputRef}
          id="search-box"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search body no. or driver name..."
          autoComplete="off"
          className="w-full h-11 bg-slate-50 border rounded-xl px-3.5 text-base font-semibold text-slate-900 placeholder:text-slate-400 transition-all font-mono outline-none border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-3 focus:ring-blue-100 shadow-xs"
        />
        <div className="absolute right-3 top-3 text-xs text-slate-400 font-bold pointer-events-none font-mono">
          ↵ Enter
        </div>
      </div>

      {/* Query Results (Fixed 3-Row Height: 120px) */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
            Matching Units
          </span>
          <span className="text-xs font-medium text-slate-400">
            {query.trim()
              ? `${results.length} unit(s) found`
              : "Type to search"}
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
          {/* Table Header: Full Readable Names */}
          <div className="grid grid-cols-12 bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
            <span className="col-span-2 font-mono">Body No.</span>
            <span className="col-span-3">Last Name</span>
            <span className="col-span-3">First Name</span>
            <span className="col-span-2 text-center font-mono">M.I.</span>
            <span className="col-span-2">Nickname</span>
          </div>

          {/* List Container: STRICT FIXED HEIGHT (h-[120px], scrollable) */}
          <div
            ref={listRef}
            id="results-rows"
            className="h-[120px] min-h-[120px] max-h-[120px] overflow-y-auto divide-y divide-slate-100 bg-white"
          >
            {!query.trim() ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium p-4 font-mono">
                Enter body # or driver name
              </div>
            ) : results.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 font-medium p-3 gap-1">
                <span>No driver matching &quot;{query}&quot;</span>
                {onOpenQuickRegister && (
                  <button
                    type="button"
                    onClick={() => onOpenQuickRegister(query.trim())}
                    className="text-blue-600 hover:underline font-bold text-xs cursor-pointer"
                  >
                    + Register new driver
                  </button>
                )}
              </div>
            ) : (
              results.map((d, idx) => {
                const isSelected = idx === selectedIndex;

                let rowStyle = "hover:bg-slate-50 text-slate-700 border-l-4 border-transparent pl-3";
                if (isSelected) {
                  if (isActive) {
                    rowStyle = "bg-slate-100 text-slate-900 font-semibold border-l-4 border-blue-400 pl-3";
                  } else {
                    rowStyle = "bg-blue-50/80 text-blue-950 font-bold border-l-4 border-blue-600 pl-3";
                  }
                }

                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSelectedIndex(idx);
                      handleSelectDriver(d);
                    }}
                    className={`h-[40px] grid grid-cols-12 px-3 py-2 text-xs cursor-pointer transition-colors items-center ${rowStyle}`}
                  >
                    <span
                      className={`col-span-2 font-mono font-bold ${
                        isSelected ? "text-blue-700" : "text-slate-800"
                      }`}
                    >
                      {d.body_number}
                    </span>
                    <span className="col-span-3 truncate font-medium">{d.last_name || "—"}</span>
                    <span className="col-span-3 truncate font-medium">{d.first_name || "—"}</span>
                    <span className="col-span-2 text-center font-mono opacity-80">
                      {d.middle_initial || "—"}
                    </span>
                    <span className="col-span-2 truncate italic opacity-90">{d.nickname || "—"}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
