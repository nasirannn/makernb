/**
 * Z-Index 层级管理
 * 统一管理所有组件的 z-index 值，避免层级冲突
 */

export const Z_INDEX = {
  // 基础层级 (0-10)
  BACKGROUND: 0,
  BASE_CONTENT: 1,
  MAIN_CONTENT: 10,

  // 组件层级 (20-50)
  CARD: 20,
  PANEL: 30,
  MODAL_BACKDROP: 30,
  DROPDOWN: 40,
  SIDEBAR: 50,

  // 交互层级 (60-80)
  HOVER: 60,
  TOAST: 70,
  NOTIFICATION: 70,
  MODAL_CONTENT: 80,

  // 工具层级 (90-100)
  DEBUG: 90,
  DEV_TOOLS: 100,

  // 最高层级 (99999+)
  TOOLTIP: 99999,
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
  // 模态框
  MODAL: {
    backdrop: getZIndexClass('MODAL_BACKDROP'),
    content: getZIndexClass('MODAL_CONTENT'),
  },
  
  // 下拉菜单
  DROPDOWN: {
    menu: getZIndexClass('DROPDOWN'),
  },
  
  // 侧边栏
  SIDEBAR: {
    container: getZIndexClass('SIDEBAR'),
    tooltip: getZIndexClass('TOOLTIP'),
  },
  
  // 通知
  NOTIFICATION: {
    toast: getZIndexClass('TOAST'),
    notification: getZIndexClass('NOTIFICATION'),
  },
  
  // 工具提示
  TOOLTIP: {
    tooltip: getZIndexClass('TOOLTIP'),
  },
} as const;
