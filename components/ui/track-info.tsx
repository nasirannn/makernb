"use client";

import React from 'react';
import { formatDuration, formatDateTime } from '@/lib/format-utils';

interface TrackInfoProps {
  title: string;
  tags?: string;
  duration?: number;
  createdAt?: string;
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
  const heightClass = 'h-16';
  const titleSizeClass = 'text-sm';
  const textSizeClass = 'text-xs';
  const justifyClass = 'justify-center';
  const tagMarginClass = 'mt-0.5';
  const timeMarginClass = 'mt-1';
  
  return (
    <div className={`flex-1 min-w-0 flex flex-col ${justifyClass} ${heightClass}`}>
      {/* 标题行 */}
      <div className="flex items-center gap-1.5">
        <h3 className={`font-semibold ${titleSizeClass} truncate ${
          isError
            ? 'text-red-400'
            : isSelected
              ? 'text-primary'
              : 'text-foreground'
        }`}>
          {isError ? (errorMessage || title || 'Generation failed') : (title || 'Untitled Track')}
        </h3>

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
        <>
          {tags && tags.trim() !== '' ? (
            <div className={`flex items-center gap-2 ${tagMarginClass}`}>
              {/* 时长显示在 tags 前面，用竖线分隔 */}
              {showDuration && (
                <>
                  {/* 如果有有效时长，显示格式化的时长 */}
                  {duration && duration > 0 ? (
                    <>
                      <span className={`${textSizeClass} text-muted-foreground whitespace-nowrap`}>
                        {formatDuration(duration)}
                      </span>
                      <span className={`${textSizeClass} text-muted-foreground/60`}>|</span>
                    </>
                  ) : (
                    /* 如果正在生成且没有时长，显示旋转icon */
                    isGenerating && (
                      <>
                        <div className="flex items-center gap-0.5">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse"></div>
                          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                          <div className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                        </div>
                        <span className={`${textSizeClass} text-muted-foreground/60`}>|</span>
                      </>
                    )
                  )}
                </>
              )}
              <p 
                className={`${textSizeClass} text-muted-foreground truncate flex-1`}
                title={tags}
              >
                {tags.split(/[,;.]/).filter((tag: string) => tag.trim()).map((tag: string, index: number, array: string[]) => (
                  <span key={index}>
                    <span>{tag.trim()}</span>
                    {index < array.length - 1 && <span className="mx-1">•</span>}
                  </span>
                ))}
                {tags.length > 100 && '...'}
              </p>
            </div>
          ) : (
            isGenerating && (
              <p className={`${textSizeClass} text-muted-foreground truncate ${tagMarginClass}`}>
                Generating your track, please wait...
              </p>
            )
          )}
        </>
      )}

      {/* 错误提示 */}
      {isError && (
        <p className={`${textSizeClass} text-red-400/80 truncate ${timeMarginClass}`}>
          Click delete to remove this failed track
        </p>
      )}
      
      {/* 创建时间 */}
      {!isError && createdAt && (
        <p className={`${textSizeClass} text-muted-foreground/60 truncate ${timeMarginClass}`}>
          {formatDateTime(createdAt)}
        </p>
      )}
    </div>
  );
};

