"use client";

import React from "react";
import type { User } from "@supabase/supabase-js";
import { Coins, LogOut, PencilLine } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SubscriptionBadge } from "@/components/ui/subscription-badge";
import type { SubscriptionBadgeTone } from "@/components/ui/subscription-badge";
import { formatLocalizedNumber } from "@/lib/locale-format";
import { cn } from "@/lib/utils";

type TranslationVars = Record<string, string | number | null | undefined>;
type TranslateFn = (key: string, vars?: TranslationVars) => string;

interface DesktopUserDropdownProps {
  user: User;
  displayName: string;
  credits: number | null;
  tierCode?: string | null;
  tierName: string;
  billingNotice: string | null;
  t: TranslateFn;
  onOpenPricing: () => void;
  onEditProfile: () => void;
  onSignOut: () => void | Promise<void>;
  className?: string;
}

export function DesktopUserDropdown({
  user,
  displayName,
  credits,
  tierCode,
  tierName,
  billingNotice,
  t,
  onOpenPricing,
  onEditProfile,
  onSignOut,
  className,
}: DesktopUserDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const clearHoverTimeout = React.useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = React.useCallback(() => {
    clearHoverTimeout();
    setOpen(true);
  }, [clearHoverTimeout]);

  const handleMouseLeave = React.useCallback(() => {
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      hoverTimeoutRef.current = null;
    }, 120);
  }, [clearHoverTimeout]);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        clearHoverTimeout();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [clearHoverTimeout, open]);

  React.useEffect(() => {
    return () => {
      clearHoverTimeout();
    };
  }, [clearHoverTimeout]);

  const resolvedTierTone: SubscriptionBadgeTone =
    tierCode === "starter" || tierCode === "hobby" ? tierCode : "free";

  return (
    <div
      ref={containerRef}
      className={cn("relative user-menu-container", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onFocus={handleMouseEnter}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("common.openUserMenu")}
      >
        <Avatar className="w-10 h-10 cursor-pointer hover:scale-105 transition-transform duration-200">
          <AvatarImage
            src={
              user.user_metadata?.avatar_url ||
              user.user_metadata?.picture ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`
            }
            alt={t("common.userAvatar")}
          />
          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-600 text-white font-semibold text-sm">
            {displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </button>

      {open && (
        <div className="absolute right-0 top-12 min-w-52 w-max bg-background border border-black/10 rounded-2xl p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.12)] z-[110]">
          <div className="px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-foreground font-semibold text-sm truncate flex-1">
                {displayName || t("common.user")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenPricing();
                }}
                className="group inline-flex items-center gap-1.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={t("common.openPricing")}
                title={billingNotice ?? undefined}
              >
                <SubscriptionBadge
                  tone={resolvedTierTone}
                  label={tierName}
                  tooltip={billingNotice ?? undefined}
                  className="cursor-pointer transition-colors !bg-primary !text-primary-foreground hover:!bg-primary/90 !border-primary/40 dark:!border-primary/50 !py-1"
                />
              </button>
            </div>
            <p className="text-muted-foreground text-xs truncate">{user.email}</p>
          </div>

          <div className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-primary">
                <Coins className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-medium text-foreground">{t("common.credits")}</span>
            </div>
            <span className="min-w-6 text-right text-xs font-semibold text-foreground tabular-nums">
              {credits === null ? "..." : formatLocalizedNumber(credits)}
            </span>
          </div>

          <button
            onClick={() => {
              setOpen(false);
              onEditProfile();
            }}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground transition-colors"
          >
            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-foreground/70">
              <PencilLine className="h-3.5 w-3.5" />
            </div>
            <span className="text-foreground font-medium text-sm">{t("common.editProfile")}</span>
          </button>

          <button
            onClick={async () => {
              setOpen(false);
              await onSignOut();
            }}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground transition-colors"
          >
            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-foreground/70">
              <LogOut className="h-3.5 w-3.5" />
            </div>
            <span className="text-foreground font-medium text-sm">{t("common.signOut")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
