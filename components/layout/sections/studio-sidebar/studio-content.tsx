import React from "react";
import { Music, Download, Trash2, Play, Pause } from "lucide-react";
import Image from "next/image";
import { Skeleton } from '@/components/ui/skeleton';

interface StudioContentProps {
  // Generated tracks
  allGeneratedTracks: any[];
  selectedLibraryTrack: string | null;
  setSelectedLibraryTrack: (id: string | null) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onDownload: (track: any) => void;
  onDelete: (track: any) => void;

  // Generation
  isGenerating: boolean;
  pendingTasksCount: number;
}

export const StudioContent = (props: StudioContentProps) => {
  const {
    allGeneratedTracks, selectedLibraryTrack, setSelectedLibraryTrack,
    isPlaying, onPlayPause, onDownload, onDelete, isGenerating, pendingTasksCount
  } = props;

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 relative" data-studio-panel={true}>
      <div className="space-y-3 pt-4">
        {/* Generated Tracks */}
        {allGeneratedTracks.length > 0 && (
          <div className="space-y-3">
            {allGeneratedTracks.map((track, index) => (
              <div
                key={`generated-${index}`}
                onClick={track.isLoading ? undefined : () => setSelectedLibraryTrack(`generated-${index}`)}
                className={`flex items-center gap-4 p-4 transition-all duration-300 group relative bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-3xl border border-border/30 shadow-lg ${track.isLoading
                    ? 'cursor-default'
                    : `cursor-pointer hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl ${selectedLibraryTrack === `generated-${index}`
                        ? 'shadow-xl'
                        : 'hover:shadow-2xl'
                      }`
                  }`}
              >
                {/* Loading overlay - 根据生成状态显示不同的圆点数量 */}
                {track.isLoading && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-3xl pointer-events-none z-10">
                    <div className="flex items-center gap-2">
                      {/* 第一个圆点 - 总是显示 */}
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                      {/* 第二个圆点 - 在first回调后隐藏 */}
                      {(!track.audioUrl || !track.duration) && (
                        <div className="w-3 h-3 bg-white/70 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                      )}
                      {/* 第三个圆点 - 在first回调后隐藏 */}
                      {(!track.audioUrl || !track.duration) && (
                        <div className="w-3 h-3 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Selection overlay */}
                {selectedLibraryTrack === `generated-${index}` && !track.isLoading && (
                  <div className="absolute inset-0 bg-primary/10 rounded-3xl pointer-events-none z-5"></div>
                )}

                <div className={`w-16 h-16 rounded-md overflow-hidden flex-shrink-0 relative transition-transform duration-300 ${!track.isLoading ? 'group-hover:scale-105' : ''}`}>
                  {track.coverImage ? (
                    <Image
                      src={track.coverImage}
                      alt={track.title}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover transition-all duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center transition-all duration-300">
                      <Music className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  
                  {/* Cover interaction layer */}
                  {!track.isLoading && (
                    <div className="absolute inset-0">
                      {/* Playing wave effect */}
                      {selectedLibraryTrack === `generated-${index}` && isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:opacity-0 transition-opacity duration-300">
                          <div className="flex items-end gap-0.5">
                            <div className="w-0.5 h-2 bg-white animate-pulse" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-0.5 h-3 bg-white animate-pulse" style={{ animationDelay: '100ms' }}></div>
                            <div className="w-0.5 h-1.5 bg-white animate-pulse" style={{ animationDelay: '200ms' }}></div>
                            <div className="w-0.5 h-4 bg-white animate-pulse" style={{ animationDelay: '300ms' }}></div>
                            <div className="w-0.5 h-2.5 bg-white animate-pulse" style={{ animationDelay: '400ms' }}></div>
                            <div className="w-0.5 h-3.5 bg-white animate-pulse" style={{ animationDelay: '500ms' }}></div>
                            <div className="w-0.5 h-1 bg-white animate-pulse" style={{ animationDelay: '600ms' }}></div>
                            <div className="w-0.5 h-2 bg-white animate-pulse" style={{ animationDelay: '700ms' }}></div>
                          </div>
                        </div>
                      )}

                      {/* Hover play button */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {selectedLibraryTrack === `generated-${index}` && isPlaying ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlayPause();
                            }}
                            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all duration-200 hover:scale-110"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLibraryTrack(`generated-${index}`);
                              onPlayPause();
                            }}
                            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all duration-200 hover:scale-110"
                          >
                            <Play className="w-4 h-4 ml-0.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 w-0">
                  <div className={`font-medium text-base transition-colors flex items-center gap-2 ${selectedLibraryTrack === `generated-${index}`
                      ? 'text-primary'
                      : 'text-foreground group-hover:text-primary'
                    }`}>
                    <span className="flex-1 truncate">{track.title}</span>
                    {track.isLoading && (
                      <span className="text-xs text-muted-foreground">
                        Generating...
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed w-full" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word'
                  }}>
                    {track.prompt}
                  </div>
                  {!track.isLoading && (
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownload(track);
                          }}
                          className="p-1 rounded hover:bg-muted/50 transition-colors duration-200 group/btn"
                          title="Download"
                        >
                          <Download className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors duration-200" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(track);
                          }}
                          className="p-1 rounded hover:bg-muted/50 transition-colors duration-200 group/btn"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive transition-colors duration-200" />
                        </button>
                      </div>
                      <span className="inline-flex items-center justify-center w-4 h-4 text-xs text-muted-foreground rounded border border-border shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-200">
                        {track.duration ?
                          `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` :
                          '--:--'
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skeleton Loading State - 在生成过程中显示 */}
        {pendingTasksCount > 0 && (
          <div className="space-y-3">
            {Array.from({ length: pendingTasksCount }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-3xl backdrop-blur-md border border-border/30 shadow-lg">
                <Skeleton className="w-16 h-16 rounded-md flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <Skeleton className="h-3 w-2/3" />
                  {/* 操作按钮骨架 */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded" />
                      <Skeleton className="h-6 w-6 rounded" />
                    </div>
                    {/* Duration skeleton */}
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
