import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

interface FeaturesProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const featureList: FeaturesProps[] = [
  {
    icon: () => <Image src="/icons/Two-Flexible-Creation-Modes.svg" alt="Studio Create" width={48} height={48} className="h-12 w-12" />,
    title: "Two Flexible Creation Modes",
    description:
      "Simple Mode for instant hits or Custom Mode for complete creative control",
  },
  {
    icon: () => <Image src="/icons/Studio-Quality-Output.svg" alt="Extend Music" width={48} height={48} className="h-12 w-12" />,
    title: "Extend Music",
    description:
      "Expand any track with seamless continuations that match your original vibe",
  },
  {
    icon: () => <Image src="/icons/Custom-Lyrics-Support.svg" alt="AI Lyrics Support" width={48} height={48} className="h-12 w-12" />,
    title: "AI Lyrics Support",
    description:
      "Generate intelligent lyrics or input your own to create authentic songs with your unique ideas",
  },
  {
    icon: () => <Image src="/icons/Authentic-RnB-Styles.svg" alt="Authentic R&B Styles" width={48} height={48} className="h-12 w-12" />,
    title: "Replace Section",
    description:
      "Swap specific sections while keeping the rest of the song intact",
  },
  {
    icon: () => <Image src="/icons/Vocal-Remover.svg" alt="Vocal Remover" width={48} height={48} className="h-12 w-12" />,
    title: "Vocal Remover",
    description:
      "Separate vocals from music using cutting-edge AI technology for professional quality tracks",
  },
  {
    icon: () => <Image src="/icons/Free-Daily-Credits.svg" alt="Free Daily Credits" width={48} height={48} className="h-12 w-12" />,
    title: "Free Daily Credits",
    description:
      "Start creating immediately with daily credits - no subscriptions required",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="container py-24 sm:py-32">
      <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
        Features
      </h2>

      <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
        Powerful AI Music Creation
      </h2>

      <h3 className="md:w-1/2 mx-auto text-lg text-center text-muted-foreground mb-8">
        Experience the future of music creation with our advanced AI technology that transforms your ideas into professional R&B songs
      </h3>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {featureList.map(({ icon: IconComponent, title, description }) => (
          <div key={title}>
            <Card className="h-full border-0 shadow-none bg-transparent">
              <CardHeader className="flex justify-center items-center pb-2">
                <div className="p-3 rounded-full mb-1">
                  <IconComponent className="h-8 w-8 text-primary" />
                </div>

                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>

              <CardContent className="text-muted-foreground text-center">
                {description}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
};
