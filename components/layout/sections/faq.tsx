import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQProps {
  question: string;
  answer: string;
  value: string;
}

const FAQList: FAQProps[] = [
  {
    question: "Is MakeRNB really free to use?",
    answer: "Yes! MakeRNB offers free daily credits that allow you to create original R&B tracks without any subscription fees. You get fresh credits every day to continue your music creation journey.",
    value: "item-1",
  },
  {
    question: "Can I generate AI cover songs or create music based on specific artists?",
    answer: "MakeRNB doesn't create direct copies of existing songs, our AI music generator can create original music inspired by different genres and styles. This ensures your creations are unique while maintaining professional quality.",
    value: "item-2",
  },
  {
    question: "Can I use my own lyrics in the songs?",
    answer: "Absolutely! In Custom Mode, you can input your own lyrics to create personalized R&B tracks that tell your unique story. The AI will compose music that perfectly complements your words.",
    value: "item-3",
  },
  {
    question: "What audio quality do I get when downloading?",
    answer: "All generated tracks are studio-quality with rich vocals, smooth harmonies, and that signature R&B sound. You can download high-quality audio files ready for streaming, sharing, or further production.",
    value: "item-4",
  },
  {
    question: "How long does it take to generate a song?",
    answer: "Our AI works incredibly fast! You can preview your R&B track in about 40 seconds, and the complete high-quality version will be ready for download in approximately 3 minutes.",
    value: "item-5",
  },
  {
    question: "Can I use the generated music commercially?",
    answer: "Yes, you own the rights to the music you create with MakeRNB. You can use your generated tracks for personal projects, commercial releases, or any other purpose without additional licensing fees.",
    value: "item-6",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="container max-w-4xl py-12 sm:py-16">
      <div className="text-center mb-8">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          Frequently Asked Questions
        </h2>

        <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
          Everything You Need to Know
        </h2>
        
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Get answers to common questions about our AI-powered R&B music generation platform
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {FAQList.map(({ question, answer, value }) => (
          <AccordionItem key={value} value={value} className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              {question}
            </AccordionTrigger>

            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              {answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};
