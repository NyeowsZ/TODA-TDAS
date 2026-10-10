import Link from "next/link";
import { ArrowRight, Shield, Zap, BarChart3 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="animate-fade-in text-center max-w-2xl mx-auto">
          {/* Logo Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-soft text-brand-soft-text text-xs font-semibold rounded-full mb-8 tracking-wider uppercase">
            <Shield className="w-3.5 h-3.5" />
            TODA Management System
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-extrabold text-text-primary tracking-tight leading-tight mb-4">
            Dispatch operations,{" "}
            <span className="text-brand-primary">streamlined.</span>
          </h1>

          <p className="text-lg text-text-secondary max-w-lg mx-auto mb-10 leading-relaxed">
            Real-time dispatch logging, driver roster management, and
            operational oversight for TODA associations.
          </p>

          {/* CTA */}
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand-primary hover:bg-brand-hover text-white font-bold text-base rounded-full shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98]"
          >
            Sign In
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-16 animate-slide-up">
          <div className="bg-surface-card rounded-2xl p-5 border border-border-subtle shadow-sm">
            <div className="w-10 h-10 bg-brand-soft rounded-xl flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-brand-primary" />
            </div>
            <h3 className="font-bold text-sm text-text-primary mb-1">
              Sub-2s Dispatch
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Lightning-fast body number lookup from local cache. No network
              delay during rush hours.
            </p>
          </div>

          <div className="bg-surface-card rounded-2xl p-5 border border-border-subtle shadow-sm">
            <div className="w-10 h-10 bg-status-success-bg rounded-xl flex items-center justify-center mb-3">
              <Shield className="w-5 h-5 text-status-success-text" />
            </div>
            <h3 className="font-bold text-sm text-text-primary mb-1">
              Tamper-Proof Ledger
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Append-only dispatch logs with immutable audit trail. Zero data
              loss, zero hard deletes.
            </p>
          </div>

          <div className="bg-surface-card rounded-2xl p-5 border border-border-subtle shadow-sm">
            <div className="w-10 h-10 bg-status-warning-bg rounded-xl flex items-center justify-center mb-3">
              <BarChart3 className="w-5 h-5 text-status-warning-text" />
            </div>
            <h3 className="font-bold text-sm text-text-primary mb-1">
              Real-Time Analytics
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Hourly dispatch histograms, rush hour patterns, and daily
              reconciliation at a glance.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-text-muted">
        <p>Dacotoda Management System &middot; GMT+8 Philippines</p>
      </footer>
    </main>
  );
}
