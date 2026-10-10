"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/actions/auth-actions";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn({ email, password });

      if (!result.success) {
        setError(result.error || "Invalid credentials");
        setIsLoading(false);
        return;
      }

      // The middleware will handle routing based on role
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-primary rounded-2xl shadow-lg shadow-blue-600/25 mb-4">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Sign in to your TODA Management account
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider pl-3">
            Email Address
          </label>
          <div className="flex items-center bg-surface-subtle rounded-2xl px-4 py-3.5 transition-all focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-brand-primary focus-within:shadow-sm">
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="controller@toda.ph"
              className="w-full bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
              required
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider pl-3">
            Password
          </label>
          <div className="flex items-center bg-surface-subtle rounded-2xl px-4 py-3.5 transition-all focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-brand-primary focus-within:shadow-sm">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="ml-2 text-text-muted hover:text-text-secondary transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-status-danger-bg text-status-danger-text text-xs font-semibold px-4 py-3 rounded-2xl animate-scale-in">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-14 bg-brand-primary hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold rounded-full shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-6"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-xs text-text-muted mt-8">
        Contact your TODA administrator for account access.
      </p>
    </div>
  );
}
