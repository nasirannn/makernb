"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Star, Share2, Check, Download, MoreVertical, Mic, Trash2, Eye, EyeOff, Pencil } from "lucide-react";
import { LibraryTrack } from '@/types/track';

interface TrackActionButtonsProps {
  track: LibraryTrack & any;
  isMobile?: boolean;
  
  // 状态
  isFavorited?: boolean;
  isCopied?: boolean;
  isPublished?: boolean;
  
  // 权限
  canDownloadMP3?: boolean;
  canDownloadWAV?: boolean;
  
  // 回调函数
  onFavoriteToggle?: () => void;
  onShare?: () => void;
  onDownload?: (format: 'mp3' | 'wav') => void;
  onVocalRemoval?: () => void;
  onDelete?: () => void;
  onPricingModalOpen?: () => void;
  onPublishToggle?: (trackId: string, isPublished: boolean) => void;
  onEditTitle?: (trackId: string, newTitle: string) => void;
}

export const TrackActionButtons: React.FC<TrackActionButtonsProps> = ({
  track,
  isMobile = false,
  isFavorited = false,
  isCopied = false,
  isPublished: isPublishedProp,
  canDownloadMP3 = false,
  canDownloadWAV = false,
  onFavoriteToggle,
  onShare,
  onDownload,
  onVocalRemoval,
  onDelete,
  onPricingModalOpen,
  onPublishToggle,
  onEditTitle,
}) => {
  const isInstrumental = track.musicGeneration?.isInstrumental || track.isInstrumental;
  const hasAudioUrl = !!track.audioUrl;
  const isPublished = isPublishedProp ?? track.isPublished ?? false;
  
  // 编辑标题对话框状态
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  
  // 处理编辑标题
  const handleEditTitleClick = () => {
    setEditingTitle(track.title || '');
    setIsEditDialogOpen(true);
  };
  
  // 保存编辑的标题
  const handleSaveTitle = () => {
    if (onEditTitle && editingTitle.trim()) {
      onEditTitle(track.id, editingTitle.trim());
      setIsEditDialogOpen(false);
    }
  };
  
  // 判断是否显示更多菜单（需要至少有一个功能）
  const shouldShowMoreMenu = onVocalRemoval || onDelete || onPublishToggle || onEditTitle;

  // 桌面端按钮
  if (!isMobile) {
    return (
      <div className="hidden md:flex items-center gap-3">
        {/* 收藏按钮 */}
        {onFavoriteToggle && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 hover:bg-muted/50 ${
              isFavorited 
                ? 'text-red-500 hover:text-red-600' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle();
            }}
            aria-label={isFavorited ? "Remove from library" : "Add to library"}
          >
            <Star className={`h-3 w-3 ${isFavorited ? 'fill-current' : ''}`} />
          </Button>
        )}
        
        {/* 分享按钮 */}
        {onShare && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 hover:bg-muted/50 transition-colors ${
              isCopied 
                ? 'text-green-500' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            aria-label="Share track"
          >
            {isCopied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Share2 className="h-3 w-3" />
            )}
          </Button>
        )}
        
        {/* 下载按钮 */}
        {onDownload && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label="Download track"
              >
                <Download className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[160px]">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canDownloadMP3) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onDownload('mp3');
                }}
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
              >
                <span className="font-medium">Download MP3</span>
                {!canDownloadMP3 && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                    Basic
                  </Badge>
                )}
              </DropdownMenuItem>
              {canDownloadWAV !== undefined && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canDownloadWAV) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onDownload('wav');
                  }}
                  className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
                >
                  <span className="font-medium">Download WAV</span>
                  {!canDownloadWAV && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                      Premium
                    </Badge>
                  )}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* 更多按钮 */}
        {shouldShowMoreMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label="More options"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[140px]">
              {/* Publish/Unpublish 选项 */}
              {onPublishToggle && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPublishToggle(track.id, isPublished);
                  }}
                  className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
                >
                  {isPublished ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Unpublish</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Publish</span>
                    </>
                  )}
                </DropdownMenuItem>
              )}
              
              {/* Edit Title 选项 */}
              {onEditTitle && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditTitleClick();
                    }}
                    className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit Title</span>
                  </DropdownMenuItem>
                  {(onVocalRemoval || onDelete) && <DropdownMenuSeparator className="my-1" />}
                </>
              )}
              
              {/* Vocal Remover 选项 */}
              {hasAudioUrl && onVocalRemoval && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isInstrumental) return;
                      onVocalRemoval();
                    }}
                    disabled={isInstrumental}
                    className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent ${
                      isInstrumental ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5" />
                      <span>Vocal Remover</span>
                    </div>
                  </DropdownMenuItem>
                  {onDelete && <DropdownMenuSeparator className="my-1" />}
                </>
              )}
              
              {/* 删除选项 */}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs text-destructive data-[highlighted]:bg-transparent data-[highlighted]:text-destructive focus:text-destructive focus:bg-transparent"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* 编辑标题对话框 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Title</DialogTitle>
              <DialogDescription>
                Enter a new title for your track.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="Track title"
                maxLength={80}
                className="w-full"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveTitle();
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTitle}
                disabled={!editingTitle.trim()}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // 移动端按钮
  return (
    <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
      {/* 收藏按钮 */}
      {onFavoriteToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle();
          }}
          className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors ${
            isFavorited 
              ? 'text-red-500' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={isFavorited ? "Remove from library" : "Add to library"}
        >
          <Star className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
        </button>
      )}
      
      {/* 分享按钮 */}
      {onShare && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className={`h-7 w-7 flex items-center justify-center transition-colors ${
            isCopied
              ? 'text-green-500'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Share track"
        >
          {isCopied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
        </button>
      )}
      
      {/* 下载按钮 */}
      {onDownload && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Download track"
            >
              <Download className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[160px]">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!canDownloadMP3) {
                  onPricingModalOpen?.();
                  return;
                }
                onDownload('mp3');
              }}
              className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
            >
              <span className="font-medium">Download MP3</span>
              {!canDownloadMP3 && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                  Basic
                </Badge>
              )}
            </DropdownMenuItem>
            {canDownloadWAV !== undefined && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canDownloadWAV) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onDownload('wav');
                }}
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
              >
                <span className="font-medium">Download WAV</span>
                {!canDownloadWAV && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                    Premium
                  </Badge>
                )}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      {/* 更多按钮 */}
      {shouldShowMoreMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[140px]">
            {/* Publish/Unpublish 选项 */}
            {onPublishToggle && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPublishToggle(track.id, isPublished);
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
              >
                {isPublished ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Unpublish</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span>Publish</span>
                  </>
                )}
              </DropdownMenuItem>
            )}
            
            {/* Edit Title 选项 */}
            {onEditTitle && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEditTitleClick();
                  }}
                  className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Title</span>
                </DropdownMenuItem>
                {(onVocalRemoval || onDelete) && <DropdownMenuSeparator className="my-1" />}
              </>
            )}
            
            {/* Vocal Remover 选项 */}
            {hasAudioUrl && onVocalRemoval && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isInstrumental) return;
                    onVocalRemoval();
                  }}
                  disabled={isInstrumental}
                  className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent ${
                    isInstrumental ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5" />
                    <span>Vocal Remover</span>
                  </div>
                </DropdownMenuItem>
                {onDelete && <DropdownMenuSeparator className="my-1" />}
              </>
            )}
            
            {/* 删除选项 */}
            {onDelete && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      {/* 编辑标题对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Title</DialogTitle>
            <DialogDescription>
              Enter a new title for your track.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="Track title"
              maxLength={80}
              className="w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveTitle();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTitle}
              disabled={!editingTitle.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

