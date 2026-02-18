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
    question: "How does the credits system work?",
    answer: "You automatically receive 15 free credits every day when you log in. Each song generation costs 12 credits. Daily login credits expire at midnight (UTC) if unused, and you get a fresh batch with each new login.",
    value: "item-2",
  },
  {
    question: "Can I generate AI cover songs or create music based on specific artists?",
    answer: "MakeRNB doesn't create direct copies of existing songs, our AI music generator can create original music inspired by different genres and styles. This ensures your creations are unique while maintaining professional quality.",
    value: "item-5",
  },
  {
    question: "Can I use the generated music commercially?",
    answer: "Yes. If you are on a paid plan, you can use the music you generate in commercial projects such as videos, games, podcasts, websites, apps, and advertisements. You do not need to pay additional royalties for these uses.",
    value: "item-8",
  },
  {
    question: "Do I own the copyright to the generated music?",
    answer: "No. The music is licensed to you for use, but ownership of the generated audio itself is not transferred. This allows you to use the music commercially, while preventing resale or redistribution of the audio as standalone files.",
    value: "item-9",
  },
  {
    question: "Can I upload the music to YouTube, TikTok, or Spotify?",
    answer: "Yes, for use as part of your content. However, you may not register the music with Content ID systems or copyright registries.",
    value: "item-10",
  },
  {
    question: "Can I sell the music or offer it as stock music?",
    answer: "No. You may not resell, sublicense, or distribute the generated music as standalone audio tracks.",
    value: "item-11",
  },
  {
    question: "Is the music guaranteed to be copyright-safe?",
    answer: "No. AI-generated music may share similarities with existing works. We do not provide guarantees of non-infringement. You are responsible for how the music is used in your projects.",
    value: "item-12",
  },
  {
    question: "Why are there these limitations?",
    answer: "These limitations help keep the service affordable, fair for all users, and compliant with third-party technology providers.",
    value: "item-13",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="container">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center sm:mb-14">
            <h2 className="mb-2 text-center text-lg tracking-wider text-primary">
              Frequently Asked Questions
            </h2>

            <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
              Everything You Need to Know
            </h2>

            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Get answers to common questions about our AI-powered R&B music generation platform
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQList.map(({ question, answer, value }) => (
              <AccordionItem key={value} value={value} className="border-b border-border px-4">
                <AccordionTrigger className="py-4 text-left text-lg font-semibold hover:no-underline [&[data-state=open]]:text-primary">
                  {question}
                </AccordionTrigger>

                <AccordionContent className="pb-4 text-base leading-relaxed text-muted-foreground">
                  {answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
