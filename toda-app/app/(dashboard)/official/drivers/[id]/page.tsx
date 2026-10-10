import type { Metadata } from "next";
import { DriverVersionHistory } from "@/components/official/driver-version-history";

export const metadata: Metadata = {
  title: "Driver History",
  description: "Driver profile version history (SCD-2)",
};

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriverVersionHistory driverId={id} />;
}
