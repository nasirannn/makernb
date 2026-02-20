"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { withLocalePrefix } from "@/lib/i18n/routing";

interface TimelineEra {
  icon: string;
  translationKey: string;
}

interface GenreData {
  id: string;
  translationKey: string;
  image: string;
  href: string;
}

const genreData: GenreData[] = [
  {
    id: "new-jack-swing",
    translationKey: "newJackSwing",
    image: "/New-Jack-Swing.webp",
    href: "/blog/golden-era-90s-rnb-genres",
  },
  {
    id: "hip-hop-soul",
    translationKey: "hipHopSoul",
    image: "/Hip-Hop-Soul.webp",
    href: "/blog/golden-era-90s-rnb-genres",
  },
  {
    id: "neo-soul",
    translationKey: "neoSoul",
    image: "/Neo-Soul.webp",
    href: "/blog/golden-era-90s-rnb-genres",
  },
  {
    id: "quiet-storm",
    translationKey: "quietStorm",
    image: "/Quiet-Storm.webp",
    href: "/blog/golden-era-90s-rnb-genres",
  },
];

const timelineEras: TimelineEra[] = [
  {
    icon: "/icons/1940s-1960s.svg",
    translationKey: "origins",
  },
  {
    icon: "/icons/1970s-1980s.svg",
    translationKey: "soulFunkEra",
  },
  {
    icon: "/icons/1990s.svg",
    translationKey: "goldenAge",
  },
  {
    icon: "/icons/2000s.svg",
    translationKey: "contemporary",
  },
];

export const IntroductionSection = () => {
  const { locale, t } = useI18n();
  const withCurrentLocale = (path: string) => withLocalePrefix(path, locale);

  return (
    <section id="introduction" className="pt-12 pb-24 sm:pt-16 sm:pb-28">
      <div className="container">
        <div className="mx-auto max-w-7xl space-y-12 sm:space-y-14">
          <header className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {t("introductionSection.header.title")}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t("introductionSection.header.subtitle")}
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr] lg:items-stretch">
            <article className="h-full p-6 sm:p-8 lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/90">
                {t("introductionSection.timeline.label")}
              </p>
              <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                {t("introductionSection.timeline.title")}
              </h3>
              <p className="mt-4 line-clamp-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("introductionSection.timeline.descriptionPrimary")}
              </p>
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground/75 sm:text-base dark:text-white/78">
                {t("introductionSection.timeline.descriptionSecondary")}
              </p>
              <Link
                href={withCurrentLocale("/blog/a-journey-through-the-eras-of-rnb")}
                className="mt-6 inline-flex items-center text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              >
                {t("introductionSection.timeline.readFullArticle")}
              </Link>
            </article>

            <div className="flex h-full items-center">
              <div className="w-full overflow-hidden rounded-[24px]">
                <Image
                  src="/blog/a-journey-through-the-eras-of-rnb.webp"
                  alt={t("introductionSection.timeline.coverImageAlt")}
                  width={1820}
                  height={1022}
                  sizes="(min-width: 1024px) 32vw, 100vw"
                  className="block h-auto w-full"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {timelineEras.map(({ icon, translationKey }, index) => {
              const title = t(`introductionSection.timeline.eras.${translationKey}.title`);
              const description = t(`introductionSection.timeline.eras.${translationKey}.description`);
              return (
              <article key={title} className="app-card h-full rounded-[24px] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <Image
                    src={icon}
                    alt={t("introductionSection.timeline.iconAlt", { title })}
                    width={40}
                    height={40}
                    className="h-10 w-10"
                  />
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45 dark:text-white/45">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h4 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{title}</h4>
                <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </article>
              );
            })}
          </div>

          <div className="space-y-6 sm:space-y-7">
            <div className="space-y-3">
              <Link href={withCurrentLocale("/blog/golden-era-90s-rnb-genres")} className="inline-block">
                <h2 className="text-2xl font-bold tracking-tight text-foreground transition-colors hover:text-primary md:text-3xl">
                  {t("introductionSection.genres.title")}
                </h2>
              </Link>
              <p className="max-w-3xl text-muted-foreground">
                {t("introductionSection.genres.description")}
              </p>
            </div>

            <div className="grid gap-4 sm:gap-5">
              {genreData.map((genre, index) => (
                <article
                  key={genre.id}
                  className="group overflow-hidden rounded-[20px] bg-foreground/[0.03] p-3.5 sm:p-4"
                >
                  <div
                    className={cn(
                      "flex flex-col gap-3.5 sm:gap-4 md:items-center",
                      index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                    )}
                  >
                    <div
                      className={cn(
                        "min-w-0 flex-1 space-y-2.5",
                        index % 2 === 0 ? "md:pr-2" : "md:pl-2"
                      )}
                    >
                      <h3 className="text-xl font-semibold tracking-tight text-foreground">
                        {t(`introductionSection.genres.items.${genre.translationKey}.title`)}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {t(`introductionSection.genres.items.${genre.translationKey}.description`)}
                      </p>
                      <Link
                        href={withCurrentLocale(genre.href)}
                        className="inline-flex text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                      >
                        {t("introductionSection.genres.learnMore")}
                      </Link>
                    </div>

                    <Link
                      href={withCurrentLocale(genre.href)}
                      className={cn(
                        "relative block aspect-[4/3] w-full max-w-[220px] shrink-0 self-end overflow-hidden rounded-[16px] md:self-auto",
                        index % 2 === 0 ? "md:ml-auto" : "md:mr-auto"
                      )}
                      aria-label={t(`introductionSection.genres.items.${genre.translationKey}.title`)}
                    >
                      <Image
                        src={genre.image}
                        alt={t(`introductionSection.genres.items.${genre.translationKey}.title`)}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        sizes="(min-width: 1024px) 220px, (min-width: 768px) 240px, 100vw"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/38 via-black/8 to-transparent"
                      />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
