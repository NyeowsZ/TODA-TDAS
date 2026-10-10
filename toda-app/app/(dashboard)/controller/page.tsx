import type { Metadata } from "next";
import { ControllerTerminal } from "@/components/controller/controller-terminal";

export const metadata: Metadata = {
  title: "Dispatch Terminal",
  description: "Controller dispatch entry terminal for logging tricycle launches",
};

export default function ControllerPage() {
  return <ControllerTerminal />;
}
