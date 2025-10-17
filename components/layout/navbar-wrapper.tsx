"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const { credits } = useCredits();
  
  // 在音乐生成页面、音乐库页面、隐私政策、条款页面和支付页面不显示导航栏
  const hideNavbarPaths = ["/studio", "/library", "/privacy", "/terms", "/payment"];
  const shouldHideNavbar = hideNavbarPaths.some(path => 
    pathname === path || pathname?.startsWith(`${path}/`)
  );
  
  if (shouldHideNavbar) {
    return null;
  }
  
  return <Navbar credits={credits} />;
};
