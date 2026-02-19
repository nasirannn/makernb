"use client";

import React from "react";
import { Film, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";

interface Mp4BrandingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  author: string;
  domainName: string;
  onAuthorChange: (value: string) => void;
  onDomainNameChange: (value: string) => void;
  onGenerate: () => void;
}

const AUTHOR_MAX_LENGTH = 50;
const DOMAIN_MAX_LENGTH = 50;

const BrandingField = ({
  id,
  label,
  placeholder,
  value,
  maxLength,
  onChange,
  helper,
  infoTitle,
  infoAriaLabel,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  helper: string;
  infoTitle: string;
  infoAriaLabel: string;
}) => {
  return (
    <div className="space-y-2.5 rounded-xl bg-muted/35 p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold tracking-tight">
          {label}
        </label>
        <button
          type="button"
          aria-label={infoAriaLabel}
          title={infoTitle}
          className="inline-flex h-7 w-7 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-9 border-0 bg-background/90 shadow-sm ring-1 ring-black/5 dark:ring-white/10 focus-visible:ring-2 focus-visible:ring-primary/40"
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{helper}</span>
        <span className="font-medium text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
};

export const Mp4BrandingDialog: React.FC<Mp4BrandingDialogProps> = ({
  open,
  onOpenChange,
  author,
  domainName,
  onAuthorChange,
  onDomainNameChange,
  onGenerate,
}) => {
  const { t } = useI18n();
  const wasOpenRef = React.useRef(open);

  React.useEffect(() => {
    if (wasOpenRef.current && !open) {
      onAuthorChange("");
      onDomainNameChange("");
    }
    wasOpenRef.current = open;
  }, [open, onAuthorChange, onDomainNameChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] overflow-hidden bg-background p-0 sm:max-w-[520px]">
        <DialogHeader className="bg-muted/45 px-4 pb-3 pt-4 text-left sm:px-5 sm:pt-5">
          <DialogTitle className="text-lg font-semibold tracking-tight">{t("mp4Branding.title")}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {t("mp4Branding.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 bg-background px-4 py-3 sm:px-5">
          <BrandingField
            id="mp4-branding-author"
            label={t("mp4Branding.authorLabel")}
            placeholder={t("mp4Branding.authorPlaceholder")}
            value={author}
            maxLength={AUTHOR_MAX_LENGTH}
            onChange={onAuthorChange}
            helper={t("mp4Branding.authorHelper")}
            infoTitle={t("mp4Branding.authorInfoTitle")}
            infoAriaLabel={t("mp4Branding.fieldInfoAria", { label: t("mp4Branding.authorLabel") })}
          />

          <BrandingField
            id="mp4-branding-domain"
            label={t("mp4Branding.domainLabel")}
            placeholder={t("mp4Branding.domainPlaceholder")}
            value={domainName}
            maxLength={DOMAIN_MAX_LENGTH}
            onChange={onDomainNameChange}
            helper={t("mp4Branding.domainHelper")}
            infoTitle={t("mp4Branding.domainInfoTitle")}
            infoAriaLabel={t("mp4Branding.fieldInfoAria", { label: t("mp4Branding.domainLabel") })}
          />
        </div>

        <DialogFooter className="bg-muted/35 px-4 py-3 sm:px-5 sm:py-4">
          <Button onClick={onGenerate} className="w-full gap-2">
            <Film className="h-4 w-4" />
            {t("mp4Branding.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
