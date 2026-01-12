"use client";

import Image from "next/image";
import Link from "next/link"

interface IntroductionProps {
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

const timelineEras: IntroductionProps[] = [
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
    <section id="introduction" className="py-20 sm:py-24">
      <div className="container">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14 sm:mb-16">
            <p className="text-primary text-lg font-medium mb-2 tracking-wider">Introduction</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Discover The Rich History of R&B
            </h2>
            <p className="text-muted-foreground text-lg">
              From soulful roots to modern evolution, explore the genres that shaped music
            </p>
          </div>
          <div className="grid gap-8 lg:grid-cols-[0.95fr,1.05fr] lg:gap-10">
            {/* Left: definition + CTA */}
            <div className="w-full">
              <div className="app-card rounded-[28px] p-6 sm:p-7">
                <div className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-foreground/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  <span>Timeline</span>
                </div>

                <h3 className="mt-5 text-2xl font-bold tracking-tight text-left">
                  What Is R&amp;B?
                </h3>
                <p className="mt-3 text-base sm:text-lg text-muted-foreground text-left leading-relaxed">
                  Rhythm and Blues (R&amp;B) blends soulful vocals with rhythm-driven grooves. Emerging in the 1940s and evolving through soul, funk, and disco, it became one of the most influential genres shaping modern popular music.
                </p>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <Link
                    href="/blog/a-journey-through-the-eras-of-rnb"
                    className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_14px_40px_rgba(0,0,0,0.16)] hover:bg-primary/90 transition-colors"
                  >
                    Read full article
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: vertical timeline */}
            <div className="w-full">
              <div className="relative">
                <div
                  className="pointer-events-none absolute left-7 top-2 bottom-2 w-px bg-foreground/10"
                  aria-hidden="true"
                />
                <div className="space-y-4">
                  {timelineEras.map(({ icon, title, description }) => (
                    <div key={title} className="grid grid-cols-[56px,1fr] gap-4 items-start">
                      <div className="flex justify-center pt-2">
                        <Image
                          src={icon}
                          alt={`${title} icon`}
                          width={44}
                          height={44}
                          className="h-11 w-11 drop-shadow-[0_12px_26px_rgba(0,0,0,0.22)]"
                        />
                      </div>

                      <div className="app-card rounded-[24px] p-5 sm:p-6">
                        <h4 className="text-lg font-semibold tracking-tight text-foreground">
                          {title}
                        </h4>
                        <p className="mt-2 text-sm sm:text-[15px] text-muted-foreground leading-relaxed line-clamp-2">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* R&B Golden Era Section */}
          <div className="mt-16 sm:mt-20">
            <div className="mb-8 text-center">
              <Link href="/blog/golden-era-90s-rnb-genres" className="inline-block">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight hover:underline">
                  Classic R&amp;B Genres Of The Golden Age
                </h2>
              </Link>
              <p className="mt-3 text-muted-foreground">
                A quick guide to the signature sounds that defined the era.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
              {genreData.map((genre) => (
                <Link
                  key={genre.id}
                  href={genre.href}
                  className="group app-card rounded-[28px] overflow-hidden transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(0,0,0,0.10)]"
                >
                  <div className="relative aspect-[16/10] w-full">
                    <Image
                      src={genre.image}
                      alt={genre.title}
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 520px, 100vw"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  </div>

                  <div className="p-5 sm:p-6">
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                      {genre.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {genre.description}
                    </p>
                    <div className="mt-4 text-sm font-semibold text-primary">
                      Learn more →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      
    </section>
  );
};
