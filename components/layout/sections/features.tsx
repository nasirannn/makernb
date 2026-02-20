"use client";

import Image from "next/image";
import {
  Blend,
  Disc3,
  Expand,
  Mic,
  Music,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

interface FeatureItem {
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
  const featureList: FeatureItem[] = [
    {
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
      icon: Blend,
      title: t("studioFeatures.mashup"),
      headline: t("landingFeatures.items.mashup.headline"),
      description: t("landingFeatures.items.mashup.description"),
      bullets: [
        t("landingFeatures.items.mashup.bulletOne"),
        t("landingFeatures.items.mashup.bulletTwo"),
        t("landingFeatures.items.mashup.bulletThree"),
      ],
      image: "/banner/car_beach.webp",
      imageAlt: t("landingFeatures.items.mashup.imageAlt"),
      accent: "rose",
    },
    {
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

  return (
    <section id="features" className="pt-24 pb-10 sm:pt-32 sm:pb-12">
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
              return (
              <article
                key={feature.title}
                className="group relative"
              >
                  <div
                    className={cn(
                    "relative w-full py-6 sm:py-8 md:min-h-[100dvh] md:flex md:flex-row md:items-start md:gap-0 md:py-6",
                    index % 2 === 1 && "md:flex-row-reverse"
                  )}
                >
                  <div className="w-full md:w-[47%]">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[26px]">
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
                          index % 2 === 0
                            ? "bg-gradient-to-r from-black/22 via-black/5 to-transparent"
                            : "bg-gradient-to-l from-black/22 via-black/5 to-transparent"
                        )}
                      />
                    </div>
                  </div>

                  <div className="relative w-full md:w-[53%] md:px-14">
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

                      <h3 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.6rem] sm:leading-[1.08] [text-wrap:wrap]">
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

                    </div>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
