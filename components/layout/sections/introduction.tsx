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
  const cardColors = [
    "bg-[#aeb6ff]",
    "bg-[#c5f8f1]",
    "bg-[#ffc2f2]",
    "bg-[#c9ddff]",
  ];


  return (
    <section id="introduction" className="py-20 sm:py-24">
      <div className="container">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-lg font-medium mb-2 tracking-wider">Introduction</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Discover The Rich History of R&B
            </h2>
            <p className="text-muted-foreground text-lg">
              From soulful roots to modern evolution, explore the genres that shaped music
            </p>
          </div>
          <div className="grid lg:grid-cols-2 lg:gap-24">
            <div className="w-full">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary mb-4">
                Timeline
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-4 text-left">What Is R&B?</h3>
                <p className="text-lg text-muted-foreground mb-0 text-left line-clamp-4 overflow-hidden">
                  Rhythm and Blues (R&B) is a genre that blends soulful vocals with rhythm-driven grooves. Emerging in the 1940s and evolving through soul, funk, and disco, R&B became one of the most influential genres shaping modern popular music.
                </p>
              
              <div className="mt-4 text-left">
                <Link href="/blog/a-journey-through-the-eras-of-rnb" className="text-primary hover:underline text-sm font-medium">
                  Read full article →
                </Link>
              </div>
              
              <div className="flex items-center justify-between gap-4 mt-6 mb-0">
                {timelineEras.map(({ icon, title }, index) => (
                  <div key={title} className="flex flex-col items-center">
                    <Image
                      src={icon}
                      alt={`${title} icon`}
                      width={96}
                      height={96}
                    />
                  </div>
                ))}
              </div>
              </div>
            </div>

            <div className="w-full">
              {timelineEras.map(({ icon, title, description }, index) => (
                <div key={title} className="bg-muted/50 dark:bg-card p-4 rounded-lg">
                  <div className="mb-2">
                    <h3 className="text-lg font-semibold">
                      {title}
                    </h3>
                  </div>

                  <div className="text-muted-foreground text-sm">
                    <div className="line-clamp-2 overflow-hidden">
                      {description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* R&B Golden Era Section */}
          <div className="mt-16">
            <div className="mb-6">
              <div className="mb-4">
                <Link href="/blog/golden-era-90s-rnb-genres">
                  <h2 className="text-2xl md:text-3xl font-bold cursor-pointer hover:underline text-left">
                    <span className="block">Classic R&B Genres Of The Golden Age</span>
                  </h2>
                </Link>
              </div>
            </div>

            {/* Genre Cards Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
              {genreData.map((genre, index) => (
                <Link
                  key={genre.id}
                  href={genre.href}
                  className={`group relative overflow-hidden rounded-[28px] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.12)] transition-shadow duration-300 hover:shadow-[0_28px_70px_rgba(0,0,0,0.16)] ${cardColors[index % cardColors.length]}`}
                >
                  <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-black/35 transition-opacity duration-300 group-hover:opacity-0" />
                  <h3 className="text-lg font-bold text-black mb-3 text-left leading-tight">
                    {genre.title}
                  </h3>
                  <p className="text-sm font-medium text-black/60 leading-relaxed line-clamp-2 mb-5 text-left">
                    {genre.description}
                  </p>
                  <div>
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[22px] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                      <Image
                        src={genre.image}
                        alt={genre.title}
                        fill
                        className="object-cover"
                      />
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
