'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Client component to inject canonical link with trailing slash
 * Only used on home page to override Next.js default behavior
 */
export function HomeCanonical() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }

    // Remove any existing canonical links
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    if (existingCanonical) {
      existingCanonical.remove();
    }

    // Create and inject new canonical link with trailing slash
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = 'https://makernb.com/';
    document.head.appendChild(link);

    // Cleanup function
    return () => {
      link.remove();
    };
  }, [pathname]);

  return null; // This component doesn't render anything
}
