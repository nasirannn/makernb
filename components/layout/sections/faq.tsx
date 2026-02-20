"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useI18n } from "@/lib/i18n/provider";

interface FAQProps {
  translationKey: string;
  value: string;
}

const FAQList: FAQProps[] = [
  {
    translationKey: "item1",
    value: "item-1",
  },
  {
    translationKey: "item2",
    value: "item-2",
  },
  {
    translationKey: "item3",
    value: "item-5",
  },
  {
    translationKey: "item4",
    value: "item-8",
  },
  {
    translationKey: "item5",
    value: "item-9",
  },
  {
    translationKey: "item6",
    value: "item-10",
  },
  {
    translationKey: "item7",
    value: "item-11",
  },
  {
    translationKey: "item8",
    value: "item-12",
  },
  {
    translationKey: "item9",
    value: "item-13",
  },
];

export const FAQSection = () => {
  const { t } = useI18n();

  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="container">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center sm:mb-14">
            <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
              {t("faqSection.title")}
            </h2>

            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {t("faqSection.subtitle")}
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQList.map(({ translationKey, value }) => (
              <AccordionItem key={value} value={value} className="border-b border-border px-4">
                <AccordionTrigger className="py-4 text-left text-lg font-semibold hover:no-underline [&[data-state=open]]:text-primary">
                  {t(`faqSection.items.${translationKey}.question`)}
                </AccordionTrigger>

                <AccordionContent className="pb-4 text-base leading-relaxed text-muted-foreground">
                  {t(`faqSection.items.${translationKey}.answer`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
