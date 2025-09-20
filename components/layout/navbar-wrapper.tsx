"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const { credits } = useCredits();
  
  // 在音乐生成页面不显示导航栏
  if (pathname === "/studio") {
    return null;
  }
  
  return <Navbar credits={credits} />;
};
