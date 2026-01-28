"use client";

import React from 'react';
import { formatDuration, formatDateTime } from '@/lib/format-utils';

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
      <div className="flex items-center gap-1.5">
        <h3 className={`font-semibold ${titleSizeClass} truncate ${
          isSelected ? 'text-primary' : 'text-foreground'
          }`}>
          {displayTitle}
        </h3>

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
              <span className="text-muted-foreground/60" aria-hidden="true">·</span>
              <span className="inline-flex items-center rounded-sm bg-accent px-1 py-0.5 text-[10px] font-medium text-accent-foreground">
                {modelLabel}
              </span>
            </>
          )}

          {visibleTags.length > 0 ? (
            <>
              <span className="text-muted-foreground/60" aria-hidden="true">·</span>
              <div className={`${textSizeClass} text-muted-foreground truncate flex-1`} title={tags}>
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

      {/* 创建时间 */}
      {createdAt && (
        <p className={`${textSizeClass} text-muted-foreground/60 truncate ${timeMarginClass}`}>
          {formatDateTime(createdAt)}
        </p>
      )}
    </div>
  );
};
