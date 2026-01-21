"use client";

import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import Image from "next/image";

export const FooterSection = () => {
  return (
    <footer id="footer" className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.02))] dark:bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.03))]" />

      <div className="container py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image src="/logo.svg" alt="MakeRNB Logo" width={32} height={32} />
              <span className="text-lg font-extrabold tracking-tight">MakeRNB</span>
            </Link>
            <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
              Create authentic R&B music with AI — from soulful ballads to contemporary grooves. Generate export‑ready tracks in minutes.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/studio"
                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Try for free
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center rounded-full bg-background/40 px-4 py-2 text-sm font-semibold text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.10)] hover:bg-foreground/5 transition-colors"
              >
                Explore
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Product</p>
              <div className="flex flex-col gap-2 text-sm">
                <Link href="/#features" className="text-foreground/80 hover:text-foreground transition-colors">Features</Link>
                <Link href="/#pricing" className="text-foreground/80 hover:text-foreground transition-colors">Pricing</Link>
                <Link href="/blog" className="text-foreground/80 hover:text-foreground transition-colors">Blog</Link>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Support</p>
              <div className="flex flex-col gap-2 text-sm">
                <a
                  href="mailto:contact@makernb.com?subject=Contact from MakeRNB Website&body=Hello MakeRNB Team,%0D%0A%0D%0AI would like to get in touch with you regarding:%0D%0A%0D%0A%0D%0A%0D%0ABest regards,"
                  className="text-foreground/80 hover:text-foreground transition-colors"
                >
                  Contact
                </a>
                <Link href="/privacy" className="text-foreground/80 hover:text-foreground transition-colors">Privacy</Link>
                <Link href="/terms" className="text-foreground/80 hover:text-foreground transition-colors">Terms</Link>
                <Link href="/refund" className="text-foreground/80 hover:text-foreground transition-colors">Refunds</Link>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; 2025 MakeRNB. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://www.producthunt.com/products/makernb?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-makernb"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl px-3 py-2"
            >
              <Image
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1026584&theme=light&t=1768827078984"
                alt="MakeRNB - Create authentic R&B tracks with AI, instantly | Product Hunt"
                width={250}
                height={54}
                className="block w-[220px] h-[48px] dark:hidden"
              />
              <Image
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1026584&theme=dark&t=1760448580929"
                alt="MakeRNB - Create authentic R&B tracks with AI, instantly | Product Hunt"
                width={250}
                height={54}
                className="hidden w-[220px] h-[48px] dark:block"
              />
            </a>
            <a
              href="https://startupfa.st"
              target="_blank"
              rel="noopener noreferrer"
              title="Powered by Startup Fast"
              className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
            >
              <Image
                src="https://startupfa.st/images/badges/powered-by-light.svg"
                alt="Powered by Startup Fast"
                width={150}
                height={44}
                className="block dark:hidden"
              />
              <Image
                src="https://startupfa.st/images/badges/powered-by-dark.svg"
                alt="Powered by Startup Fast"
                width={150}
                height={44}
                className="hidden dark:block"
              />
            </a>
            <a
              href="https://startupfa.me/s/makernb?utm_source=makernb.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
            >
              <Image
                src="https://startupfa.me/badges/featured/light.webp"
                alt="MakeRNB - Featured on Startup Fame"
                width={171}
                height={54}
                className="block dark:hidden"
              />
              <Image
                src="https://startupfa.me/badges/featured/dark.webp"
                alt="MakeRNB - Featured on Startup Fame"
                width={171}
                height={54}
                className="hidden dark:block"
              />
            </a>
            <a
              href="https://fazier.com/launches/makernb.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
            >
              <Image
                src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=launched&theme=light"
                width={120}
                height={32}
                alt="Fazier badge"
                className="block"
              />
            </a>
            <a
              href="https://open-launch.com/projects/makernb"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
            >
              <Image
                src="https://open-launch.com/api/badge/a65b5aca-78a6-4d8b-960e-5de6ee455816/featured-light.svg"
                alt="Featured on Open-Launch"
                width={200}
                height={50}
                className="block dark:hidden"
              />
              <Image
                src="https://open-launch.com/api/badge/a65b5aca-78a6-4d8b-960e-5de6ee455816/featured-dark.svg"
                alt="Featured on Open-Launch"
                width={200}
                height={50}
                className="hidden dark:block"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
