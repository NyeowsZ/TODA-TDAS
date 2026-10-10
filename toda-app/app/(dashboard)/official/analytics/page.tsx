import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/official/analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Dispatch analytics, rush hour patterns, and operational insights",
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
