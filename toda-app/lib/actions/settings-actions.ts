"use server";

import { createClient } from "@/lib/supabase/server";
import { systemSettingSchema } from "@/lib/utils/validators";
import { revalidatePath } from "next/cache";
import type { Json } from "@/types/supabase";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

/**
 * Get all system settings.
 */
export async function getSystemSettings() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .order("key");

  if (error) return [];
  return data || [];
}

/**
 * Update a system setting (Chairman only — enforced by RLS).
 */
export async function updateSystemSetting(input: {
  key: string;
  value: Record<string, unknown>;
}): Promise<ActionResult> {
  const parsed = systemSettingSchema.safeParse(input);
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
    .from("system_settings")
    .update({
      value: parsed.data.value as unknown as Json,
      updated_by: user.id,
    })
    .eq("key", parsed.data.key);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/official/settings");
  return { success: true };
}
