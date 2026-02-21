"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { useI18n } from "@/lib/i18n/provider";

export function PricingModal() {
  const { isOpen, closeModal } = usePricingModal();
  const { t } = useI18n();
  return (
    <>
      <Dialog open={isOpen} onOpenChange={closeModal}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-7xl max-h-[92vh] overflow-y-auto p-0">
          <div className="app-card relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(980px_520px_at_18%_0%,hsl(var(--primary)/0.20),transparent_62%)]"
            />
            <DialogHeader className="relative px-6 pt-6 pb-4">
            <DialogTitle className="text-center sr-only">{t("pricing.modal.srTitle")}</DialogTitle>
            <div className="space-y-2">
              <div>
                <h2 className="text-2xl md:text-3xl text-center font-bold tracking-tight">
                  {t("pricing.modal.title")}
                </h2>
                <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
                  {t("pricing.modal.subtitle")}
                </p>
              </div>

            </div>
          </DialogHeader>

          <div className="relative px-6 pb-6">
            <PricingPlans variant="modal" onNavigate={closeModal} />
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
