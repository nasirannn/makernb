"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const { credits } = useCredits();
  
  // 在音乐生成页面、音乐库页面、隐私政策和条款页面不显示导航栏
  if (pathname === "/studio" || pathname === "/library" || pathname === "/privacy" || pathname === "/terms") {
    return null;
  }
  
  return <Navbar credits={credits} />;
};
