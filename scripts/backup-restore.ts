#!/usr/bin/env npx tsx

/**
 * 数据备份和恢复脚本
 *
 * 此脚本提供：
 * 1. 备份逻辑删除的数据到JSON文件
 * 2. 从备份文件恢复数据
 * 3. 验证备份文件的完整性
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';

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

interface BackupData {
  metadata: {
    timestamp: string;
    version: string;
    description: string;
    counts: {
      tracks: number;
      generations: number;
      covers: number;
      lyrics: number;
    };
  };
  tracks: any[];
  generations: any[];
  covers: any[];
  lyrics: any[];
}

/**
 * 创建完整的数据备份
 */
async function createBackup(): Promise<string> {
  console.log('📦 创建数据备份...');

  // 1. 备份逻辑删除的音轨
  console.log('  📀 备份音轨数据...');
  const tracksResult = await dbQuery(`
    SELECT *
    FROM music_tracks
    WHERE is_deleted = TRUE
    ORDER BY created_at
  `);

  // 2. 备份相关的生成记录
  console.log('  🎵 备份生成记录...');
  const generationsResult = await dbQuery(`
    SELECT DISTINCT mg.*
    FROM music_generations mg
    INNER JOIN music_tracks mt ON mg.id = mt.music_generation_id
    WHERE mt.is_deleted = TRUE
    ORDER BY mg.created_at
  `);

  // 3. 备份相关的封面图片
  console.log('  🖼️  备份封面数据...');
  const coversResult = await dbQuery(`
    SELECT ci.*
    FROM cover_images ci
    LEFT JOIN music_tracks mt ON ci.music_track_id = mt.id
    WHERE ci.music_track_id IS NULL OR mt.is_deleted = TRUE
    ORDER BY ci.created_at
  `);

  // 4. 备份相关的歌词
  console.log('  📝 备份歌词数据...');
  const lyricsResult = await dbQuery(`
    SELECT ml.*
    FROM music_lyrics ml
    INNER JOIN music_generations mg ON ml.music_generation_id = mg.id
    INNER JOIN music_tracks mt ON mt.music_generation_id = mg.id
    WHERE mt.is_deleted = TRUE
    ORDER BY ml.created_at
  `);

  // 创建备份数据结构
  const backupData: BackupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      description: 'Backup of logically deleted music data before physical deletion',
      counts: {
        tracks: tracksResult.rowCount || 0,
        generations: generationsResult.rowCount || 0,
        covers: coversResult.rowCount || 0,
        lyrics: lyricsResult.rowCount || 0,
      }
    },
    tracks: tracksResult.rows,
    generations: generationsResult.rows,
    covers: coversResult.rows,
    lyrics: lyricsResult.rows
  };

  // 保存到文件
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-before-deletion-${timestamp}.json`;
  const filepath = path.join(__dirname, '../backups', filename);

  // 确保backups目录存在
  await fs.mkdir(path.dirname(filepath), { recursive: true });

  await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));

  console.log('📊 备份统计:');
  console.log(`  📀 音轨: ${backupData.metadata.counts.tracks} 个`);
  console.log(`  🎵 生成: ${backupData.metadata.counts.generations} 个`);
  console.log(`  🖼️  封面: ${backupData.metadata.counts.covers} 个`);
  console.log(`  📝 歌词: ${backupData.metadata.counts.lyrics} 个`);
  console.log(`💾 备份已保存到: ${filepath}`);

  return filepath;
}

/**
 * 从备份文件恢复数据
 */
async function restoreFromBackup(backupFile: string): Promise<void> {
  console.log(`🔄 从备份文件恢复数据: ${backupFile}`);

  // 读取备份文件
  const backupContent = await fs.readFile(backupFile, 'utf-8');
  const backupData: BackupData = JSON.parse(backupContent);

  console.log('📋 备份信息:');
  console.log(`  时间: ${backupData.metadata.timestamp}`);
  console.log(`  版本: ${backupData.metadata.version}`);
  console.log(`  描述: ${backupData.metadata.description}`);

  // 开始事务
  await dbQuery('BEGIN');

  try {
    let restoredCounts = {
      tracks: 0,
      generations: 0,
      covers: 0,
      lyrics: 0
    };

    // 1. 恢复生成记录
    console.log('🎵 恢复生成记录...');
    for (const generation of backupData.generations) {
      const { id, ...data } = generation;
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 2}`);

      await dbQuery(`
        INSERT INTO music_generations (id, ${columns.join(', ')})
        VALUES ($1, ${placeholders.join(', ')})
        ON CONFLICT (id) DO NOTHING
      `, [id, ...values]);

      restoredCounts.generations++;
    }

    // 2. 恢复音轨记录
    console.log('📀 恢复音轨记录...');
    for (const track of backupData.tracks) {
      const { id, ...data } = track;
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 2}`);

      await dbQuery(`
        INSERT INTO music_tracks (id, ${columns.join(', ')})
        VALUES ($1, ${placeholders.join(', ')})
        ON CONFLICT (id) DO NOTHING
      `, [id, ...values]);

      restoredCounts.tracks++;
    }

    // 3. 恢复封面记录
    console.log('🖼️  恢复封面记录...');
    for (const cover of backupData.covers) {
      const { id, ...data } = cover;
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 2}`);

      await dbQuery(`
        INSERT INTO cover_images (id, ${columns.join(', ')})
        VALUES ($1, ${placeholders.join(', ')})
        ON CONFLICT (id) DO NOTHING
      `, [id, ...values]);

      restoredCounts.covers++;
    }

    // 4. 恢复歌词记录
    console.log('📝 恢复歌词记录...');
    for (const lyrics of backupData.lyrics) {
      const { id, ...data } = lyrics;
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 2}`);

      await dbQuery(`
        INSERT INTO music_lyrics (id, ${columns.join(', ')})
        VALUES ($1, ${placeholders.join(', ')})
        ON CONFLICT (id) DO NOTHING
      `, [id, ...values]);

      restoredCounts.lyrics++;
    }

    // 提交事务
    await dbQuery('COMMIT');

    console.log('✅ 数据恢复完成!');
    console.log('📊 恢复统计:');
    console.log(`  📀 音轨: ${restoredCounts.tracks} 个`);
    console.log(`  🎵 生成: ${restoredCounts.generations} 个`);
    console.log(`  🖼️  封面: ${restoredCounts.covers} 个`);
    console.log(`  📝 歌词: ${restoredCounts.lyrics} 个`);

  } catch (error) {
    // 回滚事务
    await dbQuery('ROLLBACK');
    console.error('❌ 数据恢复失败，已回滚:', error);
    throw error;
  }
}

/**
 * 验证备份文件的完整性
 */
async function validateBackup(backupFile: string): Promise<void> {
  console.log(`🔍 验证备份文件: ${backupFile}`);

  try {
    const backupContent = await fs.readFile(backupFile, 'utf-8');
    const backupData: BackupData = JSON.parse(backupContent);

    // 验证文件结构
    const requiredFields = ['metadata', 'tracks', 'generations', 'covers', 'lyrics'];
    for (const field of requiredFields) {
      if (!(field in backupData)) {
        throw new Error(`备份文件缺少必需字段: ${field}`);
      }
    }

    // 验证元数据
    if (!backupData.metadata.timestamp || !backupData.metadata.version) {
      throw new Error('备份文件元数据不完整');
    }

    // 验证数据数量
    const actualCounts = {
      tracks: backupData.tracks.length,
      generations: backupData.generations.length,
      covers: backupData.covers.length,
      lyrics: backupData.lyrics.length
    };

    console.log('✅ 备份文件验证通过');
    console.log('📊 文件内容:');
    console.log(`  时间: ${backupData.metadata.timestamp}`);
    console.log(`  版本: ${backupData.metadata.version}`);
    console.log(`  📀 音轨: ${actualCounts.tracks} 个`);
    console.log(`  🎵 生成: ${actualCounts.generations} 个`);
    console.log(`  🖼️  封面: ${actualCounts.covers} 个`);
    console.log(`  📝 歌词: ${actualCounts.lyrics} 个`);

    // 检查数据完整性
    if (actualCounts.tracks !== backupData.metadata.counts.tracks) {
      console.warn(`⚠️  音轨数量不匹配: 预期 ${backupData.metadata.counts.tracks}, 实际 ${actualCounts.tracks}`);
    }

  } catch (error) {
    console.error('❌ 备份文件验证失败:', error);
    throw error;
  }
}

/**
 * 列出所有备份文件
 */
async function listBackups(): Promise<void> {
  console.log('📁 列出所有备份文件...');

  const backupsDir = path.join(__dirname, '../backups');

  try {
    const files = await fs.readdir(backupsDir);
    const backupFiles = files.filter(f => f.endsWith('.json') && f.includes('backup'));

    if (backupFiles.length === 0) {
      console.log('📂 没有找到备份文件');
      return;
    }

    console.log(`📊 找到 ${backupFiles.length} 个备份文件:`);

    for (const file of backupFiles.sort().reverse()) {
      const filepath = path.join(backupsDir, file);
      const stats = await fs.stat(filepath);
      const size = (stats.size / 1024 / 1024).toFixed(2);

      console.log(`  📄 ${file} (${size} MB, ${stats.mtime.toLocaleString()})`);
    }

  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      console.log('📂 备份目录不存在');
    } else {
      throw error;
    }
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];

    // 连接数据库（除了list命令）
    if (command !== 'list') {
      console.log('🔌 连接数据库...');
      await dbClient.connect();
      console.log('✅ 数据库连接成功\n');
    }

    switch (command) {
      case 'create':
      case 'backup':
        await createBackup();
        break;

      case 'restore':
        const backupFile = args[1];
        if (!backupFile) {
          console.error('❌ 请指定备份文件路径');
          console.log('用法: npm run backup restore <backup-file>');
          process.exit(1);
        }
        await restoreFromBackup(backupFile);
        break;

      case 'validate':
        const validateFile = args[1];
        if (!validateFile) {
          console.error('❌ 请指定备份文件路径');
          console.log('用法: npm run backup validate <backup-file>');
          process.exit(1);
        }
        await validateBackup(validateFile);
        break;

      case 'list':
        await listBackups();
        break;

      default:
        console.log('📋 备份和恢复工具');
        console.log('');
        console.log('用法:');
        console.log('  npm run backup create     - 创建备份');
        console.log('  npm run backup restore <file> - 从备份恢复');
        console.log('  npm run backup validate <file> - 验证备份文件');
        console.log('  npm run backup list       - 列出所有备份');
        console.log('');
        console.log('示例:');
        console.log('  npm run backup create');
        console.log('  npm run backup restore backups/backup-before-deletion-2024-01-01.json');
        break;
    }

  } catch (error) {
    console.error('❌ 操作失败:', error);
    process.exit(1);
  } finally {
    // 断开数据库连接
    try {
      await dbClient.end();
    } catch (error) {
      // 忽略断开连接的错误
    }
  }
}

// 运行主函数
if (require.main === module) {
  main();
}