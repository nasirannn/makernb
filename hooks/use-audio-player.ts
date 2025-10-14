/**
 * Audio Player Hook
 * Custom hook for managing audio playback in studio components
 */

import { useState, useCallback } from 'react';

interface UseAudioPlayerReturn {
  currentAudio: HTMLAudioElement | null;
  playingAudioId: string | null;
  playAudio: (audioUrl: string, audioId: string) => void;
}

/**
 * Hook for managing audio playback with pause/resume functionality
 * @returns Audio player state and controls
 */
export const useAudioPlayer = (): UseAudioPlayerReturn => {
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const playAudio = useCallback((audioUrl: string, audioId: string) => {
    // If clicking the same audio that's currently playing, pause it
    if (playingAudioId === audioId && currentAudio) {
      currentAudio.pause();
      setPlayingAudioId(null);
      return;
    }
    
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    // Create new audio instance
    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);
    setPlayingAudioId(audioId);
    
    // Play the audio
    audio.play().catch((error) => {
      console.error('Audio play failed:', error);
      setPlayingAudioId(null);
    });
    
    // Clean up when audio ends
    audio.addEventListener('ended', () => {
      setCurrentAudio(null);
      setPlayingAudioId(null);
    });
  }, [currentAudio, playingAudioId]);

  return {
    currentAudio,
    playingAudioId,
    playAudio
  };
};