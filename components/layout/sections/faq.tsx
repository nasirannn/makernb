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
    question: "Is R&B  Music Generator really free to use?",
    answer: "Yes! R&B  Music Generator offers free daily credits that allow you to create original R&B tracks without any subscription fees. You get fresh credits every day to continue your music creation journey.",
    value: "item-1",
  },
  {
    question: "What R&B styles can I generate?",
    answer: "Our AI specializes in authentic R&B styles including New Jack Swing, Hip-Hop Soul, Neo-Soul, Quiet Storm, and Contemporary R&B. Each style captures the unique characteristics, rhythms, and production techniques that define these distinct R&B genres.",
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
    answer: "Our AI works incredibly fast! Most R&B tracks are generated within seconds to a few minutes, including composition, arrangement, lyrics, and vocals. You'll have your complete song ready to listen and download almost instantly.",
    value: "item-5",
  },
  {
    question: "Can I use the generated music commercially?",
    answer: "Yes, you own the rights to the music you create with R&B  Music Generator. You can use your generated tracks for personal projects, commercial releases, or any other purpose without additional licensing fees.",
    value: "item-6",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="container max-w-4xl py-24 sm:py-32">
      <div className="text-center mb-16">
        <h2 className="text-2xl text-primary text-center mb-4 tracking-wider font-semibold">
          Frequently Asked Questions
        </h2>

        <h2 className="text-4xl md:text-5xl text-center font-bold mb-6">
          Everything You Need to Know
        </h2>
        
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Get answers to common questions about our AI-powered R&B music generation platform
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {FAQList.map(({ question, answer, value }) => (
          <AccordionItem key={value} value={value} className="border-b border-border px-6 py-2">
            <AccordionTrigger className="text-left text-lg font-semibold py-6 hover:no-underline [&[data-state=open]]:text-primary">
              {question}
            </AccordionTrigger>

            <AccordionContent className="text-base text-muted-foreground pb-6 leading-relaxed">
              {answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};
