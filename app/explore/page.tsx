"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoading } from '@/components/ui/loading-dots';
import { Play, Pause, Music } from 'lucide-react';
import { SafeImage } from '@/components/ui/safe-image';
import { SimpleMusicPlayer } from '@/components/ui/simple-music-player';

interface Track {
  id: string;
  audio_url: string;
  duration: number;
  side_letter: string;
  cover_r2_url?: string;
}

interface MusicGeneration {
  id: string;
  title: string;
  genre: string;
  tags: string;
  prompt?: string;
  lyrics?: string;
  createdAt: string;
  updatedAt: string;
  primaryTrack: Track;
  allTracks: Track[];
  totalDuration: number;
  trackCount: number;
}

interface ExploreData {
  music: MusicGeneration[];
  count: number;
  limit: number;
  offset: number;
}

// Genre options for filtering
const GENRE_OPTIONS = [
  { id: 'all', name: 'All Genres' },
  { id: 'New Jack Swing', name: 'New Jack Swing' },
  { id: 'Hip-Hop Soul', name: 'Hip-Hop Soul' },
  { id: 'Quiet Storm', name: 'Quiet Storm' },
  { id: 'Neo-Soul', name: 'Neo-Soul' },
  { id: 'R&B', name: 'Contemporary R&B' }
];

export default function ExplorePage() {
  const [exploreData, setExploreData] = useState<ExploreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 播放器状态
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<{trackId: string, audioUrl: string} | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playlist, setPlaylist] = useState<MusicGeneration[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 区分初始加载和筛选加载
        if (isInitialLoad) {
          setLoading(true);
        } else {
          setFilterLoading(true);
        }

        const genreParam = selectedGenre !== 'all' ? `&genre=${selectedGenre}` : '';
        const response = await fetch(`/api/explore?limit=20&offset=0${genreParam}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setExploreData(result.data);
            setPlaylist(result.data.music || []);
          } else {
            setError('Failed to load music data');
          }
        } else {
          setError('Failed to load music data');
        }
      } catch (error) {
        console.error('Error fetching explore data:', error);
        setError('Failed to load music data');
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          setIsInitialLoad(false);
        } else {
          setFilterLoading(false);
        }
      }
    };

    loadData();
  }, [selectedGenre, isInitialLoad]);

  const fetchExploreData = async (offset = 0, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const genreParam = selectedGenre !== 'all' ? `&genre=${selectedGenre}` : '';
      const response = await fetch(`/api/explore?limit=20&offset=${offset}${genreParam}`);
      const data = await response.json();
      
      if (data.success) {
        if (append && exploreData && exploreData.music) {
          const newData = {
            ...data.data,
            music: [...exploreData.music, ...data.data.music]
          };
          setExploreData(newData);
          setPlaylist(newData.music);
        } else {
          setExploreData(data.data);
          setPlaylist(data.data.music);
        }
      } else {
        setError(data.error || 'Failed to load music');
      }
    } catch (err) {
      setError('Failed to load music');
      console.error('Error fetching explore data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (exploreData && exploreData.music && !loadingMore) {
      fetchExploreData(exploreData.music.length, true);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = (trackId: string, audioUrl: string, music: MusicGeneration) => {
    // 找到歌曲在播放列表中的索引
    const trackIndex = playlist.findIndex(track => track.primaryTrack.id === trackId);
    if (trackIndex === -1) return;

    // 如果点击的是当前播放的歌曲，则暂停/继续
    if (currentlyPlaying === trackId) {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
      return;
    }

    // 切换到新歌曲
    playTrack(trackIndex);
  };

  const playTrack = (index: number, specificTrackId?: string, specificAudioUrl?: string) => {
    if (index < 0 || index >= playlist.length) return;

    const music = playlist[index];
    const trackId = specificTrackId || music.primaryTrack.id;
    const audioUrl = specificAudioUrl || music.primaryTrack.audio_url;

    // 停止当前播放
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // 创建新的音频元素
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // 设置当前播放的歌曲信息
    setCurrentTrackIndex(index);
    setCurrentlyPlaying(trackId);
    setCurrentPlayingTrack({ trackId, audioUrl }); // 跟踪当前播放的具体track
    setCurrentTime(0);
    setDuration(0);

    // 音频事件监听
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration || 0);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      // 自动播放下一首
      if (index < playlist.length - 1) {
        playTrack(index + 1);
      }
    });

    // 设置音量
    audio.volume = isMuted ? 0 : volume;

    // 播放音频
    audio.play();
    setIsPlaying(true);
  };

  const handleSideChange = (trackId: string, audioUrl: string) => {
    playTrack(currentTrackIndex, trackId, audioUrl);
  };

  // 播放器控制函数
  const handlePlayerPlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handlePrevious = () => {
    if (currentTrackIndex > 0) {
      playTrack(currentTrackIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentTrackIndex < playlist.length - 1) {
      playTrack(currentTrackIndex + 1);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : newVolume;
    }
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.volume = newMuted ? 0 : volume;
    }
  };

  const handleTrackChange = (index: number) => {
    playTrack(index);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-24">
        <div className="container mx-auto px-4 py-8">
          <PageLoading message="Loading music" className="text-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black pt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={() => fetchExploreData()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24">
      <div className={`container mx-auto px-4 py-8 ${playlist.length > 0 && currentlyPlaying ? 'pb-32' : ''}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Listen to The AI-Generated R&B Songs
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            Explore soulful tracks crafted by artificial intelligence
          </p>
        </div>

        {/* Genre Filter - 左对齐 */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((genre) => (
              <Button
                key={genre.id}
                variant={selectedGenre === genre.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedGenre(genre.id)}
                disabled={filterLoading}
                className={`transition-all duration-200 ${
                  selectedGenre === genre.id
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-black/20 border-white/20 text-white hover:bg-white/10 hover:border-white/30'
                } ${filterLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {genre.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Music Grid */}
        {exploreData && exploreData.music && exploreData.music.length > 0 ? (
          <>
            <div className="relative">
              {/* Filter Loading Overlay */}
              {filterLoading && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <span className="text-white/90">Filtering music...</span>
                  </div>
                </div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 ${filterLoading ? 'opacity-50' : ''}`}>
              {exploreData.music.map((music) => (
                <div
                  key={music.id}
                  className="bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden hover:bg-black/30 transition-all duration-300 group cursor-pointer border border-white/10"
                >
                  {/* Cover Image */}
                  <div className="relative aspect-square">
                    {music.primaryTrack.cover_r2_url ? (
                      <SafeImage
                        src={music.primaryTrack.cover_r2_url}
                        alt={music.title}
                        fill
                        className="object-cover"
                        fallbackContent={<Music className="w-16 h-16 text-white/50" />}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-600 flex items-center justify-center">
                        <Music className="w-16 h-16 text-white/50" />
                      </div>
                    )}

                    {/* Genre Badge - 右上角 */}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs bg-black/70 text-white border-white/20">
                        {music.genre}
                      </Badge>
                    </div>

                    {/* Playing Wave Effect - 播放时音波效果 */}
                    {currentlyPlaying === music.primaryTrack.id && isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:opacity-0 transition-opacity duration-300">
                        <div className="flex items-end gap-1">
                          <div className="w-1 h-4 bg-white animate-pulse" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1 h-6 bg-white animate-pulse" style={{ animationDelay: '100ms' }}></div>
                          <div className="w-1 h-3 bg-white animate-pulse" style={{ animationDelay: '200ms' }}></div>
                          <div className="w-1 h-8 bg-white animate-pulse" style={{ animationDelay: '300ms' }}></div>
                          <div className="w-1 h-5 bg-white animate-pulse" style={{ animationDelay: '400ms' }}></div>
                          <div className="w-1 h-7 bg-white animate-pulse" style={{ animationDelay: '500ms' }}></div>
                          <div className="w-1 h-2 bg-white animate-pulse" style={{ animationDelay: '600ms' }}></div>
                          <div className="w-1 h-4 bg-white animate-pulse" style={{ animationDelay: '700ms' }}></div>
                        </div>
                      </div>
                    )}

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Button
                        onClick={() => handlePlayPause(music.primaryTrack.id, music.primaryTrack.audio_url, music)}
                        size="lg"
                        className="rounded-full bg-white/90 hover:bg-white text-black hover:text-black border-0 shadow-lg"
                      >
                        {currentlyPlaying === music.primaryTrack.id && isPlaying ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6 ml-1" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Track Info */}
                  <div className="p-4">
                    <h3 className="text-white font-bold text-base mb-1 truncate">
                      {music.title}
                    </h3>
                    <p className="text-white/70 text-sm mb-2 truncate capitalize whitespace-nowrap overflow-hidden">
                      {music.tags}
                    </p>
                    <div className="flex items-center text-white/50 text-xs">
                      <span>{music.trackCount} tracks</span>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>

            {/* Load More Button */}
            {exploreData && exploreData.music && exploreData.music.length < exploreData.count && (
              <div className="text-center mt-12">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-3 rounded-xl backdrop-blur-sm"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}

            {/* No More Music Message */}
            {exploreData && exploreData.music && exploreData.music.length > 0 && exploreData.music.length >= exploreData.count && (
              <div className="text-center mt-12 py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 mb-4">
                  <Music className="w-6 h-6 text-white/40" />
                </div>
                <p className="text-white/60 text-sm">
                  All the music is here ✨
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/70 text-lg">No public music available yet</p>
          </div>
        )}
      </div>

      {/* 播放器 - 固定在底部 */}
      {playlist.length > 0 && currentlyPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <SimpleMusicPlayer
            tracks={playlist.map(music => ({
              id: music.primaryTrack.id,
              title: music.title,
              audioUrl: music.primaryTrack.audio_url,
              duration: music.totalDuration,
              coverImage: music.primaryTrack.cover_r2_url,
              artist: music.genre,
              allTracks: music.allTracks
            }))}
            currentTrackIndex={currentTrackIndex}
            currentPlayingTrack={currentPlayingTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            onPlayPause={handlePlayerPlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onTrackChange={handleTrackChange}
            onSideChange={handleSideChange}
          />
        </div>
      )}
    </div>
  );
}
