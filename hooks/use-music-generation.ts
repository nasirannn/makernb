import { useState, useEffect, useRef } from "react";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type GenerationStatus = 'generating' | 'text' | 'first' | 'complete' | 'error';

interface TrackData {
  id?: string;
  title: string;
  audioUrl?: string;
  streamAudioUrl?: string;
  finalAudioUrl?: string;
  coverImage?: string;
  duration?: number;
  genre?: string;
  style?: string;
  tags?: string;
  lyrics?: string;
  sideLetter?: string;
  isLoading?: boolean;
  isGenerating?: boolean;
  isStreaming?: boolean;
  isUsingStreamAudio?: boolean;
  isError?: boolean;
  errorMessage?: string;
  originalPrompt?: string;
  vibe?: string;
  generationId?: string;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export const useMusicGeneration = () => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Music Configuration States
  const [mode, setMode] = useState<"basic" | "custom">("basic");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedVibe, setSelectedVibe] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [instrumentalMode, setInstrumentalMode] = useState(false);
  const [keepPrivate, setKeepPrivate] = useState(false);

  // Advanced Music Options
  const [bpm, setBpm] = useState([60]);
  const [grooveType, setGrooveType] = useState("");
  const [leadInstrument, setLeadInstrument] = useState<string[]>([]);
  const [drumKit, setDrumKit] = useState("");
  const [bassTone, setBassTone] = useState("");
  const [vocalStyle, setVocalStyle] = useState("");
  const [vocalGender, setVocalGender] = useState("male");
  const [harmonyPalette, setHarmonyPalette] = useState("");

  // Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [allGeneratedTracks, setAllGeneratedTracks] = useState<TrackData[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [generationTimer, setGenerationTimer] = useState(0);

  // ============================================================================
  // REFS AND TIMERS
  // ============================================================================

  const generationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingDelayRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoplayedRef = useRef(false);
  const currentPollingMsRef = useRef<number>(1000);
  const hasAutoPlayedRef = useRef<boolean>(false);

  // Expose hasAutoPlayedRef to global scope for other components
  if (typeof window !== 'undefined') {
    (window as any).hasAutoPlayedRef = hasAutoPlayedRef;
  }


  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Cleans up all timers and polling intervals
   */
  const cleanupResources = () => {
    if (generationTimerRef.current) {
      clearInterval(generationTimerRef.current);
      generationTimerRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollingDelayRef.current) {
      clearTimeout(pollingDelayRef.current);
      pollingDelayRef.current = null;
    }
  };

  /**
   * Validates form inputs based on the current mode
   */
  const validateInputs = (): boolean => {
    if (mode === "basic") {
      if (!customPrompt?.trim()) {
        toast.error("Please enter a prompt");
        return false;
      }
    } else {
      if (!selectedGenre || !selectedVibe) {
        toast.error("Please select genre and vibe");
        return false;
      }
    }
    return true;
  };

  /**
   * Builds request data for music generation API
   */
  const buildRequestData = () => {
    return {
      mode,
      customPrompt,
      instrumentalMode,
      ...(mode === 'custom' && { genre: selectedGenre }),
      ...(mode === 'custom' && { vibe: selectedVibe }),
      songTitle,
      grooveType,
      leadInstrument,
      drumKit,
      bassTone,
      vocalStyle,
      vocalGender,
      harmonyPalette,
      bpm: bpm[0]
    };
  };

  /**
   * Creates a failed track object for error display
   */
  const createFailedTrack = (errorMessage: string): TrackData => {
    return {
      id: `failed-${Date.now()}`,
      title: customPrompt || 'Unknown',
      audioUrl: undefined,
      coverImage: undefined,
      duration: 0,
      isLoading: false,
      isError: true,
      errorMessage,
      originalPrompt: customPrompt,
      genre: mode === 'basic' ? 'R&B' : selectedGenre,
      tags: mode === 'basic' ? 'R&B' : `${selectedGenre}, ${selectedVibe}`,
      lyrics: ''
    };
  };


  /**
   * Processes raw track data from API response
   */
  const processTracksData = (tracks: any[], status: GenerationStatus, generationId?: string): TrackData[] => {
    return tracks.map((t: any, index: number) => {
      const audioUrl = t.audioUrl || '';
      const streamAudioUrl = t.streamAudioUrl || '';
      const hasFinalForThisTrack = !!audioUrl && !!t.duration && t.duration > 0;
      const hasStreamAudio = !!streamAudioUrl;

      // 根据状态和音频可用性确定加载状态
      let isLoading = false;
      let isGenerating = false;
      let isStreaming = false;
      let currentAudioUrl = '';
      let currentDuration = undefined;

      if (status === 'text') {
        // text 回调：显示播放器，使用 stream audio，duration 显示 --:--
        isLoading = true; // 显示loading指示器
        isGenerating = true; // 仍在生成中
        isStreaming = hasStreamAudio;
        currentAudioUrl = streamAudioUrl;
        currentDuration = undefined; // 不显示具体时长，前端会显示 --:--
      } else if (status === 'first') {
        // first 回调：第一首歌有最终音频，其他仍使用 stream audio
        if (index === 0 && hasFinalForThisTrack) {
          isLoading = false;
          isGenerating = false;
          isStreaming = false;
          currentAudioUrl = audioUrl;
          currentDuration = t.duration;
        } else {
          isLoading = true;
          isGenerating = true;
          isStreaming = hasStreamAudio;
          currentAudioUrl = streamAudioUrl;
          currentDuration = undefined; // 其他歌曲在 first 回调时也显示 --:--
        }
      } else if (status === 'complete') {
        // complete 回调：所有歌曲都有最终音频
        isLoading = false;
        isGenerating = false;
        isStreaming = false;
        currentAudioUrl = audioUrl;
        currentDuration = t.duration;
      } else {
        // generating 状态：显示骨架屏
        isLoading = true;
        isGenerating = true;
        isStreaming = false;
        currentAudioUrl = '';
        currentDuration = undefined;
      }

      return {
        id: t.id,
        generationId: generationId || t.generationId,
        finalAudioUrl: audioUrl,
        streamAudioUrl: streamAudioUrl,
        audioUrl: currentAudioUrl,
        isUsingStreamAudio: !hasFinalForThisTrack && hasStreamAudio,
        title: t.title,
        duration: currentDuration,
        genre: t.genre,
        vibe: mode === 'basic' ? 'polished' : selectedVibe,
        coverImage: t.coverImage || undefined, // 没有封面时显示磁带
        sideLetter: t.sideLetter || (index === 0 ? 'A' : 'B'),
        tags: t.tags,
        lyrics: t.lyrics || '',
        isStreaming: isStreaming,
        isGenerating: isGenerating,
        isLoading: isLoading,
      };
    });
  };

  /**
   * Cleanup resources on component unmount
   */
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  // ============================================================================
  // POLLING LOGIC
  // ============================================================================

  /**
   * Handles API error responses during polling
   */
  const handlePollingError = (payload: any) => {
    console.error('Stopping polling due to API error');

    // Stop all timers
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (generationTimerRef.current) {
      clearInterval(generationTimerRef.current);
      generationTimerRef.current = null;
    }

    // Update states
    setIsGenerating(false);
    setPendingTasksCount(0);

    // Add failed track to display (only one error track)
    const failedTrack = createFailedTrack(payload.msg || 'System error occurred');
    setAllGeneratedTracks([failedTrack]); // 直接设置，不追加
  };

  /**
   * Updates tracks display and handles autoplay logic
   */
  const updateTracksDisplay = (tracksInfo: TrackData[], setIsPlaying?: (playing: boolean) => void) => {
    setAllGeneratedTracks(tracksInfo);
    setPendingTasksCount(0);

    // Handle autoplay logic - 在 text 回调后就开始自动播放 stream audio
    if (!hasAutoPlayedRef.current && tracksInfo.length > 0) {
      const firstTrack = tracksInfo[0];
      // 只要有音频 URL（包括 stream audio）就自动播放
      if (firstTrack.audioUrl && firstTrack.audioUrl.trim() !== '') {
        hasAutoPlayedRef.current = true;
        hasAutoplayedRef.current = true; // 同步两个 ref

        setTimeout(() => {
          if (setIsPlaying) {
            setIsPlaying(true);
          }
        }, 500);
      }
    }
  };

  /**
   * Handles status-specific track updates
   */
  const handleStatusUpdates = (status: GenerationStatus, tracks: any[]) => {
    if (status === 'first') {
      setAllGeneratedTracks(prev => prev.map((t, idx) => {
        const correspondingTrack = tracks[idx];
        if (correspondingTrack && correspondingTrack.audioUrl && correspondingTrack.duration) {
          return {
            ...t,
            isLoading: false,
            isGenerating: false,
            finalAudioUrl: correspondingTrack.audioUrl,
            audioUrl: correspondingTrack.audioUrl,
            duration: correspondingTrack.duration,
            isUsingStreamAudio: false
          };
        }
        return t;
      }));
    }

    if (status === 'complete') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
        generationTimerRef.current = null;
      }
      setIsGenerating(false);

      setAllGeneratedTracks(prev => prev.map((t, idx) => {
        const correspondingTrack = tracks[idx];
        if (correspondingTrack && correspondingTrack.audioUrl && correspondingTrack.duration) {
          return {
            ...t,
            isLoading: false,
            isStreaming: false,
            isGenerating: false,
            finalAudioUrl: correspondingTrack.audioUrl,
            audioUrl: correspondingTrack.audioUrl,
            duration: correspondingTrack.duration,
            isUsingStreamAudio: false
          };
        }
        return {...t, isLoading: false, isStreaming: false, isGenerating: false, isUsingStreamAudio: false};
      }));
    }

    if (status === 'error') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
        generationTimerRef.current = null;
      }
      setIsGenerating(false);
      setPendingTasksCount(0);

      const errorTrack = createFailedTrack('Generation failed');
      setAllGeneratedTracks([errorTrack]); // 直接设置，不追加
    }
  };

  /**
   * Adjusts polling frequency based on generation status
   */
  const adjustPollingFrequency = (status: GenerationStatus, pollFunction: () => Promise<void>) => {
    if ((status === 'text' || status === 'first' || hasAutoplayedRef.current) && currentPollingMsRef.current !== 3000) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      currentPollingMsRef.current = 3000;
      pollingRef.current = setInterval(pollFunction, currentPollingMsRef.current);
    }
  };

  /**
   * Starts polling for music generation status
   */
  const startPollingStatus = (taskId: string, setIsPlaying?: (playing: boolean) => void) => {
    // Clean up existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollingDelayRef.current) {
      clearTimeout(pollingDelayRef.current);
      pollingDelayRef.current = null;
    }

    hasAutoplayedRef.current = false;
    hasAutoPlayedRef.current = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/music-status?taskId=${taskId}`);
        if (!res.ok) return;
        const payload = await res.json();

        if (payload.code !== 200) {
          console.warn('Music status API returned non-200 code:', payload.code, payload.msg);
          if (payload.code === 202) {
            return; // Continue polling
          }
          handlePollingError(payload);
          return;
        }

        const data = payload.data;
        const status = data.status as GenerationStatus;
        const tracks = (data.tracks || []) as any[];

        // 在 text 回调后立即显示播放器和歌词面板
        if (status === 'text' || status === 'first' || status === 'complete') {
          if (tracks.length > 0) {
            const tracksInfo = processTracksData(tracks, status, data.generationId);
            updateTracksDisplay(tracksInfo, setIsPlaying);
          } else {
            // 没有 tracks 数据时，继续显示skeleton，等待真实数据
            console.log('Text callback complete but no tracks data yet, keeping skeleton state');
          }
        } else {
          console.log('Text callback not complete yet, keeping skeleton state');
        }

        handleStatusUpdates(status, tracks);
        adjustPollingFrequency(status, poll);
      } catch (e) {
        console.warn('Polling music status failed:', e);
      }
    };

    // Start polling with delay
    pollingDelayRef.current = setTimeout(() => {
      poll();
      currentPollingMsRef.current = 1000;
      pollingRef.current = setInterval(poll, currentPollingMsRef.current);
    }, 30000);
  };

  // ============================================================================
  // MUSIC GENERATION LOGIC
  // ============================================================================

  /**
   * Handles music generation process
   */
  const handleGenerate = async (
    refreshCredits?: () => Promise<void>,
    setIsPlaying?: (playing: boolean) => void,
    onApiSuccess?: () => void
  ) => {
    if (!validateInputs()) {
      throw new Error('Input validation failed');
    }

    setIsGenerating(true);
    setActiveTrackIndex(0);
    setPendingTasksCount(2);

    // Start generation timer
    setGenerationTimer(0);
    if (generationTimerRef.current) {
      clearInterval(generationTimerRef.current);
    }
    generationTimerRef.current = setInterval(() => {
      setGenerationTimer(prev => prev + 1);
    }, 1000);

    try {
      const requestData = buildRequestData();

      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      console.log('=== Calling Music Generation API ===');

      // Call real API
      const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'Insufficient credits') {
          throw new Error('Insufficient credits! Please check your credit balance.');
        }
        throw new Error(errorData.error || 'Music generation failed');
      }

      const result = await response.json();

      if (result.success) {
        // 立即触发确认弹窗显示
        if (onApiSuccess) {
          onApiSuccess();
        }

        // Refresh credits display
        if (refreshCredits) {
          refreshCredits().catch(console.error);
        }

        if (result.data?.taskId) {
          console.log('Music generation started, taskId:', result.data.taskId);
          startPollingStatus(result.data.taskId, setIsPlaying);
        } else {
          console.log('Music generation failed - no taskId received');
          throw new Error('No task ID received from server');
        }
      } else {
        throw new Error(result.error || 'Music generation failed');
      }
    } catch (error) {
      console.error('Music generation error:', error);

      // Stop timer and reset states
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
        generationTimerRef.current = null;
      }
      setIsGenerating(false);
      setPendingTasksCount(0);

      // Add error track to display
      const errorTrack = createFailedTrack(error instanceof Error ? error.message : 'Music generation failed');
      setAllGeneratedTracks([errorTrack]); // 直接设置，不追加

      // Show error message
      toast.error(error instanceof Error ? error.message : 'Music generation failed');
      
      // 重新抛出错误，让外层可以捕获
      throw error;
    }
  };

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // Configuration States
    mode, setMode,
    selectedGenre, setSelectedGenre,
    selectedVibe, setSelectedVibe,
    customPrompt, setCustomPrompt,
    songTitle, setSongTitle,
    instrumentalMode, setInstrumentalMode,
    keepPrivate, setKeepPrivate,

    // Advanced Options
    bpm, setBpm,
    grooveType, setGrooveType,
    leadInstrument, setLeadInstrument,
    drumKit, setDrumKit,
    bassTone, setBassTone,
    vocalStyle, setVocalStyle,
    vocalGender, setVocalGender,
    harmonyPalette, setHarmonyPalette,

    // Generation States
    isGenerating, setIsGenerating,
    allGeneratedTracks, setAllGeneratedTracks,
    activeTrackIndex, setActiveTrackIndex,
    pendingTasksCount, setPendingTasksCount,
    generationTimer,

    // Functions
    handleGenerate,
  };
};
