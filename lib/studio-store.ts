import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { StudioTrack, LibraryTrack } from '@/types/track';

// 定义状态机的状态
type StudioState =
  | 'idle'
  | 'generating'
  | 'text_received'
  | 'first_received'
  | 'completed'
  | 'error';

// 定义 Store 接口
interface StudioStore {
  // 状态机状态
  state: StudioState;

  // 数据
  generatedTracks: StudioTrack[];
  userTracks: LibraryTrack[];
  selectedTrack: StudioTrack | null;
  currentPlayingTrack: StudioTrack | null;

  // UI 状态
  isGenerating: boolean;
  showLyrics: boolean;
  panelOpen: boolean;

  // Actions (纯函数，无副作用)
  setState: (state: StudioState) => void;
  setGeneratedTracks: (tracks: StudioTrack[]) => void;
  addGeneratedTrack: (track: StudioTrack) => void;
  updateGeneratedTrack: (id: string, updates: Partial<StudioTrack>) => void;
  moveToUserTracks: () => void;
  setUserTracks: (tracks: LibraryTrack[]) => void;
  updateUserTrack: (id: string, updates: Partial<LibraryTrack>) => void;
  setSelectedTrack: (track: StudioTrack | null) => void;
  setCurrentPlayingTrack: (track: StudioTrack | null) => void;

  // UI Actions
  setShowLyrics: (show: boolean) => void;
  setPanelOpen: (open: boolean) => void;

  // 复合操作
  startGeneration: () => void;
  completeGeneration: () => void;
  resetGeneration: () => void;
}

// 创建 Store
export const useStudioStore = create<StudioStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // 初始状态
      state: 'idle' as StudioState,
      generatedTracks: [] as StudioTrack[],
      userTracks: [] as LibraryTrack[],
      selectedTrack: null as StudioTrack | null,
      currentPlayingTrack: null as StudioTrack | null,
      isGenerating: false,
      showLyrics: true, // 默认展开歌词面板
      panelOpen: true,

      // 基础 Actions
      setState: (state: StudioState) => set({ state }, false, 'setState'),

      setGeneratedTracks: (tracks: StudioTrack[]) => set({ generatedTracks: tracks }, false, 'setGeneratedTracks'),

      addGeneratedTrack: (track: StudioTrack) => set(
        (state) => ({
          generatedTracks: [...state.generatedTracks, track]
        }),
        false,
        'addGeneratedTrack'
      ),

      updateGeneratedTrack: (id: string, updates: Partial<StudioTrack>) => set(
        (state) => ({
          generatedTracks: state.generatedTracks.map((track: StudioTrack) =>
            track.id === id ? { ...track, ...updates } : track
          )
        }),
        false,
        'updateGeneratedTrack'
      ),

      moveToUserTracks: () => set(
        (state) => {
          const completedTracks = state.generatedTracks.filter((t: StudioTrack) => t.isCompleted);
          if (completedTracks.length === 0) return state;

          // 创建新的 generation 对象
          const newGeneration: LibraryTrack = {
            id: completedTracks[0].generationId || '',
            title: completedTracks[0].title,
            tags: completedTracks[0].tags,
            genre: completedTracks[0].genre,
            status: 'completed',
            created_at: new Date().toISOString(),
            allTracks: completedTracks.map((track: StudioTrack) => ({
              id: track.id,
              audio_url: track.audioUrl || '',
              duration: track.duration || 0,
              cover_r2_url: track.coverImage,
              lyrics: track.lyrics,
              is_deleted: false,
              is_favorited: track.is_favorited || false
            }))
          };

          return {
            userTracks: [newGeneration, ...state.userTracks],
            generatedTracks: [], // 清空生成的 tracks
            state: 'idle' as StudioState
          };
        },
        false,
        'moveToUserTracks'
      ),

      setUserTracks: (tracks: LibraryTrack[]) => set({ userTracks: tracks }, false, 'setUserTracks'),
      
      updateUserTrack: (id: string, updates: Partial<LibraryTrack>) => set(
        (state) => ({
          userTracks: state.userTracks.map((track: LibraryTrack) =>
            track.id === id ? { ...track, ...updates } : track
          )
        }),
        false,
        'updateUserTrack'
      ),

      setSelectedTrack: (track: StudioTrack | null) => set({ selectedTrack: track }, false, 'setSelectedTrack'),
      setCurrentPlayingTrack: (track: StudioTrack | null) => set({ currentPlayingTrack: track }, false, 'setCurrentPlayingTrack'),
      setShowLyrics: (show: boolean) => set({ showLyrics: show }, false, 'setShowLyrics'),
      setPanelOpen: (open: boolean) => set({ panelOpen: open }, false, 'setPanelOpen'),

      // 复合操作（状态机转换）
      startGeneration: () => set({
        state: 'generating' as StudioState,
        isGenerating: true,
        generatedTracks: []
      }, false, 'startGeneration'),

      completeGeneration: () => set({
        state: 'completed' as StudioState,
        isGenerating: false
      }, false, 'completeGeneration'),

      resetGeneration: () => set({
        state: 'idle' as StudioState,
        isGenerating: false,
        generatedTracks: [],
        selectedTrack: null
      }, false, 'resetGeneration')
    })),
    {
      name: 'studio-store'
    }
  )
);

// 状态机转换规则
export const stateTransitions: Record<StudioState, StudioState[]> = {
  idle: ['generating'],
  generating: ['text_received', 'error'],
  text_received: ['first_received', 'error'],
  first_received: ['completed', 'error'],
  completed: ['idle'],
  error: ['idle']
};

// 状态机验证
export const canTransition = (from: StudioState, to: StudioState): boolean => {
  return stateTransitions[from]?.includes(to) ?? false;
};

// 选择器（优化重新渲染）
export const selectGeneratedTracks = (state: StudioStore) => state.generatedTracks;
export const selectIsGenerating = (state: StudioStore) => state.isGenerating;
export const selectCurrentState = (state: StudioStore) => state.state;
export const selectUserTracks = (state: StudioStore) => state.userTracks;
export const selectSelectedTrack = (state: StudioStore) => state.selectedTrack;
export const selectCurrentPlayingTrack = (state: StudioStore) => state.currentPlayingTrack;