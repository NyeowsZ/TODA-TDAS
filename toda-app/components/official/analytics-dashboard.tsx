"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart3,
  TrendingUp,
  Users,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowUpRight,
  Shield,
  Award,
  RefreshCw,
} from "lucide-react";
import { formatManilaDate } from "@/lib/utils/format-timezone";

type TimeRange = "today" | "7d" | "30d";

interface AnalyticsData {
  totalLaunches: number;
  totalVoids: number;
  voidRate: string;
  uniqueDrivers: number;
  peakHour: string;
  hourlyTrends: Record<number, number>;
  dailyTrends: Array<{ date: string; count: number }>;
  topDrivers: Array<{
    driverId: string;
    bodyNumber: string;
    name: string;
    launchCount: number;
  }>;
}

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchAnalytics = (range: TimeRange) => {
    startTransition(async () => {
      const supabase = createClient();

      // Calculate start date
      const now = new Date();
      let days = 7;
      if (range === "today") days = 1;
      if (range === "30d") days = 30;

      const startDate = new Date();
      startDate.setDate(now.getDate() - days);
      const startIso = startDate.toISOString();

      const { data: rawLogs, error } = await supabase
        .from("dispatch_logs")
        .select(
          `
          id,
          launch_count,
          logged_at,
          is_voided,
          driver_id,
          drivers (
            body_number,
            driver_profile_versions (
              full_name
            )
          )
        `
        )
        .gte("logged_at", startIso)
        .order("logged_at", { ascending: true });

      if (error || !rawLogs) {
        console.error("Failed to load analytics:", error);
        return;
      }

      const logs = rawLogs as unknown as Array<{
        id: number;
        launch_count: number;
        logged_at: string;
        is_voided: boolean;
        driver_id: string;
        drivers: {
          body_number: string;
          driver_profile_versions: Array<{ full_name: string }>;
        };
      }>;

      const activeLogs = logs.filter((l) => !l.is_voided);
      const voidedLogs = logs.filter((l) => l.is_voided);

      // Total launches
      const totalLaunches = activeLogs.reduce((acc, curr) => acc + curr.launch_count, 0);
      const totalVoids = voidedLogs.length;
      const voidRate =
        logs.length > 0 ? ((totalVoids / logs.length) * 100).toFixed(1) : "0.0";

      // Unique drivers
      const uniqueDriverSet = new Set(activeLogs.map((l) => l.driver_id));

      // Hourly trends (Manila UTC+8)
      const hourlyTrends: Record<number, number> = {};
      for (let h = 5; h <= 22; h++) hourlyTrends[h] = 0;

      activeLogs.forEach((l) => {
        const d = new Date(l.logged_at);
        const manilaHour = (d.getUTCHours() + 8) % 24;
        if (hourlyTrends[manilaHour] !== undefined) {
          hourlyTrends[manilaHour] += l.launch_count;
        }
      });

      // Peak hour
      let peakHourNum = 0;
      let peakHourCount = 0;
      Object.entries(hourlyTrends).forEach(([hour, count]) => {
        if (count > peakHourCount) {
          peakHourNum = parseInt(hour);
          peakHourCount = count;
        }
      });

      // Daily trends
      const dailyMap: Record<string, number> = {};
      activeLogs.forEach((l) => {
        const d = new Date(l.logged_at);
        const manilaDate = new Date(d.getTime() + 8 * 3600000).toISOString().split("T")[0];
        dailyMap[manilaDate] = (dailyMap[manilaDate] || 0) + l.launch_count;
      });

      const dailyTrends = Object.entries(dailyMap).map(([date, count]) => ({
        date,
        count,
      }));

      // Top Drivers Leaderboard
      const driverMap: Record<
        string,
        { bodyNumber: string; name: string; count: number }
      > = {};

      activeLogs.forEach((l) => {
        const id = l.driver_id;
        const bodyNum = l.drivers?.body_number || "---";
        const name = l.drivers?.driver_profile_versions?.[0]?.full_name || "Unknown";

        if (!driverMap[id]) {
          driverMap[id] = { bodyNumber: bodyNum, name, count: 0 };
        }
        driverMap[id].count += l.launch_count;
      });

      const topDrivers = Object.entries(driverMap)
        .map(([driverId, val]) => ({
          driverId,
          bodyNumber: val.bodyNumber,
          name: val.name,
          launchCount: val.count,
        }))
        .sort((a, b) => b.launchCount - a.launchCount)
        .slice(0, 10);

      setData({
        totalLaunches,
        totalVoids,
        voidRate,
        uniqueDrivers: uniqueDriverSet.size,
        peakHour: `${String(peakHourNum).padStart(2, "0")}:00 - ${String(
          peakHourNum + 1
        ).padStart(2, "0")}:00`,
        hourlyTrends,
        dailyTrends,
        topDrivers,
      });
    });
  };

  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [timeRange]);

  const maxHourlyCount = useMemo(() => {
    if (!data?.hourlyTrends) return 1;
    const values = Object.values(data.hourlyTrends);
    return Math.max(...values, 1);
  }, [data]);

  const maxDailyCount = useMemo(() => {
    if (!data?.dailyTrends || data.dailyTrends.length === 0) return 1;
    return Math.max(...data.dailyTrends.map((d) => d.count), 1);
  }, [data]);

  const maxLeaderboardCount = useMemo(() => {
    if (!data?.topDrivers || data.topDrivers.length === 0) return 1;
    return data.topDrivers[0].launchCount || 1;
  }, [data]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-light">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dispatch Analytics & Insights
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Operational throughput, rush hour patterns, and driver dispatch leaderboard
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex bg-slate-100 p-1 rounded-full">
            {(
              [
                { id: "today", label: "Today" },
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setTimeRange(item.id)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
                  timeRange === item.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics(timeRange)}
            disabled={isPending}
            className="p-2.5 rounded-full bg-surface-card border border-border-light text-slate-600 hover:text-blue-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface-card rounded-2xl p-5 border border-border-light shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Launches</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-900">
            {data?.totalLaunches.toLocaleString() ?? "0"}
          </div>
          <p className="text-[11px] text-slate-400">Total verified passenger departures</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface-card rounded-2xl p-5 border border-border-light shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Active Drivers</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-900">
            {data?.uniqueDrivers.toLocaleString() ?? "0"}
          </div>
          <p className="text-[11px] text-slate-400">Unique units deployed in period</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface-card rounded-2xl p-5 border border-border-light shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Peak Rush Window</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {data?.peakHour ?? "None"}
          </div>
          <p className="text-[11px] text-slate-400">Highest passenger queue turnover</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface-card rounded-2xl p-5 border border-border-light shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Void / Cancel Rate</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-rose-600">
            {data?.voidRate ?? "0.0"}%
          </div>
          <p className="text-[11px] text-slate-400">
            {data?.totalVoids ?? 0} voided entries recorded
          </p>
        </div>
      </div>

      {/* Two Column Layout: Daily Trends + Hourly Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Launch Trend */}
        <div className="bg-surface-card rounded-2xl p-6 border border-border-light shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Daily Launch Volume</h2>
              <p className="text-xs text-slate-400">Aggregated departures per operational day</p>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              PST (UTC+8)
            </span>
          </div>

          <div className="h-44 pt-6 flex items-end gap-2">
            {!data?.dailyTrends || data.dailyTrends.length === 0 ? (
              <div className="w-full text-center text-slate-400 text-xs py-8">
                No dispatch volume recorded in this time range.
              </div>
            ) : (
              data.dailyTrends.map((d) => {
                const height = (d.count / maxDailyCount) * 100;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="relative w-full flex justify-center">
                      <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                        {d.count} launches
                      </div>
                      <div
                        style={{ height: `${Math.max(height, 6)}%` }}
                        className="w-full max-w-[32px] bg-blue-600 hover:bg-blue-700 rounded-t-lg transition-all"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[42px]">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Hourly Rush Hour Pattern */}
        <div className="bg-surface-card rounded-2xl p-6 border border-border-light shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Hourly Distribution Curve</h2>
              <p className="text-xs text-slate-400">05:00 to 22:00 cumulative passenger peaks</p>
            </div>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
              Terminal Traffic
            </span>
          </div>

          <div className="h-44 pt-6 flex items-end gap-1.5">
            {Array.from({ length: 18 }, (_, i) => i + 5).map((hour) => {
              const count = data?.hourlyTrends?.[hour] || 0;
              const height = (count / maxHourlyCount) * 100;
              const isPeak = count === maxHourlyCount && count > 0;

              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="relative w-full flex justify-center">
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                      {count} launches
                    </div>
                    <div
                      style={{ height: `${Math.max(height, 4)}%` }}
                      className={`w-full max-w-[20px] rounded-t transition-all ${
                        isPeak
                          ? "bg-blue-600 shadow-md shadow-blue-500/25"
                          : count > 0
                          ? "bg-slate-300 group-hover:bg-blue-400"
                          : "bg-slate-100"
                      }`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">
                    {String(hour).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Drivers Leaderboard */}
      <div className="bg-surface-card rounded-2xl p-6 border border-border-light shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border-light/60">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Top 10 Active Units</h2>
              <p className="text-xs text-slate-400">Drivers with the highest registered departures</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Ranked by Launches
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {!data?.topDrivers || data.topDrivers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No driver activity recorded for this period.
            </div>
          ) : (
            data.topDrivers.map((driver, index) => {
              const barPercent = (driver.launchCount / maxLeaderboardCount) * 100;
              const isTop3 = index < 3;

              return (
                <div
                  key={driver.driverId}
                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <span
                    className={`w-6 text-center font-mono text-xs font-extrabold ${
                      index === 0
                        ? "text-amber-500"
                        : index === 1
                        ? "text-slate-400"
                        : index === 2
                        ? "text-amber-700"
                        : "text-slate-400"
                    }`}
                  >
                    #{index + 1}
                  </span>

                  <span className="font-mono text-xs font-extrabold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg shrink-0">
                    #{driver.bodyNumber}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {driver.name}
                      </span>
                      <span className="font-mono text-xs font-extrabold text-blue-600">
                        {driver.launchCount} launches
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${barPercent}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          isTop3 ? "bg-blue-600" : "bg-slate-400"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
