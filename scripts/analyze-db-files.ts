#!/usr/bin/env npx tsx

/**
 * 数据库文件分析脚本
 * 
 * 此脚本会：
 * 1. 扫描数据库中所有有效的音频和封面文件引用
 * 2. 显示详细的统计信息
 * 3. 不访问R2存储，只分析数据库
 */

// 加载环境变量
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载.env.local文件
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { Client } from 'pg';

// 创建数据库客户端
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 简化的查询函数
async function dbQuery(text: string, params?: any[]) {
  try {
    const result = await dbClient.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * 从R2 URL中提取key
 */
function extractR2KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // 移除开头的斜杠
    return urlObj.pathname.substring(1);
  } catch (error) {
    console.warn(`⚠️  无法解析URL: ${url}`);
    return null;
  }
}

/**
 * 获取数据库中所有有效的文件引用
 */
async function analyzeValidFileReferences(): Promise<void> {
  console.log('🔍 分析数据库中的有效文件引用...\n');
  
  // 1. 获取所有有效的音频文件 (music_tracks表中未删除的记录)
  console.log('📀 音频文件分析:');
  const audioResult = await dbQuery(`
    SELECT 
      mt.audio_url,
      mt.id as track_id,
      mt.side_letter,
      mg.task_id,
      mg.user_id,
      mg.title,
      mg.status,
      mg.created_at,
      (mt.is_deleted IS NOT NULL AND mt.is_deleted = TRUE) as track_deleted,
      (mg.is_deleted IS NOT NULL AND mg.is_deleted = TRUE) as generation_deleted
    FROM music_tracks mt
    INNER JOIN music_generations mg ON mt.music_generation_id = mg.id
    WHERE mt.audio_url IS NOT NULL 
    ORDER BY mg.created_at DESC
  `);
  
  let validAudioCount = 0;
  let deletedAudioCount = 0;
  const audioByUser: { [key: string]: number } = {};
  
  console.log(`  总音频记录: ${audioResult.rows.length}`);
  
  for (const row of audioResult.rows) {
    const isDeleted = row.track_deleted || row.generation_deleted;
    
    if (isDeleted) {
      deletedAudioCount++;
      console.log(`    ❌ 已删除: ${row.title || 'Untitled'} (${row.side_letter}) - ${row.track_id}`);
    } else {
      validAudioCount++;
      audioByUser[row.user_id] = (audioByUser[row.user_id] || 0) + 1;
      
      const key = extractR2KeyFromUrl(row.audio_url);
      console.log(`    ✅ 有效: ${row.title || 'Untitled'} (${row.side_letter}) - ${key}`);
    }
  }
  
  console.log(`  📊 统计:`);
  console.log(`    ✅ 有效音频: ${validAudioCount} 个`);
  console.log(`    ❌ 已删除音频: ${deletedAudioCount} 个`);
  console.log(`    👥 用户分布:`);
  Object.entries(audioByUser).forEach(([userId, count]) => {
    console.log(`      ${userId}: ${count} 个音频文件`);
  });
  
  console.log('\n🖼️  封面图片分析:');
  
  // 2. 获取所有有效的封面图片 (cover_images表)
  const coverResult = await dbQuery(`
    SELECT 
      ci.r2_url,
      ci.id as cover_id,
      ci.music_track_id,
      mt.id as track_id,
      mg.title,
      mg.user_id,
      mg.created_at,
      (mt.is_deleted IS NOT NULL AND mt.is_deleted = TRUE) as track_deleted,
      (mg.is_deleted IS NOT NULL AND mg.is_deleted = TRUE) as generation_deleted
    FROM cover_images ci
    LEFT JOIN music_tracks mt ON ci.music_track_id = mt.id
    LEFT JOIN music_generations mg ON mt.music_generation_id = mg.id
    WHERE ci.r2_url IS NOT NULL
    ORDER BY ci.created_at DESC
  `);
  
  let validCoverCount = 0;
  let deletedCoverCount = 0;
  let orphanCoverCount = 0;
  const coverByUser: { [key: string]: number } = {};
  
  console.log(`  总封面记录: ${coverResult.rows.length}`);
  
  for (const row of coverResult.rows) {
    const key = extractR2KeyFromUrl(row.r2_url);
    
    if (!row.track_id) {
      // 没有关联track的封面（可能是待关联的）
      orphanCoverCount++;
      console.log(`    🔗 未关联: ${key} (cover: ${row.cover_id})`);
    } else {
      const isDeleted = row.track_deleted || row.generation_deleted;
      
      if (isDeleted) {
        deletedCoverCount++;
        console.log(`    ❌ 已删除: ${row.title || 'Untitled'} - ${key}`);
      } else {
        validCoverCount++;
        coverByUser[row.user_id] = (coverByUser[row.user_id] || 0) + 1;
        console.log(`    ✅ 有效: ${row.title || 'Untitled'} - ${key}`);
      }
    }
  }
  
  console.log(`  📊 统计:`);
  console.log(`    ✅ 有效封面: ${validCoverCount} 个`);
  console.log(`    ❌ 已删除封面: ${deletedCoverCount} 个`);
  console.log(`    🔗 未关联封面: ${orphanCoverCount} 个`);
  console.log(`    👥 用户分布:`);
  Object.entries(coverByUser).forEach(([userId, count]) => {
    console.log(`      ${userId}: ${count} 个封面文件`);
  });
  
  console.log('\n📊 总体统计:');
  console.log(`  ✅ 应保留的文件: ${validAudioCount + validCoverCount + orphanCoverCount} 个`);
  console.log(`    📀 音频文件: ${validAudioCount} 个`);
  console.log(`    🖼️  封面文件: ${validCoverCount + orphanCoverCount} 个`);
  console.log(`  ❌ 可删除的文件: ${deletedAudioCount + deletedCoverCount} 个`);
  console.log(`    📀 音频文件: ${deletedAudioCount} 个`);
  console.log(`    🖼️  封面文件: ${deletedCoverCount} 个`);
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始数据库文件分析...\n');
    
    // 连接数据库
    console.log('🔌 连接数据库...');
    await dbClient.connect();
    console.log('✅ 数据库连接成功\n');
    
    // 分析数据库中的文件引用
    await analyzeValidFileReferences();
    
    console.log('\n✅ 数据库文件分析完成!');
    console.log('\n💡 下一步:');
    console.log('  1. 检查R2存储配置');
    console.log('  2. 运行完整的清理脚本: npm run cleanup-r2');
    console.log('  3. 实际删除无用文件: npm run cleanup-r2:delete');
    
  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error);
    process.exit(1);
  } finally {
    // 断开数据库连接
    try {
      await dbClient.end();
      console.log('\n🔌 数据库连接已断开');
    } catch (error) {
      console.error('⚠️  断开数据库连接时出错:', error);
    }
  }
}

// 运行主函数
if (require.main === module) {
  main();
}
