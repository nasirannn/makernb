"use client";

import { Separator } from "@/components/ui/separator";
import { ThemeModeToggle } from "@/components/ui/theme-mode-toggle";
import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { withLocalePrefix } from "@/lib/i18n/routing";

export const FooterSection = () => {
  const { t, locale } = useI18n();
  const withCurrentLocale = (path: string) => withLocalePrefix(path, locale);
  const renderBadges = () => (
    <>
      <a
        href="https://launchurapp.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
        aria-label={t("footerSection.featuredOnLaunchYourApp")}
      >
        <Image
          src="https://84826d28beedc6132a2353da3796e843.cdn.bubble.io/f1758681923686x163623620280710200/Featured_On_LaunchYourApp.svg"
          alt="LaunchYourApp Badge"
          width={202}
          height={44}
          className="block h-auto w-[202px]"
        />
      </a>
      <a
        href="https://www.superlaun.ch/products/1749"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
      >
        <Image
          src="https://www.superlaun.ch/badge.png"
          alt="Featured on Super Launch"
          width={300}
          height={300}
          className="block h-[54px] w-auto"
        />
      </a>
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
        title={t("footerSection.poweredByStartupFast")}
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
        href="https://twelve.tools"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
      >
        <Image
          src="https://twelve.tools/badge0-light.svg"
          alt="Featured on Twelve Tools"
          width={200}
          height={54}
          className="block dark:hidden"
        />
        <Image
          src="https://twelve.tools/badge0-dark.svg"
          alt="Featured on Twelve Tools"
          width={200}
          height={54}
          className="hidden dark:block"
        />
      </a>
      <a
        href="https://wired.business"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
      >
        <Image
          src="https://wired.business/badge0-light.svg"
          alt="Featured on Wired Business"
          width={200}
          height={54}
          className="block dark:hidden"
        />
        <Image
          src="https://wired.business/badge0-dark.svg"
          alt="Featured on Wired Business"
          width={200}
          height={54}
          className="hidden dark:block"
        />
      </a>
      <a
        href="https://frogdr.com/makernb.com?utm_source=makernb.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
      >
        <Image
          src="https://frogdr.com/makernb.com/badge-light.svg?badge=1"
          alt="Monitor your Domain Rating with FrogDR"
          width={250}
          height={54}
          className="block dark:hidden"
        />
        <Image
          src="https://frogdr.com/makernb.com/badge-dark.svg?badge=1"
          alt="Monitor your Domain Rating with FrogDR"
          width={250}
          height={54}
          className="hidden dark:block"
        />
      </a>
      <a
        href="https://toolsaiapp.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-2xl px-2 py-2"
      >
        <Image
          src="https://toolsaiapp.com/wp-content/uploads/2025/12/badge.png"
          alt="Featured on Tools AI App"
          width={200}
          height={54}
          className="block h-[54px] w-auto dark:hidden"
        />
        <Image
          src="https://toolsaiapp.com/wp-content/uploads/2025/12/badge-dark.png"
          alt="Featured on Tools AI App"
          width={200}
          height={54}
          className="hidden h-[54px] w-auto dark:block"
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
    </>
  );

  return (
    <footer id="footer" className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.02))] dark:bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.03))]" />

      <div className="container py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          <div className="space-y-4">
            <Link href={withCurrentLocale("/")} className="inline-flex items-center gap-3">
              <Image src="/logo.svg" alt={t("common.brandLogo")} width={32} height={32} />
              <span className="text-lg font-extrabold tracking-tight">MakeRNB</span>
            </Link>
            <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
              {t("footerSection.description")}
            </p>
            <a
              href="mailto:contact@makernb.com?subject=Contact from MakeRNB Website&body=Hello MakeRNB Team,%0D%0A%0D%0AI would like to get in touch with you regarding:%0D%0A%0D%0A%0D%0A%0D%0ABest regards,"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label={t("footerSection.emailMakeRnb")}
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{t("footerSection.product")}</p>
              <div className="flex flex-col gap-2 text-sm">
                <Link href={withCurrentLocale("/#features")} className="text-foreground/80 hover:text-foreground transition-colors">{t("footerSection.features")}</Link>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{t("footerSection.resources")}</p>
              <div className="flex flex-col gap-2 text-sm">
                <Link href={withCurrentLocale("/blog")} className="text-foreground/80 hover:text-foreground transition-colors">{t("nav.blog")}</Link>
                <Link href={withCurrentLocale("/pricing")} className="text-foreground/80 hover:text-foreground transition-colors">{t("nav.pricing")}</Link>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{t("footerSection.support")}</p>
              <div className="flex flex-col gap-2 text-sm">
                <Link href={withCurrentLocale("/privacy")} className="text-foreground/80 hover:text-foreground transition-colors">{t("footerSection.privacy")}</Link>
                <Link href={withCurrentLocale("/terms")} className="text-foreground/80 hover:text-foreground transition-colors">{t("footerSection.terms")}</Link>
                <Link href={withCurrentLocale("/refund")} className="text-foreground/80 hover:text-foreground transition-colors">{t("footerSection.refunds")}</Link>
              </div>
            </div>
          </div>
        </div>

        <Separator className="mt-8 mb-4" />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground text-left">
              {t("footerSection.copyright")}
            </div>
            <ThemeModeToggle variant="icon" />
          </div>

          <Separator />

          <div className="relative overflow-hidden">
            <div className="flex w-max items-center gap-3 animate-marquee motion-reduce:animate-none hover:[animation-play-state:paused]">
              {renderBadges()}
              {renderBadges()}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
