/**
 * Track Generation Monitor Hook
 * 监听音乐生成过程的各个阶段（text, cover, complete）
 * 提供幂等性保护，避免重复处理相同的回调
 */
import { useEffect, useRef, useCallback } from 'react';
import { StudioTrack } from '@/types/track';
import { getEventBus, COVER_EVENTS, TRACK_EVENTS } from '@/lib/event-bus';

interface AudioPlayer {
  currentTrack: StudioTrack | null;
  playTrack: (track: any) => Promise<void>;
  updateCurrentTrackDuration: (duration: number) => void;
}

interface UseTrackGenerationMonitorProps {
  generatedTracks: any[];
  player: AudioPlayer;
  onTrackUpdate: (updater: (prev: StudioTrack | null) => StudioTrack | null) => void;
  onAllTracksCompleted?: () => void; // 新增：所有歌曲完成时的回调
  onTrackCompleted?: (track: StudioTrack) => void; // 新增：单个歌曲完成时的回调
}

/**
 * 监听生成中的歌曲状态变化
 * 处理三个主要阶段：
 * 1. Text 回调 - 初始化歌曲信息（title, tags, lyrics, streamAudioUrl）
 * 2. Cover 回调 - 更新封面图
 * 3. Complete 回调 - 更新最终音频URL和duration
 */
export const useTrackGenerationMonitor = ({
  generatedTracks,
  player,
  onTrackUpdate,
  onAllTracksCompleted,
  onTrackCompleted,
}: UseTrackGenerationMonitorProps) => {
  // 使用 ref 记录每首歌曲已处理的阶段，防止重复处理
  const processedTracksRef = useRef<Map<string, {
    textProcessed?: boolean;
    coverProcessed?: boolean;
    completeProcessed?: boolean;
  }>>(new Map());

  // 使用 ref 记录是否已经触发过刷新，防止重复刷新
  const refreshTriggeredRef = useRef<Set<string>>(new Set());

  // 1. 监听 text 回调完成，初始化 selectedStudioTrack
  useEffect(() => {
    if (generatedTracks.length === 0) return;

    

    // 遍历所有生成中的歌曲，为每首歌独立处理
    generatedTracks.forEach((song) => {
      // 跳过占位数据
      if (song.isPlaceholder) return;

      // 🔧 优化：检查 text 回调是否完整，并且有封面图才显示
      // 确保所有文本数据都已存在，并且有封面图
      const isTextCallbackComplete = !!song.streamAudioUrl &&
                                     song.streamAudioUrl.trim() !== '' &&
                                     !!song.title &&
                                     song.title.trim() !== '' &&
                                     !!song.coverImage; // 🔧 关键：必须有封面图才显示

      if (!isTextCallbackComplete) {
        return;
      }

      // 🔧 增强的幂等性保护：检查该歌曲是否已处理过 text 回调
      const processed = processedTracksRef.current.get(song.id);
      if (processed?.textProcessed) {
        return;
      }

      // 标记该歌曲的 text 回调已处理
      processedTracksRef.current.set(song.id, {
        ...processed,
        textProcessed: true
      });

      

      // 构造 track 对象
      const generatedTrack = {
        id: song.id,
        generationId: song.generationId,
        title: song.title,
        audioUrl: song.audioUrl || song.streamAudioUrl,
        streamAudioUrl: song.streamAudioUrl,
        duration: song.duration,
        coverImage: song.coverImage,
        tags: song.tags,
        lyrics: song.lyrics,
        isGenerating: false, // 🔧 有封面图说明已经完成text回调
        isCompleted: song.isCompleted
      };

      // 更新 selectedStudioTrack - 简化逻辑
      onTrackUpdate(prev => {
        
        // 1. 如果没有选中任何歌曲，选中当前完成的歌曲
        if (!prev) {
          return generatedTrack as StudioTrack;
        }
        
        // 2. 如果选中的是当前歌曲，更新数据
        if (prev.id === song.id) {
          return generatedTrack as StudioTrack;
        }
        
        // 3. 如果当前选中的是占位符或正在生成，替换为真实数据
        if (prev.isPlaceholder || prev.isGenerating) {
          return generatedTrack as StudioTrack;
        }
        
        // 4. 其他情况：保持之前的选择，不切换
        return prev;
      });
    });
  }, [generatedTracks, onTrackUpdate]);

  // 2. 监听封面图生成完成，更新封面
  useEffect(() => {
    if (generatedTracks.length === 0) return;

    

    // 遍历所有生成中的歌曲，为每首歌独立处理封面回调
    generatedTracks.forEach((song) => {
      // 跳过占位数据
      if (song.isPlaceholder) return;
      if (!song.coverImage) return;

      // 🔧 增强的幂等性保护：检查该歌曲是否已处理过封面回调
      const processed = processedTracksRef.current.get(song.id);
      if (processed?.coverProcessed) {
        return;
      }

      // 标记该歌曲的封面回调已处理
      processedTracksRef.current.set(song.id, {
        ...processed,
        coverProcessed: true
      });

      

      // 如果这首歌正在被选中显示，则更新 selectedStudioTrack 的封面
      onTrackUpdate(prev => {
        if (!prev || prev.id !== song.id) return prev;

        // 🔧 关键修改：完全替换数据，确保与 generatedTracks 完全同步
        return {
          ...prev,
          coverImage: song.coverImage,
          isGenerating: false,
          // 确保使用最新的所有数据
          title: song.title || prev.title,
          tags: song.tags || prev.tags,
          lyrics: song.lyrics || prev.lyrics,
          audioUrl: song.audioUrl || song.streamAudioUrl || prev.audioUrl,
          streamAudioUrl: song.streamAudioUrl || prev.streamAudioUrl
        } as StudioTrack;
      });

      // 🎯 通过 EventBus 发送封面更新事件
      if (typeof window !== 'undefined') {
        const eventBus = getEventBus();
        eventBus.emit(COVER_EVENTS.UPDATED, {
          trackId: song.id,
          coverUrl: song.coverImage
        });
      }
    });
  }, [generatedTracks, onTrackUpdate]);

  // 3. 监听 complete 回调完成，更新 duration 和 isCompleted
  useEffect(() => {
    if (generatedTracks.length === 0) return;

    let hasNewCompletedTrack = false;

    // 遍历所有生成中的歌曲，为每首歌独立处理 complete 回调
    generatedTracks.forEach((song) => {
      // 跳过占位数据
      if (song.isPlaceholder) return;

      const isCompleteCallbackComplete = !!song.audioUrl &&
                                         !!song.duration &&
                                         song.duration > 0 &&
                                         !song.isGenerating;

      if (!isCompleteCallbackComplete) return;

      // 🔧 增强的幂等性保护：检查该歌曲是否已处理过 complete 回调
      const processed = processedTracksRef.current.get(song.id);
      if (processed?.completeProcessed) {
        return;
      }

      // 标记该歌曲的 complete 回调已处理
      processedTracksRef.current.set(song.id, {
        ...processed,
        completeProcessed: true
      });

      hasNewCompletedTrack = true;
      

      // 如果这首歌正在被选中显示，则更新 selectedStudioTrack
      onTrackUpdate(prev => {
        if (!prev || prev.id !== song.id) return prev;

        // 🔧 关键修改：完全替换数据，确保与 generatedTracks 完全同步
        return {
          ...prev,
          duration: song.duration,
          isCompleted: true,
          audioUrl: song.audioUrl || song.streamAudioUrl || prev.audioUrl,
          streamAudioUrl: song.streamAudioUrl || prev.streamAudioUrl,
          coverImage: song.coverImage || prev.coverImage,
          isGenerating: false,
          // 确保使用最新的所有数据
          title: song.title || prev.title,
          tags: song.tags || prev.tags,
          lyrics: song.lyrics || prev.lyrics
        } as StudioTrack;
      });

      // 如果这首歌正在播放，则更新播放器的 duration
      if (player.currentTrack?.id === song.id) {
        if (song.duration && typeof song.duration === 'number') {
          player.updateCurrentTrackDuration(song.duration);
        }
      }

      // 🆕 触发单个歌曲完成的回调
      if (onTrackCompleted) {
        onTrackCompleted(song as StudioTrack);
      }

      // 🎯 通过 EventBus 发送歌曲完成事件
      if (typeof window !== 'undefined') {
        const eventBus = getEventBus();
        eventBus.emit(TRACK_EVENTS.COMPLETED, {
          trackId: song.id,
          duration: song.duration,
          audioUrl: song.audioUrl || song.streamAudioUrl
        });
      }
    });

    // 🔧 新增：检测所有歌曲是否都已完成
    if (hasNewCompletedTrack && onAllTracksCompleted) {
      const nonPlaceholderTracks = generatedTracks.filter(track => !track.isPlaceholder);
      const allTracksCompleted = nonPlaceholderTracks.length > 0 && 
                                nonPlaceholderTracks.every(track => 
                                  !!track.audioUrl && 
                                  !!track.duration && 
                                  track.duration > 0 && 
                                  !track.isGenerating
                                );

      if (allTracksCompleted) {
        // 生成一个唯一的key来标识这次生成
        const generationKey = nonPlaceholderTracks.map(t => t.generationId).sort().join('-');
        
        // 🔧 增强的防重复机制：使用更严格的检查
        if (!refreshTriggeredRef.current.has(generationKey)) {
          refreshTriggeredRef.current.add(generationKey);
          
          // 🔧 延迟执行，确保所有状态更新完成
          setTimeout(() => {
            onAllTracksCompleted();
          }, 500);
        }
      }
    }
  }, [generatedTracks, player, onTrackUpdate, onAllTracksCompleted, onTrackCompleted]);

  // 清理函数
  const cleanup = useCallback(() => {
    processedTracksRef.current.clear();
    refreshTriggeredRef.current.clear();
  }, []);

  return {
    cleanup,
    processedTracksRef
  };
};
