"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '@/lib/z-index';

interface TooltipProps {
  children: React.ReactNode;
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  allowWrap?: boolean; // 新增：是否允许换行
  matchWidth?: boolean; // 新增：是否匹配子元素宽度
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'right',
  delay = 200,
  className = '',
  allowWrap = false,
  matchWidth = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);

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
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const offset = 16;
      const style: React.CSSProperties = {
        position: 'fixed',
        pointerEvents: 'none',
        top: rect.top + rect.height / 2,
        left: rect.right + offset,
        transform: 'translateY(-50%)',
      };

      switch (position) {
        case 'top':
          style.top = rect.top - offset;
          style.left = rect.left + rect.width / 2;
          style.transform = 'translate(-50%, -100%)';
          break;
        case 'bottom':
          style.top = rect.bottom + offset;
          style.left = rect.left + rect.width / 2;
          style.transform = 'translate(-50%, 0)';
          break;
        case 'left':
          style.left = rect.left - offset;
          style.top = rect.top + rect.height / 2;
          style.transform = 'translate(-100%, -50%)';
          break;
        case 'right':
        default:
          style.left = rect.right + offset;
          style.top = rect.top + rect.height / 2;
          style.transform = 'translate(0, -50%)';
          break;
      }

      if (matchWidth) {
        style.minWidth = rect.width;
      }

      setPositionStyle(style);
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible, position, matchWidth, mounted]);

  const getTooltipClasses = () => {
    const whitespaceClass = allowWrap ? 'break-words' : 'whitespace-nowrap';
    const widthClass = matchWidth ? 'min-w-full text-center' : '';
    return `relative inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-tight text-[#0c0c16] bg-white shadow-[0_12px_32px_rgba(5,5,15,0.35)] border border-white/80 transition-all duration-200 ease-out ${whitespaceClass} ${widthClass}`;
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {isVisible && mounted && positionStyle &&
        createPortal(
          <div
            className={getTooltipClasses()}
            style={{
              ...positionStyle,
              zIndex: Z_INDEX.TOOLTIP,
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
