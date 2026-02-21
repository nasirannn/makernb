"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";
import { isStudioAreaPath } from "@/lib/studio-features";
import { stripLocalePrefix } from "@/lib/i18n/routing";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname);
  const { credits } = useCredits();

  const hideNavbarPaths = ["/privacy", "/terms", "/refund", "/payment"];
  const shouldHideNavbarByPath = hideNavbarPaths.some(path => 
    normalizedPathname === path || normalizedPathname.startsWith(`${path}/`)
  ) || isStudioAreaPath(pathname)
    || normalizedPathname === "/library" || normalizedPathname.startsWith("/library/")
    || normalizedPathname === "/lyrics-generator" || normalizedPathname.startsWith("/lyrics-generator/");

  if (shouldHideNavbarByPath) {
    return null;
  }
  
  return (
    <>
      <Navbar credits={credits} />
    </>
  );
};
