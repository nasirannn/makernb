import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: "MakeRNB - AI-Powered Music Creation for R&B",
  description: "Create authentic R&B music with AI. Generate professional-quality tracks in New Jack Swing, Hip-Hop Soul, Quiet Storm, and Neo-Soul genres.",
  alternates: {
    canonical: 'https://makernb.com',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" suppressHydrationWarning className="dark">
      <body className={cn("min-h-screen bg-background", inter.className)}>
        <AuthProvider>
          <CreditsProvider>
            <ThemeProvider>
              <NavbarWrapper />

              {children}
              
              <Toaster
                position="top-right"
                expand={false}
              />
            </ThemeProvider>
          </CreditsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
