"use server";

import { createClient } from "@/lib/supabase/server";
import { auditAdjustmentSchema } from "@/lib/utils/validators";
import { revalidatePath } from "next/cache";
import type { DispatchLogWithDriver } from "@/types/supabase";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

/**
 * Get daily audit data — all dispatches for a given date (Manila timezone).
 */
export async function getDailyAuditData(dateStr?: string) {
  const supabase = await createClient();

  // Default to today in Manila timezone (en-CA formats as YYYY-MM-DD)
  const targetDate =
    dateStr ||
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
      new Date()
    );

  // Calculate day boundaries in Manila timezone (UTC+8)
  const dayStart = `${targetDate}T00:00:00+08:00`;
  const dayEnd = `${targetDate}T23:59:59.999+08:00`;

  const { data: dispatches, error } = await supabase
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
    .gte("logged_at", dayStart)
    .lte("logged_at", dayEnd)
    .order("logged_at", { ascending: false });

  if (error) {
    console.error("getDailyAuditData database error:", error);
    return { dispatches: [], metrics: null };
  }

  const items = (dispatches || []) as unknown as DispatchLogWithDriver[];
  const activeDispatches = items.filter((d) => !d.is_voided);
  const voidedDispatches = items.filter((d) => d.is_voided);

  // Calculate hourly distribution
  const hourlyData: Record<number, number> = {};
  for (let h = 5; h <= 22; h++) hourlyData[h] = 0;

  activeDispatches.forEach((d) => {
    const date = new Date(d.logged_at);
    // Convert to Manila time
    const manilaHour = (date.getUTCHours() + 8) % 24;
    if (hourlyData[manilaHour] !== undefined) {
      hourlyData[manilaHour] += d.launch_count;
    }
  });

  // Find peak hour
  let peakHour = 0;
  let peakCount = 0;
  Object.entries(hourlyData).forEach(([hour, count]) => {
    if (count > peakCount) {
      peakHour = parseInt(hour);
      peakCount = count;
    }
  });

  // Calculate controller stats
  const controllerStats: Record<
    string,
    { launches: number; voids: number; controllerId: string }
  > = {};
  items.forEach((d) => {
    if (!controllerStats[d.controller_id]) {
      controllerStats[d.controller_id] = {
        launches: 0,
        voids: 0,
        controllerId: d.controller_id,
      };
    }
    if (d.is_voided) {
      controllerStats[d.controller_id].voids++;
    } else {
      controllerStats[d.controller_id].launches += d.launch_count;
    }
  });

  // Unique active drivers
  const uniqueDrivers = new Set(activeDispatches.map((d) => d.driver_id));

  const metrics = {
    totalLaunches: activeDispatches.reduce(
      (sum, d) => sum + d.launch_count,
      0
    ),
    totalRecords: items.length,
    totalVoids: voidedDispatches.length,
    voidRate:
      items.length > 0
        ? ((voidedDispatches.length / items.length) * 100).toFixed(1)
        : "0.0",
    activeDrivers: uniqueDrivers.size,
    peakHour: `${String(peakHour).padStart(2, "0")}:00 - ${String(peakHour + 1).padStart(2, "0")}:00`,
    hourlyData,
    controllerStats: Object.values(controllerStats),
  };

  return { dispatches: items, metrics };
}

/**
 * Submit an audit adjustment (Official/Auditor within 36-hour window).
 * RLS enforces the time window constraint.
 */
export async function submitAuditAdjustment(input: {
  dispatch_id: number;
  adjustment_type: string;
  notes: string;
}): Promise<ActionResult> {
  const parsed = auditAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("audit_adjustments")
    .insert({
      dispatch_id: parsed.data.dispatch_id,
      official_id: user.id,
      adjustment_type: parsed.data.adjustment_type,
      notes: parsed.data.notes,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("policy")) {
      return {
        success: false,
        error: "The 36-hour adjustment window for this dispatch has expired.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/official/audit");
  return {
    success: true,
    data: data as unknown as Record<string, unknown>,
  };
}

/**
 * Get audit adjustments for a specific date.
 */
export async function getAuditAdjustments(dateStr?: string) {
  const supabase = await createClient();

  const targetDate = dateStr || new Date().toISOString().split("T")[0];
  const dayStart = `${targetDate}T00:00:00+08:00`;
  const dayEnd = `${targetDate}T23:59:59.999+08:00`;

  const { data, error } = await supabase
    .from("audit_adjustments")
    .select(
      `
      *,
      dispatch_logs (
        id,
        driver_id,
        launch_count,
        logged_at,
        drivers (
          body_number
        )
      )
    `
    )
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}
