"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook for managing the 2-minute undo grace window countdown.
 * Provides a real-time countdown in seconds for a given log timestamp.
 */
export function useGraceTimer(
  loggedAt: string | null,
  windowMinutes: number = 2
) {
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const calculateRemaining = useCallback(() => {
    if (!loggedAt) return 0;
    const loggedDate = new Date(loggedAt);
    const expiresAt = new Date(
      loggedDate.getTime() + windowMinutes * 60 * 1000
    );
    const now = new Date();
    return Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
    );
  }, [loggedAt, windowMinutes]);

  useEffect(() => {
    if (!loggedAt) {
      setSecondsRemaining(0);
      return;
    }

    // Initial calculation
    setSecondsRemaining(calculateRemaining());

    // Update every second
    intervalRef.current = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loggedAt, calculateRemaining]);

  const isWithinGrace = secondsRemaining > 0;

  const formattedTime = `${Math.floor(secondsRemaining / 60)}:${String(
    secondsRemaining % 60
  ).padStart(2, "0")}`;

  return {
    secondsRemaining,
    isWithinGrace,
    formattedTime,
  };
}
