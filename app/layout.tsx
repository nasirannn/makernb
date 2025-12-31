import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { FeaturePermissionsProvider } from "@/contexts/FeaturePermissionsContext";
import { PricingModalProvider } from "@/contexts/PricingModalContext";
import { PricingModal } from "@/components/ui/pricing-modal";
import { Toaster } from "@/components/ui/sonner";
import { Inter } from 'next/font/google';
import { Suspense } from "react";

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: "MakeRNB - AI-Powered Music Creation for R&B",
  description: "MakeRNB lets you instantly create and download professional R&B songs with AI. Explore Neo-Soul, Quiet Storm & more — free, online, and easy to use.",
  other: {
    'google-adsense-account': 'ca-pub-4929701767055366',
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
    ],
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={cn("min-h-screen bg-background font-sans", inter.variable)}>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-VFWQ5T4YWG"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-VFWQ5T4YWG');
          `}
        </Script>
        
        {/* Google AdSense */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4929701767055366"
          async
          crossOrigin="anonymous"
        />

        <AuthProvider>
          <CreditsProvider>
            <FeaturePermissionsProvider>
              <PricingModalProvider>
                <ThemeProvider>
                  <Suspense fallback={null}>
                    <NavbarWrapper />
                  </Suspense>

                  {children}
                  
                  <PricingModal />
                  
                  <Toaster
                    position="top-right"
                    expand={false}
                  />
                </ThemeProvider>
              </PricingModalProvider>
            </FeaturePermissionsProvider>
          </CreditsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
