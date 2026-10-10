"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DriverSummary } from "@/types/supabase";

/**
 * Hook that maintains an in-memory Map<body_number, DriverSummary> for
 * sub-5ms lookups at the controller terminal.
 *
 * - Hydrates once on mount from the `view_driver_active_summaries` view.
 * - Subscribes to Supabase Realtime for live roster changes.
 * - Provides instant search by body number prefix.
 */
export function useDriverCache() {
  const [drivers, setDrivers] = useState<Map<string, DriverSummary>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  // Initial hydration
  useEffect(() => {
    async function hydrate() {
      setIsLoading(true);
      try {
        const { data, error: fetchError } = await supabaseRef.current
          .from("drivers")
          .select(
            `
            id,
            body_number,
            status,
            driver_profile_versions!inner (
              full_name,
              driver_photo_url,
              version
            )
          `
          )
          .order("body_number");

        if (fetchError) throw fetchError;

        const map = new Map<string, DriverSummary>();
        (data || []).forEach((driver: Record<string, unknown>) => {
          const versions = driver.driver_profile_versions as Array<{
            full_name: string;
            driver_photo_url: string | null;
            version: number;
          }>;
          // Get highest version
          const latest = versions.reduce((a, b) =>
            a.version > b.version ? a : b
          );
          map.set(driver.body_number as string, {
            id: driver.id as string,
            body_number: driver.body_number as string,
            full_name: latest.full_name,
            driver_photo_url: latest.driver_photo_url,
            status: driver.status as DriverSummary["status"],
          });
        });
        setDrivers(map);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load roster");
      } finally {
        setIsLoading(false);
      }
    }

    hydrate();

    // Subscribe to realtime changes on drivers table
    const channel = supabaseRef.current
      .channel("driver-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => {
          // Re-hydrate entire cache on any driver change
          hydrate();
        }
      )
      .subscribe();

    return () => {
      supabaseRef.current.removeChannel(channel);
    };
  }, []);

  /**
   * Lookup a driver by exact body number.
   */
  const lookupByBodyNumber = useCallback(
    (bodyNumber: string): DriverSummary | undefined => {
      return drivers.get(bodyNumber);
    },
    [drivers]
  );

  /**
   * Search drivers by body number prefix (for typeahead).
   */
  const searchByPrefix = useCallback(
    (prefix: string): DriverSummary[] => {
      if (!prefix) return [];
      const results: DriverSummary[] = [];
      drivers.forEach((driver) => {
        if (driver.body_number.startsWith(prefix)) {
          results.push(driver);
        }
      });
      return results.slice(0, 10); // Limit suggestions
    },
    [drivers]
  );

  return {
    drivers,
    isLoading,
    error,
    lookupByBodyNumber,
    searchByPrefix,
    totalDrivers: drivers.size,
  };
}
