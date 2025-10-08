/**
 * Z-Index 层级管理
 * 统一管理所有组件的 z-index 值，避免层级冲突
 * 
 * 层级规范：
 * 0-9: 背景和基础内容
 * 10-19: 内容层
 * 20-29: 卡片和面板
 * 30-39: 下拉菜单和工具提示
 * 40-49: 侧边栏和导航
 * 50-59: 模态框和对话框
 * 60-69: 音乐播放器
 * 70-79: 通知和提示
 * 80-89: 特殊交互
 * 90-99: 开发工具
 * 100+: 最高优先级（AuthModal等）
 */

export const Z_INDEX = {
  // 背景和基础内容 (0-9)
  BACKGROUND: 0,
  ANIMATED_BACKGROUND: 0,
  BASE_CONTENT: 1,

  // 内容层 (10-19)
  MAIN_CONTENT: 10,
  MUSIC_PLAYER_CONTROLS: 10,
  LOADING_OVERLAY: 10,
  TRACK_OVERLAY: 10,

  // 卡片和面板 (20-29)
  CARD: 20,
  PANEL: 25,

  // 下拉菜单和工具提示 (30-39)
  DROPDOWN: 30,
  TOOLTIP: 35,
  SELECT: 30,

  // 侧边栏和导航 (40-49)
  SIDEBAR: 40,
  SIDEBAR_DROPDOWN: 40,
  NAVBAR: 50,
  MOBILE_NAV: 50,

  // 模态框和对话框 (50-59)
  MODAL_BACKDROP: 50,
  MODAL_CONTENT: 50,
  DIALOG_BACKDROP: 50,
  DIALOG_CONTENT: 50,
  CONFIRM_DIALOG: 50,

  // 音乐播放器 (60-69)
  MUSIC_PLAYER: 60,
  LYRICS_PANEL: 55,
  LYRICS_BACKDROP: 50,

  // 通知和提示 (70-79)
  NOTIFICATION: 70,
  DAILY_CREDITS: 50,

  // 特殊交互 (80-89)
  STUDIO_CREATE_MODAL: 50,
  STUDIO_PANEL_TOOLTIP: 50,

  // 开发工具 (90-99)
  DEBUG: 90,
  DEV_TOOLS: 100,

  // 最高优先级 (100+)
  AUTH_MODAL_BACKDROP: 110,
  AUTH_MODAL_CONTENT: 111,

  // 最高层级 (99999+)
  EMERGENCY: 999999,
} as const;

/**
 * 获取 z-index 的 CSS 类名
 */
export const getZIndexClass = (level: keyof typeof Z_INDEX): string => {
  const value = Z_INDEX[level];
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
 * 3. 避免使用过高的 z-index 值（> 200）
 * 4. 模态框和对话框使用 50-59 范围
 * 5. 认证相关使用 100+ 范围
 * 6. 音乐播放器使用 60-69 范围
 * 
 * 示例：
 * ```tsx
 * // ✅ 正确
 * <div className={getZIndexClass('AUTH_MODAL_BACKDROP')}>
 * 
 * // ❌ 错误
 * <div className="z-[999]">
 * ```
 */
