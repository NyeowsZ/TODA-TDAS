"use client";

import { useGraceTimer } from "@/hooks/use-grace-timer";
import { formatManila } from "@/lib/utils/format-timezone";
import { cn } from "@/lib/utils";
import type { DispatchLog } from "@/types/supabase";
import { User } from "lucide-react";

interface FeedItem extends DispatchLog {
  body_number: string;
  driver_name: string;
  driver_photo_url: string | null;
  _optimistic?: boolean;
}

interface RecentFeedProps {
  items: FeedItem[];
  onUndo: (item: FeedItem) => void;
}

export function RecentFeed({ items, onUndo }: RecentFeedProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-text-muted">No dispatches logged yet</p>
        <p className="text-xs text-text-muted mt-1">
          Enter a body number above to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
          Recent Dispatches
        </h2>
        <span className="text-[11px] font-mono text-text-muted">
          {items.length}/50
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <FeedRow
            key={`${item.id}-${index}`}
            item={item}
            onUndo={() => onUndo(item)}
          />
        ))}
      </div>
    </div>
  );
}

function FeedRow({
  item,
  onUndo,
}: {
  item: FeedItem;
  onUndo: () => void;
}) {
  const { isWithinGrace, formattedTime } = useGraceTimer(item.logged_at);

  return (
    <div
      className={cn(
        "bg-surface-card rounded-2xl p-3.5 flex items-center justify-between border shadow-sm transition-all",
        item.is_voided
          ? "border-rose-200 bg-rose-50/50 opacity-60"
          : "border-surface-subtle",
        item._optimistic && "animate-slide-up"
      )}
    >
      <div className="flex items-center gap-3">
        {item.driver_photo_url ? (
          <img
            src={item.driver_photo_url}
            alt={item.driver_name}
            className="w-9 h-9 rounded-full object-cover ring-1 ring-surface-subtle"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-surface-subtle flex items-center justify-center">
            <User className="w-4 h-4 text-text-muted" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-extrabold px-1.5 py-0.5 bg-surface-subtle text-text-primary rounded-lg">
              #{item.body_number}
            </span>
            <p
              className={cn(
                "text-xs font-bold",
                item.is_voided
                  ? "line-through text-text-muted"
                  : "text-text-primary"
              )}
            >
              {item.launch_count}x {item.launch_count === 1 ? "Launch" : "Launches"}
            </p>
          </div>
          <p className="text-[11px] text-text-muted font-mono mt-0.5">
            {formatManila(item.logged_at)} · GMT+8
            {item.is_voided && (
              <span className="text-status-danger-text ml-2 font-sans font-semibold">
                VOIDED
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Undo Button (within grace window and not already voided) */}
      {isWithinGrace && !item.is_voided && (
        <button
          onClick={onUndo}
          className="px-3 py-1.5 bg-status-danger-bg hover:bg-rose-100 text-status-danger-text text-xs font-bold rounded-full flex items-center gap-1.5 transition-all shrink-0"
        >
          <span>Undo</span>
          <span className="font-mono text-[10px] bg-rose-200/60 px-1.5 py-0.5 rounded-full">
            {formattedTime}
          </span>
        </button>
      )}
    </div>
  );
}
