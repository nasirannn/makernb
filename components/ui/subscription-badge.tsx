"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/lib/subscription-tier";

export type { SubscriptionTier } from "@/lib/subscription-tier";

export type SubscriptionBadgeTone = SubscriptionTier | "free";

const tierConfig: Record<
  SubscriptionBadgeTone,
  { label: string; className: string }
> = {
  starter: {
    label: "Starter",
    className:
      "bg-foreground/6 text-foreground/70 dark:bg-white/10 dark:text-foreground/80",
  },
  hobby: {
    label: "Hobby",
    className:
      "bg-primary/12 text-primary dark:bg-primary/22 dark:text-primary-foreground",
  },
  free: {
    label: "Free",
    className:
      "bg-foreground/6 text-foreground/70 dark:bg-white/10 dark:text-foreground/80",
  },
};

export function SubscriptionBadge({
  tone = "free",
  label,
  className,
}: {
  tone?: SubscriptionBadgeTone;
  label?: string;
  className?: string;
}) {
  const config = tierConfig[tone];
  const displayLabel = label ?? config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        "shadow-[0_10px_26px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]",
        config.className,
        className
      )}
      title={displayLabel}
      aria-label={`Subscription: ${displayLabel}`}
    >
      <span>{displayLabel}</span>
    </span>
  );
}
