// 生产环境调试脚本
// 在浏览器控制台中运行此脚本来检查状态

console.log('=== 生产环境调试 ===');

// 1. 检查音乐生成状态
const musicGenerationHook = window.musicGeneration || {};
console.log('音乐生成状态:', {
  isGenerating: musicGenerationHook.isGenerating,
  pendingTasksCount: musicGenerationHook.pendingTasksCount,
  allGeneratedTracks: musicGenerationHook.allGeneratedTracks,
  generationTimer: musicGenerationHook.generationTimer
});

// 2. 检查用户tracks
const userTracks = window.userTracks || [];
console.log('用户tracks:', userTracks.length, userTracks);

// 3. 检查最近的API调用
console.log('检查网络请求...');
fetch('/api/music-status?taskId=test')
  .then(res => res.json())
  .then(data => console.log('音乐状态API测试:', data))
  .catch(err => console.error('音乐状态API错误:', err));

// 4. 检查localStorage中的状态
console.log('LocalStorage状态:', {
  musicGeneration: localStorage.getItem('musicGeneration'),
  userTracks: localStorage.getItem('userTracks'),
  pendingTasks: localStorage.getItem('pendingTasksCount')
});

// 5. 检查React组件状态
const reactRoot = document.querySelector('#__next');
if (reactRoot) {
  console.log('React根组件存在');
} else {
  console.log('React根组件未找到');
}

console.log('=== 调试完成 ===');
