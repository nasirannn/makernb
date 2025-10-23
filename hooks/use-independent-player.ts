import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface TrackInfo {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  coverImage?: string;
  tags?: string;
  genre?: string;
  lyrics?: string;
  sideLetter?: string;
  isFavorited?: boolean;
  generationId?: string;
}

interface PlayerState {
  currentTrack: TrackInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

export const useIndependentPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
  });

  // 通过 track ID 获取 track 信息
  const fetchTrackInfo = useCallback(async (trackId: string): Promise<TrackInfo | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/track-info/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch track info:', response.status);
        return null;
      }

      const data = await response.json();
      return data.track;
    } catch (error) {
      console.error('Error fetching track info:', error);
      return null;
    }
  }, []);

  // 播放指定 track
  const playTrack = useCallback(async (trackId: string) => {
    console.log('Playing track:', trackId);
    
    // 获取 track 信息
    const trackInfo = await fetchTrackInfo(trackId);
    if (!trackInfo) {
      console.error('Failed to get track info for:', trackId);
      return;
    }

    // 设置当前 track
    setPlayerState(prev => ({
      ...prev,
      currentTrack: trackInfo,
      duration: trackInfo.duration || 0,
    }));

    // 设置音频源
    if (audioRef.current) {
      const wasPlaying = !audioRef.current.paused;
      const currentTime = audioRef.current.currentTime;
      
      audioRef.current.src = trackInfo.audioUrl;
      audioRef.current.load();
      
      // 如果之前正在播放，恢复播放状态
      if (wasPlaying) {
        audioRef.current.addEventListener('canplay', () => {
          if (audioRef.current) {
            audioRef.current.currentTime = currentTime;
            audioRef.current.play().catch(console.error);
          }
        }, { once: true });
      }
    }
  }, [fetchTrackInfo]);

  // 暂停/播放
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (playerState.isPlaying) {
      audioRef.current.pause();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current.play().catch(console.error);
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [playerState.isPlaying]);

  // 设置音量
  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      setPlayerState(prev => ({ ...prev, volume }));
    }
  }, []);

  // 静音/取消静音
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;

    const newMuted = !playerState.isMuted;
    audioRef.current.volume = newMuted ? 0 : playerState.volume;
    setPlayerState(prev => ({ ...prev, isMuted: newMuted }));
  }, [playerState.isMuted, playerState.volume]);

  // 设置播放进度
  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      console.log('Audio load started');
    };

    const handleCanPlay = () => {
      console.log('Audio can play');
      // 使用 track 信息中的 duration，而不是音频文件的 duration
      if (playerState.currentTrack?.duration) {
        setPlayerState(prev => ({ ...prev, duration: playerState.currentTrack!.duration }));
      } else {
        setPlayerState(prev => ({ ...prev, duration: audio.duration || 0 }));
      }
    };

    const handlePlay = () => {
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    };

    const handleTimeUpdate = () => {
      setPlayerState(prev => ({ ...prev, currentTime: audio.currentTime }));
    };

    const handleEnded = () => {
      setPlayerState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    };

    const handleError = (e: any) => {
      console.error('Audio error:', e);
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    };

    // 添加事件监听器
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [playerState.currentTrack]);

  return {
    audioRef,
    playerState,
    playTrack,
    togglePlayPause,
    setVolume,
    toggleMute,
    seekTo,
  };
};
