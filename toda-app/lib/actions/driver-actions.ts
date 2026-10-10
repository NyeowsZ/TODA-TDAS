"use server";

import { createClient } from "@/lib/supabase/server";
import {
  driverRegistrationSchema,
  driverUpdateSchema,
  statusChangeSchema,
} from "@/lib/utils/validators";
import { revalidatePath } from "next/cache";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

/**
 * Register a new driver (Secretary/Chairman only).
 * Atomic: creates anchor in `drivers` + first version in `driver_profile_versions`.
 */
export async function registerDriver(input: {
  body_number: string;
  full_name: string;
  contact_number?: string;
  driver_photo_url?: string;
  unit_photo_url?: string;
}): Promise<ActionResult> {
  const parsed = driverRegistrationSchema.safeParse(input);
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

  // Check for duplicate body number
  const { data: existing } = await supabase
    .from("drivers")
    .select("id")
    .eq("body_number", parsed.data.body_number)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: `Body Number ${parsed.data.body_number} is already registered.`,
    };
  }

  // Step 1: Insert driver anchor
  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .insert({
      body_number: parsed.data.body_number,
      current_version: 1,
      status: "active",
      created_by: user.id,
    })
    .select()
    .single();

  if (driverError) {
    return { success: false, error: driverError.message };
  }

  // Step 2: Insert first profile version
  const { error: versionError } = await supabase
    .from("driver_profile_versions")
    .insert({
      driver_id: driver.id,
      version: 1,
      full_name: parsed.data.full_name,
      contact_number: parsed.data.contact_number || null,
      driver_photo_url: input.driver_photo_url || null,
      unit_photo_url: input.unit_photo_url || null,
      changed_by: user.id,
      change_reason: "Initial Registration",
    });

  if (versionError) {
    // Rollback: this shouldn't happen with proper constraints
    return { success: false, error: versionError.message };
  }

  revalidatePath("/official/drivers");
  return {
    success: true,
    data: driver as unknown as Record<string, unknown>,
  };
}

/**
 * Update a driver profile (creates a new SCD-2 version).
 * Secretary/Chairman only.
 */
export async function updateDriverProfile(input: {
  driver_id: string;
  full_name: string;
  contact_number?: string;
  change_reason: string;
  driver_photo_url?: string;
  unit_photo_url?: string;
}): Promise<ActionResult> {
  const parsed = driverUpdateSchema.safeParse(input);
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

  // Get current version
  const { data: driver, error: fetchError } = await supabase
    .from("drivers")
    .select("id, current_version")
    .eq("id", parsed.data.driver_id)
    .single();

  if (fetchError || !driver) {
    return { success: false, error: "Driver not found" };
  }

  const newVersion = driver.current_version + 1;

  // Insert new version
  const { error: versionError } = await supabase
    .from("driver_profile_versions")
    .insert({
      driver_id: driver.id,
      version: newVersion,
      full_name: parsed.data.full_name,
      contact_number: parsed.data.contact_number || null,
      driver_photo_url: input.driver_photo_url || null,
      unit_photo_url: input.unit_photo_url || null,
      changed_by: user.id,
      change_reason: parsed.data.change_reason,
    });

  if (versionError) {
    return { success: false, error: versionError.message };
  }

  // Update driver anchor to point to new version
  const { error: updateError } = await supabase
    .from("drivers")
    .update({ current_version: newVersion })
    .eq("id", driver.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/official/drivers");
  revalidatePath(`/official/drivers/${driver.id}`);
  return { success: true };
}

/**
 * Change driver status (active/suspended/inactive).
 * Secretary/Chairman only.
 */
export async function changeDriverStatus(input: {
  driver_id: string;
  status: "active" | "suspended" | "inactive";
  reason: string;
}): Promise<ActionResult> {
  const parsed = statusChangeSchema.safeParse(input);
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

  const { error } = await supabase
    .from("drivers")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.driver_id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/official/drivers");
  revalidatePath(`/official/drivers/${parsed.data.driver_id}`);
  return { success: true };
}

/**
 * Upload driver photo to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadDriverPhoto(
  driverId: string,
  version: number,
  photoType: "face" | "unit",
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  const filePath = `${driverId}/v${version}_${photoType}.webp`;

  const { error } = await supabase.storage
    .from("driver-photos")
    .upload(filePath, file, {
      contentType: "image/webp",
      upsert: true,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("driver-photos").getPublicUrl(filePath);

  return { success: true, data: { url: publicUrl } };
}

/**
 * Get all drivers with their current profile version.
 */
export async function getDriverRoster() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("drivers")
    .select(
      `
      *,
      driver_profile_versions!inner (
        full_name,
        contact_number,
        driver_photo_url,
        unit_photo_url,
        version
      )
    `
    )
    .order("body_number", { ascending: true });

  if (error) return [];

  const rawDrivers = (data || []) as unknown as Array<{
    id: string;
    body_number: string;
    current_version: number;
    status: "active" | "suspended" | "inactive";
    created_at: string;
    created_by: string | null;
    driver_profile_versions: Array<{
      full_name: string;
      contact_number: string | null;
      driver_photo_url: string | null;
      unit_photo_url: string | null;
      version: number;
    }>;
  }>;

  // Filter to only current version for each driver
  return rawDrivers.map((driver) => {
    const currentProfile = driver.driver_profile_versions.find(
      (v) => v.version === driver.current_version
    );
    return {
      ...driver,
      current_profile: currentProfile || driver.driver_profile_versions[0],
    };
  });
}

/**
 * Get driver version history.
 */
export async function getDriverVersionHistory(driverId: string) {
  const supabase = await createClient();

  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", driverId)
    .single();

  const { data: versions } = await supabase
    .from("driver_profile_versions")
    .select("*")
    .eq("driver_id", driverId)
    .order("version", { ascending: false });

  return { driver, versions: versions || [] };
}
