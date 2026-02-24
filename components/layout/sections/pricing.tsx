"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import type { PricingPlan } from "@/lib/pricing-config";
import { useI18n } from "@/lib/i18n/provider";

interface PricingSectionProps {
  initialPlans?: PricingPlan[];
}

export const PricingSection = ({ initialPlans }: PricingSectionProps) => {
  const { t } = useI18n();
  const faqItems = [
    {
      question: t("pricingPage.faq.items.tryFree.question"),
      answer: t("pricingPage.faq.items.tryFree.answer"),
    },
    {
      question: t("pricingPage.faq.items.creditsWork.question"),
      answer: t("pricingPage.faq.items.creditsWork.answer"),
    },
    {
      question: t("pricingPage.faq.items.cancelAnytime.question"),
      answer: t("pricingPage.faq.items.cancelAnytime.answer"),
    },
    {
      question: t("pricingPage.faq.items.customerPortal.question"),
      answer: t("pricingPage.faq.items.customerPortal.answer"),
    },
    {
      question: t("pricingPage.faq.items.cancelDifference.question"),
      answer: t("pricingPage.faq.items.cancelDifference.answer"),
    },
    {
      question: t("pricingPage.faq.items.billingDetails.question"),
      answer: t("pricingPage.faq.items.billingDetails.answer"),
    },
    {
      question: t("pricingPage.faq.items.refunds.question"),
      answer: t("pricingPage.faq.items.refunds.answer"),
    },
  ];

  return (
    <section id="pricing" className="py-24 sm:py-32">
      <div className="container max-w-7xl">
        <div className="text-center">
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            {t("pricingPage.title")}
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-base md:text-lg text-muted-foreground">
            {t("pricingPage.subtitle")}
          </p>

        </div>

        <PricingPlans variant="section" initialPlans={initialPlans} />

        <div className="mt-16 space-y-12">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-8">
              <h3 className="text-3xl md:text-4xl text-center font-bold mb-4">
                {t("pricingPage.faq.title")}
              </h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("pricingPage.faq.subtitle")}
              </p>
            </div>
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item) => (
                <AccordionItem
                  key={item.question}
                  value={item.question}
                  className="border-b border-border px-4 py-1"
                >
                  <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

      </div>
    </section>
  );
};
