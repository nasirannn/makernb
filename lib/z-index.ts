/**
 * Z-Index 层级管理
 * 统一管理所有组件的 z-index 值，避免层级冲突
 *
 * 层级规范（由低到高）：
 * -10: 页面背景
 * 0-29: 页面内容层
 * 30-49: 交互辅助层（tooltip/select 等）
 * 50-69: Studio 本地层（sidebar/player/backdrop）
 * 70-99: 通知与调试
 * 100-119: 导航与菜单
 * 120-129: 全局模态框/对话框
 * 130-179: 移动端抽屉等全屏浮层
 * 180+: 特殊高优先级菜单
 */

export const Z_INDEX = {
  // 页面背景
  HERO_BACKGROUND: -10,

  // 基础内容
  BACKGROUND: 0,
  ANIMATED_BACKGROUND: 0,
  BASE_CONTENT: 1,

  // 内容层
  MAIN_CONTENT: 10,
  MUSIC_PLAYER_CONTROLS: 10,
  LOADING_OVERLAY: 10,
  TRACK_OVERLAY: 10,

  // 卡片和面板
  CARD: 20,
  PANEL: 25,

  // 工具提示和选择器
  TOOLTIP: 35,
  SELECT: 30,

  // 侧边栏（Studio）
  SIDEBAR_HOVER_BACKDROP: 50,
  SIDEBAR: 55,
  SIDEBAR_MENU_ANCHOR: 40,
  SIDEBAR_DROPDOWN: 110,

  // 模态框和对话框
  MODAL_BACKDROP: 120,
  MODAL_CONTENT: 121,
  DIALOG_BACKDROP: 120,
  DIALOG_CONTENT: 121,
  CONFIRM_DIALOG: 121,

  // 导航与菜单
  NAVBAR: 100,
  MOBILE_NAV: 100,
  DROPDOWN: 110,

  // Studio 播放器与歌词层
  MUSIC_PLAYER: 45,
  FLOATING_PLAYER: 60,
  LYRICS_PANEL: 60,
  LYRICS_BACKDROP: 50,

  // 通知和提示
  NOTIFICATION: 70,
  DAILY_CREDITS: 70,

  // Inline panel 交互层
  INLINE_PANEL_OVERLAY: 70,
  INLINE_PANEL_CONTAINER: 80,
  INLINE_PANEL_STUDIO_OVERLAY: 90,

  // 特殊交互
  STUDIO_CREATE_MODAL: 130,
  STUDIO_PANEL_TOOLTIP: 122,

  // 开发工具
  DEBUG: 90,
  DEV_TOOLS: 100,

  // 认证模态框（与标准 Dialog 对齐）
  AUTH_MODAL_BACKDROP: 120,
  AUTH_MODAL_CONTENT: 121,

  // 移动端浮层
  MOBILE_DRAWER: 130,

  // 特殊高优先级菜单（仅在必要时使用）
  PRIORITY_DROPDOWN: 180,

  // 最高层级
  EMERGENCY: 999999,
} as const;

/**
 * 获取 z-index 的 CSS 类名
 */
export const getZIndexClass = (level: keyof typeof Z_INDEX): string => {
  const value = Z_INDEX[level];
  // 处理负值：使用 -z-[N] 而不是 z-[-N]
  if (value < 0) {
    return `-z-[${Math.abs(value)}]`;
  }
  return `z-[${value}]`;
};

/**
 * 获取 z-index 的 CSS 样式对象
 */
export const getZIndexStyle = (level: keyof typeof Z_INDEX): { zIndex: number } => {
  return { zIndex: Z_INDEX[level] };
};

/**
 * 常用的 z-index 组合
 */
export const Z_INDEX_COMBINATIONS = {
  // 认证模态框
  AUTH_MODAL: {
    backdrop: getZIndexClass('AUTH_MODAL_BACKDROP'),
    content: getZIndexClass('AUTH_MODAL_CONTENT'),
  },
  
  // 普通模态框
  MODAL: {
    backdrop: getZIndexClass('MODAL_BACKDROP'),
    content: getZIndexClass('MODAL_CONTENT'),
  },
  
  // 对话框
  DIALOG: {
    backdrop: getZIndexClass('DIALOG_BACKDROP'),
    content: getZIndexClass('DIALOG_CONTENT'),
  },
  
  // 下拉菜单
  DROPDOWN: {
    menu: getZIndexClass('DROPDOWN'),
  },
  
  // 侧边栏
  SIDEBAR: {
    backdrop: getZIndexClass('SIDEBAR_HOVER_BACKDROP'),
    container: getZIndexClass('SIDEBAR'),
    dropdown: getZIndexClass('SIDEBAR_DROPDOWN'),
  },
  
  // 导航栏
  NAVBAR: {
    container: getZIndexClass('NAVBAR'),
    mobile: getZIndexClass('MOBILE_NAV'),
  },
  
  // 音乐播放器
  MUSIC_PLAYER: {
    player: getZIndexClass('MUSIC_PLAYER'),
    lyrics: getZIndexClass('LYRICS_PANEL'),
    backdrop: getZIndexClass('LYRICS_BACKDROP'),
  },
  
  // 通知
  NOTIFICATION: {
    notification: getZIndexClass('NOTIFICATION'),
    dailyCredits: getZIndexClass('DAILY_CREDITS'),
  },
  
  // 工具提示
  TOOLTIP: {
    tooltip: getZIndexClass('TOOLTIP'),
  },
} as const;

/**
 * Z-Index 使用指南
 * 
 * 1. 优先使用预定义的常量，避免硬编码数字
 * 2. 新增组件时，根据功能选择合适的层级范围
 * 3. 避免使用过高的 z-index 值（通常不超过 180）
 * 4. 页面背景使用 HERO_BACKGROUND (-10)
 * 5. 模态框和对话框使用 120-129 范围
 * 6. 导航和菜单使用 100-119 范围
 * 7. Studio 局部浮层使用 50-69 范围
 * 
 * 示例：
 * ```tsx
 * // ✅ 正确 - 使用常量
 * <div className={getZIndexClass('HERO_BACKGROUND')}>  // Hero背景
 * <div className={getZIndexClass('NAVBAR')}>           // 导航栏
 * 
 * // ❌ 错误 - 硬编码
 * <div className="-z-10">
 * <div className="z-[999]">
 * ```
 */
