"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export const HeroSection = () => {
  const router = useRouter();

  return (
    <section className="app-shell relative w-full min-h-screen overflow-hidden">
      {/* Extra hero glow (theme-aware) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/18 via-[rgba(0,198,255,0.10)] to-transparent blur-3xl" />
        <div className="absolute -bottom-52 right-[-160px] h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-[rgba(255,190,83,0.16)] to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto min-h-screen flex items-center pt-20 pb-16 md:pt-28">
        <div className="w-full max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-foreground/70">
            <span>Especially For The Old-School R&B Lovers</span>
          </div>

          <h1 className="mt-6 text-[2.6rem] leading-[0.98] tracking-tight font-black text-foreground sm:text-5xl lg:text-[4.6rem]">
            <span className="block">
              Free Online <span className="hero-ink">AI R&amp;B</span> Music Generator
            </span>
            <span className="block mt-2 text-foreground/85 text-[1.05rem] sm:text-xl lg:text-2xl font-extrabold tracking-tight">
              Create R&amp;B songs in different old-school musical styles
            </span>
          </h1>

          <div className="mt-7 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/studio")}
              aria-label="Try for free"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 text-base shadow-[0_16px_44px_rgba(0,0,0,0.18)]"
            >
              <span>Try for free</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/explore")}
              aria-label="Listen to examples"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-foreground/5 text-foreground font-semibold rounded-full hover:bg-foreground/10 transition-colors duration-200 text-base"
            >
              <span>Explore</span>
            </button>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Free daily credits <span className="mx-1 opacity-60">•</span> No experience needed <span className="mx-1 opacity-60">•</span> 100% Royalty-Free
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {[
              { label: "New Jack Swing", icon: "New Jack Swing Icon.webp" },
              { label: "Neo‑Soul", icon: "Neo-Soul Icon.webp" },
              { label: "Quiet Storm", icon: "Quiet Storm Icon.webp" },
              { label: "Hip-Hop Soul", icon: "Hip-Hop Soul Icon.webp" },
              { label: "Contemporary R&B", icon: "Contemporary R&B Icon.webp" },
            ].map(({ label, icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/75"
              >
                <Image
                  src={`/hero/${encodeURIComponent(icon)}`}
                  alt=""
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 opacity-90"
                  aria-hidden="true"
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden md:flex items-center justify-center">
        <svg
          className="hero-pulse-line w-[78%] max-w-5xl"
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
