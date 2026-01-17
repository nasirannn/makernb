"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Navbar } from "./navbar";
import { useCredits } from "@/contexts/CreditsContext";
import { getZIndexClass } from "@/lib/z-index";

export const NavbarWrapper = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { credits } = useCredits();
  const [showStickyCta, setShowStickyCta] = useState(false);
  
  const hasTrackQuery = pathname === "/studio" && Boolean(searchParams?.get("track"));
  const hideNavbarPaths = ["/studio", "/library", "/privacy", "/terms", "/refund", "/payment"];
  const shouldHideNavbarByPath = hideNavbarPaths.some(path => 
    pathname === path || pathname?.startsWith(`${path}/`)
  );

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
      {pathname === "/" && showStickyCta && (
        <div className={`fixed top-3 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-4xl ${getZIndexClass('NAVBAR')} bg-primary border border-white/10 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.4)]`}>
          <div className="flex items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-3 text-primary-foreground font-extrabold tracking-tight">
              <Image src="logo.svg" alt="MakeRNB Logo" width={28} height={28} />
              <span>Create tracks with MakeRNB</span>
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center rounded-full bg-background px-5 py-2 text-sm font-semibold text-foreground border border-black/10 hover:bg-black/5 transition-colors"
            >
              Try For Free
            </Link>
          </div>
        </div>
      )}
    </>
  );
};
