"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Settings, Plus, Trash2, X } from "lucide-react";

export interface RouteSelectorProps {
  isActive: boolean;
  selectedRoute: string;
  onRouteChange: (routeName: string) => void;
  onAdvance: () => void;
  onBackToOmnibox: () => void;
  routes?: string[];
  onRoutesUpdate?: (routes: string[]) => void;
}

const DEFAULT_ROUTES = ["Guinsay", "Taytay", "Sabang"];
const STORAGE_ROUTES_KEY = "dacotoda_routes";
const STORAGE_LAST_ROUTE_KEY = "dacotoda_last_route";

export function RouteSelector({
  isActive,
  selectedRoute,
  onRouteChange,
  onAdvance,
  onBackToOmnibox,
  routes: externalRoutes,
  onRoutesUpdate,
}: RouteSelectorProps) {
  // Routes list
  const [routes, setRoutes] = useState<string[]>(() => {
    if (externalRoutes && externalRoutes.length > 0) return externalRoutes;
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_ROUTES_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn("Could not read routes from localStorage", e);
      }
    }
    return DEFAULT_ROUTES;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRouteInput, setNewRouteInput] = useState("");
  const [readyForEnter, setReadyForEnter] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep routes synced with external updates if provided
  useEffect(() => {
    if (externalRoutes && externalRoutes.length > 0) {
      setRoutes(externalRoutes);
    }
  }, [externalRoutes]);

  // Current selected index
  const selectedIndex = Math.max(
    0,
    routes.findIndex((r) => r.toLowerCase() === selectedRoute.toLowerCase())
  );

  // Arm Enter transition only after the key from previous card is released
  useEffect(() => {
    if (isActive) {
      setReadyForEnter(false);

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          setTimeout(() => {
            setReadyForEnter(true);
          }, 80);
          window.removeEventListener("keyup", handleKeyUp);
        }
      };

      window.addEventListener("keyup", handleKeyUp);

      // Fallback timer
      const timer = setTimeout(() => {
        setReadyForEnter(true);
      }, 300);

      // Focus the selected route button
      const focusTimer = setTimeout(() => {
        buttonRefs.current[selectedIndex]?.focus();
      }, 50);

      return () => {
        window.removeEventListener("keyup", handleKeyUp);
        clearTimeout(timer);
        clearTimeout(focusTimer);
      };
    } else {
      setReadyForEnter(false);
    }
  }, [isActive, selectedIndex]);

  // Global key navigation for Route Selector when active
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if route management modal is open
      if (isModalOpen) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIdx = (selectedIndex + 1) % routes.length;
        const nextRoute = routes[nextIdx];
        onRouteChange(nextRoute);
        try {
          localStorage.setItem(STORAGE_LAST_ROUTE_KEY, nextRoute);
        } catch (_) {}
        buttonRefs.current[nextIdx]?.focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIdx = (selectedIndex - 1 + routes.length) % routes.length;
        const prevRoute = routes[prevIdx];
        onRouteChange(prevRoute);
        try {
          localStorage.setItem(STORAGE_LAST_ROUTE_KEY, prevRoute);
        } catch (_) {}
        buttonRefs.current[prevIdx]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (readyForEnter) {
          onAdvance();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onBackToOmnibox();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, isModalOpen, selectedIndex, routes, readyForEnter, onRouteChange, onAdvance, onBackToOmnibox]);

  const handleSelectClick = (route: string, e?: React.MouseEvent) => {
    // Suppress synthetic keyboard click (e.detail === 0 when triggered via Enter keyup on focused button)
    if (e && e.detail === 0) {
      return;
    }
    onRouteChange(route);
    try {
      localStorage.setItem(STORAGE_LAST_ROUTE_KEY, route);
    } catch (_) {}
    onAdvance();
  };

  const handleAddRoute = () => {
    const trimmed = newRouteInput.trim();
    if (!trimmed || routes.some((r) => r.toLowerCase() === trimmed.toLowerCase())) return;

    const updated = [...routes, trimmed];
    setRoutes(updated);
    try {
      localStorage.setItem(STORAGE_ROUTES_KEY, JSON.stringify(updated));
    } catch (_) {}
    if (onRoutesUpdate) onRoutesUpdate(updated);
    setNewRouteInput("");
  };

  const handleDeleteRoute = (indexToRemove: number) => {
    if (routes.length <= 1) return; // Keep at least one route
    const updated = routes.filter((_, idx) => idx !== indexToRemove);
    setRoutes(updated);
    try {
      localStorage.setItem(STORAGE_ROUTES_KEY, JSON.stringify(updated));
    } catch (_) {}
    if (onRoutesUpdate) onRoutesUpdate(updated);

    if (selectedIndex >= updated.length) {
      const fallback = updated[0];
      onRouteChange(fallback);
      try {
        localStorage.setItem(STORAGE_LAST_ROUTE_KEY, fallback);
      } catch (_) {}
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        id="route-card"
        className={`shrink-0 bg-white rounded-2xl p-3 shadow-xs transition-all duration-200 flex flex-col ${
          isActive
            ? "border-2 border-blue-500 ring-4 ring-blue-50"
            : "border border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>Route</span>
              {isActive && (
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                  ← / → Active
                </span>
              )}
            </span>

            {/* Admin CRUD Modal trigger */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 transition-colors"
              title="Admin: Manage Routes (CRUD)"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            Use <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded font-bold text-slate-700">←</kbd>{" "}
            <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded font-bold text-slate-700">→</kbd> to select
          </span>
        </div>

        {/* Horizontal Route Buttons */}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(routes.length, 4)}, minmax(0, 1fr))` }}
        >
          {routes.map((route, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={route}
                ref={(el) => {
                  buttonRefs.current[idx] = el;
                }}
                type="button"
                tabIndex={isSelected && isActive ? 0 : -1}
                onClick={(e) => handleSelectClick(route, e)}
                onFocus={() => {
                  if (idx !== selectedIndex) {
                    onRouteChange(route);
                    try {
                      localStorage.setItem(STORAGE_LAST_ROUTE_KEY, route);
                    } catch (_) {}
                  }
                }}
                className={`h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 select-none cursor-pointer border focus:outline-none ${
                  isSelected
                    ? isActive
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500 ring-offset-1"
                      : "bg-blue-50 text-blue-900 border-blue-400 font-extrabold"
                    : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <span>{route}</span>
                {isSelected && isActive && (
                  <span className="text-[10px] font-mono opacity-80">↵</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Admin Route CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Admin: Route Management</h3>
                <p className="text-xs text-slate-500">Add, edit, or remove dispatch routes</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Route List */}
            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
              {routes.map((r, idx) => (
                <div
                  key={r}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="font-bold text-slate-800">{r}</span>
                  </div>
                  {routes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRoute(idx)}
                      className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Route Input */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <input
                type="text"
                value={newRouteInput}
                onChange={(e) => setNewRouteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddRoute();
                  }
                }}
                placeholder="New route name..."
                className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={handleAddRoute}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
