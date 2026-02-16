"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";
import { getZIndexClass } from "@/lib/z-index";
import { isStudioAreaPath } from "@/lib/studio-features";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { credits } = useCredits();
  const [showStickyCta, setShowStickyCta] = useState(false);
  
  const isStudioPath = isStudioAreaPath(pathname);
  const hasTrackQuery = isStudioPath && Boolean(searchParams?.get("track"));
  const hideNavbarPaths = ["/library", "/privacy", "/terms", "/refund", "/payment"];
  const shouldHideNavbarByPath = hideNavbarPaths.some(path => 
    pathname === path || pathname?.startsWith(`${path}/`)
  ) || isStudioPath;

  useEffect(() => {
    if (pathname !== "/") {
      setShowStickyCta(false);
      return;
    }

    const handleScroll = () => {
      setShowStickyCta(window.scrollY > 120);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);
  
  if (shouldHideNavbarByPath && !hasTrackQuery) {
    return null;
  }
  
  return (
    <>
      <Navbar credits={credits} />
    </>
  );
};
