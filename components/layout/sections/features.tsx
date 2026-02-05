import { cn } from "@/lib/utils";

const PenIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M6 14l8-8 4 4-8 8H6v-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ExtendIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M14 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CoverIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="M9 15a3 3 0 1 0 0-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const UploadIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M12 16V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const VocalIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="2" />
    <path d="M5 12a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 19v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

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
    icon: PenIcon,
    title: "Text/Lyrics to Song",
    description:
      "Describe the vibe in a sentence or paste full lyrics. The model turns your words into a track with matching melody, rhythm, and tone.",
    accent: "violet",
    featured: true,
  },
  {
    icon: EditIcon,
    title: "Edit Song",
    description:
      "Need a new verse or hook? Select a section, change the lyrics or style, and regenerate just that part. Merge it seamlessly into the song.",
    accent: "pink",
  },
  {
    icon: ExtendIcon,
    title: "Extend Song",
    description:
      "Make a track longer without losing its feel. Choose where to start and generate a natural continuation that fits the existing groove.",
    accent: "amber",
  },
  {
    icon: CoverIcon,
    title: "Song Cover",
    description:
      "Reimagine your song in a new style while keeping the lyrics intact. Generate a fresh version with a different musical character.",
    accent: "emerald",
  },
  {
    icon: UploadIcon,
    title: "Upload Audio",
    description:
      "Upload a clip and use it as a creative anchor. Build extensions or covers that reference the original melody and texture.",
    accent: "blue",
  },
  {
    icon: VocalIcon,
    title: "Vocal Removal",
    description:
      "Split vocals and instrumentals for cleaner edits, remixes, or exports. Keep full control over each stem.",
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
              Powerful AI music creation, built for iteration
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Turn a spark into a finished R&amp;B track — then refine vocals, structure, and sound without breaking the vibe.
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
