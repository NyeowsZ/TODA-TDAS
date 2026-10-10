"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  getDriverRoster,
  registerDriver,
  changeDriverStatus,
  updateDriverProfile,
  uploadDriverPhoto,
} from "@/lib/actions/driver-actions";
import { compressImage } from "@/lib/utils/compress-image";
import {
  Search,
  UserPlus,
  Filter,
  User,
  History,
  Edit2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Shield,
  Phone,
  Upload,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface DriverWithProfile {
  id: string;
  body_number: string;
  current_version: number;
  status: "active" | "suspended" | "inactive";
  created_at: string;
  created_by: string | null;
  current_profile?: {
    full_name: string;
    contact_number: string | null;
    driver_photo_url: string | null;
    unit_photo_url: string | null;
    version: number;
  };
}

export function DriversRoster() {
  const [drivers, setDrivers] = useState<DriverWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "inactive">("all");
  const [isPending, startTransition] = useTransition();

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [statusModalDriver, setStatusModalDriver] = useState<DriverWithProfile | null>(null);
  const [editModalDriver, setEditModalDriver] = useState<DriverWithProfile | null>(null);

  // Register form state
  const [regBodyNumber, setRegBodyNumber] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regContactNumber, setRegContactNumber] = useState("");
  const [regPhotoFile, setRegPhotoFile] = useState<File | null>(null);
  const [regPhotoPreview, setRegPhotoPreview] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Status change form state
  const [newStatus, setNewStatus] = useState<"active" | "suspended" | "inactive">("suspended");
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Edit profile form state (SCD-2)
  const [editFullName, setEditFullName] = useState("");
  const [editContactNumber, setEditContactNumber] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const loadRoster = () => {
    startTransition(async () => {
      try {
        const data = await getDriverRoster();
        setDrivers(data as unknown as DriverWithProfile[]);
      } catch (err) {
        console.error("Failed to load driver roster:", err);
      }
    });
  };

  useEffect(() => {
    loadRoster();
  }, []);

  // Filtered list
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const matchSearch =
        d.body_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.current_profile?.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.current_profile?.contact_number || "").includes(searchQuery);

      if (!matchSearch) return false;
      if (statusFilter === "all") return true;
      return d.status === statusFilter;
    });
  }, [drivers, searchQuery, statusFilter]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: drivers.length,
      active: drivers.filter((d) => d.status === "active").length,
      suspended: drivers.filter((d) => d.status === "suspended").length,
      inactive: drivers.filter((d) => d.status === "inactive").length,
    };
  }, [drivers]);

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRegPhotoFile(file);
      const url = URL.createObjectURL(file);
      setRegPhotoPreview(url);
    }
  };

  // Handle Driver Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setIsRegistering(true);

    try {
      let photoUrl: string | undefined = undefined;

      // 1. Register driver anchor + version 1
      const res = await registerDriver({
        body_number: regBodyNumber.trim(),
        full_name: regFullName.trim(),
        contact_number: regContactNumber.trim() || undefined,
        driver_photo_url: photoUrl,
      });

      if (!res.success) {
        setRegError(res.error || "Failed to register driver");
        setIsRegistering(false);
        return;
      }

      const createdDriver = res.data as { id: string } | undefined;

      // 2. Upload photo if selected
      if (regPhotoFile && createdDriver?.id) {
        try {
          const compressedBlob = await compressImage(regPhotoFile, {
            maxWidth: 600,
            maxHeight: 600,
            maxSizeKB: 100,
          });

          const formData = new FormData();
          formData.append(
            "file",
            new File([compressedBlob], "photo.webp", { type: "image/webp" })
          );

          await uploadDriverPhoto(createdDriver.id, 1, "face", formData);
        } catch (photoErr) {
          console.warn("Photo compression/upload warning:", photoErr);
        }
      }

      // Reset form
      setRegBodyNumber("");
      setRegFullName("");
      setRegContactNumber("");
      setRegPhotoFile(null);
      setRegPhotoPreview(null);
      setIsRegisterOpen(false);
      loadRoster();
    } catch (err: unknown) {
      setRegError((err as Error).message || "An unexpected error occurred");
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle Status Update
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalDriver) return;

    if (statusReason.trim().length < 5) {
      setStatusError("Reason must be at least 5 characters.");
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError(null);

    try {
      const res = await changeDriverStatus({
        driver_id: statusModalDriver.id,
        status: newStatus,
        reason: statusReason.trim(),
      });

      if (!res.success) {
        setStatusError(res.error || "Failed to update status");
      } else {
        setStatusModalDriver(null);
        setStatusReason("");
        loadRoster();
      }
    } catch (err: unknown) {
      setStatusError((err as Error).message || "An unexpected error occurred");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle SCD-2 Profile Update
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalDriver) return;

    if (editReason.trim().length < 5) {
      setEditError("Reason must be at least 5 characters for SCD-2 audit log.");
      return;
    }

    setIsUpdatingProfile(true);
    setEditError(null);

    try {
      const res = await updateDriverProfile({
        driver_id: editModalDriver.id,
        full_name: editFullName.trim(),
        contact_number: editContactNumber.trim() || undefined,
        change_reason: editReason.trim(),
      });

      if (!res.success) {
        setEditError(res.error || "Failed to update driver profile");
      } else {
        setEditModalDriver(null);
        setEditReason("");
        loadRoster();
      }
    } catch (err: unknown) {
      setEditError((err as Error).message || "An unexpected error occurred");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const openStatusModal = (driver: DriverWithProfile) => {
    setStatusModalDriver(driver);
    setNewStatus(driver.status === "active" ? "suspended" : "active");
    setStatusReason("");
    setStatusError(null);
  };

  const openEditModal = (driver: DriverWithProfile) => {
    setEditModalDriver(driver);
    setEditFullName(driver.current_profile?.full_name || "");
    setEditContactNumber(driver.current_profile?.contact_number || "");
    setEditReason("");
    setEditError(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header & Registration CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-light">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Driver & Unit Directory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Member roster with immutable SCD-2 version tracking and status management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadRoster}
            disabled={isPending}
            className="p-2.5 rounded-full bg-surface-card border border-border-light text-slate-600 hover:text-blue-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <button
            onClick={() => setIsRegisterOpen(true)}
            className="h-11 px-5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-bold rounded-full shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Unit</span>
          </button>
        </div>
      </div>

      {/* Roster KPI Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter("all")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-md"
              : "bg-surface-card text-slate-900 border-border-light hover:border-slate-300"
          }`}
        >
          <p className="text-[11px] uppercase font-semibold text-slate-400">Total Units</p>
          <p className="text-2xl font-bold font-mono mt-0.5">{counts.total}</p>
        </div>

        <div
          onClick={() => setStatusFilter("active")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "active"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
              : "bg-surface-card text-slate-900 border-border-light hover:border-emerald-200"
          }`}
        >
          <p className={`text-[11px] uppercase font-semibold ${statusFilter === "active" ? "text-emerald-100" : "text-emerald-600"}`}>
            Active Units
          </p>
          <p className="text-2xl font-bold font-mono mt-0.5">{counts.active}</p>
        </div>

        <div
          onClick={() => setStatusFilter("suspended")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "suspended"
              ? "bg-rose-600 text-white border-rose-600 shadow-md"
              : "bg-surface-card text-slate-900 border-border-light hover:border-rose-200"
          }`}
        >
          <p className={`text-[11px] uppercase font-semibold ${statusFilter === "suspended" ? "text-rose-100" : "text-rose-600"}`}>
            Suspended
          </p>
          <p className="text-2xl font-bold font-mono mt-0.5">{counts.suspended}</p>
        </div>

        <div
          onClick={() => setStatusFilter("inactive")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "inactive"
              ? "bg-slate-700 text-white border-slate-700 shadow-md"
              : "bg-surface-card text-slate-900 border-border-light hover:border-slate-300"
          }`}
        >
          <p className="text-[11px] uppercase font-semibold text-slate-400">Inactive</p>
          <p className="text-2xl font-bold font-mono mt-0.5">{counts.inactive}</p>
        </div>
      </div>

      {/* Search Bar & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center bg-surface-card border border-border-light rounded-2xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            placeholder="Search by body number, full name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Driver Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.length === 0 ? (
          <div className="col-span-full bg-surface-card rounded-2xl p-12 text-center border border-border-light text-slate-400 text-sm">
            No driver records match the specified query.
          </div>
        ) : (
          filteredDrivers.map((driver) => {
            const profile = driver.current_profile;
            const isActive = driver.status === "active";
            const isSuspended = driver.status === "suspended";

            return (
              <div
                key={driver.id}
                className={`bg-surface-card rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                  isSuspended
                    ? "border-rose-200 bg-rose-50/15"
                    : "border-border-light"
                }`}
              >
                <div>
                  {/* Top row: Body number + Status + Version */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold px-2.5 py-1 bg-slate-100 text-slate-900 rounded-lg">
                        #{driver.body_number}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        v{driver.current_version}
                      </span>
                    </div>

                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full ${
                        isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : isSuspended
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
                    </span>
                  </div>

                  {/* Driver Info */}
                  <div className="flex items-center gap-3.5 my-2">
                    {profile?.driver_photo_url ? (
                      <img
                        src={profile.driver_photo_url}
                        alt={profile.full_name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 ring-2 ring-slate-200/50">
                        <User className="w-6 h-6" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {profile?.full_name || "Unassigned"}
                      </h3>
                      {profile?.contact_number ? (
                        <p className="text-xs font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {profile.contact_number}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">No contact number</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center gap-2 pt-4 border-t border-border-light/60 mt-3">
                  <Link
                    href={`/official/drivers/${driver.id}`}
                    className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full flex items-center justify-center gap-1.5 transition-all"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>SCD-2 History</span>
                  </Link>

                  <button
                    onClick={() => openEditModal(driver)}
                    className="p-2 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-all"
                    title="Edit profile (creates new version)"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => openStatusModal(driver)}
                    className={`px-3 h-9 text-xs font-bold rounded-full transition-all ${
                      isActive
                        ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {isActive ? "Suspend" : "Activate"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Registration Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Register New Driver Unit</h3>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {regError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Body Number (Unique ID)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 042"
                  value={regBodyNumber}
                  onChange={(e) => setRegBodyNumber(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm font-bold font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Driver Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan dela Cruz"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Contact Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 09171234567"
                  value={regContactNumber}
                  onChange={(e) => setRegContactNumber(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Driver Photo (Auto-compressed to ≤100KB WebP)
                </label>
                <div className="flex items-center gap-3">
                  {regPhotoPreview ? (
                    <img
                      src={regPhotoPreview}
                      alt="Preview"
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-600"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <label className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all">
                    <Upload className="w-4 h-4" />
                    <span>{regPhotoFile ? "Change Photo" : "Upload Face Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-full transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    "Register Unit"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {statusModalDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Change Status</h3>
              </div>
              <button
                onClick={() => setStatusModalDriver(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-slate-800">
                  Unit #{statusModalDriver.body_number}
                </span>
                <p className="text-xs font-semibold text-slate-600">
                  {statusModalDriver.current_profile?.full_name}
                </p>
              </div>
              <span className="text-xs font-bold capitalize px-2.5 py-1 bg-white rounded-full text-slate-700 shadow-xs">
                Current: {statusModalDriver.status}
              </span>
            </div>

            {statusError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  New Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["active", "suspended", "inactive"] as const).map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setNewStatus(s)}
                      className={`h-11 text-xs font-bold rounded-2xl capitalize transition-all border ${
                        newStatus === s
                          ? s === "active"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : s === "suspended"
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-slate-800 text-white border-slate-800"
                          : "bg-slate-100 text-slate-700 border-transparent hover:bg-slate-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Official Justification Reason
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this status is being changed (e.g. Route violation, franchise renewal)..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalDriver(null)}
                  className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-full transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUpdatingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Apply Status"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCD-2 Edit Profile Modal */}
      {editModalDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit Driver Profile</h3>
                  <p className="text-xs text-slate-500">
                    Creates version v{editModalDriver.current_version + 1} (SCD-2 immutable)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalDriver(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3.5 rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
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
                  value={editContactNumber}
                  onChange={(e) => setEditContactNumber(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-2">
                  Change Reason (Audit Requirement)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corrected surname spelling, updated mobile number"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full bg-slate-100 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalDriver(null)}
                  className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-full transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Version...
                    </>
                  ) : (
                    "Save & Version"
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
