"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const { credits } = useCredits();
  
  // 在音乐生成页面和音乐库页面不显示导航栏
  if (pathname === "/studio" || pathname === "/library") {
    return null;
  }
  
  return <Navbar credits={credits} />;
};
