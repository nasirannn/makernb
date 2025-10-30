/**
 * 全局事件系统
 * 用于组件间的解耦通信
 */
export class EventBus {
  private listeners: Map<string, Function[]> = new Map();

  /**
   * 监听事件
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
  emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * 一次性监听事件
   */
  once(event: string, callback: Function): void {
    const onceCallback = (data: any) => {
      callback(data);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  /**
   * 移除所有事件监听
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}

// 全局事件总线实例
let eventBusInstance: EventBus | null = null;

export const getEventBus = (): EventBus => {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
};

export const destroyEventBus = (): void => {
  if (eventBusInstance) {
    eventBusInstance.removeAllListeners();
    eventBusInstance = null;
  }
};

// 事件类型定义
export interface AudioEvents {
  play: void;
  pause: void;
  ended: void;
  timeupdate: { currentTime: number; duration: number };
  trackChanged: { trackId: string; audioUrl: string };
  error: Error;
}

export interface CoverEvents {
  coverUpdated: { trackId: string; coverUrl: string };
  coverError: { trackId: string; error: Error };
}

export interface TrackEvents {
  trackSelected: { trackId: string };
  trackPlayed: { trackId: string };
  trackPaused: { trackId: string };
  trackUpdated: { trackId: string; duration?: number; audioUrl?: string; [key: string]: any };
  trackCompleted: { trackId: string; duration: number; audioUrl: string };
  trackDeleted: { trackId: string };
}

// 事件名称常量
export const AUDIO_EVENTS = {
  PLAY: 'audio:play',
  PAUSE: 'audio:pause',
  ENDED: 'audio:ended',
  TIMEUPDATE: 'audio:timeupdate',
  TRACK_CHANGED: 'audio:trackChanged',
  ERROR: 'audio:error',
} as const;

export const COVER_EVENTS = {
  UPDATED: 'cover:updated',
  ERROR: 'cover:error',
} as const;

export const TRACK_EVENTS = {
  SELECTED: 'track:selected',
  PLAYED: 'track:played',
  PAUSED: 'track:paused',
  UPDATED: 'track:updated',
  COMPLETED: 'track:completed',
  DELETED: 'track:deleted',
} as const;
