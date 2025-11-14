/**
 * 扩展标记组件
 * 用于在曲目列表中显示扩展关系
 */

"use client";

import React from 'react';
import { Maximize2, ArrowRight } from 'lucide-react';
import { Tooltip } from "@/components/ui/tooltip";

export interface ExtensionBadgeProps {
  /** 是否是扩展歌曲 */
  isExtension: boolean;
  /** 原始曲目 ID */
  originalTrackId?: string;
  /** 原始曲目标题 */
  originalTrackTitle?: string;
  /** 点击查看原始歌曲回调 */
  onViewOriginal?: () => void;
  /** 大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 样式变体 */
  variant?: 'default' | 'subtle' | 'prominent';
}

/**
 * 扩展标记组件
 */
export const ExtensionBadge: React.FC<ExtensionBadgeProps> = ({
  isExtension,
  originalTrackId,
  originalTrackTitle,
  onViewOriginal,
  size = 'sm',
  variant = 'default',
}) => {
  // 如果不是扩展歌曲，不显示标记
  if (!isExtension) {
    return null;
  }

  // 尺寸配置
  const sizeConfig = {
    sm: {
      icon: 'h-3 w-3',
      text: 'text-xs',
      padding: 'px-1.5 py-0.5',
      gap: 'gap-1',
    },
    md: {
      icon: 'h-3.5 w-3.5',
      text: 'text-sm',
      padding: 'px-2 py-1',
      gap: 'gap-1.5',
    },
    lg: {
      icon: 'h-4 w-4',
      text: 'text-base',
      padding: 'px-2.5 py-1.5',
      gap: 'gap-2',
    },
  };

  // 样式配置
  const variantConfig = {
    default: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20',
    subtle: 'bg-muted text-muted-foreground border border-transparent hover:bg-muted/80',
    prominent: 'bg-primary text-primary-foreground border border-primary hover:bg-primary/90',
  };

  const config = sizeConfig[size];
  const variantStyle = variantConfig[variant];

  // 工具提示内容
  const tooltipContent = originalTrackTitle
    ? `Extended from: "${originalTrackTitle}"`
    : `Extended track`;

  // 标记内容
  const badgeContent = (
    <div
      className={`
        inline-flex items-center ${config.gap} ${config.padding} 
        rounded-full font-medium transition-colors
        ${variantStyle}
        ${onViewOriginal ? 'cursor-pointer' : 'cursor-default'}
      `}
      onClick={(e) => {
        if (onViewOriginal) {
          e.stopPropagation();
          onViewOriginal();
        }
      }}
    >
      <Maximize2 className={config.icon} />
      <span className={config.text}>
        Extended
      </span>
      {onViewOriginal && <ArrowRight className={config.icon} />}
    </div>
  );

  // 如果有工具提示，包裹在 Tooltip 中
  const fullTooltipContent = (
    <div className="max-w-xs">
      <p className="text-xs">{tooltipContent}</p>
      {onViewOriginal && (
        <p className="text-xs text-muted-foreground mt-1">
          Click to view original track
        </p>
      )}
    </div>
  );

  return (
    <Tooltip content={fullTooltipContent} position="top" allowWrap>
      {badgeContent}
    </Tooltip>
  );
};

/**
 * 简化版扩展标记（仅图标）
 */
export const ExtensionIcon: React.FC<ExtensionBadgeProps> = ({
  isExtension,
  originalTrackTitle,
  onViewOriginal,
  size = 'sm',
}) => {
  if (!isExtension) {
    return null;
  }

  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-5 w-5' : 'h-6 w-6';
  
  const tooltipContent = originalTrackTitle
    ? `Extended from: "${originalTrackTitle}"`
    : `Extended track`;

  const iconTooltipContent = (
    <div>
      <p className="text-xs">{tooltipContent}</p>
      {onViewOriginal && (
        <p className="text-xs text-muted-foreground mt-1">
          Click to view original
        </p>
      )}
    </div>
  );

  return (
    <Tooltip content={iconTooltipContent} position="top" allowWrap>
      <div
        className={`
          inline-flex items-center justify-center
          ${onViewOriginal ? 'cursor-pointer hover:text-primary' : 'cursor-default'}
          text-primary/70 transition-colors
        `}
        onClick={(e) => {
          if (onViewOriginal) {
            e.stopPropagation();
            onViewOriginal();
          }
        }}
      >
        <Maximize2 className={sizeClass} />
      </div>
    </Tooltip>
  );
};

