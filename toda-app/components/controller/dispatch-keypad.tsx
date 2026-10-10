"use client";

import { cn } from "@/lib/utils";

interface DispatchKeypadProps {
  launchCount: number;
  setLaunchCount: (count: number) => void;
  launchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function DispatchKeypad({
  launchCount,
  setLaunchCount,
  launchInputRef,
}: DispatchKeypadProps) {
  const presets = [1, 2, 3];

  return (
    <div className="space-y-3">
      {/* Label */}
      <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider pl-3">
        Launch Count
      </label>

      {/* Preset Chips */}
      <div className="flex gap-2">
        {presets.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setLaunchCount(n)}
            className={cn(
              "flex-1 h-12 font-bold text-sm rounded-full transition-all active:scale-[0.97]",
              launchCount === n
                ? "bg-brand-primary text-white shadow-sm"
                : "bg-brand-soft text-brand-soft-text hover:bg-blue-100"
            )}
          >
            {n} {n === 1 ? "Launch" : "Launches"}
          </button>
        ))}
      </div>

      {/* Custom Input */}
      <div className="flex items-center bg-surface-subtle rounded-2xl px-4 py-3 transition-all focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-brand-primary focus-within:shadow-sm">
        <label className="text-xs font-semibold text-text-muted mr-3 shrink-0">
          Custom:
        </label>
        <input
          ref={launchInputRef}
          type="number"
          name="launch_count"
          inputMode="numeric"
          min={1}
          max={999}
          value={launchCount}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val) && val > 0) {
              setLaunchCount(val);
            }
          }}
          className="w-full bg-transparent text-base font-bold font-mono text-text-primary focus:outline-none"
        />
      </div>
    </div>
  );
}
