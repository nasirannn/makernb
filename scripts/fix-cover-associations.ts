import { query } from '../lib/db-query-builder';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

interface UnlinkedCover {
  coverId: string;
  coverR2Url: string;
  coverGenerationId: string;
  musicTaskId: string;
  createdAt: string;
}

interface MusicTrack {
  trackId: string;
  sideLetter: string;
  musicGenerationId: string;
}

async function fixCoverAssociations(): Promise<void> {
  console.log('=== 修复封面图关联问题 ===\n');

  try {
    // 1. 查找所有未关联的封面图
    const unlinkedCoversQuery = await query(`
      SELECT 
        ci.id as cover_id,
        ci.r2_url as cover_r2_url,
        ci.cover_generation_id,
        cg.music_task_id,
        ci.created_at
      FROM cover_images ci
      JOIN cover_generations cg ON ci.cover_generation_id = cg.id
      WHERE ci.music_track_id IS NULL
      ORDER BY ci.created_at DESC
    `);

    const unlinkedCovers: UnlinkedCover[] = unlinkedCoversQuery.rows.map(row => ({
      coverId: row.cover_id,
      coverR2Url: row.cover_r2_url,
      coverGenerationId: row.cover_generation_id,
      musicTaskId: row.music_task_id,
      createdAt: row.created_at
    }));

    console.log(`找到 ${unlinkedCovers.length} 个未关联的封面图\n`);

    // 2. 为每个未关联的封面图尝试关联
    for (const cover of unlinkedCovers) {
      console.log(`处理封面图: ${cover.coverId}`);
      console.log(`音乐任务ID: ${cover.musicTaskId}`);

      // 查找对应的音乐轨道
      const tracksQuery = await query(`
        SELECT 
          mt.id as track_id,
          mt.side_letter,
          mt.music_generation_id
        FROM music_tracks mt
        JOIN music_generations mg ON mt.music_generation_id = mg.id
        WHERE mg.task_id = $1
        ORDER BY mt.side_letter ASC, mt.created_at ASC
      `, [cover.musicTaskId]);

      const tracks: MusicTrack[] = tracksQuery.rows.map(row => ({
        trackId: row.track_id,
        sideLetter: row.side_letter,
        musicGenerationId: row.music_generation_id
      }));

      if (tracks.length === 0) {
        console.log(`  ❌ 未找到对应的音乐轨道\n`);
        continue;
      }

      console.log(`  找到 ${tracks.length} 个音乐轨道`);

      // 选择第一个轨道进行关联（通常是A面）
      const targetTrack = tracks[0];
      console.log(`  关联到轨道: ${targetTrack.trackId} (${targetTrack.sideLetter}面)`);

      // 更新封面图关联
      const updateResult = await query(
        'UPDATE cover_images SET music_track_id = $1 WHERE id = $2',
        [targetTrack.trackId, cover.coverId]
      );

      if (updateResult.rowCount && updateResult.rowCount > 0) {
        console.log(`  ✅ 成功关联封面图到轨道 ${targetTrack.trackId}\n`);
      } else {
        console.log(`  ❌ 关联失败\n`);
      }
    }

    // 3. 验证修复结果
    console.log('=== 验证修复结果 ===');
    const verificationQuery = await query(`
      SELECT 
        ci.id as cover_id,
        ci.r2_url as cover_r2_url,
        ci.music_track_id,
        mt.side_letter,
        mg.task_id as music_task_id
      FROM cover_images ci
      LEFT JOIN music_tracks mt ON ci.music_track_id = mt.id
      LEFT JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE ci.id IN (${unlinkedCovers.map((_, i) => `$${i + 1}`).join(', ')})
    `, unlinkedCovers.map(cover => cover.coverId));

    console.log('修复后的关联情况:');
    verificationQuery.rows.forEach(row => {
      console.log(`  - ${row.cover_id}: ${row.music_track_id ? `已关联到轨道 ${row.music_track_id} (${row.side_letter}面)` : '未关联'}`);
      console.log(`    音乐任务: ${row.music_task_id}`);
      console.log(`    R2 URL: ${row.cover_r2_url}\n`);
    });

    // 4. 检查特定封面图的修复情况
    const specificCoverId = '891af910-6cf4-47c8-8215-07410c8f5494';
    const specificCoverQuery = await query(`
      SELECT 
        ci.id as cover_id,
        ci.r2_url as cover_r2_url,
        ci.music_track_id,
        mt.side_letter,
        mg.task_id as music_task_id,
        mg.title as music_title
      FROM cover_images ci
      LEFT JOIN music_tracks mt ON ci.music_track_id = mt.id
      LEFT JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE ci.id = $1
    `, [specificCoverId]);

    if (specificCoverQuery.rows.length > 0) {
      const cover = specificCoverQuery.rows[0];
      console.log('=== 特定封面图修复情况 ===');
      console.log(`封面图ID: ${cover.cover_id}`);
      console.log(`关联状态: ${cover.music_track_id ? `已关联到轨道 ${cover.music_track_id}` : '未关联'}`);
      console.log(`轨道面: ${cover.side_letter || 'N/A'}`);
      console.log(`音乐任务ID: ${cover.music_task_id || 'N/A'}`);
      console.log(`音乐标题: ${cover.music_title || 'N/A'}`);
      console.log(`R2 URL: ${cover.cover_r2_url}\n`);
    }

  } catch (error) {
    console.error('修复封面图关联时出错:', error);
  }
}

// 运行修复
if (require.main === module) {
  fixCoverAssociations()
    .then(() => {
      console.log('封面图关联修复完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('修复失败:', error);
      process.exit(1);
    });
}

export { fixCoverAssociations };

