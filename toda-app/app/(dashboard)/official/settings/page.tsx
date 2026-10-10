import type { Metadata } from "next";
import { SystemSettings } from "@/components/official/system-settings";

export const metadata: Metadata = {
  title: "System Settings",
  description: "Configure system thresholds, grace windows, and operational parameters",
};

export default function SettingsPage() {
  return <SystemSettings />;
}
