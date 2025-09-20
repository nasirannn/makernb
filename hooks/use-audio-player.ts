import { useState, useRef, useEffect } from "react";

export const useAudioPlayer = () => {
  // Audio Player States
  const [isPlaying, setIsPlaying] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 添加音频事件监听器
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      // Audio play event
    };

    const handlePause = () => {
      // Audio pause event
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = (e: any) => {
      console.error('Audio error:', e);
      console.error('Error details:', {
        error: e.target?.error,
        networkState: e.target?.networkState,
        readyState: e.target?.readyState,
        src: e.target?.src
      });
      setIsPlaying(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // 添加键盘快捷键支持
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 只在播放器区域响应键盘事件
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          // 需要传入当前歌曲，这里暂时跳过
          break;
        case 'ArrowLeft':
          e.preventDefault();
          // 上一首 - 需要从父组件传入
          break;
        case 'ArrowRight':
          e.preventDefault();
          // 下一首 - 需要从父组件传入
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);


  const handleTrackSelect = (index: number) => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    setCurrentTime(0);
    setDuration(0);
    return { setCurrentTime, setDuration, setIsPlaying };
  };

  const togglePlayPause = (currentTrack: any) => {

    if (!audioRef.current || !currentTrack) {
      console.error('Missing audioRef or currentTrack');
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        // Audio play started successfully
      }).catch(error => {
        console.error('Audio play failed:', error);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  // 专门处理流式音频的函数
  const playStreamAudio = (streamUrl: string, trackInfo?: any) => {
    if (!audioRef.current) {
      console.error('Audio ref not available');
      return Promise.reject(new Error('Audio ref not available'));
    }

    return new Promise<void>((resolve, reject) => {
      const audio = audioRef.current!;

      console.log('Playing stream audio:', streamUrl);

      // 为流式音频优化设置
      audio.preload = 'none';

      const handleCanPlay = () => {
        console.log('Stream audio ready to play');
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('error', handleError);
        resolve();
      };

      const handleError = (error: any) => {
        console.error('Stream audio load error:', error);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('error', handleError);
        reject(error);
      };

      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('error', handleError);

      // 设置音频源并加载
      audio.src = streamUrl;
      audio.load();

      // 尝试播放
      audio.play().then(() => {
        setIsPlaying(true);
        console.log('Stream audio playing successfully');
      }).catch((playError) => {
        console.error('Stream audio play error:', playError);
        setIsPlaying(false);
        reject(playError);
      });
    });
  };

  const handleAudioLoad = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioEnd = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDownload = async (currentTrack: any) => {
    if (!currentTrack?.audioUrl) return;

    try {
      const response = await fetch(currentTrack.audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${currentTrack.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed, please try again');
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle volume interaction (click + drag)
  const handleVolumeInteraction = (e: React.MouseEvent) => {
    const slider = e.currentTarget.parentElement;
    if (!slider) return;

    const rect = slider.getBoundingClientRect();

    const updateVolume = (clientX: number) => {
      const width = rect.width;
      const left = rect.left;

      // 计算音量：从左到右，0% 到 100%
      let newVolume = (clientX - left) / width;

      // 限制在0-1范围内
      newVolume = Math.max(0, Math.min(1, newVolume));

      setVolume(newVolume);
      setIsMuted(false); // 调节音量时取消静音

      if (audioRef.current) {
        audioRef.current.volume = newVolume;
      }
    };

    // 初始点击位置
    updateVolume(e.clientX);

    // 拖拽处理
    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateVolume(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle mute/unmute
  const handleMuteToggle = () => {
    if (isMuted) {
      // 取消静音，恢复之前的音量
      setVolume(previousVolume);
      if (audioRef.current) {
        audioRef.current.volume = previousVolume;
      }
      setIsMuted(false);
    } else {
      // 静音，保存当前音量
      setPreviousVolume(volume);
      setVolume(0);
      if (audioRef.current) {
        audioRef.current.volume = 0;
      }
      setIsMuted(true);
    }
  };

  return {
    // States
    isPlaying, setIsPlaying,
    currentTime, setCurrentTime,
    duration, setDuration,
    volume, setVolume,
    isMuted, setIsMuted,
    previousVolume, setPreviousVolume,
    audioRef,
    
    // Functions
    handleTrackSelect,
    togglePlayPause,
    playStreamAudio,
    handleAudioLoad,
    handleTimeUpdate,
    handleAudioEnd,
    handleDownload,
    formatTime,
    handleVolumeInteraction,
    handleMuteToggle,
  };
};
