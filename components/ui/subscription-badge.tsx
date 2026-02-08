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
      "border border-foreground/10 bg-foreground/10 text-foreground/80 dark:border-white/15 dark:bg-white/15 dark:text-foreground/90",
  },
  hobby: {
    label: "Hobby",
    className:
      "border border-primary/20 bg-primary/15 text-primary dark:border-primary/35 dark:bg-primary/30 dark:text-primary-foreground",
  },
  free: {
    label: "Free",
    className:
      "border border-foreground/10 bg-foreground/10 text-foreground/80 dark:border-white/15 dark:bg-white/15 dark:text-foreground/90",
  },
};

export function SubscriptionBadge({
  tone = "free",
  label,
  className,
  tooltip,
}: {
  tone?: SubscriptionBadgeTone;
  label?: string;
  className?: string;
  tooltip?: string | null;
}) {
  const config = tierConfig[tone];
  const displayLabel = label ?? config.label;
  const title = tooltip ?? displayLabel;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        "shadow-[0_10px_26px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]",
        config.className,
        className
      )}
      title={title}
      aria-label={`Subscription: ${displayLabel}`}
    >
      <span>{displayLabel}</span>
    </span>
  );
}
