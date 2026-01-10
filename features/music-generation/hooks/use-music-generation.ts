import { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { MusicModel } from '@/components/ui/model-selection-dialog';

// ============================================================================
// TYPES
// ============================================================================

type GenerationStatus = 'generating' | 'text' | 'first' | 'complete' | 'error';

import { MusicGenerationTrack } from '@/types/track';

const POLLING_CONFIG = {
  INITIAL_DELAY: 30000,       // 首次轮询延迟 30秒
  INTERVAL: 3000,             // 轮询间隔 3秒
  MAX_DURATION: 5 * 60 * 1000, // 最大轮询时长 5分钟
  MAX_RETRIES: 3,             // 网络错误最大重试次数
} as const;

// ============================================================================
// HOOK - 参考 TanStack Query 和 SWR 的轮询模式重构
// ============================================================================

export const useMusicGeneration = () => {
  // ==================== 配置状态 ====================
  const [mode, setMode] = useState<"simple" | "custom">("simple");
  const [simplePrompt, setSimplePrompt] = useState("");
  const [customLyrics, setCustomLyrics] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [styleText, setStyleText] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedVibe, setSelectedVibe] = useState("");
  const [instrumentalMode, setInstrumentalMode] = useState(false);
  const [isPublished] = useState(false);
  const [selectedModel, setSelectedModel] = useState<MusicModel>('V4'); // 默认使用 V4

  // 高级选项
  const [bpm, setBpm] = useState([60]);
  const [grooveType, setGrooveType] = useState("");
  const [leadInstrument, setLeadInstrument] = useState<string[]>([]);
  const [drumKit, setDrumKit] = useState("");
  const [bassTone, setBassTone] = useState("");
  const [vocalStyle, setVocalStyle] = useState("");
  const [vocalGender, setVocalGender] = useState("random");
  const [harmonyPalette, setHarmonyPalette] = useState("");

  // ==================== 生成状态 ====================
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTracks, setGeneratedTracks] = useState<MusicGenerationTrack[]>([]);

  // ==================== 轮询控制 - 使用 Ref 而非状态 ====================
  const pollingStateRef = useRef<{
    isPolling: boolean;
    taskId: string | null;
    startTime: number;
    retryCount: number;
    timeoutId: NodeJS.Timeout | null;
    abortController: AbortController | null;
  }>({
    isPolling: false,
    taskId: null,
    startTime: 0,
    retryCount: 0,
    timeoutId: null,
    abortController: null,
  });

  // ==================== 清理资源 - 彻底清理所有引用 ====================
  const cleanup = useCallback(() => {
    
    const state = pollingStateRef.current;
    
    // 取消所有pending的请求
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
    
    // 清除定时器
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
    
    // 重置状态
    state.isPolling = false;
    state.taskId = null;
    state.retryCount = 0;
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // ==================== 辅助函数 ====================

  const validateInputs = (): boolean => {
    if (mode === "simple" && !simplePrompt?.trim()) {
      toast.error("Please enter a prompt");
      return false;
    }
    // Custom mode: styleText is now optional, no validation needed
    return true;
  };

  const buildRequestData = () => {
    const prompt = mode === "simple" ? simplePrompt : customLyrics;
    const data: Record<string, unknown> = {
      mode,
      customPrompt: prompt,
      instrumentalMode,
      songTitle,
      styleText,
      isPublished,
      model: selectedModel, // 添加模型参数
    };

    if (vocalGender !== 'random') {
      data.vocalGender = vocalGender;
    }

    return data;
  };


  // 转换初始数据库tracks为前端Track格式
  const convertInitialTracks = (initialTracks: any[]): MusicGenerationTrack[] => {
    return initialTracks.map((t: any) => ({
      id: t.id,
      generationId: t.generationId || '',
      sunoTrackId: t.sunoTrackId || t.suno_track_id || null,
      title: t.title || 'Untitled Track',
      audioUrl: t.audioUrl || '',
      streamAudioUrl: t.streamAudioUrl || '',
      duration: t.duration,
      coverImage: t.coverImage,
      tags: t.tags || '',
      genre: t.genre || '',
      prompt: t.prompt || '',
      lyrics: t.lyrics || '',
      generationMode: t.generationMode || t.generation_mode,
      model: t.model || selectedModel,
      createdAt: t.createdAt || new Date().toISOString(),
      isGenerating: true, // 初始状态都在生成中
      isCompleted: false, // 初始状态都未完成
      isPlaceholder: false, // 使用真实ID，不是placeholder
    }));
  };

  const createPlaceholderTracks = (
    generationId: string,
    title: string,
    tags: string,
    prompt: string,
    generationMode: string
  ): MusicGenerationTrack[] => {
    const now = new Date().toISOString();
    return Array.from({ length: 2 }, (_, index) => ({
      id: `${generationId}_placeholder_${index}`,
      generationId,
      sunoTrackId: null,
      title: title || 'Untitled Track',
      audioUrl: '',
      streamAudioUrl: '',
      duration: undefined,
      coverImage: undefined,
      tags,
      genre: '',
      prompt,
      lyrics: '',
      generationMode,
      model: selectedModel,
      createdAt: now,
      isGenerating: true,
      isCompleted: false,
      isPlaceholder: true,
    }));
  };

  // 转换API返回的数据为Track
  const convertToTracks = (
    tracks: any[],
    status: GenerationStatus,
    generationId?: string,
    errorMessage?: string
  ): MusicGenerationTrack[] => {
    return tracks.map((t: any) => {
      const isGenerating = status === 'text' || 
                          status === 'generating' || 
                          (status === 'first' && !t.duration);
      
      return {
        id: t.id,
        generationId: t.generationId || generationId || '',
        sunoTrackId: t.sunoTrackId || t.suno_track_id || null, // 保存 suno_track_id 用于匹配
        title: t.title || 'Untitled Track',
        audioUrl: t.audioUrl || '',
        streamAudioUrl: t.streamAudioUrl || '',
      duration: t.duration,
      coverImage: t.coverImage,
      tags: t.tags || '',
      genre: t.genre,
      prompt: t.prompt || '',
      lyrics: t.lyrics || '',
      generationMode: t.generationMode || t.generation_mode,
        createdAt: t.createdAt || new Date().toISOString(),
        isGenerating: status === 'error' ? false : isGenerating,
        // 仅在 complete 阶段标记为已完成，避免 first 阶段提前进入 userTracks
        isCompleted: status === 'complete',
        isPlaceholder: false,
        isError: status === 'error',
        errorMessage: status === 'error' ? errorMessage : undefined,
      };
    });
  };

  // 智能合并新数据和现有数据（通过ID或sunoTrackId匹配）
  const mergeTracks = (currentTracks: MusicGenerationTrack[], newTracks: MusicGenerationTrack[], status: GenerationStatus): MusicGenerationTrack[] => {
    if (newTracks.length === 0) {
      return currentTracks;
    }

    const result = [...currentTracks];
    let hasChanges = false;
    
    newTracks.forEach((newTrack) => {
      // 按ID或sunoTrackId查找匹配
      const matchedIndex = result.findIndex(
        t => t.id === newTrack.id || (newTrack.sunoTrackId && t.sunoTrackId === newTrack.sunoTrackId)
      );
      
      if (matchedIndex !== -1) {
        // 找到匹配的track，更新它
        const currentTrack = result[matchedIndex];
        
        // 检查是否有实际变化
        const needsUpdate = 
          currentTrack.id !== newTrack.id ||
          currentTrack.generationId !== newTrack.generationId ||
          currentTrack.sunoTrackId !== newTrack.sunoTrackId ||
          currentTrack.title !== newTrack.title ||
          currentTrack.tags !== newTrack.tags ||
          currentTrack.lyrics !== newTrack.lyrics ||
          currentTrack.genre !== newTrack.genre ||
          currentTrack.audioUrl !== newTrack.audioUrl ||
          currentTrack.streamAudioUrl !== newTrack.streamAudioUrl ||
          currentTrack.duration !== newTrack.duration ||
          currentTrack.coverImage !== newTrack.coverImage ||
          currentTrack.isGenerating !== newTrack.isGenerating ||
          currentTrack.isCompleted !== newTrack.isCompleted ||
          currentTrack.isError !== newTrack.isError ||
          currentTrack.errorMessage !== newTrack.errorMessage;
        
        if (needsUpdate) {
          result[matchedIndex] = {
            ...currentTrack,
            ...newTrack,
            model: newTrack.model ?? currentTrack.model
          };
          hasChanges = true;
        }
      } else {
        // 没找到匹配的track，添加新的
        result.push(newTrack);
        hasChanges = true;
      }
    });

    // 如果没有任何变化，返回原数组，防止触发不必要的重新渲染
    return hasChanges ? result : currentTracks;
  };

  // ==================== 轮询逻辑 - 单一递归 setTimeout 模式 ====================
  
  /**
   * 参考 TanStack Query 的实现:
   * - 使用递归 setTimeout 而非 setInterval (更精确的控制)
   * - 使用 AbortController 彻底取消请求
   * - 使用 ref 追踪状态避免闭包问题
   * - 支持重试和超时
   */
  const pollStatus = useCallback(async () => {
    const state = pollingStateRef.current;
    
    // 检查是否应该继续轮询
    if (!state.isPolling || !state.taskId) {
      return;
    }

    // 检查超时
    const elapsed = Date.now() - state.startTime;
    if (elapsed > POLLING_CONFIG.MAX_DURATION) {
      console.error('[Polling] Timeout after', elapsed / 1000, 'seconds');
      cleanup();
      setIsGenerating(false);
      toast.error('Music generation timeout. Please try again.');
      return;
    }

    // 检查网络连接
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      state.timeoutId = setTimeout(pollStatus, 5000);
      return;
    }

    try {
      // 创建新的 AbortController
      state.abortController = new AbortController();
      
      
      
      const res = await fetch(`/api/music-status?taskId=${state.taskId}`, {
        signal: state.abortController.signal,
        cache: 'no-store', // 确保不使用缓存
      });

      // 请求成功后重置重试计数
      state.retryCount = 0;

      if (!res.ok) {
        console.warn('[Polling] HTTP error:', res.status);
        // 继续轮询，不中断
        state.timeoutId = setTimeout(pollStatus, POLLING_CONFIG.INTERVAL);
        return;
      }

      const payload = await res.json();

      // 处理202状态码 - 仍在生成中
      if (payload.code === 202) {
        state.timeoutId = setTimeout(pollStatus, POLLING_CONFIG.INTERVAL);
        return;
      }

      // 处理错误响应
      if (payload.code !== 200) {
        console.error('[Polling] API error:', payload.msg);
        cleanup();
        setIsGenerating(false);
        toast.error(payload.msg || 'Generation failed');
        return;
      }

      const { status, tracks, generationId, errorInfo } = payload.data;
      const errorMessage = errorInfo?.errorMessage;
      
      

      // 更新tracks
      if (tracks && Array.isArray(tracks)) {
        setGeneratedTracks(prev => {
          const newTracks = mergeTracks(
            prev,
            convertToTracks(tracks, status, generationId, errorMessage),
            status
          );
          // 🔒 额外的防御：如果 mergeTracks 返回的是同一个数组引用，说明没有变化，不触发重新渲染
          if (newTracks === prev) {
            return prev;
          }
          return newTracks;
        });
      }

      // 检查是否完成
      if (status === 'complete') {
        cleanup();
        setIsGenerating(false);
        toast.success('Music generated successfully!');
        return;
      }

      if (status === 'error') {
        console.error('[Polling] Generation failed');
        setGeneratedTracks(prev => {
          if (!generationId) return prev;
          return prev.map(track => {
            if (track.generationId !== generationId) return track;
            return {
              ...track,
              isError: true,
              isGenerating: false,
              isCompleted: false,
              errorMessage: errorMessage || track.errorMessage || 'Unknown error'
            };
          });
        });
        cleanup();
        setIsGenerating(false);
        toast.error(errorMessage || 'Music generation failed');
        return;
      }

      // 继续轮询
      state.timeoutId = setTimeout(pollStatus, POLLING_CONFIG.INTERVAL);

    } catch (error: any) {
      // 忽略 abort 错误
      if (error.name === 'AbortError') {
        return;
      }

      console.error('[Polling] Error:', error);

      // 重试逻辑
      state.retryCount++;
      if (state.retryCount >= POLLING_CONFIG.MAX_RETRIES) {
        console.error('[Polling] Max retries reached');
        cleanup();
        setIsGenerating(false);
        toast.error('Network error. Please check your connection.');
        return;
      }

      // 指数退避重试
      const retryDelay = POLLING_CONFIG.INTERVAL * Math.pow(2, state.retryCount - 1);
      state.timeoutId = setTimeout(pollStatus, retryDelay);
    }
  }, [cleanup, setIsGenerating, setGeneratedTracks]);

  // ==================== 开始轮询 ====================
  const startPolling = useCallback((taskId: string) => {
    
    // 清理旧的轮询
    cleanup();

    // 初始化轮询状态
    pollingStateRef.current = {
      isPolling: true,
      taskId,
      startTime: Date.now(),
      retryCount: 0,
      timeoutId: null,
      abortController: null,
    };

    // 延迟后开始首次轮询
    pollingStateRef.current.timeoutId = setTimeout(() => {
      pollStatus();
    }, POLLING_CONFIG.INITIAL_DELAY);
  }, [cleanup, pollStatus]);

  // ==================== 生成歌曲 ====================
  const handleGenerate = async (
    refreshCredits?: () => Promise<void>,
    onApiSuccess?: () => void
  ) => {
    if (!validateInputs()) {
      throw new Error('Input validation failed');
    }

    // 清理之前的轮询
    cleanup();
    
    setIsGenerating(true);

    const trimmedPrompt = mode === 'simple' ? simplePrompt.trim() : customLyrics.trim();
    const trimmedStyle = styleText.trim();
    const trimmedTitle = songTitle.trim();
    const placeholderGenerationId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const placeholderTags = mode === 'custom' ? trimmedStyle : trimmedPrompt;
    const placeholderPrompt = mode === 'custom' ? trimmedStyle : trimmedPrompt;
    const placeholderMode = mode;

    flushSync(() => {
      setGeneratedTracks(prevTracks => {
        const placeholders = createPlaceholderTracks(
          placeholderGenerationId,
          trimmedTitle,
          placeholderTags,
          placeholderPrompt,
          placeholderMode
        );
        return [...placeholders, ...prevTracks];
      });
    });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      const response = await fetch('/api/music/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(buildRequestData()),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Music generation failed');
      }

      const result = await response.json();

      if (result.success && result.data?.taskId) {
        // ✅ 使用后端返回的initialTracks
        if (result.data?.initialTracks && result.data.initialTracks.length > 0) {
          setGeneratedTracks(prevTracks => {
            const newTracks = convertInitialTracks(result.data.initialTracks);
            const withoutPlaceholders = prevTracks.filter(
              track => !(track.isPlaceholder && track.generationId === placeholderGenerationId)
            );
            return [...newTracks, ...withoutPlaceholders];
          });
        }

        if (onApiSuccess) onApiSuccess();
        if (refreshCredits) await refreshCredits();

        // 开始轮询
        startPolling(result.data.taskId);
      } else {
        throw new Error('No taskId returned from API');
      }
    } catch (error) {
      console.error('[Music Generation] Error:', error);
      cleanup();
      setIsGenerating(false);
      setGeneratedTracks(prevTracks =>
        prevTracks.filter(track => !(track.isPlaceholder && track.generationId === placeholderGenerationId))
      );
      toast.error(error instanceof Error ? error.message : 'Music generation failed');
      throw error;
    }
  };

  // 更新tracks（用于删除操作）
  // 支持函数式更新，避免闭包陷阱
  const updateTracks = (newTracksOrUpdater: MusicGenerationTrack[] | ((prev: MusicGenerationTrack[]) => MusicGenerationTrack[])) => {
    setGeneratedTracks(newTracksOrUpdater);
  };

  const trackExistingTask = useCallback((taskId: string, initialTracks?: any[]) => {
    if (!taskId) return;
    cleanup();
    setIsGenerating(true);

    // 如果有初始占位 tracks，立即显示
    if (initialTracks && Array.isArray(initialTracks) && initialTracks.length > 0) {
      setGeneratedTracks(prevTracks => {
        const newTracks = convertInitialTracks(initialTracks);
        // 保留已完成的歌曲，将新的tracks添加到顶部（与 handleGenerate 逻辑一致）
        const completedTracks = prevTracks.filter(track => track.isCompleted && !newTracks.find(nt => nt.id === track.id));
        return [...newTracks, ...completedTracks];
      });
    }

    startPolling(taskId);
  }, [cleanup, startPolling]);

  return {
    // 配置
    mode, setMode,
    simplePrompt, setSimplePrompt,
    customLyrics, setCustomLyrics,
    songTitle, setSongTitle,
    styleText, setStyleText,
    selectedGenre, setSelectedGenre,
    selectedVibe, setSelectedVibe,
    instrumentalMode, setInstrumentalMode,
    isPublished,
    bpm, setBpm,
    grooveType, setGrooveType,
    leadInstrument, setLeadInstrument,
    drumKit, setDrumKit,
    bassTone, setBassTone,
    vocalStyle, setVocalStyle,
    vocalGender, setVocalGender,
    harmonyPalette, setHarmonyPalette,
    selectedModel, setSelectedModel, // 添加模型状态

    // 状态
    isGenerating,
    generatedTracks,
    state: isGenerating ? 'generating' : 'idle',

    // 方法
    handleGenerate,
    trackExistingTask,
    updateTracks,
  };
};
