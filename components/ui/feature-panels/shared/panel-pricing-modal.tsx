"use client";

import { X } from "lucide-react";
import { PricingSection } from "@/components/layout/sections/pricing";
import { Z_INDEX_COMBINATIONS, getZIndexClass } from "@/lib/z-index";

type PanelPricingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PanelPricingModal({ open, onOpenChange }: PanelPricingModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 ${Z_INDEX_COMBINATIONS.MODAL.backdrop} flex items-center justify-center bg-black/65 p-4 backdrop-blur-[1px] dark:bg-black/60`}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-background"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={() => onOpenChange(false)}
          className={`sticky right-4 top-4 ${getZIndexClass('MAIN_CONTENT')} float-right text-muted-foreground transition-colors hover:text-foreground`}
        >
          <X className="h-6 w-6" />
        </button>
        <div className="pt-8">
          <PricingSection />
        </div>
      </div>
    </div>
  );
}
