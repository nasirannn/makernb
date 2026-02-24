import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { PricingModalProvider } from "@/contexts/PricingModalContext";
import { PricingModal } from "@/components/ui/pricing-modal";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { I18nProvider } from "@/lib/i18n/provider";
import { LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n/routing";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
  const htmlLang = normalizeLocale(localeCookie);

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans")}>
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

        <I18nProvider>
          <AuthProvider>
            <CreditsProvider>
              <SubscriptionProvider>
                <PricingModalProvider>
                  <ThemeProvider>
                    <Suspense fallback={null}>
                      <NavbarWrapper />
                    </Suspense>

                    {children}
                    
                    <PricingModal />
                    
                    <Toaster
                      position="bottom-right"
                      expand={false}
                    />
                  </ThemeProvider>
                </PricingModalProvider>
              </SubscriptionProvider>
            </CreditsProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
