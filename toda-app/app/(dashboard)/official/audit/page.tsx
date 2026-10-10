import type { Metadata } from "next";
import { AuditDashboard } from "@/components/official/audit-dashboard";

export const metadata: Metadata = {
  title: "Daily Audit",
  description: "Daily dispatch audit ledger and reconciliation dashboard",
};

export default function AuditPage() {
  return <AuditDashboard />;
}
