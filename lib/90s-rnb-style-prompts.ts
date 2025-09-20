/**
 * 90s R&B 风格 Prompt 生成器
 * 根据用户选择的风格自动生成专业的音乐生成 prompt
 */

export interface StyleInfo {
  id: string;
  name: string;
  era: string;
  productionElements: string[];
  restrictions: string[];
}

export const R_AND_B_STYLES: StyleInfo[] = [
  {
    id: 'new-jack-swing',
    name: 'New Jack Swing',
    era: 'early 90s New Jack Swing',
    productionElements: [
      'swing groove drum machines (TR-808, SP-1200)',
      'funky basslines',
      'bright synth stabs and horn hits',
      'call-and-response vocals, party vibe',
      'uptempo, danceable R&B with swing beat'
    ],
    restrictions: ['not trap', 'not EDM', 'not modern R&B']
  },
  {
    id: 'hip-hop-soul',
    name: 'Hip-Hop Soul',
    era: 'mid 90s hip-hop soul',
    productionElements: [
      'boom bap hip-hop drums with vinyl texture',
      'sampled loops',
      'emotional and powerful R&B vocals',
      'layered harmonies with gospel influence',
      'soulful vocals blended with hip-hop beats',
      'streetwise but soulful mood'
    ],
    restrictions: ['not trap', 'not EDM', 'not modern R&B']
  },
  {
    id: 'quiet-storm',
    name: 'Quiet Storm',
    era: '90s quiet storm ballad',
    productionElements: [
      'soft electric piano (Rhodes)',
      'warm bass and subtle percussion',
      'lush string pads',
      'intimate vocals with reverb',
      'smooth, romantic slow jam R&B',
      'slow tempo, sensual and emotional atmosphere'
    ],
    restrictions: ['not uptempo', 'not trap', 'not modern R&B']
  },
  {
    id: 'neo-soul',
    name: 'Neo-Soul',
    era: 'late 90s neo-soul',
    productionElements: [
      'live drums with human feel',
      'jazzy chord progressions',
      'vintage electric piano (Fender Rhodes, Wurlitzer)',
      'warm analog bass',
      'expressive vocal runs, laid-back groove',
      'organic and soulful groove with jazzy influence',
      'earthy and intimate atmosphere'
    ],
    restrictions: ['not trap', 'not EDM', 'not modern R&B']
  }
];

/**
 * 根据风格 ID 获取风格信息
 */
export function getStyleById(styleId: string): StyleInfo | undefined {
  return R_AND_B_STYLES.find(style => style.id === styleId);
}

/**
 * 生成 90s R&B 风格的音乐生成 prompt
 * @param styleId 风格 ID
 * @param customPrompt 用户自定义的 prompt（可选）
 * @param mood 情绪（可选）
 * @returns 完整的音乐生成 prompt
 */
export function generate90sRnBPrompt(
  styleId: string,
  customPrompt?: string,
  mood?: string
): string {
  // 简化的Basic Mode prompt生成逻辑
  // 只根据mood和用户输入的prompt生成R&B曲风的歌曲

  let prompt = 'Generate an R&B track';

  // 添加mood信息
  if (mood) {
    const moodDescriptions = {
      'joyful': 'with an upbeat, happy, celebratory vibe',
      'melancholic': 'with a melancholy, introspective, emotional feel',
      'romantic': 'with a romantic, intimate, loving atmosphere',
      'nostalgic': 'with a nostalgic, reminiscent, wistful mood',
      'mysterious': 'with a mysterious, enigmatic, sultry tone',
      'chill': 'with a relaxed, laid-back, chill vibe',
      'energetic': 'with an energetic, vibrant, dynamic feel',
      'confident': 'with a confident, empowering, strong attitude'
    };

    const moodDesc = moodDescriptions[mood as keyof typeof moodDescriptions];
    if (moodDesc) {
      prompt += ` ${moodDesc}`;
    }
  }

  // 添加用户自定义内容
  if (customPrompt && customPrompt.trim()) {
    prompt += `. ${customPrompt.trim()}`;
  }

  // 确保是R&B风格
  prompt += '. Focus on authentic R&B production and vocals.';

  return prompt;
}

/**
 * 生成简化版的风格描述（用于 UI 显示）
 * @param styleId 风格 ID
 * @returns 简化的风格描述
 */
export function getStyleDescription(styleId: string): string {
  const style = getStyleById(styleId);
  
  if (!style) {
    return 'Unknown style';
  }
  
  return `${style.era} - ${style.name}`;
}

/**
 * 获取所有可用的风格选项（用于 UI 下拉菜单）
 */
export function getStyleOptions() {
  return R_AND_B_STYLES.map(style => ({
    id: style.id,
    name: style.name,
    description: getStyleDescription(style.id)
  }));
}

/**
 * 示例用法和测试函数
 */
export function testPromptGeneration() {
  console.log('=== 90s R&B Style Prompt Generator Test ===');
  
  // 测试所有风格
  R_AND_B_STYLES.forEach(style => {
    console.log(`\n--- ${style.name} ---`);
    console.log(generate90sRnBPrompt(style.id, 'about love and heartbreak', 'melancholic'));
  });
  
  // 测试自定义 prompt
  console.log('\n--- Custom Prompt Test ---');
  console.log(generate90sRnBPrompt('new-jack-swing', 'about dancing at a club', 'energetic'));
}
