import {
  Blend,
  Disc3,
  Expand,
  Mic,
  Music,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeaturesProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: "violet" | "cyan" | "amber" | "emerald" | "blue" | "pink";
  featured?: boolean;
}

const accentStyles: Record<
  FeaturesProps["accent"],
  {
    icon: string;
    wash: string;
  }
> = {
  violet: { icon: "text-violet-600 dark:text-violet-300", wash: "from-violet-500/22 to-fuchsia-500/10" },
  cyan: { icon: "text-cyan-600 dark:text-cyan-300", wash: "from-cyan-500/22 to-sky-500/10" },
  amber: { icon: "text-amber-600 dark:text-amber-300", wash: "from-amber-500/22 to-orange-500/10" },
  emerald: { icon: "text-emerald-600 dark:text-emerald-300", wash: "from-emerald-500/22 to-teal-500/10" },
  blue: { icon: "text-blue-600 dark:text-blue-300", wash: "from-blue-500/22 to-indigo-500/10" },
  pink: { icon: "text-pink-600 dark:text-pink-300", wash: "from-pink-500/22 to-rose-500/10" },
};

function FeatureIconBadge({
  accent,
  children,
}: {
  accent: FeaturesProps["accent"];
  children: React.ReactNode;
}) {
  const styles = accentStyles[accent];
  return (
    <div className="relative h-11 w-11 shrink-0">
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 rounded-xl opacity-70 blur-[10px]",
          `bg-gradient-to-br ${styles.wash}`
        )}
      />
      <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/5 dark:bg-white/10">
        {children}
      </div>
    </div>
  );
}

const featureList: FeaturesProps[] = [
  {
    icon: Music2,
    title: "Music Generator",
    description:
      "Start from a short description or full lyrics, then generate complete songs with your selected model, style, and structure.",
    accent: "violet",
    featured: true,
  },
  {
    icon: Expand,
    title: "Music Extender",
    description:
      "Upload an existing track and continue it naturally. Extend intros, verses, or endings while preserving the original vibe.",
    accent: "amber",
  },
  {
    icon: Disc3,
    title: "Music Cover",
    description:
      "Re-create a song in a new style and vocal character. Keep the core composition while changing the overall sound direction.",
    accent: "emerald",
  },
  {
    icon: Blend,
    title: "Mashup",
    description:
      "Blend two audio sources into one coherent output. Combine arrangements and textures to prototype unique hybrid tracks quickly.",
    accent: "pink",
  },
  {
    icon: Mic,
    title: "Add Vocal",
    description:
      "Upload your track and add an AI vocal layer that sits on the existing arrangement while keeping timing and feel aligned.",
    accent: "blue",
  },
  {
    icon: Music,
    title: "Add Melody",
    description:
      "Inject fresh melodic ideas over your audio to create new hooks, motifs, and lead lines without rebuilding the full track.",
    accent: "cyan",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="container">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="text-primary text-lg font-medium mb-2 tracking-wider">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Six core workflows, one studio
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Go from idea to production-ready variations with a focused set of generation, transformation, and remix workflows.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {featureList.map((f) => (
              <div
                key={f.title}
                className="group app-card-muted relative overflow-hidden rounded-[28px] p-6 transition-transform duration-300 hover:-translate-y-1 hover:bg-foreground/10 dark:hover:bg-white/15"
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-0 h-1",
                    `bg-gradient-to-r ${accentStyles[f.accent].wash}`
                  )}
                />
                <div className="relative flex items-start gap-4">
                  <FeatureIconBadge accent={f.accent}>
                    <f.icon className={cn("h-6 w-6", accentStyles[f.accent].icon)} />
                  </FeatureIconBadge>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold tracking-tight text-foreground">{f.title}</div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
