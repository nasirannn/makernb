"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '@/lib/z-index';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: React.ReactNode;
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  contentClassName?: string;
  allowWrap?: boolean; // 新增：是否允许换行
  matchWidth?: boolean; // 新增：是否匹配子元素宽度
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'right',
  delay = 200,
  className = '',
  contentClassName = '',
  allowWrap = false,
  matchWidth = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useLayoutEffect(() => {
    if (!mounted || !isVisible) {
      setPositionStyle(null);
      return;
    }

    const updatePosition = () => {
      const triggerEl = triggerRef.current;
      const tooltipEl = tooltipRef.current;
      if (!triggerEl || !tooltipEl) return;

      const triggerRect = triggerEl.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const viewportPadding = 12;
      const offset = 12;

      const clamp = (value: number, min: number, max: number) => {
        if (max < min) return min;
        return Math.min(Math.max(value, min), max);
      };

      const placementOrder: Array<'top' | 'bottom' | 'left' | 'right'> = (() => {
        switch (position) {
          case 'top':
            return ['top', 'bottom', 'right', 'left'];
          case 'bottom':
            return ['bottom', 'top', 'right', 'left'];
          case 'left':
            return ['left', 'right', 'bottom', 'top'];
          case 'right':
          default:
            return ['right', 'left', 'bottom', 'top'];
        }
      })();

      const getCoordinates = (placement: 'top' | 'bottom' | 'left' | 'right') => {
        switch (placement) {
          case 'top':
            return {
              top: triggerRect.top - tooltipRect.height - offset,
              left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
            };
          case 'bottom':
            return {
              top: triggerRect.bottom + offset,
              left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
            };
          case 'left':
            return {
              top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
              left: triggerRect.left - tooltipRect.width - offset,
            };
          case 'right':
          default:
            return {
              top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
              left: triggerRect.right + offset,
            };
        }
      };

      const fitsViewport = (coords: { top: number; left: number }) => (
        coords.top >= viewportPadding &&
        coords.left >= viewportPadding &&
        coords.top + tooltipRect.height <= viewportHeight - viewportPadding &&
        coords.left + tooltipRect.width <= viewportWidth - viewportPadding
      );

      let selectedCoords = getCoordinates(placementOrder[0]);
      for (const placement of placementOrder) {
        const candidate = getCoordinates(placement);
        if (fitsViewport(candidate)) {
          selectedCoords = candidate;
          break;
        }
      }

      setPositionStyle({
        position: 'fixed',
        pointerEvents: 'none',
        top: Math.round(
          clamp(
            selectedCoords.top,
            viewportPadding,
            viewportHeight - tooltipRect.height - viewportPadding
          )
        ),
        left: Math.round(
          clamp(
            selectedCoords.left,
            viewportPadding,
            viewportWidth - tooltipRect.width - viewportPadding
          )
        ),
        minWidth: matchWidth ? triggerRect.width : undefined,
      });
    };

    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible, position, matchWidth, mounted]);

  const getTooltipClasses = () => {
    const whitespaceClass = allowWrap ? 'break-words' : 'whitespace-nowrap';
    const widthClass = matchWidth ? 'min-w-full text-center' : '';
    return cn(
      'relative inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-tight text-[#0c0c16] bg-white shadow-[0_12px_32px_rgba(5,5,15,0.35)] border border-white/80 transition-all duration-200 ease-out',
      whitespaceClass,
      widthClass,
      contentClassName
    );
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {isVisible && mounted &&
        createPortal(
          <div
            ref={tooltipRef}
            className={getTooltipClasses()}
            style={{
              ...(positionStyle ?? {
                position: 'fixed',
                pointerEvents: 'none',
                top: 0,
                left: 0,
                opacity: 0,
              }),
              zIndex: Math.max(
                Z_INDEX.TOOLTIP,
                Z_INDEX.DIALOG_CONTENT + 1,
                Z_INDEX.AUTH_MODAL_CONTENT + 1
              ),
            }}
          >
            {content}
          </div>,
          document.body
        )
      }
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
