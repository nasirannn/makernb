"use client";

import React from 'react';
import { X } from "lucide-react";
import { StudioPanel } from "@/components/ui/studio-panel";

interface MobileCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  studioPanelProps: any; // StudioPanel的所有props
}

/**
 * 移动端创作抽屉组件
 * 底部弹出的抽屉，包含StudioPanel用于创作音乐
 */
export const MobileCreateDrawer = React.memo(({
  isOpen,
  onClose,
  studioPanelProps,
}: MobileCreateDrawerProps) => {
  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-[50]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div 
        className="absolute bottom-0 left-0 right-0 bg-background border-t border-border/30 rounded-t-3xl shadow-2xl transform-gpu transition-transform duration-300 ease-out will-change-transform overflow-hidden" 
        style={{ 
          height: 'auto', 
          minHeight: 'calc(500px + var(--mobile-nav-height, 0px))', 
          maxHeight: 'calc(100vh - var(--mobile-nav-height, 0px))' 
        }}
      >
        <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - var(--mobile-nav-height, 0px))' }}>
          {/* Drag Handle - 拖动指示器 */}
          <div 
            onClick={onClose}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              (e.currentTarget as any).dragStartY = touch.clientY;
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              const dragStartY = (e.currentTarget as any).dragStartY;
              if (dragStartY !== undefined) {
                (e.currentTarget as any).dragCurrentY = touch.clientY;
              }
            }}
            onTouchEnd={(e) => {
              const dragStartY = (e.currentTarget as any).dragStartY;
              const dragCurrentY = (e.currentTarget as any).dragCurrentY;
              
              if (dragStartY !== undefined && dragCurrentY !== undefined) {
                const dragDistance = dragCurrentY - dragStartY;
                // 向下拖动超过100px，关闭面板
                if (dragDistance > 100) {
                  onClose();
                }
              }
              
              // 清除拖动数据
              delete (e.currentTarget as any).dragStartY;
              delete (e.currentTarget as any).dragCurrentY;
            }}
            className="flex items-center justify-center py-3 cursor-pointer active:cursor-grabbing touch-none flex-shrink-0"
          >
            <div className="w-12 h-1 bg-border/50 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 px-6 pb-4 bg-background/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Create Music</h1>
              <button
                onClick={onClose}
                className="p-2 hover:bg-foreground/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Create Panel Content */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - var(--mobile-nav-height, 0px) - 140px)' }}>
            <StudioPanel
              {...studioPanelProps}
              forceVisibleOnMobile
              onCollapse={onClose}
              panelOpen={true}
              setPanelOpen={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

MobileCreateDrawer.displayName = 'MobileCreateDrawer';

