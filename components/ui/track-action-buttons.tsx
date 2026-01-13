"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
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
import { FileAudio, Image as ImageIcon, Music2, Star, Share2, Check, Download, MoreVertical, Mic, Trash2, Pencil, Maximize2, Scissors } from "lucide-react";
import { LibraryTrack } from '@/types/track';
import { EditMusicInfoDialog } from './edit-music-info-dialog';

interface TrackActionButtonsProps {
  track: LibraryTrack & any;
  isMobile?: boolean;
  
  // 状态
  isFavorited?: boolean;
  isCopied?: boolean;
  
  // 权限
  canDownloadMP3?: boolean;
  canDownloadWAV?: boolean;
  canDownloadCover?: boolean;
  canVocalRemoval?: boolean;
  canExtendMusic?: boolean;
  canReplaceSection?: boolean;

  // 回调函数
  onFavoriteToggle?: () => void;
  onShare?: () => void;
  onDownload?: (format: 'mp3' | 'wav' | 'cover') => void;
  onVocalRemoval?: () => void;
  onExtendMusic?: () => void;
  onReplaceSection?: () => void;
  onDelete?: () => void;
  onPricingModalOpen?: () => void;
  onEditTitle?: (trackId: string, newTitle: string) => void;
  onEditMusicInfo?: (trackId: string, data: { title: string; coverImageUrl?: string }) => Promise<void>;
}

export const TrackActionButtons: React.FC<TrackActionButtonsProps> = ({
  track,
  isMobile = false,
  isFavorited = false,
  isCopied = false,
  canDownloadMP3 = false,
  canDownloadWAV = false,
  canDownloadCover = false,
  canVocalRemoval = false,
  canExtendMusic = false,
  canReplaceSection = false,
  onFavoriteToggle,
  onShare,
  onDownload,
  onVocalRemoval,
  onExtendMusic,
  onReplaceSection,
  onDelete,
  onPricingModalOpen,
  onEditTitle,
  onEditMusicInfo,
}) => {
  const isInstrumental = track.musicGeneration?.isInstrumental || track.isInstrumental;
  const hasAudioUrl = !!track.audioUrl;
  const hasCoverImage = Boolean(
    track.coverR2Url ||
    track.coverImage ||
    track.coverImageUrl ||
    track.musicGeneration?.coverImage ||
    track.musicGeneration?.coverImageUrl
  );
  
  // 编辑音乐信息对话框状态
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // 处理编辑音乐信息
  const handleEditMusicInfoClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsEditDialogOpen(true);
  };
  
  // 保存编辑的音乐信息
  const handleSaveMusicInfo = async (data: { title: string; coverImageUrl?: string }) => {
    if (onEditMusicInfo) {
      await onEditMusicInfo(track.id, data);
      setIsEditDialogOpen(false);
    } else if (onEditTitle && data.title) {
      // Fallback to old onEditTitle if onEditMusicInfo is not provided
      onEditTitle(track.id, data.title);
      setIsEditDialogOpen(false);
    }
  };

  // 处理对话框关闭，确保不会触发其他事件
  const handleDialogClose = () => {
    setIsEditDialogOpen(false);
  };
  
  // 判断是否显示更多菜单（需要至少有一个功能）
  const shouldShowMoreMenu = onVocalRemoval || onExtendMusic || onDelete || onEditTitle || onEditMusicInfo;

  // 桌面端按钮
  if (!isMobile) {
    return (
      <div className="hidden md:flex items-center gap-3">
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
                title="Download track"
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
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Music2 className="h-3.5 w-3.5" />
                  MP3 (Song)
                </span>
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
                  className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <FileAudio className="h-3.5 w-3.5" />
                    WAV (High Quality Song)
                  </span>
                </DropdownMenuItem>
              )}
              {hasCoverImage && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canDownloadCover) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onDownload('cover');
                  }}
                  className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <ImageIcon className="h-3.5 w-3.5" />
                    PNG (Cover Art)
                  </span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* 收藏按钮 */}
        {onFavoriteToggle && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 hover:bg-muted/50 transition-colors ${
              isFavorited 
                ? 'text-red-500' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={isFavorited ? 'Remove from library' : 'Add to library'}
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle();
            }}
            aria-label={isFavorited ? 'Remove from library' : 'Add to library'}
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
            title={isCopied ? 'Link copied' : 'Share track'}
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
                title="More options"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-2 w-64">
              {/* Edit Music Info 选项 */}
              {(onEditMusicInfo || onEditTitle) && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditMusicInfoClick();
                    }}
                    className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit Music Info</span>
                  </DropdownMenuItem>
                </>
              )}

              {/* Premium Features 标题和选项 */}
              {hasAudioUrl && (onVocalRemoval || onExtendMusic || onReplaceSection) && (
                <>
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase">
                    Advanced Features
                  </div>
                  {onVocalRemoval && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isInstrumental) return;
                        if (!canVocalRemoval) {
                          onPricingModalOpen?.();
                          return;
                        }
                        onVocalRemoval();
                    }}
                    disabled={isInstrumental}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
                      isInstrumental ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5" />
                        <span>Vocal Separation</span>
                      </div>
                    </DropdownMenuItem>
                  )}
                  {onExtendMusic && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!canExtendMusic) {
                          onPricingModalOpen?.();
                          return;
                        }
                        onExtendMusic();
                      }}
                      className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Extend Music</span>
                    </DropdownMenuItem>
                  )}
                  {onReplaceSection && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!canReplaceSection) {
                          onPricingModalOpen?.();
                          return;
                        }
                        onReplaceSection();
                      }}
                      className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      <span>Replace Section</span>
                    </DropdownMenuItem>
                  )}
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
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {/* 编辑音乐信息对话框 */}
        {(onEditMusicInfo || onEditTitle) && (
          <EditMusicInfoDialog
            isOpen={isEditDialogOpen}
            onClose={handleDialogClose}
            onSave={handleSaveMusicInfo}
            initialTitle={track.title || ''}
            initialCoverImage={track.coverImage || track.coverR2Url}
          />
        )}
      </div>
    );
  }

  // 移动端按钮
  return (
    <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
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
              className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2 font-medium">
                <Music2 className="h-3.5 w-3.5" />
                MP3 (Song)
              </span>
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
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileAudio className="h-3.5 w-3.5" />
                  WAV (High Quality Song)
                </span>
              </DropdownMenuItem>
            )}
            {hasCoverImage && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canDownloadCover) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onDownload('cover');
                }}
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2 font-medium">
                  <ImageIcon className="h-3.5 w-3.5" />
                  PNG (Cover Art)
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* 收藏按钮 */}
      {onFavoriteToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle();
          }}
          className={`h-7 w-7 flex items-center justify-center transition-colors ${
            isFavorited
              ? 'text-red-500'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={isFavorited ? 'Remove from library' : 'Add to library'}
          title={isFavorited ? 'Remove from library' : 'Add to library'}
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
            {/* Edit Music Info 选项 */}
            {(onEditMusicInfo || onEditTitle) && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEditMusicInfoClick();
                  }}
                  className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Music Info</span>
                </DropdownMenuItem>
              </>
            )}

            {(onEditMusicInfo || onEditTitle) && (onVocalRemoval || onExtendMusic || onReplaceSection || onDelete) && (
              <DropdownMenuSeparator className="my-1" />
            )}
            
            {/* Premium Features 标题和选项 */}
            {hasAudioUrl && (onVocalRemoval || onExtendMusic) && (
              <>
                <div className="px-2.5 py-1 text-[10px] text-muted-foreground uppercase">
                  Premium Features
                </div>
                {(onVocalRemoval) && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isInstrumental) return;
                      if (!canVocalRemoval) {
                        onPricingModalOpen?.();
                        return;
                      }
                      onVocalRemoval();
                    }}
                    disabled={isInstrumental}
                    className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs ${
                      isInstrumental ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5" />
                      <span>Vocal Separation</span>
                    </div>
                  </DropdownMenuItem>
                )}
                {onExtendMusic && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!canExtendMusic) {
                        onPricingModalOpen?.();
                        return;
                        }
                        onExtendMusic();
                      }}
                    className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Extend Music</span>
                  </DropdownMenuItem>
                )}
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
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      {/* 编辑音乐信息对话框 */}
      {(onEditMusicInfo || onEditTitle) && (
        <EditMusicInfoDialog
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSave={handleSaveMusicInfo}
          initialTitle={track.title || ''}
          initialCoverImage={track.coverImage || track.coverR2Url}
        />
      )}
    </div>
  );
};
