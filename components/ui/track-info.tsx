"use client";

import React from 'react';
import { formatDuration, formatDateTime } from '@/lib/format-utils';
import { Tooltip } from '@/components/ui/tooltip';
import { Loader2, Pencil } from 'lucide-react';

interface TrackInfoProps {
  title: string;
  tags?: string;
  duration?: number;
  createdAt?: string;
  model?: string;
  modelPlacement?: 'title' | 'meta' | 'none';
  isError?: boolean;
  errorMessage?: string;
  isGenerating?: boolean;
  isSelected?: boolean;
  showDuration?: boolean;
  isExtension?: boolean;
  originalTrackTitle?: string;
  sourceType?: 'extended' | 'replace_section';
  showTitleEditButton?: boolean;
  onTitleEditClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
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
  isError = false,
  errorMessage,
  isGenerating = false,
  isSelected = false,
  showDuration = true,
  isExtension = false,
  originalTrackTitle,
  sourceType,
  showTitleEditButton = false,
  onTitleEditClick,
  titleActions,
  footerActions,
}) => {
  // 统一所有track的样式，不再区分extension
  const heightClass = 'min-h-16';
  const titleSizeClass = 'text-sm';
  const textSizeClass = 'text-xs';
  const justifyClass = 'justify-center';
  const tagMarginClass = 'mt-0.5';
  const timeMarginClass = 'mt-1';
  const parsedTags = React.useMemo(() => {
    if (!tags) return [];
    return tags
      .split(/[,，;.]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }, [tags]);
  const visibleTags = parsedTags.slice(0, 2);
  const hiddenTagCount = parsedTags.length > 2 ? parsedTags.length - 2 : 0;
  const tagTooltipContent = React.useMemo(() => {
    if (parsedTags.length === 0) return null;

    const tooltipTags = parsedTags;

    return (
      <div className="w-fit max-w-[min(88vw,560px)] rounded-2xl bg-popover/95 p-3 text-left shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-popover/85">
        <div className="flex max-h-[46vh] flex-wrap items-start gap-1.5 overflow-y-auto pr-1">
          {tooltipTags.map((tag, index) => (
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
    const safeTitle = title || 'Untitled Track';
    return safeTitle;
  }, [isError, title]);
  
  return (
    <div className={`flex-1 min-w-0 flex flex-col ${justifyClass} ${heightClass}`}>
      {/* 标题行 */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h3 className={`min-w-0 flex-shrink truncate font-semibold ${titleSizeClass} ${
            isSelected ? 'text-primary' : 'text-foreground'
            }`}>
            {displayTitle}
          </h3>

          {showTitleEditButton && !isError && (
            isGenerating ? (
              <span
                className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center text-muted-foreground"
                aria-label="Generating"
                title="Generating"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </span>
            ) : (
              onTitleEditClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTitleEditClick(e);
                  }}
                  className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all duration-150 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover:opacity-100"
                  aria-label="Edit music info"
                  title="Edit music info"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )
            )
          )}

          {modelLabel && modelPlacement === 'title' && (
            <span className="inline-flex items-center rounded-sm bg-accent px-1 py-0.5 text-[10px] font-medium text-accent-foreground">
              {modelLabel}
            </span>
          )}

          {/* 来源标识徽章 - 紧跟标题后面 */}
          {!isError && originalTrackTitle && sourceType && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary whitespace-nowrap flex-shrink-0">
              {sourceType === 'extended' ? 'Extended' : 'Replaced'}
            </span>
          )}

          {/* 时长加载动画（仅在没有时长且不在生成中时显示，生成中会显示 --:--） */}
          {!isError && showDuration && (!duration || duration === 0) && !isGenerating && (
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
              <div className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
            </div>
          )}
        </div>

        {titleActions && (
          <div className="flex flex-shrink-0 items-center justify-end">
            {titleActions}
          </div>
        )}
      </div>
      
      {/* 标签和时长行 */}
      {!isError && (
        <div className={`flex items-center gap-2 ${tagMarginClass}`}>
          {showDuration && (
            <>
              {duration && duration > 0 ? (
                <span className={`${textSizeClass} text-muted-foreground whitespace-nowrap inline-flex items-center gap-1`}>
                  {formatDuration(duration)}
                </span>
              ) : isGenerating ? (
                <div className="flex items-center gap-0.5 text-muted-foreground/70">
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                </div>
              ) : (
                <span className={`${textSizeClass} text-muted-foreground/70 whitespace-nowrap`}>
                  --:--
                </span>
              )}
            </>
          )}

          {modelLabel && modelPlacement === 'meta' && (
            <>
              <span className="inline-flex items-center rounded-sm bg-accent px-1 py-0.5 text-[10px] font-medium text-accent-foreground">
                {modelLabel}
              </span>
            </>
          )}

          {showDuration && visibleTags.length > 0 && (
            <span className="text-[11px] leading-none text-muted-foreground/45">|</span>
          )}

          {visibleTags.length > 0 ? (
            <>
              <Tooltip
                content={tagTooltipContent || ''}
                position="top"
                delay={120}
                className="!block min-w-0 flex-1"
                contentClassName="!inline-block !items-start !rounded-none !bg-transparent !border-0 !shadow-none !p-0 !text-left !transition-none !duration-0"
              >
                <div className={`${textSizeClass} text-muted-foreground truncate flex-1 cursor-pointer transition-colors duration-150 hover:text-foreground/90`}>
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
            </>
          ) : (
            isGenerating && (
              <p className={`${textSizeClass} text-muted-foreground truncate flex-1`}>
                Generating your track, please wait...
              </p>
            )
          )}
        </div>
      )}

      {/* 错误提示 */}
      
      {/* 错误提示 */}
      {isError && (
        <p className={`${textSizeClass} text-amber-400/90 truncate ${timeMarginClass}`}>
          {errorMessage || 'Unknown error'}
        </p>
      )}

      {footerActions ? (
        <div className={`${timeMarginClass} flex items-center gap-1.5`}>
          {footerActions}
        </div>
      ) : (
        createdAt && (
          <p className={`${textSizeClass} text-muted-foreground/60 truncate ${timeMarginClass}`}>
            {formatDateTime(createdAt)}
          </p>
        )
      )}
    </div>
  );
};
