"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";
import { isStudioAreaPath } from "@/lib/studio-features";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const { credits } = useCredits();

  const hideNavbarPaths = ["/privacy", "/terms", "/refund", "/payment"];
  const shouldHideNavbarByPath = hideNavbarPaths.some(path => 
    pathname === path || pathname?.startsWith(`${path}/`)
  ) || isStudioAreaPath(pathname) || pathname === "/library" || pathname?.startsWith("/library/");

  if (shouldHideNavbarByPath) {
    return null;
  }
  
  return (
    <>
      <Navbar credits={credits} />
    </>
  );
};
