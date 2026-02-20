"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import type { PricingPlan } from "@/lib/pricing-config";

interface PricingSectionProps {
  initialPlans?: PricingPlan[];
}

export const PricingSection = ({ initialPlans }: PricingSectionProps) => {
  const faqItems = [
    {
      question: "Can I try MakeRNB for free?",
      answer:
        "Yes. The free plan includes daily credits so you can explore core features before upgrading.",
    },
    {
      question: "How do credits work?",
      answer:
        "Every action uses credits. The amount depends on the feature you use.",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes. You can schedule cancellation from the Pricing page or the Customer Portal.",
    },
    {
      question: "What is the Customer Portal?",
      answer:
        "The Customer Portal is a self-service page hosted by Creem where you can manage billing details, invoices, and subscription status. If you are already subscribed, click the “Manage Subscription” button on your current plan card or use the subscription badge in the avatar menu to open the portal.",
    },
    {
      question: "What is the difference between canceling here and in the Customer Portal?",
      answer:
        "Canceling from the Pricing page schedules cancellation at the end of the current billing period. Canceling in the Customer Portal ends the subscription immediately and stops future charges.",
    },
    {
      question: "Where can I manage billing details?",
      answer:
        "Use the Customer Portal to update your payment method and view invoices.",
    },
    {
      question: "Do you offer refunds?",
      answer:
        "Refund terms are listed on the Refunds page. Contact support if you need help.",
    },
  ] as const;

  return (
    <section id="pricing" className="py-24 sm:py-32">
      <div className="container max-w-7xl">
        <div className="text-center">
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            Choose the Plan That Fits You Best
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-base md:text-lg text-muted-foreground">
            Upgrade for more credits, faster iteration, and higher-quality exports. Cancel anytime.
          </p>

        </div>

        <PricingPlans variant="section" initialPlans={initialPlans} />

        <div className="mt-16 space-y-12">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-8">
              <h3 className="text-3xl md:text-4xl text-center font-bold mb-4">
                Everything You Need to Know
              </h3>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Get answers to common questions about plans, billing, and credits.
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
