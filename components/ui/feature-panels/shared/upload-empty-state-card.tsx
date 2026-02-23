"use client";

import React from "react";

type UploadCardAction = {
  label: string;
  onClick: () => void;
  title?: string;
};

type UploadEmptyStateCardProps = {
  title?: string;
  headline: string;
  icon: React.ReactNode;
  onClick: () => void;
  clickTitle?: string;
  secondaryAction?: UploadCardAction;
  secondaryActionPrefix?: string;
  description?: React.ReactNode;
  formatHint?: string;
  durationHint?: string;
};

export const UploadEmptyStateCard: React.FC<UploadEmptyStateCardProps> = ({
  title,
  headline,
  icon,
  onClick,
  clickTitle,
  secondaryAction,
  secondaryActionPrefix,
  description,
  formatHint,
  durationHint,
}) => {
  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const handleSecondaryKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (!secondaryAction) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      secondaryAction.onClick();
    }
  };

  const thirdLineText = [formatHint, durationHint].filter(Boolean).join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
      title={clickTitle || headline}
      aria-label={clickTitle || headline}
      className="studio-panel-card upload-dashed-card group relative cursor-pointer overflow-hidden rounded-2xl border border-dashed border-primary/40 px-4 py-5 transition-colors duration-200 hover:border-primary/55 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0 dark:border-primary/50 dark:hover:border-primary/70 dark:hover:bg-foreground/10"
    >
      {title ? <h3 className="text-xs md:text-sm font-semibold text-foreground">{title}</h3> : null}

      <div className={`relative flex min-h-[138px] flex-col items-center justify-center gap-2.5 text-center ${title ? "mt-2.5" : ""}`}>
        <p className="inline-flex items-center justify-center gap-2 text-base font-semibold tracking-tight text-foreground md:text-lg">
          <span className="inline-flex h-5 w-5 items-center justify-center text-foreground/90">
            {icon}
          </span>
          <span className="leading-tight">{headline}</span>
        </p>

        <p className="max-w-[44ch] text-sm leading-relaxed text-muted-foreground">
          {description}
          {secondaryAction ? (
            <>
              {secondaryActionPrefix ? <span> {secondaryActionPrefix} </span> : <span> </span>}
              <span
                role="link"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  secondaryAction.onClick();
                }}
                onKeyDown={handleSecondaryKeyDown}
                title={secondaryAction.title || secondaryAction.label}
                className="cursor-pointer font-semibold text-primary/90 underline underline-offset-2 transition-opacity hover:opacity-85 dark:text-primary-foreground/90"
              >
                {secondaryAction.label}
              </span>
            </>
          ) : null}
        </p>

        {thirdLineText ? (
          <p className="text-xs font-medium leading-5 text-foreground/70 dark:text-white/70">{thirdLineText}</p>
        ) : null}
      </div>
    </div>
  );
};
