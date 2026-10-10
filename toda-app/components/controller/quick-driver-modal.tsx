"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, UserPlus, Loader2, AlertCircle } from "lucide-react";
import { registerDriver } from "@/lib/actions/driver-actions";
import { logDispatch } from "@/lib/actions/dispatch-actions";

interface QuickDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillQuery: string;
  onSuccessDispatch: (driverId: string) => void;
}

export function QuickDriverModal({
  isOpen,
  onClose,
  prefillQuery,
  onSuccessDispatch,
}: QuickDriverModalProps) {
  const [bodyNumber, setBodyNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [nickname, setNickname] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [dispatchImmediately, setDispatchImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      const trimmed = prefillQuery.trim();
      const isDigits = /^\d+$/.test(trimmed);

      if (isDigits) {
        setBodyNumber(trimmed);
        setFirstName("");
        setLastName("");
      } else {
        setBodyNumber("");
        const words = trimmed.split(" ").filter(Boolean);
        if (words.length > 1) {
          setFirstName(words[0]);
          setLastName(words.slice(1).join(" "));
        } else {
          setFirstName(trimmed);
          setLastName("");
        }
      }
      setMiddleInitial("");
      setNickname("");
      setContactNumber("");
      setDispatchImmediately(true);

      setTimeout(() => {
        bodyInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, prefillQuery]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bodyNumber.trim()) {
      setError("Body number is required");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("First Name and Last Name are required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const regRes = await registerDriver({
        body_number: bodyNumber.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_initial: middleInitial.trim() || undefined,
        nickname: nickname.trim() || undefined,
        contact_number: contactNumber.trim() || undefined,
      });

      if (!regRes.success) {
        setError(regRes.error || "Failed to register driver");
        setIsSubmitting(false);
        return;
      }

      const newDriverId = (regRes.data as { id?: string })?.id;

      if (dispatchImmediately && newDriverId) {
        const dispRes = await logDispatch({
          driver_id: newDriverId,
          launch_count: 1,
        });

        if (!dispRes.success) {
          setError(`Driver registered, but dispatch failed: ${dispRes.error}`);
          setIsSubmitting(false);
          return;
        }

        onSuccessDispatch(newDriverId);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-border-subtle shadow-2xl w-full max-w-md p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand-soft text-brand-primary flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-text-primary">
                Quick Driver Registration
              </h2>
              <p className="text-xs text-text-muted">
                Add driver to roster and dispatch immediately
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-status-danger-bg text-status-danger-text text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 pl-1">
              Body / Sidecar Number
            </label>
            <div className="flex items-center bg-surface-subtle rounded-2xl px-4 py-3 border border-transparent focus-within:border-brand-primary focus-within:bg-white transition-all">
              <span className="font-mono font-bold text-text-muted mr-1.5">#</span>
              <input
                ref={bodyInputRef}
                type="text"
                value={bodyNumber}
                onChange={(e) => setBodyNumber(e.target.value)}
                placeholder="e.g. 714"
                className="w-full bg-transparent font-mono font-bold text-sm text-text-primary focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1 pl-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Dela Cruz"
                className="w-full bg-surface-subtle rounded-2xl px-3 py-2.5 text-sm font-bold text-text-primary border border-transparent focus:border-brand-primary focus:bg-white focus:outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1 pl-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Juan"
                className="w-full bg-surface-subtle rounded-2xl px-3 py-2.5 text-sm font-bold text-text-primary border border-transparent focus:border-brand-primary focus:bg-white focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1 pl-1">
                M.I.
              </label>
              <input
                type="text"
                value={middleInitial}
                onChange={(e) => setMiddleInitial(e.target.value)}
                placeholder="e.g. P."
                className="w-full bg-surface-subtle rounded-2xl px-3 py-2.5 text-sm font-semibold text-text-primary border border-transparent focus:border-brand-primary focus:bg-white focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1 pl-1">
                Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Johnny"
                className="w-full bg-surface-subtle rounded-2xl px-3 py-2.5 text-sm font-semibold text-text-primary border border-transparent focus:border-brand-primary focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 pl-1">
              Contact Number (Optional)
            </label>
            <input
              type="text"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. 09171234567"
              className="w-full bg-surface-subtle rounded-2xl px-4 py-3 text-sm font-semibold text-text-primary border border-transparent focus:border-brand-primary focus:bg-white focus:outline-none transition-all"
            />
          </div>

          {/* Dispatch checkbox */}
          <label className="flex items-center gap-2.5 px-1 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={dispatchImmediately}
              onChange={(e) => setDispatchImmediately(e.target.checked)}
              className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary cursor-pointer"
            />
            <span className="text-xs font-bold text-text-primary">
              Dispatch 1x trip immediately after registering
            </span>
          </label>

          {/* Action buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-12 bg-brand-primary hover:bg-brand-hover text-white text-sm font-bold rounded-full shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : dispatchImmediately ? (
                "Save & Dispatch Now"
              ) : (
                "Register Driver"
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 h-12 bg-surface-subtle hover:bg-slate-200 text-text-secondary text-sm font-bold rounded-full transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
