"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { getDriverVersionHistory, updateDriverProfile } from "@/lib/actions/driver-actions";
import { formatManilaDate, formatManilaTime } from "@/lib/utils/format-timezone";
import {
  ArrowLeft,
  History,
  Shield,
  User,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  X,
  Calendar,
} from "lucide-react";
import type { Driver, DriverProfileVersion } from "@/types/supabase";

interface DriverVersionHistoryProps {
  driverId: string;
}

export function DriverVersionHistory({ driverId }: DriverVersionHistoryProps) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [versions, setVersions] = useState<DriverProfileVersion[]>([]);
  const [isPending, startTransition] = useTransition();

  // Create new version modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editReason, setEditReason] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadHistory = () => {
    startTransition(async () => {
      try {
        const res = await getDriverVersionHistory(driverId);
        setDriver(res.driver as unknown as Driver);
        setVersions(res.versions as unknown as DriverProfileVersion[]);
      } catch (err) {
        console.error("Failed to load driver history:", err);
      }
    });
  };

  useEffect(() => {
    loadHistory();
  }, [driverId]);

  const openModal = () => {
    const latest = versions[0];
    setEditFullName(latest?.full_name || "");
    setEditContact(latest?.contact_number || "");
    setEditReason("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editReason.trim().length < 5) {
      setModalError("Audit reason must be at least 5 characters.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await updateDriverProfile({
        driver_id: driverId,
        full_name: editFullName.trim(),
        contact_number: editContact.trim() || undefined,
        change_reason: editReason.trim(),
      });

      if (!res.success) {
        setModalError(res.error || "Failed to create new version");
      } else {
        setIsModalOpen(false);
        loadHistory();
      }
    } catch (err: unknown) {
      setModalError((err as Error).message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPending && !driver) {
    return (
      <div className="max-w-4xl mx-auto py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Loading SCD-2 version history...</p>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <p className="text-slate-500 font-medium">Driver not found.</p>
        <Link
          href="/official/drivers"
          className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Driver Directory</span>
        </Link>
      </div>
    );
  }

  const latestVersion = versions[0];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/official/drivers"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Driver Directory</span>
        </Link>
      </div>

      {/* Driver Header Summary Card */}
      <div className="bg-surface-card rounded-3xl p-6 md:p-8 border border-border-light shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          {latestVersion?.driver_photo_url ? (
            <img
              src={latestVersion.driver_photo_url}
              alt={latestVersion.full_name}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 ring-2 ring-slate-200/50 shrink-0">
              <User className="w-8 h-8" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-extrabold px-3 py-1 bg-slate-100 text-slate-900 rounded-lg">
                #{driver.body_number}
              </span>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full capitalize ${
                  driver.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : driver.status === "suspended"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {driver.status}
              </span>
              <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                Current: v{driver.current_version}
              </span>
            </div>

            <h1 className="text-xl font-bold text-slate-900 mt-2">
              {latestVersion?.full_name || "Unassigned"}
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Identity Anchor ID: {driver.id}
            </p>
          </div>
        </div>

        <button
          onClick={openModal}
          className="h-11 px-5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-full shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Version</span>
        </button>
      </div>

      {/* SCD-2 Explanation Notice */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600">
        <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-800">
            Slowly Changing Dimension Type 2 (SCD-2) Immutable Record:
          </span>{" "}
          Driver profile changes are append-only. Past records are permanently preserved for audit
          verification and historical integrity.
        </div>
      </div>

      {/* Version Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border-light">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Profile Version Timeline ({versions.length} versions)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">PST (UTC+8)</span>
        </div>

        <div className="space-y-4">
          {versions.map((ver, idx) => {
            const isCurrent = ver.version === driver.current_version;

            return (
              <div
                key={ver.id}
                className={`bg-surface-card rounded-2xl p-5 border shadow-sm transition-all ${
                  isCurrent
                    ? "border-blue-300 ring-2 ring-blue-500/10"
                    : "border-border-light opacity-90"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-light/60">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`font-mono text-xs font-extrabold px-2.5 py-1 rounded-full ${
                        isCurrent
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      Version {ver.version}
                    </span>
                    {isCurrent && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active Current
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {formatManilaDate(ver.created_at)} at {formatManilaTime(ver.created_at)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase font-semibold">
                      Driver Full Name
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{ver.full_name}</p>
                  </div>

                  <div>
                    <p className="text-[11px] text-slate-400 uppercase font-semibold">
                      Contact Number
                    </p>
                    <p className="text-sm font-mono text-slate-800 mt-0.5">
                      {ver.contact_number || "None specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] text-slate-400 uppercase font-semibold">
                      Reason for Revision
                    </p>
                    <p className="text-xs text-slate-700 font-medium mt-0.5">
                      {ver.change_reason || "Initial Registration"}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-border-light/40 flex justify-between items-center text-[11px] text-slate-400 font-mono">
                  <span>Author / Changed by: {ver.changed_by.slice(0, 8)}...</span>
                  <span>Record ID: #{ver.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Version Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Create Profile Version</h3>
                  <p className="text-xs text-slate-500">
                    Will increment to Version v{driver.current_version + 1}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateVersion} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Contact Number
                </label>
                <input
                  type="tel"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Change Reason (Mandatory Audit Requirement)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Changed registered driver due to franchise transfer, updated cell number"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-full transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Save New Version"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
