"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth-actions";
import {
  Shield,
  Radio,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/supabase";

interface NavUser {
  id: string;
  full_name: string;
  role: AppRole;
  email?: string | undefined;
}

const officialNavItems = [
  {
    label: "Daily Audit",
    href: "/official/audit",
    icon: ClipboardList,
  },
  {
    label: "Analytics",
    href: "/official/analytics",
    icon: BarChart3,
  },
  {
    label: "Driver Roster",
    href: "/official/drivers",
    icon: Users,
  },
];

const settingsNavItem = {
  label: "Settings",
  href: "/official/settings",
  icon: Settings,
};

export function DashboardNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isController = user.role === "controller";
  const isAdmin = user.role === "chairman" || user.role === "secretary";

  const navItems = isController
    ? []
    : [
        ...officialNavItems,
        ...(isAdmin ? [settingsNavItem] : []),
      ];

  return (
    <>
      {/* Desktop / Tablet Nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Nav */}
            <div className="flex items-center gap-8">
              <Link
                href={isController ? "/controller" : "/official/audit"}
                className="flex items-center gap-2.5"
              >
                <div className="w-8 h-8 bg-brand-primary rounded-xl flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm text-text-primary hidden sm:block">
                  TODA System
                </span>
              </Link>

              {/* Desktop Nav Links */}
              {!isController && (
                <nav className="hidden md:flex items-center gap-1">
                  {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all",
                          isActive
                            ? "bg-brand-soft text-brand-soft-text"
                            : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              )}

              {isController && (
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-status-success-text animate-pulse-soft" />
                  <span className="text-xs font-bold text-status-success-text uppercase tracking-wider">
                    Dispatch Terminal
                  </span>
                </div>
              )}
            </div>

            {/* Right: User Info & Actions */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs font-bold text-text-primary">
                    {user.full_name}
                  </p>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                    {user.role}
                  </p>
                </div>
                <div className="w-8 h-8 bg-surface-subtle rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-text-secondary">
                    {user.full_name.charAt(0)}
                  </span>
                </div>
              </div>

              <form action={signOut}>
                <button
                  type="submit"
                  className="p-2 text-text-muted hover:text-status-danger-text hover:bg-status-danger-bg rounded-full transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>

              {/* Mobile menu toggle */}
              {!isController && (
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden p-2 text-text-secondary hover:bg-surface-subtle rounded-full transition-all"
                >
                  {mobileOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && !isController && (
          <div className="md:hidden border-t border-border-subtle bg-surface-card animate-slide-down">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all",
                      isActive
                        ? "bg-brand-soft text-brand-soft-text"
                        : "text-text-secondary hover:bg-surface-subtle"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
