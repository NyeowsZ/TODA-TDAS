"use client";

import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import type { DispatchLog } from "@/types/supabase";

interface UndoConfirmModalProps {
  dispatch: DispatchLog & { body_number: string; driver_name: string };
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

export function UndoConfirmModal({
  dispatch,
  onConfirm,
  onCancel,
}: UndoConfirmModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quickReasons = [
    "Typo in body number",
    "Wrong launch count",
    "Duplicate entry",
    "Driver not present",
  ];

  async function handleConfirm() {
    if (!reason.trim()) return;
    setIsSubmitting(true);
    await onConfirm(reason);
    setIsSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-inverse/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-surface-card rounded-3xl p-6 w-full max-w-sm shadow-xl shadow-slate-300/40 border border-white/60 animate-scale-in">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-text-secondary hover:bg-surface-subtle rounded-full transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-status-danger-bg rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-status-danger-text" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">
              Void Entry
            </h3>
            <p className="text-xs text-text-secondary">
              #{dispatch.body_number} · {dispatch.launch_count}x launch
            </p>
          </div>
        </div>

        {/* Quick Reasons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quickReasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                reason === r
                  ? "bg-brand-primary text-white"
                  : "bg-surface-subtle text-text-secondary hover:bg-brand-soft hover:text-brand-soft-text"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Custom Reason */}
        <div className="space-y-1.5 mb-5">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider pl-2">
            Reason for voiding
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why this entry should be voided..."
            rows={2}
            className="w-full bg-surface-subtle rounded-2xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-surface-card resize-none transition-all"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || isSubmitting}
            className="flex-1 h-12 bg-status-danger-solid hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-full flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Confirm Void"
            )}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 h-12 bg-surface-subtle text-text-secondary font-bold text-sm rounded-full transition-all hover:bg-surface-card"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
