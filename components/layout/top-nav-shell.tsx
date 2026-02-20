import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  NAV_BRAND_LINK_CLASSES,
  NAV_HEADER_BASE_CLASSES,
  NAV_LOGO_IMAGE_CLASSES,
} from "@/components/layout/nav-shared-styles";

interface TopNavShellProps {
  brandHref: string;
  brandAlt: string;
  className?: string;
  leadingAction?: ReactNode;
  centerContent?: ReactNode;
  rightContent?: ReactNode;
  children?: ReactNode;
}

export function TopNavShell({
  brandHref,
  brandAlt,
  className,
  leadingAction,
  centerContent,
  rightContent,
  children,
}: TopNavShellProps) {
  return (
    <header className={cn(NAV_HEADER_BASE_CLASSES, className)}>
      <div className={cn("relative flex h-12 items-center", leadingAction ? "gap-2" : "")}>
        {leadingAction ? (
          <div className="flex items-center justify-center">{leadingAction}</div>
        ) : null}
        <Link href={brandHref} className={NAV_BRAND_LINK_CLASSES}>
          <Image
            src="/logo.svg"
            alt={brandAlt}
            width={36}
            height={36}
            className={NAV_LOGO_IMAGE_CLASSES}
          />
          <span className="sidebar-brand">MakeRNB</span>
        </Link>
      </div>
      {centerContent}
      {children}
      {rightContent}
    </header>
  );
}
