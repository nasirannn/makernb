"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Blend,
  Disc3,
  Expand,
  Mic,
  Music,
  Music2,
  Pause,
  Play,
} from "lucide-react";
import { CustomAudioWaveIndicator } from "@/components/ui/audio-wave-indicator";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

interface FeatureItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  headline: string;
  description: string;
  bullets: string[];
  image: string;
  imageAlt: string;
  accent: "cyan" | "amber" | "emerald" | "rose" | "blue" | "violet";
}

export const FeaturesSection = () => {
  const { t } = useI18n();
  const rowRefs = useRef<Array<HTMLElement | null>>([]);
  const vocalSeparationPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [visibleRows, setVisibleRows] = useState<Set<number>>(new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isVocalSeparationPreviewPlaying, setIsVocalSeparationPreviewPlaying] = useState(false);
  const [hasVocalSeparationPreviewStarted, setHasVocalSeparationPreviewStarted] = useState(false);
  const [isVocalSeparationPreviewHovered, setIsVocalSeparationPreviewHovered] = useState(false);
  const vocalSeparationPreviewUrl =
    "https://cdn.makernb.com/audio/1c8b3dd3-64bc-4757-9773-501caefb70b2/593b30dc1d3ce4a00418d928ef61b64e/Cold_in_December_instrumental_1762669692241.mp3";

  const featureList: FeatureItem[] = [
    {
      id: "music-generator",
      icon: Music2,
      title: t("studioFeatures.musicGenerator"),
      headline: t("landingFeatures.items.musicGenerator.headline"),
      description: t("landingFeatures.items.musicGenerator.description"),
      bullets: [
        t("landingFeatures.items.musicGenerator.bulletOne"),
        t("landingFeatures.items.musicGenerator.bulletTwo"),
        t("landingFeatures.items.musicGenerator.bulletThree"),
      ],
      image: "/banner/mark_bus.webp",
      imageAlt: t("landingFeatures.items.musicGenerator.imageAlt"),
      accent: "cyan",
    },
    {
      id: "music-extender",
      icon: Expand,
      title: t("studioFeatures.musicExtender"),
      headline: t("landingFeatures.items.musicExtender.headline"),
      description: t("landingFeatures.items.musicExtender.description"),
      bullets: [
        t("landingFeatures.items.musicExtender.bulletOne"),
        t("landingFeatures.items.musicExtender.bulletTwo"),
        t("landingFeatures.items.musicExtender.bulletThree"),
      ],
      image: "/banner/street.webp",
      imageAlt: t("landingFeatures.items.musicExtender.imageAlt"),
      accent: "amber",
    },
    {
      id: "music-cover",
      icon: Disc3,
      title: t("studioFeatures.musicCover"),
      headline: t("landingFeatures.items.musicCover.headline"),
      description: t("landingFeatures.items.musicCover.description"),
      bullets: [
        t("landingFeatures.items.musicCover.bulletOne"),
        t("landingFeatures.items.musicCover.bulletTwo"),
        t("landingFeatures.items.musicCover.bulletThree"),
      ],
      image: "/banner/studio_female.webp",
      imageAlt: t("landingFeatures.items.musicCover.imageAlt"),
      accent: "emerald",
    },
    {
      id: "vocal-separation",
      icon: Mic,
      title: t("studioFeatures.vocalSeparation"),
      headline: t("landingFeatures.items.vocalSeparation.headline"),
      description: t("landingFeatures.items.vocalSeparation.description"),
      bullets: [
        t("landingFeatures.items.vocalSeparation.bulletOne"),
        t("landingFeatures.items.vocalSeparation.bulletTwo"),
        t("landingFeatures.items.vocalSeparation.bulletThree"),
      ],
      image: "/banner/car_beach.webp",
      imageAlt: t("landingFeatures.items.vocalSeparation.imageAlt"),
      accent: "cyan",
    },
    {
      id: "mashup",
      icon: Blend,
      title: t("studioFeatures.mashup"),
      headline: t("landingFeatures.items.mashup.headline"),
      description: t("landingFeatures.items.mashup.description"),
      bullets: [
        t("landingFeatures.items.mashup.bulletOne"),
        t("landingFeatures.items.mashup.bulletTwo"),
        t("landingFeatures.items.mashup.bulletThree"),
      ],
      image: "/banner/fashion_girl.webp",
      imageAlt: t("landingFeatures.items.mashup.imageAlt"),
      accent: "rose",
    },
    {
      id: "add-vocal",
      icon: Mic,
      title: t("studioFeatures.addVocal"),
      headline: t("landingFeatures.items.addVocal.headline"),
      description: t("landingFeatures.items.addVocal.description"),
      bullets: [
        t("landingFeatures.items.addVocal.bulletOne"),
        t("landingFeatures.items.addVocal.bulletTwo"),
        t("landingFeatures.items.addVocal.bulletThree"),
      ],
      image: "/banner/studio_male.webp",
      imageAlt: t("landingFeatures.items.addVocal.imageAlt"),
      accent: "blue",
    },
    {
      id: "add-melody",
      icon: Music,
      title: t("studioFeatures.addMelody"),
      headline: t("landingFeatures.items.addMelody.headline"),
      description: t("landingFeatures.items.addMelody.description"),
      bullets: [
        t("landingFeatures.items.addMelody.bulletOne"),
        t("landingFeatures.items.addMelody.bulletTwo"),
        t("landingFeatures.items.addMelody.bulletThree"),
      ],
      image: "/banner/bed.webp",
      imageAlt: t("landingFeatures.items.addMelody.imageAlt"),
      accent: "violet",
    },
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPreference);
      return () => mediaQuery.removeEventListener("change", syncPreference);
    }

    mediaQuery.addListener(syncPreference);
    return () => mediaQuery.removeListener(syncPreference);
  }, []);

  useEffect(() => {
    const totalRows = featureList.length;

    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      setVisibleRows(new Set(Array.from({ length: totalRows }, (_, index) => index)));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const indexAttr = (entry.target as HTMLElement).dataset.featureIndex;
          if (!indexAttr) return;

          const index = Number(indexAttr);
          if (Number.isNaN(index)) return;

          setVisibleRows((prev) => {
            if (prev.has(index)) return prev;
            const next = new Set(prev);
            next.add(index);
            return next;
          });

          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    rowRefs.current.forEach((row) => {
      if (row) observer.observe(row);
    });

    return () => observer.disconnect();
  }, [featureList.length, prefersReducedMotion]);

  useEffect(() => {
    const previewAudio = vocalSeparationPreviewRef.current;
    if (!previewAudio) return;

    const handlePlay = () => setIsVocalSeparationPreviewPlaying(true);
    const handlePause = () => setIsVocalSeparationPreviewPlaying(false);
    const handleEnded = () => setIsVocalSeparationPreviewPlaying(false);

    previewAudio.addEventListener("play", handlePlay);
    previewAudio.addEventListener("pause", handlePause);
    previewAudio.addEventListener("ended", handleEnded);

    return () => {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      previewAudio.removeEventListener("play", handlePlay);
      previewAudio.removeEventListener("pause", handlePause);
      previewAudio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const handleVocalSeparationPreviewToggle = async () => {
    const previewAudio = vocalSeparationPreviewRef.current;
    if (!previewAudio) return;

    if (previewAudio.paused) {
      try {
        await previewAudio.play();
        setHasVocalSeparationPreviewStarted(true);
      } catch {
        setIsVocalSeparationPreviewPlaying(false);
      }
      return;
    }

    previewAudio.pause();
  };

  const shouldShowVocalSeparationWaveIndicator =
    hasVocalSeparationPreviewStarted &&
    !isVocalSeparationPreviewHovered &&
    isVocalSeparationPreviewPlaying;
  const shouldShowVocalSeparationPauseOverlay =
    isVocalSeparationPreviewHovered &&
    isVocalSeparationPreviewPlaying;

  const handleVocalSeparationPreviewMouseEnter = () => {
    setIsVocalSeparationPreviewHovered(true);
  };

  const handleVocalSeparationPreviewMouseLeave = () => {
    setIsVocalSeparationPreviewHovered(false);
  };

  return (
    <section id="features" className="relative isolate pt-24 pb-16 sm:pt-32 sm:pb-20">
      <div className="container">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center sm:mb-10">
            <h2 className="mx-auto mb-4 max-w-4xl text-3xl font-bold tracking-tight md:text-4xl">
              {t("landingFeatures.sectionTitle")}
            </h2>
            <p className="mx-auto max-w-4xl text-lg text-muted-foreground">
              {t("landingFeatures.sectionDescription")}
            </p>
          </div>

          <div className="space-y-0">
            {featureList.map((feature, index) => {
              const isVisible = visibleRows.has(index) || prefersReducedMotion;
              const isRowReversed = index % 2 === 1;
              const imageHiddenClass = isRowReversed ? "translate-x-8 opacity-0" : "-translate-x-8 opacity-0";
              const textHiddenClass = isRowReversed ? "-translate-x-8 opacity-0" : "translate-x-8 opacity-0";
              return (
              <article
                key={feature.id}
                className="group relative"
                ref={(element) => {
                  rowRefs.current[index] = element;
                }}
                data-feature-index={index}
              >
                  <div
                    className={cn(
                    "relative w-full py-6 sm:py-8 md:min-h-[100dvh] md:flex md:flex-row md:items-start md:gap-0 md:py-6",
                    isRowReversed && "md:flex-row-reverse"
                  )}
                >
                  <div
                    className={cn(
                      "w-full transition-all duration-700 ease-out will-change-transform motion-reduce:transform-none motion-reduce:transition-none",
                      "md:w-[47%]",
                      isVisible ? "translate-x-0 opacity-100" : imageHiddenClass
                    )}
                  >
                    <div
                      className="relative aspect-[4/3] overflow-hidden rounded-[26px]"
                      onMouseEnter={feature.id === "vocal-separation" ? handleVocalSeparationPreviewMouseEnter : undefined}
                      onMouseLeave={feature.id === "vocal-separation" ? handleVocalSeparationPreviewMouseLeave : undefined}
                    >
                      <Image
                        src={feature.image}
                        alt={feature.imageAlt}
                        fill
                        sizes="(min-width: 768px) 47vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                      <div
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute inset-0",
                          isRowReversed
                            ? "bg-gradient-to-l from-black/22 via-black/5 to-transparent"
                            : "bg-gradient-to-r from-black/22 via-black/5 to-transparent"
                        )}
                      />
                      {feature.id === "vocal-separation" ? (
                        <>
                          <div
                            className={cn(
                              "pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                              shouldShowVocalSeparationWaveIndicator ? "opacity-100" : "opacity-0"
                            )}
                          >
                            <CustomAudioWaveIndicator
                              isPlaying={isVocalSeparationPreviewPlaying}
                              size="lg"
                              className="text-white"
                            />
                          </div>

                          <div
                            className={cn(
                              "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
                              shouldShowVocalSeparationPauseOverlay
                                ? "opacity-100"
                                : "pointer-events-none opacity-0"
                            )}
                          >
                            <button
                              type="button"
                              onClick={handleVocalSeparationPreviewToggle}
                              aria-label="Pause instrumental preview"
                              aria-pressed={isVocalSeparationPreviewPlaying}
                              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/24 text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-[1.03] hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                            >
                              <Pause className="h-5 w-5" />
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "relative w-full md:px-14 transition-all duration-700 ease-out will-change-transform motion-reduce:transform-none motion-reduce:transition-none",
                      "md:w-[53%]",
                      isVisible ? "translate-x-0 opacity-100" : textHiddenClass
                    )}
                    style={prefersReducedMotion ? undefined : { transitionDelay: "120ms" }}
                  >
                    <div className="pt-4 md:pt-0">
                      <div className="mb-4">
                        <div className="h-[72px] overflow-hidden">
                          <span
                            aria-hidden="true"
                            className="pointer-events-none -ml-[2px] block select-none text-[82px] font-black leading-[0.78] tracking-[-0.04em] text-foreground/[0.10] dark:text-white/[0.09]"
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <span className="block text-xs font-medium uppercase tracking-[0.14em] text-foreground/60 dark:text-white/65">
                          {feature.title}
                        </span>
                      </div>

                      <h3
                        className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.6rem] sm:leading-[1.08] [text-wrap:wrap]"
                      >
                        <span className="brand-gradient-text">{feature.headline}</span>
                      </h3>
                      <p className="mt-4 text-base leading-[1.8] text-muted-foreground">
                        {feature.description}
                      </p>
                      <ul className="mt-6 space-y-4">
                        {feature.bullets.map((point) => (
                          <li key={point} className="flex items-start gap-4">
                            <span className="mt-2 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                            <span className="text-base leading-[1.7] text-foreground/92 dark:text-white/86">
                              {point}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {feature.id === "vocal-separation" ? (
                        <button
                          type="button"
                          onClick={handleVocalSeparationPreviewToggle}
                          aria-label={isVocalSeparationPreviewPlaying ? "Pause instrumental preview" : "Play instrumental preview"}
                          aria-pressed={isVocalSeparationPreviewPlaying}
                          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          {isVocalSeparationPreviewPlaying ? (
                            <>
                              <Pause className="h-4 w-4" />
                              <span>{t("trackActions.pause")}</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              <span>{t("trackActions.play")}</span>
                            </>
                          )}
                        </button>
                      ) : null}

                    </div>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent via-primary/8 to-transparent dark:via-primary/12"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-6.5rem] left-1/2 h-56 w-[min(92vw,74rem)] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary/18 via-cyan-400/12 to-primary/10 blur-3xl dark:from-primary/22 dark:via-cyan-300/14 dark:to-primary/14"
      />
      <audio ref={vocalSeparationPreviewRef} src={vocalSeparationPreviewUrl} preload="none" className="hidden" />
    </section>
  );
};
