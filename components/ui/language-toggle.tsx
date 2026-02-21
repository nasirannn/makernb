"use client";

import React from "react";
import { Check, Languages } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/lib/i18n/messages";

interface LanguageToggleProps {
  className?: string;
  size?: "sm" | "md";
  variant?: "default" | "nav";
  navMenuDirection?: "top" | "bottom";
}

const LANGUAGE_OPTIONS: Array<{ value: AppLocale; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "中文" },
  { value: "ja", label: "日本語" },
];

export function LanguageToggle({
  className,
  size = "sm",
  variant = "default",
  navMenuDirection = "bottom",
}: LanguageToggleProps) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navContainerRef = React.useRef<HTMLDivElement | null>(null);
  const navTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const isNavVariant = variant === "nav";
  const triggerSizeClass =
    size === "md" ? "h-10 w-10" : isNavVariant ? "h-9 w-9" : "h-8 w-8";

  const clearCloseTimeout = React.useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const openMenu = React.useCallback(() => {
    if (!isNavVariant) return;
    clearCloseTimeout();
    setOpen(true);
  }, [clearCloseTimeout, isNavVariant]);

  const closeMenu = React.useCallback(() => {
    if (!isNavVariant) return;
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      navTriggerRef.current?.blur();
    }, 150);
  }, [clearCloseTimeout, isNavVariant]);

  const closeMenuImmediately = React.useCallback(() => {
    if (!isNavVariant) return;
    clearCloseTimeout();
    setOpen(false);
    navTriggerRef.current?.blur();
  }, [clearCloseTimeout, isNavVariant]);

  React.useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  React.useEffect(() => {
    if (!isNavVariant || !open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target as Node)) {
        closeMenuImmediately();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeMenuImmediately, isNavVariant, open]);

  if (isNavVariant) {
    return (
      <div
        ref={navContainerRef}
        className="relative language-dropdown-container"
        onMouseEnter={openMenu}
        onMouseLeave={closeMenu}
      >
        <button
          ref={navTriggerRef}
          type="button"
          aria-label={t("common.switchLanguage")}
          title={t("common.switchLanguage")}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            clearCloseTimeout();
            setOpen((prev) => {
              const next = !prev;
              if (!next) {
                navTriggerRef.current?.blur();
              }
              return next;
            });
          }}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center rounded-2xl bg-transparent text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground",
            "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            open ? "bg-foreground/5 text-foreground" : "",
            triggerSizeClass,
            className
          )}
        >
          <Languages
            className={cn(
              "shrink-0 transition-colors",
              size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"
            )}
          />
        </button>

        {open ? (
          <div
            role="menu"
            className={cn(
              "absolute right-0 z-[110] min-w-[120px] rounded-2xl border border-black/10 bg-background p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.12)]",
              navMenuDirection === "top" ? "bottom-full mb-2" : "top-full mt-2",
              size === "md" ? "w-[132px]" : "w-[120px]"
            )}
            onMouseEnter={openMenu}
            onMouseLeave={closeMenu}
          >
            {LANGUAGE_OPTIONS.map((option) => {
              const active = locale === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    setLocale(option.value);
                    closeMenuImmediately();
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/70 hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span>{option.label}</span>
                  {active ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("common.switchLanguage")}
          title={t("common.switchLanguage")}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center transition-colors",
            "rounded-2xl bg-transparent text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            triggerSizeClass,
            className
          )}
        >
          <Languages
            className={cn(
              "shrink-0 transition-colors",
              size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "min-w-[120px] p-1.5",
          size === "md" ? "w-[132px]" : "w-[120px]"
        )}
      >
        {LANGUAGE_OPTIONS.map((option) => {
          const active = locale === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setLocale(option.value)}
              className={cn(
                "cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium",
                active ? "bg-primary/10 text-primary" : ""
              )}
            >
              <span>{option.label}</span>
              {active ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
