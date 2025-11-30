"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { credits } = useCredits();
  
  const hasTrackQuery = pathname === "/studio" && Boolean(searchParams?.get("track"));
  const hideNavbarPaths = ["/studio", "/library", "/privacy", "/terms", "/refund", "/payment"];
  const shouldHideNavbarByPath = hideNavbarPaths.some(path => 
    pathname === path || pathname?.startsWith(`${path}/`)
  );
  
  if (shouldHideNavbarByPath && !hasTrackQuery) {
    return null;
  }
  
  return <Navbar credits={credits} />;
};
