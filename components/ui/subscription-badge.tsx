"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SubscriptionTier = "basic" | "premium";

const tierConfig: Record<
  SubscriptionTier,
  { label: string; className: string; dotClassName: string }
> = {
  basic: {
    label: "Basic",
    className:
      "bg-foreground/6 text-foreground/70 dark:bg-white/10 dark:text-foreground/80",
    dotClassName: "bg-foreground/30 dark:bg-white/35",
  },
  premium: {
    label: "Premium",
    className:
      "bg-primary/12 text-primary dark:bg-primary/22 dark:text-primary-foreground",
    dotClassName: "bg-primary dark:bg-primary-foreground",
  },
};

export function SubscriptionBadge({
  tier,
  className,
}: {
  tier: SubscriptionTier;
  className?: string;
}) {
  const config = tierConfig[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
        "shadow-[0_10px_26px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]",
        config.className,
        className
      )}
      title={config.label}
      aria-label={`Subscription: ${config.label}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)} />
      <span>{config.label}</span>
    </span>
  );
}

