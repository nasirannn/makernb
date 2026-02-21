"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { withLocalePrefix } from "@/lib/i18n/routing";
import { getZIndexClass } from "@/lib/z-index";

export const HeroSection = () => {
  const router = useRouter();
  const { t, locale } = useI18n();
  const withCurrentLocale = React.useCallback((path: string) => withLocalePrefix(path, locale), [locale]);
  const heroHeading = t("heroSection.heading");
  const heroHeadingParts = React.useMemo(() => heroHeading.split("R&B"), [heroHeading]);
  const [heroPrompt, setHeroPrompt] = React.useState("");
  const resolveMusicGeneratorPath = React.useCallback(() => {
    const trimmedPrompt = heroPrompt.trim();
    return trimmedPrompt
      ? withCurrentLocale(`/music-generator?prompt=${encodeURIComponent(trimmedPrompt)}`)
      : withCurrentLocale("/music-generator");
  }, [heroPrompt, withCurrentLocale]);

  const handleHeroPromptSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(resolveMusicGeneratorPath());
  }, [resolveMusicGeneratorPath, router]);

  return (
    <section className="app-shell relative w-full min-h-screen overflow-hidden">
      {/* Extra hero glow (theme-aware) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/18 via-[rgba(0,198,255,0.10)] to-transparent blur-3xl" />
        <div className="absolute -bottom-52 right-[-160px] h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-[rgba(255,190,83,0.16)] to-transparent blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent_0%,hsl(var(--background))_100%)]" />
      </div>

      <div className={`relative ${getZIndexClass("MAIN_CONTENT")} container mx-auto min-h-screen flex items-center pt-28 pb-24 md:pt-28`}>
        <div className="w-full max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(132deg,rgba(255,255,255,0.66),rgba(255,255,255,0.28))] px-2.5 py-1.5 text-foreground/85 shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur-md dark:bg-[linear-gradient(132deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] dark:shadow-[0_14px_30px_rgba(0,0,0,0.32)]">
            <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold leading-none text-primary-foreground">
              R&amp;B
            </span>
            <span className="pr-2 text-xs font-medium leading-none">{t("heroSection.badgeText")}</span>
          </div>

          <h1 className="mt-8 text-[2.6rem] leading-[0.98] tracking-tight font-black text-foreground sm:text-5xl lg:text-[4.6rem]">
            <span className="block">
              {heroHeadingParts.length === 2 ? (
                <>
                  {heroHeadingParts[0]}
                  <span className="hero-ink">R&amp;B</span>
                  {heroHeadingParts[1]}
                </>
              ) : (
                heroHeading
              )}
            </span>
          </h1>

          <form onSubmit={handleHeroPromptSubmit} className="mx-auto mt-7 w-full max-w-xl">
            <label htmlFor="hero-mood-input" className="sr-only">
              {t("heroSection.promptInputLabel")}
            </label>
            <div className="group relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 -inset-y-2 rounded-[1.5rem] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.30)_0%,rgba(0,0,0,0)_74%)] opacity-80 blur-2xl transition-opacity duration-300 group-focus-within:opacity-100"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-px rounded-[1.3rem] bg-[linear-gradient(122deg,hsl(var(--primary)/0.42),rgba(255,255,255,0.56),hsl(var(--primary)/0.25))] opacity-90"
              />
              <div className="relative flex h-12 items-center rounded-[1.25rem] border border-white/55 bg-[linear-gradient(132deg,rgba(255,255,255,0.84),rgba(255,255,255,0.58))] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),inset_0_-1px_0_rgba(148,163,184,0.16),0_24px_54px_rgba(2,6,23,0.20)] backdrop-blur-xl transition-[border-color,box-shadow,background] duration-200 focus-within:border-primary/45 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.96),inset_0_-1px_0_rgba(59,130,246,0.24),0_26px_60px_rgba(2,6,23,0.25)] dark:border-white/12 dark:bg-[linear-gradient(132deg,rgba(15,23,42,0.76),rgba(15,23,42,0.60))] dark:focus-within:border-primary/55">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent dark:via-white/35"
                />
                <input
                  id="hero-mood-input"
                  type="text"
                  value={heroPrompt}
                  onChange={(event) => setHeroPrompt(event.target.value)}
                  placeholder={t("heroSection.promptInputPlaceholder")}
                  className="h-full w-full border-0 bg-transparent text-center text-sm font-medium tracking-[0.01em] text-foreground placeholder:text-foreground/50 outline-none sm:text-base"
                />
              </div>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-center">
            <button
              type="button"
              onClick={() => router.push(resolveMusicGeneratorPath())}
              aria-label={t("heroSection.tryForFree")}
              className="inline-flex h-12 cursor-pointer items-center justify-center rounded-2xl bg-gradient-create px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              <span>{t("heroSection.tryForFree")}</span>
            </button>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            {t("heroSection.metaFreeDailyCredits")} <span className="mx-1 opacity-60">•</span> {t("heroSection.metaNoExperience")} <span className="mx-1 opacity-60">•</span> {t("heroSection.metaRoyaltyFree")}
          </div>

        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[8%] md:bottom-0 flex items-center justify-center">
        <svg
          className="hero-pulse-line w-[92%] max-w-5xl md:w-[78%]"
          viewBox="0 0 1200 160"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M0 80 H180 L210 80 L230 60 L250 80 L275 80 L295 25 L320 135 L345 80 L520 80 L540 70 L560 80 L585 80 L610 30 L635 130 L660 80 L840 80 L860 62 L880 80 L905 80 L930 35 L955 125 L980 80 H1200"
            stroke="hsl(var(--primary))"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <style jsx>{`
        .hero-ink {
          position: relative;
          display: inline-block;
          padding: 0 0.05em;
          background: linear-gradient(
            92deg,
            hsl(var(--primary)) 0%,
            rgba(0, 198, 255, 0.9) 55%,
            rgba(255, 190, 83, 0.95) 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .hero-pulse-line path {
          stroke-dasharray: 1600;
          stroke-dashoffset: 1600;
          animation: heroPulseLine 6.2s linear infinite;
          opacity: 0.32;
        }
        @keyframes heroPulseLine {
          0% {
            stroke-dashoffset: 1600;
          }
          22% {
            stroke-dashoffset: 1200;
          }
          44% {
            stroke-dashoffset: 720;
          }
          66% {
            stroke-dashoffset: 360;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </section>
  );
};
