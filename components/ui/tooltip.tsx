"use client";

import React, { useState } from 'react';
import { Z_INDEX } from '@/lib/z-index';

interface TooltipProps {
  children: React.ReactNode;
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'right',
  delay = 200,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => setIsVisible(false), 100);
    setTimeoutId(id);
  };

  const getPositionClasses = () => {
    const baseClasses = `absolute px-2 py-1.5 text-xs text-foreground bg-card/95 backdrop-blur-md rounded-lg shadow-lg border border-border/50 pointer-events-none transition-all duration-200 ease-out w-full break-words z-[${Z_INDEX.TOOLTIP}]`;
    
    switch (position) {
      case 'top':
        return `${baseClasses} bottom-full mb-2 left-1/2 transform -translate-x-1/2`;
      case 'bottom':
        return `${baseClasses} top-full mt-2 left-1/2 transform -translate-x-1/2`;
      case 'left':
        return `${baseClasses} right-full mr-2 top-1/2 transform -translate-y-1/2`;
      case 'right':
      default:
        return `${baseClasses} left-full ml-2 top-1/2 transform -translate-y-1/2`;
    }
  };

  const getArrowClasses = () => {
    const baseArrow = "absolute w-2 h-2 bg-card/95 backdrop-blur-md border border-border/50";
    
    switch (position) {
      case 'top':
        return `${baseArrow} top-full left-1/2 transform -translate-x-1/2 rotate-45 border-t-0 border-l-0`;
      case 'bottom':
        return `${baseArrow} bottom-full left-1/2 transform -translate-x-1/2 rotate-45 border-b-0 border-r-0`;
      case 'left':
        return `${baseArrow} left-full top-1/2 transform -translate-y-1/2 rotate-45 border-l-0 border-b-0`;
      case 'right':
      default:
        return `${baseArrow} right-full top-1/2 transform -translate-y-1/2 rotate-45 border-r-0 border-t-0`;
    }
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      style={{ zIndex: Z_INDEX.TOOLTIP }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {isVisible && (
        <div className={getPositionClasses()}>
          {content}
          <div className={getArrowClasses()} />
        </div>
      )}
    </div>
  );
};

// 简化版 Tooltip，用于简单的文本提示
export const SimpleTooltip: React.FC<Omit<TooltipProps, 'delay' | 'className'>> = ({
  children,
  content,
  position = 'right'
}) => {
  return (
    <Tooltip 
      content={content} 
      position={position}
      delay={0}
      className=""
    >
      {children}
    </Tooltip>
  );
};
