import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, MessageSquare, FileText, Music, Download, Heart } from "lucide-react";

interface FeaturesProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const featureList: FeaturesProps[] = [
  {
    icon: Settings,
    title: "Two Flexible Creation Modes",
    description:
      "Simple Mode for instant hits or Custom Mode for complete creative control",
  },
  {
    icon: MessageSquare,
    title: "Natural Language Input",
    description:
      "Describe your vision in plain English and watch AI transform words into music",
  },
  {
    icon: FileText,
    title: "Custom Lyrics Support",
    description:
      "Input your own lyrics to create authentic songs with your unique voice",
  },
  {
    icon: Music,
    title: "Authentic R&B Styles",
    description:
      "From classic slow jams to contemporary R&B vibes and everything between",
  },
  {
    icon: Download,
    title: "Studio-Quality Output",
    description:
      "Professional-grade tracks with rich vocals and smooth R&B harmonies",
  },
  {
    icon: Heart,
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
              <CardHeader className="flex justify-center items-center">
                <div className="bg-primary/10 p-3 rounded-full mb-4">
                  <IconComponent className="h-6 w-6 text-primary" />
                </div>

                <CardTitle>{title}</CardTitle>
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
