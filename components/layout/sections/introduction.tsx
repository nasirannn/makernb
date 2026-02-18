"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TimelineEra {
  icon: string;
  title: string;
  description: string;
}

interface GenreData {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
}

const genreData: GenreData[] = [
  {
    id: "new-jack-swing",
    title: "New Jack Swing",
    description: "New Jack Swing was the heartbeat of dance floors in the early 90s. Created by producer Teddy Riley, it fused R&B melodies with hip-hop beats, giving R&B a harder, funkier edge. Characteristics: Swing beats, punchy drum machines, funky basslines, choreographed group performances.",
    image: "/New-Jack-Swing.webp",
    href: "/blog/golden-era-90s-rnb-genres",
  },
  {
    id: "hip-hop-soul",
    title: "Hip-Hop Soul",
    description: "If New Jack Swing was about fun, Hip-Hop Soul was about raw honesty. Coined in the early 90s, this style blended hip-hop's gritty beats with the emotional storytelling of R&B, making it the \"real voice of the streets.\" Characteristics: Urban edge, hip-hop rhythms, deeply personal lyrics.",
    image: "/Hip-Hop-Soul.webp",
    href: "/blog/golden-era-90s-rnb-genres",
  },
  {
    id: "neo-soul",
    title: "Neo-Soul",
    description: "By the mid-to-late 90s, a new wave arrived: Neo-Soul. Mixing classic soul with modern R&B, jazz, and funk, this genre was poetic, organic, and deeply introspective. It spoke to listeners looking for depth and authenticity. Characteristics: Organic instruments, jazzy harmonies, laid-back grooves, thoughtful lyrics.",
    image: "/Neo-Soul.webp",
    href: "/blog/golden-era-90s-rnb-genres",
  },
  {
    id: "quiet-storm",
    title: "Quiet Storm",
    description: "Originally a 70s radio format, Quiet Storm R&B took on a new life in the 90s. This was the soundtrack of late nights — silky, romantic, and designed for candlelit moods. Characteristics: Slow tempos, lush arrangements, intimate lyrics.",
    image: "/Quiet-Storm.webp",
    href: "/blog/golden-era-90s-rnb-genres",
  },
];

const timelineEras: TimelineEra[] = [
  {
    icon: "/icons/1940s-1960s.svg",
    title: "The Origins",
    description:
      "R&B was born out of gospel, blues, and jazz. Back in the 1940s, artists like Ray Charles and Ruth Brown were crafting music that felt both spiritual and raw, pulling church sounds into dance halls. Sam Cooke gave us smooth ballads that melted hearts, while groups like The Drifters built the blueprint for vocal harmony groups to come.",
  },
  {
    icon: "/icons/1970s-1980s.svg",
    title: "The Soul & Funk Era",
    description:
      "By the '70s, R&B had grown up. The music got funkier, more political, and undeniably groovy. Stevie Wonder and Marvin Gaye delivered records that spoke to love, hope, and social change. Bands like Earth, Wind & Fire and Parliament-Funkadelic kept dance floors alive with explosive energy. And then there was Aretha Franklin, reminding the world that R&B vocals could be pure power and soul.",
  },
  {
    icon: "/icons/1990s.svg",
    title: "The Golden Age",
    description:
      "Ask any R&B fan, and they'll tell you: the '90s were magic. This was the decade when R&B ruled the charts and gave us unforgettable sounds. New Jack Swing fused hip-hop beats with slick R&B. Hip-Hop Soul was raw and emotional. Quiet Storm delivered lush ballads. Neo-Soul brought a jazzy, funk-inspired twist.",
  },
  {
    icon: "/icons/2000s.svg",
    title: "Contemporary R&B",
    description:
      "Fast-forward to the present, and R&B has gone global. It blends with hip-hop, pop, electronic, and even indie. Usher and Beyoncé carried R&B into the mainstream, while artists like Frank Ocean, The Weeknd, and H.E.R. pushed boundaries with moody, intimate, genre-blurring music.",
  },
];

export const IntroductionSection = () => {
  return (
    <section id="introduction" className="pt-12 pb-24 sm:pt-16 sm:pb-28">
      <div className="container">
        <div className="mx-auto max-w-7xl space-y-12 sm:space-y-14">
          <header className="mx-auto max-w-4xl text-center">
            <p className="mb-2 text-lg font-medium tracking-wider text-primary">Introduction</p>
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Discover The Rich History of R&B
            </h2>
            <p className="text-lg text-muted-foreground">
              From soulful roots to modern evolution, explore the genres that shaped music
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr] lg:items-stretch">
            <article className="h-full p-6 sm:p-8 lg:p-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/90">
                R&B Timeline
              </p>
              <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                What Is R&amp;B?
              </h3>
              <p className="mt-4 line-clamp-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Rhythm and Blues blends soulful vocals with rhythm-driven grooves. Emerging in the
                1940s and evolving through soul, funk, and disco, it became one of the most
                influential genres shaping modern popular music.
              </p>
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground/75 sm:text-base dark:text-white/78">
                Explore four key eras to see how artists reshaped R&amp;B while preserving its
                emotional core.
              </p>
              <Link
                href="/blog/a-journey-through-the-eras-of-rnb"
                className="mt-6 inline-flex items-center text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Read full article
              </Link>
            </article>

            <div className="flex h-full items-center">
              <div className="w-full overflow-hidden rounded-[24px]">
                <Image
                  src="/blog/a-journey-through-the-eras-of-rnb.webp"
                  alt="A Journey Through the Eras of R&B cover"
                  width={1820}
                  height={1022}
                  sizes="(min-width: 1024px) 32vw, 100vw"
                  className="block h-auto w-full"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {timelineEras.map(({ icon, title, description }, index) => (
              <article key={title} className="app-card h-full rounded-[24px] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <Image
                    src={icon}
                    alt={`${title} icon`}
                    width={40}
                    height={40}
                    className="h-10 w-10"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/45 dark:text-white/45">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h4 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{title}</h4>
                <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </article>
            ))}
          </div>

          <div className="space-y-6 sm:space-y-7">
            <div className="space-y-3">
              <Link href="/blog/golden-era-90s-rnb-genres" className="inline-block">
                <h2 className="text-2xl font-bold tracking-tight text-foreground transition-colors hover:text-primary md:text-3xl">
                  Classic R&amp;B Genres Of The Golden Age
                </h2>
              </Link>
              <p className="max-w-3xl text-muted-foreground">
                A quick guide to the signature sounds that defined 90s R&amp;B and shaped today's
                generation workflows.
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
                      <h3 className="text-xl font-semibold tracking-tight text-foreground">{genre.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                        {genre.description}
                      </p>
                      <Link
                        href={genre.href}
                        className="inline-flex text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                      >
                        Learn more
                      </Link>
                    </div>

                    <Link
                      href={genre.href}
                      className={cn(
                        "relative block aspect-[4/3] w-full max-w-[220px] shrink-0 self-end overflow-hidden rounded-[16px] md:self-auto",
                        index % 2 === 0 ? "md:ml-auto" : "md:mr-auto"
                      )}
                      aria-label={genre.title}
                    >
                      <Image
                        src={genre.image}
                        alt={genre.title}
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
