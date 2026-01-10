/**
 * 封面管理器
 * 负责封面图片的异步加载和更新，通过事件系统通知UI
 */
export class CoverManager {
  private coverCache: Map<string, string> = new Map();
  private loadingCovers: Set<string> = new Set();
  private listeners: Map<string, Function[]> = new Map();
  private eventBus: any = null; // 全局事件总线引用

  /**
   * 异步更新封面
   */
  async updateCoverAsync(trackId: string, coverUrl: string): Promise<void> {
    if (!coverUrl || coverUrl.trim() === '') {
      console.warn('Empty cover URL for track:', trackId);
      return;
    }

    // 如果正在加载，跳过
    if (this.loadingCovers.has(trackId)) {
      return;
    }

    // 如果封面没有变化，跳过
    if (this.coverCache.get(trackId) === coverUrl) {
      return;
    }

    this.loadingCovers.add(trackId);

    try {
      // 预加载封面图片
      await this.preloadImage(coverUrl);
      
      // 更新缓存
      this.coverCache.set(trackId, coverUrl);
      
      // 通知UI更新
      this.emit('coverUpdated', { trackId, coverUrl });
      
      console.log('Cover updated for track:', trackId, coverUrl);
    } catch (error) {
      console.error('Failed to load cover for track:', trackId, error);
      this.emit('coverError', { trackId, error });
    } finally {
      this.loadingCovers.delete(trackId);
    }
  }

  /**
   * 预加载图片
   */
  private preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  /**
   * 获取封面URL
   */
  getCoverUrl(trackId: string): string | undefined {
    return this.coverCache.get(trackId);
  }

  /**
   * 检查封面是否正在加载
   */
  isLoading(trackId: string): boolean {
    return this.loadingCovers.has(trackId);
  }

  /**
   * 清除封面缓存
   */
  clearCache(): void {
    this.coverCache.clear();
    this.loadingCovers.clear();
  }

  /**
   * 移除特定封面的缓存
   */
  removeCover(trackId: string): void {
    this.coverCache.delete(trackId);
    this.loadingCovers.delete(trackId);
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
   * 设置全局事件总线引用
   */
  setEventBus(eventBus: any): void {
    this.eventBus = eventBus;
  }

  /**
   * 触发事件
   */
  private emit(event: string, data?: any): void {
    // 触发内部事件
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
    
    // 同时触发全局事件总线事件
    if (this.eventBus && event === 'coverUpdated') {
      this.eventBus.emit('cover:updated', data);
    } else if (this.eventBus && event === 'coverError') {
      this.eventBus.emit('cover:error', data);
    }
  }

  /**
   * 销毁封面管理器
   */
  destroy(): void {
    this.clearCache();
    this.listeners.clear();
  }
}

// 全局封面管理器实例
let coverManagerInstance: CoverManager | null = null;

export const getCoverManager = (): CoverManager => {
  if (!coverManagerInstance) {
    coverManagerInstance = new CoverManager();
  }
  return coverManagerInstance;
};

export const destroyCoverManager = (): void => {
  if (coverManagerInstance) {
    coverManagerInstance.destroy();
    coverManagerInstance = null;
  }
};
