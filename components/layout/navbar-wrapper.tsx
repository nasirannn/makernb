"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";
import { isStudioAreaPath } from "@/lib/studio-features";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { credits } = useCredits();
  
  const isStudioPath = isStudioAreaPath(pathname);
  const hasTrackQuery = isStudioPath && Boolean(searchParams?.get("track"));
  const hideNavbarPaths = ["/library", "/privacy", "/terms", "/refund", "/payment"];
  const shouldHideNavbarByPath = hideNavbarPaths.some(path => 
    pathname === path || pathname?.startsWith(`${path}/`)
  ) || isStudioPath;

  if (shouldHideNavbarByPath && !hasTrackQuery) {
    return null;
  }
  
  return (
    <>
      <Navbar credits={credits} />
    </>
  );
};
