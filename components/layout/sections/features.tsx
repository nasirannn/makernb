import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  iconColor: string;
}

const featureList: FeaturesProps[] = [
  {
    icon: PenIcon,
    title: "Text/Lyrics to Song",
    description:
      "Describe the vibe in a sentence or paste full lyrics. The model turns your words into a track with matching melody, rhythm, and tone.",
    iconColor: "text-[#2aa3ff]",
  },
  {
    icon: EditIcon,
    title: "Edit Song",
    description:
      "Need a new verse or hook? Select a section, change the lyrics or style, and regenerate just that part. Merge it seamlessly into the song.",
    iconColor: "text-[#d94cff]",
  },
  {
    icon: ExtendIcon,
    title: "Extend Song",
    description:
      "Make a track longer without losing its feel. Choose where to start and generate a natural continuation that fits the existing groove.",
    iconColor: "text-[#f08a00]",
  },
  {
    icon: CoverIcon,
    title: "Song Cover",
    description:
      "Reimagine your song in a new style while keeping the lyrics intact. Generate a fresh version with a different musical character.",
    iconColor: "text-[#10b981]",
  },
  {
    icon: UploadIcon,
    title: "Upload Audio",
    description:
      "Upload a clip and use it as a creative anchor. Build extensions or covers that reference the original melody and texture.",
    iconColor: "text-[#4f7cff]",
  },
  {
    icon: VocalIcon,
    title: "Vocal Removal",
    description:
      "Split vocals and instrumentals for cleaner edits, remixes, or exports. Keep full control over each stem.",
    iconColor: "text-[#ff5aa7]",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="container">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          Features
        </h2>

        <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
          Powerful AI Music Creation
        </h2>

        <h3 className="md:w-1/2 mx-auto text-lg text-center text-muted-foreground mb-10">
          Experience the future of music creation with our advanced AI technology that transforms your ideas into professional R&B songs
        </h3>

        <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
          {featureList.map(({ icon: IconComponent, title, description, iconColor }) => (
            <Card key={title} className="h-full border border-white/10 bg-[#12131a] text-white rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <CardHeader className="flex flex-row items-start gap-4 pb-3">
                <div className="h-11 w-11 flex items-center justify-center">
                  <IconComponent className={`h-6 w-6 ${iconColor}`} />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                  <p className="mt-2 text-sm text-white/60 leading-relaxed">
                    {description}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0" />
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
