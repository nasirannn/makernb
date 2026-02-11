"use client";

import React from 'react';
import { formatDuration, formatDateTime } from '@/lib/format-utils';
import { Tooltip } from '@/components/ui/tooltip';

interface TrackInfoProps {
  title: string;
  tags?: string;
  duration?: number;
  createdAt?: string;
  model?: string;
  modelPlacement?: 'title' | 'meta' | 'none';
  variant?: 'default' | 'studio';
  isError?: boolean;
  errorMessage?: string;
  isGenerating?: boolean;
  isSelected?: boolean;
  showDuration?: boolean;
  isExtension?: boolean;
  originalTrackTitle?: string;
  sourceType?: 'extended' | 'replace_section';
  renderTagsAsText?: boolean;
  titleActions?: React.ReactNode;
  footerActions?: React.ReactNode;
}

export const TrackInfo: React.FC<TrackInfoProps> = ({
  title,
  tags,
  duration,
  createdAt,
  model,
  modelPlacement = 'meta',
  variant = 'default',
  isError = false,
  errorMessage,
  isGenerating = false,
  isSelected = false,
  showDuration = true,
  isExtension = false,
  originalTrackTitle,
  sourceType,
  renderTagsAsText = false,
  titleActions,
  footerActions,
}) => {
  void isExtension;
  const isStudio = variant === 'studio';
  const heightClass = isStudio ? 'h-full min-h-[90px]' : 'h-full min-h-16';
  const titleSizeClass = 'text-sm';
  const textSizeClass = 'text-xs';
  const contentPaddingClass = isStudio ? 'py-1' : 'py-0.5';
  const titleRowClass = isStudio
    ? 'h-8 min-h-0 min-w-0 items-end gap-2.5'
    : 'h-7 min-h-0 min-w-0 -mt-px items-end gap-2';
  const titleMainGapClass = isStudio ? 'gap-2' : 'gap-1.5';
  const tagsRowClass = isStudio
    ? 'mt-0.5 h-5 min-h-0 items-center gap-2.5'
    : 'h-4 min-h-0 items-center gap-2';
  const footerRowClass = isStudio
    ? 'mt-1 h-8 min-h-0 items-center'
    : 'h-7 min-h-0 items-center';
  const footerActionsClass = isStudio
    ? 'flex h-8 items-center gap-2'
    : 'flex h-7 items-center gap-1.5';

  const parsedTags = React.useMemo(() => {
    if (!tags || renderTagsAsText) return [];
    return tags
      .split(/[,，;.]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }, [tags, renderTagsAsText]);

  const plainTagsText = React.useMemo(() => {
    if (!tags || !renderTagsAsText) return '';
    const normalized = tags.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 80) return normalized;
    return `${normalized.slice(0, 80).trimEnd()}...`;
  }, [tags, renderTagsAsText]);

  const hasPlainTextTags = plainTagsText.length > 0;
  const visibleTags = parsedTags.slice(0, 2);
  const hiddenTagCount = parsedTags.length > 2 ? parsedTags.length - 2 : 0;

  const tagTooltipContent = React.useMemo(() => {
    if (parsedTags.length === 0) return null;

    return (
      <div className="w-fit max-w-[min(88vw,560px)] rounded-2xl bg-popover/95 p-3 text-left shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-popover/85">
        <div className="flex max-h-[46vh] flex-wrap items-start gap-1.5 overflow-y-auto pr-1">
          {parsedTags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className={`inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-[11px] font-medium leading-tight tracking-tight ${
                index === 0
                  ? 'bg-muted/75 text-foreground'
                  : 'bg-muted/50 text-foreground/85'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    );
  }, [parsedTags]);

  const modelLabel = React.useMemo(() => {
    if (!model) return null;
    if (model === 'V4_5PLUS') return 'V4.5+';
    if (model === 'V4_5ALL') return 'V4.5ALL';
    if (model === 'V4_5') return 'V4.5';
    if (model === 'V4') return 'V4';
    if (model === 'V5') return 'V5';
    return model.replace('_', '.');
  }, [model]);

  const displayTitle = React.useMemo(() => {
    if (isError) return 'Generation Failed';
    return title || 'Untitled Track';
  }, [isError, title]);

  return (
    <div className={`flex-1 min-w-0 ${heightClass}`}>
      <div className={`flex h-full min-h-0 flex-col justify-between ${contentPaddingClass}`}>
        <div className={`flex ${titleRowClass}`}>
          <div className={`flex min-w-0 flex-1 items-center ${titleMainGapClass}`}>
            <h3 className={`min-w-0 flex-shrink truncate font-semibold leading-none ${titleSizeClass} ${
              isSelected ? 'text-primary' : 'text-foreground'
            }`}>
              {displayTitle}
            </h3>

            {modelLabel && modelPlacement === 'title' && (
              <span className="inline-flex items-center rounded-sm bg-accent px-1 py-0.5 text-[10px] font-medium text-accent-foreground">
                {modelLabel}
              </span>
            )}

            {!isError && originalTrackTitle && sourceType && (
              <span className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {sourceType === 'extended' ? 'Extended' : 'Replaced'}
              </span>
            )}

            {!isError && showDuration && (!duration || duration === 0) && !isGenerating && (
              <div className="flex items-center gap-1">
                <div className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground"></div>
                <div className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: '0.3s' }}></div>
                <div className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: '0.6s' }}></div>
              </div>
            )}
          </div>

          {titleActions && (
            <div className="flex flex-shrink-0 items-center justify-end pl-1">
              {titleActions}
            </div>
          )}
        </div>

        <div className={`flex ${tagsRowClass}`}>
          {!isError ? (
            <>
              {showDuration && (
                <>
                  {duration && duration > 0 ? (
                    <span className={`${textSizeClass} inline-flex items-center whitespace-nowrap leading-none text-muted-foreground`}>
                      {formatDuration(duration)}
                    </span>
                  ) : isGenerating ? (
                    <div className="flex items-center gap-0.5 text-muted-foreground/70">
                      <div className="h-1 w-1 animate-pulse rounded-full bg-current"></div>
                      <div className="h-1 w-1 animate-pulse rounded-full bg-current" style={{ animationDelay: '0.3s' }}></div>
                      <div className="h-1 w-1 animate-pulse rounded-full bg-current" style={{ animationDelay: '0.6s' }}></div>
                    </div>
                  ) : (
                    <span className={`${textSizeClass} whitespace-nowrap leading-none text-muted-foreground/70`}>
                      --:--
                    </span>
                  )}
                </>
              )}

              {modelLabel && modelPlacement === 'meta' && (
                <span className="inline-flex items-center rounded-sm bg-accent px-1 py-0.5 text-[10px] font-medium text-accent-foreground">
                  {modelLabel}
                </span>
              )}

              {showDuration && (hasPlainTextTags || visibleTags.length > 0) && (
                <span className="text-[11px] leading-none text-muted-foreground/45">|</span>
              )}

              {hasPlainTextTags ? (
                <p className={`${textSizeClass} flex-1 truncate leading-none text-muted-foreground`}>
                  {plainTagsText}
                </p>
              ) : visibleTags.length > 0 ? (
                <Tooltip
                  content={tagTooltipContent || ''}
                  position="top"
                  delay={120}
                  className="!block min-w-0 flex-1"
                  contentClassName="!inline-block !items-start !rounded-none !bg-transparent !border-0 !shadow-none !p-0 !text-left !transition-none !duration-0"
                >
                  <div className={`${textSizeClass} flex-1 cursor-pointer truncate leading-none text-muted-foreground transition-colors duration-150 hover:text-foreground/90`}>
                    {visibleTags.map((tag, index) => (
                      <span key={`${tag}-${index}`}>
                        <span>{tag.length > 50 ? `${tag.slice(0, 50)}...` : tag}</span>
                        {index < visibleTags.length - 1 && <span className="mx-1">,</span>}
                      </span>
                    ))}
                    {hiddenTagCount > 0 && (
                      <>
                        {visibleTags.length > 0 && <span className="mx-1">,</span>}
                        <span className="whitespace-nowrap">+{hiddenTagCount} more</span>
                      </>
                    )}
                  </div>
                </Tooltip>
              ) : (
                isGenerating && (
                  <p className={`${textSizeClass} flex-1 truncate leading-none text-muted-foreground`}>
                    Generating your track, please wait...
                  </p>
                )
              )}
            </>
          ) : (
            <p className={`${textSizeClass} truncate leading-none text-amber-400/90`}>
              {errorMessage || 'Unknown error'}
            </p>
          )}
        </div>

        <div className={`flex ${footerRowClass}`}>
          {footerActions ? (
            <div className={footerActionsClass}>
              {footerActions}
            </div>
          ) : createdAt ? (
            <p className={`${textSizeClass} truncate leading-none text-muted-foreground/60`}>
              {formatDateTime(createdAt)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};
