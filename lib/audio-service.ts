/**
 * 独立的音频服务类
 * 负责音频播放，与UI完全分离
 */
export class AudioService {
  private audioElement: HTMLAudioElement;
  private currentTrackId: string | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private isInitialized = false;
  private savedCurrentTime: number = 0; // 保存当前播放时间

  constructor() {
    // 确保只在客户端运行
    if (typeof window === 'undefined') {
      throw new Error('AudioService can only be used on the client side');
    }
    
    this.audioElement = new Audio();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.audioElement.addEventListener('play', () => this.emit('play'));
    this.audioElement.addEventListener('pause', () => this.emit('pause'));
    this.audioElement.addEventListener('ended', () => this.emit('ended'));
    this.audioElement.addEventListener('timeupdate', () => this.emit('timeupdate', {
      currentTime: this.audioElement.currentTime,
      duration: this.audioElement.duration
    }));
    this.audioElement.addEventListener('loadedmetadata', () => this.emit('loadedmetadata', {
      duration: this.audioElement.duration
    }));
    this.audioElement.addEventListener('canplay', () => this.emit('canplay'));
    this.audioElement.addEventListener('error', (e) => this.emit('error', e));
  }

  /**
   * 播放指定歌曲
   */
  async playTrack(trackId: string, audioUrl: string, streamAudioUrl?: string): Promise<void> {
    try {
      // 停止所有其他音频播放
      this.stopAllOtherAudio();
      
      // 智能选择音频URL：优先使用本地音频，如果没有则使用stream音频
      const finalAudioUrl = audioUrl || streamAudioUrl || '';
      if (!finalAudioUrl) {
        console.error('No audio URL available');
        return;
      }
      
      // 如果正在播放同一首歌且URL相同，不重新加载
      if (this.currentTrackId === trackId && this.audioElement.src === finalAudioUrl && !this.audioElement.paused) {
        console.log('Same track and URL, resuming playback');
        await this.audioElement.play();
        return;
      }
      
      // 保存当前播放时间（如果是同一首歌但URL不同）
      if (this.currentTrackId === trackId && this.audioElement.src !== finalAudioUrl) {
        this.savedCurrentTime = this.audioElement.currentTime;
        console.log('Same track, different URL, saving current time:', this.savedCurrentTime);
      }
      
      this.currentTrackId = trackId;
      this.audioElement.src = finalAudioUrl;
      this.audioElement.load();
      
      // 如果保存了播放时间，在新音频加载后恢复
      if (this.savedCurrentTime > 0) {
        this.audioElement.addEventListener('canplay', () => {
          this.audioElement.currentTime = this.savedCurrentTime;
          this.savedCurrentTime = 0; // 重置保存的时间
        }, { once: true });
      }
      
      await this.audioElement.play();
      this.emit('trackChanged', { trackId, audioUrl: finalAudioUrl });
    } catch (error) {
      console.error('Audio play failed:', error);
      this.emit('error', error);
    }
  }

  /**
   * 暂停播放
   */
  pause(): void {
    this.audioElement.pause();
  }

  /**
   * 恢复播放
   */
  async resume(): Promise<void> {
    try {
      await this.audioElement.play();
    } catch (error) {
      console.error('Audio resume failed:', error);
    }
  }

  /**
   * 切换播放/暂停状态
   */
  async togglePlayPause(): Promise<void> {
    if (this.audioElement.paused) {
      await this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * 跳转到指定时间
   */
  seek(time: number): void {
    this.audioElement.currentTime = time;
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    this.audioElement.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 设置静音状态
   */
  setMuted(muted: boolean): void {
    this.audioElement.muted = muted;
  }

  /**
   * 停止所有其他音频播放
   */
  private stopAllOtherAudio(): void {
    const allAudioElements = document.querySelectorAll('audio');
    allAudioElements.forEach(audioEl => {
      if (audioEl !== this.audioElement && !audioEl.paused) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
    });
  }

  /**
   * 停止所有音频播放（包括自己的）
   */
  stopAllAudio(): void {
    const allAudioElements = document.querySelectorAll('audio');
    allAudioElements.forEach(audioEl => {
      if (!audioEl.paused) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
    });
    // 也停止自己的音频
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  /**
   * 获取当前播放状态
   */
  isPlaying(): boolean {
    return !this.audioElement.paused && !this.audioElement.ended;
  }

  /**
   * 获取当前播放的歌曲ID
   */
  getCurrentTrackId(): string | null {
    return this.currentTrackId;
  }

  /**
   * 获取当前播放时间
   */
  getCurrentTime(): number {
    return this.audioElement.currentTime || 0;
  }

  /**
   * 获取总时长
   */
  getDuration(): number {
    return this.audioElement.duration || 0;
  }

  /**
   * 获取音量
   */
  getVolume(): number {
    return this.audioElement.volume;
  }

  /**
   * 获取静音状态
   */
  isMuted(): boolean {
    return this.audioElement.muted;
  }

  /**
   * 事件监听
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * 移除事件监听
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  /**
   * 清理当前播放状态
   */
  clearCurrentTrack(): void {
    // 停止所有音频播放
    this.stopAllAudio();
    
    this.currentTrackId = null;
    this.savedCurrentTime = 0;
    
    this.emit('trackCleared');
  }

  /**
   * 销毁音频服务
   */
  destroy(): void {
    this.audioElement.pause();
    this.audioElement.src = '';
    this.listeners.clear();
    this.currentTrackId = null;
  }
}

// 全局音频服务实例
let audioServiceInstance: AudioService | null = null;

export const getAudioService = (): AudioService => {
  if (typeof window === 'undefined') {
    throw new Error('AudioService can only be used on the client side');
  }
  
  if (!audioServiceInstance) {
    audioServiceInstance = new AudioService();
  }
  return audioServiceInstance;
};

export const destroyAudioService = (): void => {
  if (audioServiceInstance) {
    audioServiceInstance.destroy();
    audioServiceInstance = null;
  }
};

/**
 * 停止所有音频播放（全局清理函数）
 */
export const stopAllAudioGlobally = (): void => {
  // 停止AudioService中的音频
  if (audioServiceInstance) {
    audioServiceInstance.stopAllAudio();
  }
  
  // 停止所有其他音频元素
  const allAudioElements = document.querySelectorAll('audio');
  allAudioElements.forEach(audioEl => {
    if (!audioEl.paused) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
  });
};
