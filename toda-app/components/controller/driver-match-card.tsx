"use client";

import type { DriverSummary } from "@/types/supabase";
import { AlertTriangle, User } from "lucide-react";

interface DriverMatchCardProps {
  driver: DriverSummary | null;
  suggestions: DriverSummary[];
  query: string;
  onSelect: (bodyNumber: string) => void;
}

export function DriverMatchCard({
  driver,
  suggestions,
  query,
  onSelect,
}: DriverMatchCardProps) {
  // No match found
  if (!driver && suggestions.length === 0) {
    return (
      <div className="bg-surface-subtle rounded-2xl p-4 flex items-center gap-3.5 border border-border-subtle">
        <div className="w-12 h-12 rounded-full bg-surface-card flex items-center justify-center border border-border-subtle">
          <AlertTriangle className="w-5 h-5 text-text-muted" />
        </div>
        <div>
          <p className="text-sm font-bold text-text-secondary">
            No match for &ldquo;#{query}&rdquo;
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            Unregistered body number
          </p>
        </div>
      </div>
    );
  }

  // Show suggestions if no exact match
  if (!driver && suggestions.length > 0) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider pl-1">
          Did you mean?
        </p>
        {suggestions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.body_number)}
            className="w-full bg-surface-card rounded-2xl p-3.5 flex items-center justify-between border border-border-subtle shadow-sm hover:shadow-md hover:border-brand-primary/20 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              {s.driver_photo_url ? (
                <img
                  src={s.driver_photo_url}
                  alt={s.full_name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-surface-subtle"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface-subtle flex items-center justify-center">
                  <User className="w-5 h-5 text-text-muted" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-surface-subtle text-text-primary rounded-md">
                    #{s.body_number}
                  </span>
                  <span className="text-sm font-bold text-text-primary">
                    {s.full_name}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Exact match — Active
  if (driver && driver.status === "active") {
    return (
      <div className="bg-surface-card rounded-2xl p-4 flex items-center justify-between border border-surface-subtle shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-3.5">
          {driver.driver_photo_url ? (
            <img
              src={driver.driver_photo_url}
              alt={driver.full_name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-surface-subtle"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center">
              <User className="w-6 h-6 text-text-muted" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-surface-subtle text-text-primary rounded-md">
                #{driver.body_number}
              </span>
              <h3 className="text-sm font-bold text-text-primary">
                {driver.full_name}
              </h3>
            </div>
          </div>
        </div>
        <span className="px-3 py-1 bg-status-success-bg text-status-success-text text-xs font-bold rounded-full">
          Active
        </span>
      </div>
    );
  }

  // Exact match — Suspended or Inactive
  if (driver && driver.status !== "active") {
    return (
      <div className="bg-status-danger-bg rounded-2xl p-4 flex items-center justify-between border border-rose-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-status-danger-text font-bold text-lg">
            !
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-rose-200 text-rose-800 rounded-md">
                #{driver.body_number}
              </span>
              <h3 className="text-sm font-bold text-rose-950">
                {driver.full_name}
              </h3>
            </div>
            <p className="text-xs font-medium text-status-danger-text mt-0.5">
              {driver.status === "suspended"
                ? "Driver is currently suspended"
                : "Driver is inactive"}
            </p>
          </div>
        </div>
        <span className="px-3 py-1 bg-rose-200 text-rose-800 text-xs font-bold rounded-full capitalize">
          {driver.status}
        </span>
      </div>
    );
  }

  return null;
}
