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
}) => {
  const heightClass = isExtension ? 'h-12' : 'h-16';
  const titleSizeClass = isExtension ? 'text-xs' : 'text-sm';
  const textSizeClass = isExtension ? 'text-[10px]' : 'text-xs';
  const justifyClass = isExtension ? 'justify-start' : 'justify-center';
  const tagMarginClass = isExtension ? 'mt-0' : 'mt-0.5';
  const timeMarginClass = isExtension ? 'mt-0' : 'mt-1';
  
  return (
    <div className={`flex-1 min-w-0 flex flex-col ${justifyClass} ${heightClass}`}>
      {/* 标题行 */}
      <div className="flex items-center gap-2">
        <h3 className={`font-semibold ${titleSizeClass} truncate ${
          isError
            ? 'text-red-400'
            : isSelected
              ? 'text-primary'
              : 'text-foreground'
        }`}>
          {isError ? (errorMessage || title || 'Generation failed') : (title || 'Untitled Track')}
        </h3>
        
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
                    /* 如果正在生成且没有时长，显示 --:-- */
                    isGenerating && (
                      <>
                        <span className={`${textSizeClass} text-muted-foreground whitespace-nowrap`}>
                          --:--
                        </span>
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

