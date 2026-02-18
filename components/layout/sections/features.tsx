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

const featureList: FeatureItem[] = [
  {
    icon: Music2,
    title: "Music Generator",
    headline: "Transform Ideas into Full Songs",
    description:
      "Turn a simple prompt or full lyric sheet into complete, production-ready music. MakeRNB analyzes your text, intent, and style direction to create cohesive melodies, harmonies, vocals, and arrangement layers.",
    bullets: [
      "Generate full songs from prompts, short descriptions, or complete lyrics",
      "Control style, vocal direction, and model quality in one streamlined flow",
      "Get structured outputs and rapidly iterate with instant regeneration",
    ],
    image: "/banner/mark_bus.webp",
    imageAlt: "Music generation workflow preview",
    accent: "cyan",
  },
  {
    icon: Expand,
    title: "Music Extender",
    headline: "Continue Songs with Natural Flow",
    description:
      "Extend your existing audio while preserving its timing, tone, and musical identity. Perfect for lengthening intros, creating longer verses, or building cleaner outros without losing continuity.",
    bullets: [
      "Upload source audio and extend sections without breaking musical continuity",
      "Preserve tempo, harmony direction, and transition smoothness across the extension",
      "Compare multiple ending and arrangement options with quick regeneration",
    ],
    image: "/banner/street.webp",
    imageAlt: "Music extender workflow preview",
    accent: "amber",
  },
  {
    icon: Disc3,
    title: "Music Cover",
    headline: "Reimagine Songs in New Styles",
    description:
      "Recreate a track with a new vocal texture and stylistic direction while keeping the core composition intact. Shift genre character, performance color, and production tone in a single workflow.",
    bullets: [
      "Keep the core melody and structure while reshaping overall sonic identity",
      "Try alternate vocal colors and genre-led performance directions",
      "Generate multiple cover concepts from one original track source",
    ],
    image: "/banner/studio_female.webp",
    imageAlt: "Music cover workflow preview",
    accent: "emerald",
  },
  {
    icon: Blend,
    title: "Mashup",
    headline: "Blend Two Tracks into One Concept",
    description:
      "Combine two tracks into a single cohesive result by merging rhythm, melody, and vibe. Great for creative prototyping, crossover ideas, and hybrid production experiments.",
    bullets: [
      "Fuse two audio sources into one coherent and musically balanced output",
      "Explore hybrid grooves, crossover styles, and fresh arrangement combinations",
      "Quickly test remix and transition concepts without complex DAW setup",
    ],
    image: "/banner/car_beach.webp",
    imageAlt: "Mashup workflow preview",
    accent: "rose",
  },
  {
    icon: Mic,
    title: "Add Vocal",
    headline: "Layer AI Vocals on Your Instrumental",
    description:
      "Add expressive AI vocals to your existing instrumental without rebuilding the track. Keep groove and timing aligned while introducing new toplines and lyrical direction.",
    bullets: [
      "Add AI lead vocals that sit naturally on your existing arrangement",
      "Keep phrasing and rhythmic alignment locked to the instrumental timing",
      "Generate alternate vocal directions quickly for demos and topline ideation",
    ],
    image: "/banner/studio_male.webp",
    imageAlt: "Add vocal workflow preview",
    accent: "blue",
  },
  {
    icon: Music,
    title: "Add Melody",
    headline: "Inject Fresh Hooks and Lead Lines",
    description:
      "Generate new melodic phrases on top of your track to discover stronger hooks and lead moments. Expand musical storytelling without replacing your original arrangement foundation.",
    bullets: [
      "Create melodic hooks and motifs over your current track foundation",
      "Explore new lead-line directions without replacing your core production",
      "Move from rough chorus ideas to polished melodic variations faster",
    ],
    image: "/banner/bed.webp",
    imageAlt: "Add melody workflow preview",
    accent: "violet",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="pt-24 pb-10 sm:pt-32 sm:pb-12">
      <div className="container">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center sm:mb-10">
            <p className="mb-2 text-lg font-medium tracking-wider text-primary">Features</p>
            <h2 className="mx-auto mb-4 max-w-4xl text-3xl font-bold tracking-tight md:text-4xl">
              Six core workflows, one studio
            </h2>
            <p className="mx-auto max-w-4xl text-lg text-muted-foreground">
              Build complete R&B songs end-to-end with generation, transformation, and arrangement tools designed to work together.
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
                        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/60 dark:text-white/65">
                          {feature.title}
                        </span>
                      </div>

                      <h3 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.6rem] sm:leading-[1.08] [text-wrap:wrap]">
                        <span className="brand-gradient-text">{feature.headline}</span>
                      </h3>
                      <p className="mt-4 text-[17px] leading-[1.8] text-muted-foreground">
                        {feature.description}
                      </p>
                      <ul className="mt-6 space-y-4">
                        {feature.bullets.map((point) => (
                          <li key={point} className="flex items-start gap-4">
                            <span className="mt-2 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                            <span className="text-[16px] leading-[1.7] text-foreground/92 dark:text-white/86">
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
