import { query } from '../lib/db-query-builder';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

interface CoverAssociation {
  coverId: string;
  coverR2Url: string;
  musicTrackId: string | null;
  musicGenerationId: string | null;
  musicTaskId: string | null;
  trackSideLetter: string | null;
  createdAt: string;
}

interface UnlinkedCover {
  coverId: string;
  coverR2Url: string;
  coverGenerationId: string;
  musicTaskId: string | null;
  createdAt: string;
}

async function checkCoverAssociations(): Promise<void> {
  console.log('=== 封面图关联检查 ===\n');

  try {
    // 1. 检查所有封面图的关联情况
    const allCoversQuery = await query(`
      SELECT 
        ci.id as cover_id,
        ci.r2_url as cover_r2_url,
        ci.music_track_id,
        ci.cover_generation_id,
        cg.music_task_id,
        mt.side_letter,
        ci.created_at
      FROM cover_images ci
      LEFT JOIN cover_generations cg ON ci.cover_generation_id = cg.id
      LEFT JOIN music_tracks mt ON ci.music_track_id = mt.id
      ORDER BY ci.created_at DESC
    `);

    const allCovers: CoverAssociation[] = allCoversQuery.rows.map(row => ({
      coverId: row.cover_id,
      coverR2Url: row.cover_r2_url,
      musicTrackId: row.music_track_id,
      musicGenerationId: null, // 稍后填充
      musicTaskId: row.music_task_id,
      trackSideLetter: row.side_letter,
      createdAt: row.created_at
    }));

    console.log(`总共找到 ${allCovers.length} 个封面图记录\n`);

    // 2. 检查未关联的封面图
    const unlinkedCovers: UnlinkedCover[] = allCovers
      .filter(cover => !cover.musicTrackId)
      .map(cover => ({
        coverId: cover.coverId,
        coverR2Url: cover.coverR2Url,
        coverGenerationId: '', // 需要查询
        musicTaskId: cover.musicTaskId,
        createdAt: cover.createdAt
      }));

    console.log(`未关联的封面图: ${unlinkedCovers.length} 个`);
    unlinkedCovers.forEach(cover => {
      console.log(`  - ${cover.coverId}: ${cover.coverR2Url}`);
      console.log(`    音乐任务ID: ${cover.musicTaskId}`);
      console.log(`    创建时间: ${cover.createdAt}\n`);
    });

    // 3. 检查特定图片的关联情况
    const specificCoverId = '891af910-6cf4-47c8-8215-07410c8f5494';
    const specificMusicTaskId = '0e377f87-110b-4005-8f79-5572213b6c8e';

    console.log(`=== 检查特定图片 ${specificCoverId} ===`);
    const specificCoverQuery = await query(`
      SELECT 
        ci.id as cover_id,
        ci.r2_url as cover_r2_url,
        ci.music_track_id,
        ci.cover_generation_id,
        cg.music_task_id,
        mt.side_letter,
        mt.id as track_id,
        mg.task_id as music_task_id_from_track,
        ci.created_at
      FROM cover_images ci
      LEFT JOIN cover_generations cg ON ci.cover_generation_id = cg.id
      LEFT JOIN music_tracks mt ON ci.music_track_id = mt.id
      LEFT JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE ci.id = $1
    `, [specificCoverId]);

    if (specificCoverQuery.rows.length > 0) {
      const cover = specificCoverQuery.rows[0];
      console.log(`封面图ID: ${cover.cover_id}`);
      console.log(`R2 URL: ${cover.cover_r2_url}`);
      console.log(`关联的音乐轨道ID: ${cover.music_track_id || '未关联'}`);
      console.log(`封面生成ID: ${cover.cover_generation_id}`);
      console.log(`音乐任务ID (从封面生成): ${cover.music_task_id}`);
      console.log(`轨道面: ${cover.side_letter || 'N/A'}`);
      console.log(`轨道ID: ${cover.track_id || 'N/A'}`);
      console.log(`音乐任务ID (从轨道): ${cover.music_task_id_from_track || 'N/A'}`);
      console.log(`创建时间: ${cover.created_at}\n`);
    } else {
      console.log(`未找到封面图 ${specificCoverId}\n`);
    }

    // 4. 检查特定音乐任务的轨道和封面
    console.log(`=== 检查音乐任务 ${specificMusicTaskId} ===`);
    const musicTaskQuery = await query(`
      SELECT 
        mg.id as generation_id,
        mg.task_id,
        mg.status,
        mg.title,
        mt.id as track_id,
        mt.side_letter,
        ci.id as cover_id,
        ci.r2_url as cover_r2_url,
        ci.music_track_id as cover_linked_to_track
      FROM music_generations mg
      LEFT JOIN music_tracks mt ON mg.id = mt.music_generation_id
      LEFT JOIN cover_images ci ON ci.music_track_id = mt.id
      WHERE mg.task_id = $1
      ORDER BY mt.side_letter ASC
    `, [specificMusicTaskId]);

    if (musicTaskQuery.rows.length > 0) {
      console.log(`音乐生成状态: ${musicTaskQuery.rows[0].status}`);
      console.log(`音乐标题: ${musicTaskQuery.rows[0].title}`);
      console.log(`轨道数量: ${musicTaskQuery.rows.length}\n`);

      musicTaskQuery.rows.forEach((row, index) => {
        console.log(`轨道 ${index + 1}:`);
        console.log(`  - 轨道ID: ${row.track_id}`);
        console.log(`  - 面: ${row.side_letter}`);
        console.log(`  - 关联的封面ID: ${row.cover_id || '无'}`);
        console.log(`  - 封面R2 URL: ${row.cover_r2_url || '无'}`);
        console.log(`  - 封面是否关联到此轨道: ${row.cover_linked_to_track === row.track_id ? '是' : '否'}\n`);
      });
    } else {
      console.log(`未找到音乐任务 ${specificMusicTaskId}\n`);
    }

    // 5. 检查可能的关联问题
    console.log('=== 关联问题分析 ===');
    
    // 检查是否有封面图但没有关联到轨道
    const orphanedCoversQuery = await query(`
      SELECT 
        ci.id as cover_id,
        ci.r2_url as cover_r2_url,
        cg.music_task_id,
        ci.created_at
      FROM cover_images ci
      JOIN cover_generations cg ON ci.cover_generation_id = cg.id
      WHERE ci.music_track_id IS NULL
      ORDER BY ci.created_at DESC
    `);

    console.log(`孤立的封面图 (有音乐任务但未关联到轨道): ${orphanedCoversQuery.rows.length} 个`);
    orphanedCoversQuery.rows.forEach(row => {
      console.log(`  - ${row.cover_id}: ${row.cover_r2_url}`);
      console.log(`    音乐任务: ${row.music_task_id}`);
      console.log(`    创建时间: ${row.created_at}\n`);
    });

  } catch (error) {
    console.error('检查封面图关联时出错:', error);
  }
}

// 运行检查
if (require.main === module) {
  checkCoverAssociations()
    .then(() => {
      console.log('封面图关联检查完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('检查失败:', error);
      process.exit(1);
    });
}

export { checkCoverAssociations };
