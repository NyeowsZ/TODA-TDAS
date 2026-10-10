import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: {
    default: "TODA Management System",
    template: "%s | TODA Management System",
  },
  description:
    "Tricycle Operators and Drivers Association Dispatch and Administration System — real-time dispatch logging, driver management, and operational oversight.",
  keywords: ["TODA", "dispatch", "tricycle", "management", "Philippines"],
  authors: [{ name: "Dacotoda" }],
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-surface-canvas text-text-primary font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
