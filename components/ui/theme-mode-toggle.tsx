"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeModeToggle({
  className,
  size = "sm",
  variant = "segmented",
}: {
  className?: string;
  size?: "sm" | "md";
  variant?: "segmented" | "icon";
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted ? theme === "dark" : false;

  if (variant === "icon") {
    const btnSize = size === "md" ? "h-10 w-10" : "h-9 w-9";
    const iconSize = size === "md" ? "h-4 w-4" : "h-4 w-4";

    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-transparent text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors",
          btnSize,
          className
        )}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Dark mode"}
      >
        {isDark ? <Sun className={iconSize} /> : <Moon className={iconSize} />}
      </button>
    );
  }

  const btnSize = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const containerSize = size === "md" ? "h-11 px-1.5 gap-2" : "h-10 px-1 gap-1.5";
  const iconSize = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <div
      role="group"
      aria-label="Theme toggle"
      className={cn(
        "inline-flex items-center rounded-full border border-foreground/10 bg-background/80 shadow-[0_1px_2px_rgba(0,0,0,0.08)] backdrop-blur-sm",
        containerSize,
        className
      )}
    >
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "flex items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          btnSize,
          isDark
            ? "bg-foreground/10 text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
            : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
        )}
        aria-pressed={isDark}
        aria-label="Switch to dark mode"
        title="Dark mode"
      >
        <Moon className={iconSize} />
      </button>
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "flex items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          btnSize,
          isDark
            ? "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
            : "bg-foreground/10 text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
        )}
        aria-pressed={!isDark}
        aria-label="Switch to light mode"
        title="Light mode"
      >
        <Sun className={iconSize} />
      </button>
    </div>
  );
}
