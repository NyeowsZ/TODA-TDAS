"use client";

import React, { useState, useEffect, useRef } from "react";
import type { DriverSummary } from "@/types/supabase";
import { Search, ChevronLeft, ChevronRight, UserPlus, CornerDownLeft, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface OmniboxSearchProps {
  onDispatch: (driver: DriverSummary) => void;
  onOpenQuickRegister: (prefill: string) => void;
  searchDrivers: (query: string) => DriverSummary[];
  pagination: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  isSubmitting?: boolean;
}

export function OmniboxSearch({
  onDispatch,
  onOpenQuickRegister,
  searchDrivers,
  pagination,
  isSubmitting = false,
}: OmniboxSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DriverSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showPageMenu, setShowPageMenu] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pageMenuRef = useRef<HTMLDivElement>(null);

  // Global focus shortcut: Press '/' or 'Ctrl+K' / 'Cmd+K' anywhere
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
  }, []);

  // Close page menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target as Node)) {
        setShowPageMenu(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && e.target !== inputRef.current) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update live suggestions as user types
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const matches = searchDrivers(trimmed);
    setResults(matches);
    setSelectedIndex(0);
    setIsOpen(true);
  }, [query, searchDrivers]);

  const handleSelect = (driver: DriverSummary) => {
    if (isSubmitting) return;
    onDispatch(driver);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const handleRegisterNew = () => {
    const trimmed = query.trim();
    setIsOpen(false);
    setQuery("");
    setResults([]);
    onOpenQuickRegister(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (isOpen && (results.length > 0 || query.trim() !== "")) {
      // Total items: matching drivers + "Add new driver" row
      const totalItems = results.length + 1;

      if (e.key === "Tab") {
        e.preventDefault();
        if (!e.shiftKey) {
          setSelectedIndex((prev) => (prev + 1) % totalItems);
        } else {
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (!query.trim()) return;

        if (results.length > 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        } else {
          handleRegisterNew();
        }
        return;
      }
    } else if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      const matches = searchDrivers(query.trim());
      if (matches.length > 0) {
        handleSelect(matches[0]);
      } else {
        handleRegisterNew();
      }
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto my-3 px-2 sm:px-0">
      <div className="flex items-center gap-2">
        {/* Pagination Pill (← [ Page 1 ] →) */}
        {pagination.totalPages > 0 && (
          <div ref={pageMenuRef} className="relative flex items-center shrink-0">
            <div className="flex items-center bg-white border border-border-subtle rounded-2xl h-12 px-1.5 shadow-sm">
              {/* Prev Button */}
              <button
                type="button"
                disabled={pagination.currentPage <= 1}
                onClick={() => pagination.onPageChange(Math.max(1, pagination.currentPage - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary transition-colors cursor-pointer"
                title="Previous Sheet (90 lines)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Sheet Indicator */}
              <button
                type="button"
                onClick={() => setShowPageMenu((prev) => !prev)}
                className="px-2.5 py-1 text-xs font-bold font-mono text-text-primary hover:bg-surface-subtle rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                title="Jump to Sheet"
              >
                <span>Sheet {pagination.currentPage}</span>
              </button>

              {/* Next Button */}
              <button
                type="button"
                disabled={pagination.currentPage >= pagination.totalPages}
                onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary transition-colors cursor-pointer"
                title="Next Sheet (90 lines)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Page Jump Dropdown */}
            {showPageMenu && (
              <div className="absolute left-0 top-full mt-2 w-52 max-h-60 overflow-y-auto bg-white border border-border-subtle rounded-2xl shadow-xl z-50 py-1.5 text-xs divide-y divide-surface-subtle animate-scale-in">
                {Array.from({ length: pagination.totalPages }, (_, i) => {
                  const p = i + 1;
                  const startSeq = (p - 1) * 90 + 1;
                  const endSeq = p * 90;
                  const isSelected = p === pagination.currentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        pagination.onPageChange(p);
                        setShowPageMenu(false);
                      }}
                      className={cn(
                        "w-full px-3.5 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer",
                        isSelected
                          ? "bg-brand-soft text-brand-primary font-bold"
                          : "hover:bg-surface-subtle text-text-primary"
                      )}
                    >
                      <span>Sheet {p}</span>
                      <span className="font-mono text-[11px] text-text-muted">
                        Lines {startSeq}–{endSeq}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Clean Omnibox Input */}
        <div className="relative flex-1">
          <div className="relative flex items-center">
            <span className="absolute left-4 text-text-muted pointer-events-none">
              <Search className="w-4 h-4" />
            </span>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (query.trim()) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search body # or driver name... (Press / to focus)"
              className="w-full h-12 bg-white border border-border-subtle rounded-2xl pl-11 pr-24 text-sm font-semibold text-text-primary placeholder:text-text-muted placeholder:font-normal focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-blue-100 shadow-sm transition-all"
              autoComplete="off"
            />

            <div className="absolute right-3.5 flex items-center gap-1.5 pointer-events-none">
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-text-muted bg-surface-subtle border border-border-subtle rounded-lg">
                /
              </kbd>
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {isOpen && query.trim() !== "" && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 mt-2 bg-white border border-border-subtle rounded-2xl shadow-xl overflow-hidden z-50 text-sm divide-y divide-surface-subtle animate-scale-in"
            >
              {results.length > 0 && (
                <div className="max-h-72 overflow-y-auto">
                  {results.map((driver, idx) => {
                    const isSelected = idx === selectedIndex;
                    const isSuspended = driver.status === "suspended";

                    return (
                      <div
                        key={driver.id}
                        onClick={() => handleSelect(driver)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "px-4 py-3 cursor-pointer flex items-center justify-between transition-colors border-l-4",
                          isSelected
                            ? "bg-brand-soft/80 text-brand-primary border-brand-primary font-bold"
                            : "hover:bg-surface-subtle text-text-primary border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Photo / Avatar */}
                          {driver.driver_photo_url ? (
                            <img
                              src={driver.driver_photo_url}
                              alt={driver.full_name}
                              className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-border-subtle"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-surface-subtle flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-text-muted" />
                            </div>
                          )}

                          {/* Body Number */}
                          <span className="font-mono font-extrabold text-sm w-16 shrink-0 text-text-primary">
                            #{driver.body_number}
                          </span>

                          {/* Name & Status */}
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate">{driver.full_name}</span>
                            {isSuspended && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-status-danger-bg text-status-danger-text rounded-md uppercase">
                                Suspended
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dispatch shortcut tag */}
                        <div className="flex items-center gap-1 shrink-0 ml-3 text-xs font-mono">
                          <span
                            className={cn(
                              "flex items-center gap-1",
                              isSelected ? "text-brand-primary font-bold" : "text-text-muted"
                            )}
                          >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            dispatch
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add New Driver Option */}
              <div
                onClick={handleRegisterNew}
                onMouseEnter={() => setSelectedIndex(results.length)}
                className={cn(
                  "px-4 py-3 cursor-pointer flex items-center justify-between transition-colors border-l-4",
                  selectedIndex === results.length
                    ? "bg-brand-soft/80 text-brand-primary border-brand-primary font-bold"
                    : "hover:bg-surface-subtle text-text-secondary border-transparent"
                )}
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-brand-primary shrink-0" />
                  <span className="text-brand-primary font-bold">
                    + Register new driver
                  </span>
                  <span className="text-xs text-text-muted font-mono truncate">
                    (&ldquo;{query.trim()}&rdquo;)
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs font-mono text-text-muted">
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  register
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
