"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}

export const CancelSubscriptionDialog: React.FC<CancelSubscriptionDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}) => {
  const { t } = useI18n();
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && loading) {
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[460px]">
        <AlertDialogHeader className="space-y-2">
          <AlertDialogTitle>{t("pricing.dialog.scheduleCancellationTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("pricing.dialog.scheduleCancellationDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="sm:order-1 border border-input bg-background text-foreground hover:bg-muted hover:text-foreground dark:hover:text-accent-foreground"
          >
            {loading ? (
              <span className="inline-flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("pricing.dialog.canceling")}
              </span>
            ) : (
              t("pricing.dialog.scheduleCancellationAction")
            )}
          </AlertDialogAction>
          <AlertDialogCancel
            disabled={loading}
            className="sm:order-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("pricing.dialog.keepSubscription")}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
