"use server";

import { createClient } from "@/lib/supabase/server";
import { dispatchSchema, voidReasonSchema } from "@/lib/utils/validators";
import { revalidatePath } from "next/cache";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

/**
 * Log a dispatch entry.
 * Controller only. Inserts into dispatch_logs with server-authoritative timestamp.
 */
export async function logDispatch(input: {
  driver_id: string;
  launch_count: number;
  route?: string;
}): Promise<ActionResult> {
  const parsed = dispatchSchema.safeParse(input);
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

  // Check driver exists and is active
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, status")
    .eq("id", parsed.data.driver_id)
    .single();

  if (!driver) {
    return { success: false, error: "Driver not found" };
  }

  if (driver.status !== "active") {
    return {
      success: false,
      error: `Driver is ${driver.status}. Cannot dispatch.`,
    };
  }

  // Insert dispatch log (timestamp is server-authoritative via DEFAULT NOW())
  const insertPayload: {
    driver_id: string;
    controller_id: string;
    launch_count: number;
    route?: string;
  } = {
    driver_id: parsed.data.driver_id,
    controller_id: user.id,
    launch_count: parsed.data.launch_count,
  };
  if (parsed.data.route) {
    insertPayload.route = parsed.data.route;
  }

  let { data, error } = await supabase
    .from("dispatch_logs")
    .insert(insertPayload)
    .select()
    .single();

  // Resilient fallback if Supabase DB does not have the 'route' column yet
  if (error && error.message?.includes("route") && parsed.data.route) {
    const retryPayload = {
      driver_id: parsed.data.driver_id,
      controller_id: user.id,
      launch_count: parsed.data.launch_count,
    };
    const retry = await supabase
      .from("dispatch_logs")
      .insert(retryPayload)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("logDispatch database error:", error);
    return { success: false, error: error.message };
  }

  // Purge server caches so official audit and controller terminal update immediately
  revalidatePath("/controller");
  revalidatePath("/official/audit");
  revalidatePath("/official/analytics");

  return { success: true, data: data as unknown as Record<string, unknown> };
}

/**
 * Void a dispatch entry within the 2-minute grace window.
 * Controller only. Sets is_voided = TRUE via RLS-protected UPDATE.
 */
export async function voidDispatch(input: {
  dispatch_id: number;
  void_reason: string;
}): Promise<ActionResult> {
  const parsed = voidReasonSchema.safeParse(input);
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

  // The RLS policy will enforce the 2-minute grace window
  const { error } = await supabase
    .from("dispatch_logs")
    .update({
      is_voided: true,
      voided_at: new Date().toISOString(),
      voided_by: user.id,
      void_reason: parsed.data.void_reason,
    })
    .eq("id", parsed.data.dispatch_id)
    .eq("controller_id", user.id)
    .eq("is_voided", false);

  if (error) {
    console.error("voidDispatch database error:", error);
    if (error.message.includes("0 rows")) {
      return {
        success: false,
        error: "Undo window expired or entry already voided. Contact a TODA Official.",
      };
    }
    return { success: false, error: error.message };
  }

  // Purge server caches
  revalidatePath("/controller");
  revalidatePath("/official/audit");
  revalidatePath("/official/analytics");

  return { success: true };
}

/**
 * Get recent dispatch logs for the controller feed (top 50).
 */
export async function getRecentDispatches() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
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
    .eq("controller_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(50);

  if (error) return [];
  return data || [];
}

/**
 * Adjust trip count of a consecutive run in-place on the live control sheet.
 */
export async function updateRunTripCount(input: {
  driver_id: string;
  dispatch_ids: number[];
  target_count: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch current dispatches
  const { data: dispatches } = await supabase
    .from("dispatch_logs")
    .select("id, launch_count, logged_at, is_voided")
    .in("id", input.dispatch_ids)
    .eq("controller_id", user.id)
    .eq("is_voided", false);

  if (!dispatches || dispatches.length === 0) {
    return { success: false, error: "No active dispatches found to adjust" };
  }

  const currentTotal = dispatches.reduce((sum, d) => sum + d.launch_count, 0);
  const diff = input.target_count - currentTotal;

  if (diff === 0) return { success: true };

  if (diff > 0) {
    return logDispatch({
      driver_id: input.driver_id,
      launch_count: diff,
    });
  } else {
    const latest = dispatches[0];
    const newCount = latest.launch_count + diff;
    if (newCount > 0) {
      const { error } = await supabase
        .from("dispatch_logs")
        .update({ launch_count: newCount })
        .eq("id", latest.id)
        .eq("controller_id", user.id);

      if (error) return { success: false, error: error.message };
    } else {
      await voidDispatch({
        dispatch_id: latest.id,
        void_reason: "Adjusted launch count from live control sheet",
      });
    }

    revalidatePath("/controller");
    revalidatePath("/official/audit");
    revalidatePath("/official/analytics");
    return { success: true };
  }
}
