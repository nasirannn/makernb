"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

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
}

const genreData: GenreData[] = [
  {
    id: "new-jack-swing",
    title: "New Jack Swing",
    description: "New Jack Swing was the heartbeat of dance floors in the early 90s. Created by producer Teddy Riley, it fused R&B melodies with hip-hop beats, giving R&B a harder, funkier edge. Characteristics: Swing beats, punchy drum machines, funky basslines, choreographed group performances.",
    image: "/New-Jack-Swing.webp",
  },
  {
    id: "hip-hop-soul",
    title: "Hip-Hop Soul",
    description: "If New Jack Swing was about fun, Hip-Hop Soul was about raw honesty. Coined in the early 90s, this style blended hip-hop's gritty beats with the emotional storytelling of R&B, making it the \"real voice of the streets.\" Characteristics: Urban edge, hip-hop rhythms, deeply personal lyrics.",
    image: "/Hip-Hop-Soul.webp",
  },
  {
    id: "neo-soul",
    title: "Neo-Soul",
    description: "By the mid-to-late 90s, a new wave arrived: Neo-Soul. Mixing classic soul with modern R&B, jazz, and funk, this genre was poetic, organic, and deeply introspective. It spoke to listeners looking for depth and authenticity. Characteristics: Organic instruments, jazzy harmonies, laid-back grooves, thoughtful lyrics.",
    image: "/Neo-Soul.webp",
  },
  {
    id: "quiet-storm",
    title: "Quiet Storm",
    description: "Originally a 70s radio format, Quiet Storm R&B took on a new life in the 90s. This was the soundtrack of late nights — silky, romantic, and designed for candlelit moods. Characteristics: Slow tempos, lush arrangements, intimate lyrics.",
    image: "/Quiet-Storm.webp",
  },
];

const benefitList: IntroductionProps[] = [
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
  const [currentTrack, setCurrentTrack] = useState<string>("new-jack-swing");
  const isAutoAdvancingRef = useRef<boolean>(false);
  const accordionContainerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const currentIndex = genreData.findIndex((g) => g.id === currentTrack);
  const prevIndexRef = useRef<number>(currentIndex);

  const handleAccordionChange = (value: string) => {
    if (value) {
      setCurrentTrack(value);
    }
  };

  // 自动轮播效果：每 5 秒切换一个条目（带滚动锁与失焦保护）
  useEffect(() => {
    const interval = setInterval(() => {
      const currentScrollTop = window.scrollY;
      const startTop = accordionContainerRef.current?.getBoundingClientRect().top ?? 0;
      isAutoAdvancingRef.current = true;
      setCurrentTrack((prev) => {
        const index = genreData.findIndex((g) => g.id === prev);
        const next = (index + 1) % genreData.length;
        return genreData[next].id;
      });
      // 恢复滚动位置，避免展开时页面跳动
      requestAnimationFrame(() => {
        const endTop = accordionContainerRef.current?.getBoundingClientRect().top ?? 0;
        const delta = endTop - startTop;
        if (Math.abs(delta) > 0.5) {
          window.scrollTo({ top: currentScrollTop + delta });
        }
        // 若自动切换期间某个触发器获得焦点，主动取消焦点以避免视口对齐
        const active = document.activeElement as HTMLElement | null;
        if (isAutoAdvancingRef.current && active && active.blur) {
          active.blur();
        }
        isAutoAdvancingRef.current = false;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // 重置并触发 5s 进度动画
    setProgress(0);
    requestAnimationFrame(() => setProgress(100));
  }, [currentTrack]);

  // 记录上一个索引用于判断是否为首尾跳转
  useEffect(() => {
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);


  return (
    <section id="introduction" className="py-20 sm:py-24">
      <div className="container">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-medium mb-2">Introduction</p>
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
              <Link href="/blog/a-journey-through-the-eras-of-rnb">
                <p className="text-xl text-muted-foreground mb-0 text-left hover:underline cursor-pointer line-clamp-4 overflow-hidden">
                  Rhythm and Blues (R&B) is a genre that blends soulful vocals with rhythm-driven grooves. Emerging in the 1940s and evolving through soul, funk, and disco, R&B became one of the most influential genres shaping modern popular music.
                </p>
              </Link>
              
              <div className="flex items-center justify-between gap-4 mt-6 mb-0">
                {benefitList.map(({ icon, title }) => (
                  <div key={title} className="flex flex-col items-center">
                    <Image
                      src={icon}
                      alt={`${title} icon`}
                      width={96}
                      height={96}
                    />
                    <h3 className="text-sm font-semibold mt-4 text-center">{title}</h3>
                  </div>
                ))}
              </div>
              </div>
            </div>

            <div className="w-full">
              {benefitList.map(({ icon, title, description }) => (
                <div key={title} className="bg-muted/50 dark:bg-card p-4 rounded-lg">
                  <div className="mb-2">
                    <h3 className="text-lg font-semibold">{title}</h3>
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
          <div className="mt-32">
            {/* Genre Accordion and Image Display */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Side - Genre Accordion and Header */}
              <div className="w-full" ref={accordionContainerRef}>
                <div className="mb-6">
                  <div className="mb-4">
                    <Link href="/blog/golden-era-90s-rnb-genres">
                        <h2 className="text-2xl md:text-3xl font-bold cursor-pointer hover:underline transition-all">
                          4 Classic R&B Genres Of Golden Age
                        </h2>
                    </Link>
                    <p className="text-muted-foreground mt-4 line-clamp-1">
                      The 1990s were the golden era of R&B — a decade that gave us smooth love ballads, dance-floor anthems, and soulful grooves that still inspire artists today. But R&B in the 90s was not just one sound. It was a family of genres, each with its own style, story, and stars.
                    </p>
                  </div>
                </div>
                
                <Accordion 
                  type="single" 
                  collapsible 
                  value={currentTrack}
                  onValueChange={handleAccordionChange}
                  className="w-full"
                  style={{ overflowAnchor: 'none' }}
                >
                  {genreData.map((genre) => (
                    <AccordionItem key={genre.id} value={genre.id} className={`border-0 scroll-m-20`}>
                      <AccordionTrigger className="flex w-full items-center justify-between py-4 font-medium text-left transition-all hover:underline data-[state=closed]:text-muted-foreground">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-semibold ${currentTrack === genre.id ? 'text-primary' : ''}`}>
                            {genre.title}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pt-0">
                        <div className="pb-4 text-sm md:text-base">
                          <p className="line-clamp-2 overflow-hidden">{genre.description}</p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {/* Right Side - Image crossfade */}
              <div className="h-full flex items-center justify-center">
                <div className="relative w-full max-w-md" role="region" aria-roledescription="carousel">
                  <div className="relative w-full aspect-square">
                    {genreData.map((genre) => (
                      <Image
                        key={genre.id}
                        src={genre.image}
                        alt={genre.title}
                        width={800}
                        height={800}
                        className={`absolute inset-0 w-full h-full rounded-md object-cover transition-opacity duration-500 ${
                          currentTrack === genre.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      
    </section>
  );
};
