import type { Metadata } from "next";
import { DriversRoster } from "@/components/official/drivers-roster";

export const metadata: Metadata = {
  title: "Driver Roster",
  description: "Member directory and driver registration management",
};

export default function DriversPage() {
  return <DriversRoster />;
}
