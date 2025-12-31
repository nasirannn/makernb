"use client";
import React from "react";
import Link from "next/link";

export const HeroSection = () => {
  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-[#f7f6f2]">
      {/* Soft background layers */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-28 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-200/60 via-rose-100/40 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 right-[-120px] h-[420px] w-[420px] rounded-full bg-gradient-to-tr from-slate-200/70 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,246,242,0.9))]" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto min-h-screen flex items-center justify-center">
        <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto w-full">
          <div className="text-center space-y-6">
            <div className="max-w-5xl mx-auto">
              <h1 className="text-4xl md:text-6xl lg:text-[96px] font-black text-black leading-[0.9] tracking-tight uppercase">
                <span className="block">Free Online</span>
                <span className="block text-primary">R&amp;B Music</span>
                <span className="block">Generator</span>
              </h1>
            </div>

            <p className="max-w-2xl mx-auto text-base md:text-lg text-black/70 leading-relaxed">
              Generate R&amp;B music with AI. Choose from New Jack Swing, Hip-Hop Soul, Quiet Storm, and Neo-Soul genres with customizable styles and instruments.
            </p>

            <div className="flex items-center justify-center gap-3">
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-all duration-300 text-base shadow-[0_12px_30px_rgba(0,0,0,0.2)]"
              >
                <span>Try for free</span>
              </Link>

              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-7 py-3 bg-transparent text-black font-semibold rounded-full border border-black/20 hover:border-black/40 hover:bg-black/5 transition-all duration-300 text-base"
              >
                <span>Explore</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-black/60">
              <span>✨ Free daily credits</span>
              <span>🎧 Export-ready audio</span>
              <span>🚀 No experience needed</span>
            </div>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <svg
          className="hero-pulse-line w-[78%] max-w-5xl"
          viewBox="0 0 1200 160"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M0 80 H180 L210 80 L230 60 L250 80 L275 80 L295 25 L320 135 L345 80 L520 80 L540 70 L560 80 L585 80 L610 30 L635 130 L660 80 L840 80 L860 62 L880 80 L905 80 L930 35 L955 125 L980 80 H1200"
            stroke="hsl(var(--primary))"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <style jsx>{`
        .hero-pulse-line path {
          stroke-dasharray: 1600;
          stroke-dashoffset: 1600;
          animation: heroPulseLine 5.2s linear infinite;
          opacity: 0.5;
        }
        @keyframes heroPulseLine {
          0% {
            stroke-dashoffset: 1600;
          }
          20% {
            stroke-dashoffset: 1200;
          }
          40% {
            stroke-dashoffset: 720;
          }
          60% {
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
