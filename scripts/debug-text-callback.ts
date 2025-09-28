import { query } from '../lib/neon';

async function debugTextCallback() {
  console.log('🔍 调试text回调后的数据状态...');
  
  try {
    // 查找最近的一个text状态的generation
    const recentTextGen = await query(`
      SELECT id, task_id, status, title, created_at 
      FROM music_generations 
      WHERE status = 'text' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (recentTextGen.rows.length === 0) {
      console.log('❌ 没有找到text状态的generation记录');
      return;
    }
    
    const generation = recentTextGen.rows[0];
    console.log('✅ 找到text状态的generation:', {
      id: generation.id,
      task_id: generation.task_id,
      status: generation.status,
      title: generation.title,
      created_at: generation.created_at
    });
    
    // 查询对应的music_tracks记录
    const tracksResult = await query(`
      SELECT 
        mt.id as track_id,
        mt.suno_track_id,
        mt.audio_url,
        mt.stream_audio_url,
        mt.duration,
        mt.side_letter,
        mg.title as title,
        mg.genre as genre,
        mg.tags as tags,
        (
          SELECT ci.r2_url FROM cover_images ci
          WHERE ci.music_track_id = mt.id
          ORDER BY ci.created_at ASC
          LIMIT 1
        ) as cover_r2_url,
        (
          SELECT ml.content FROM music_lyrics ml
          WHERE ml.music_generation_id = mg.id
          ORDER BY ml.created_at ASC
          LIMIT 1
        ) as lyrics_content
      FROM music_tracks mt
      INNER JOIN music_generations mg ON mt.music_generation_id = mg.id
      WHERE mg.task_id = $1
      ORDER BY mt.side_letter ASC, mt.created_at ASC
    `, [generation.task_id]);
    
    console.log(`📊 找到 ${tracksResult.rows.length} 个tracks记录:`);
    
    if (tracksResult.rows.length === 0) {
      console.log('❌ 没有找到对应的music_tracks记录！这就是问题所在！');
      
      // 检查是否有music_tracks记录但没有关联
      const allTracks = await query(`
        SELECT id, music_generation_id, side_letter, stream_audio_url, audio_url
        FROM music_tracks 
        WHERE music_generation_id = $1
      `, [generation.id]);
      
      console.log(`🔍 直接查询music_tracks表，找到 ${allTracks.rows.length} 个记录:`);
      allTracks.rows.forEach((track, index) => {
        console.log(`  Track ${index + 1}:`, {
          id: track.id,
          side_letter: track.side_letter,
          has_stream_audio: !!track.stream_audio_url,
          has_final_audio: !!track.audio_url
        });
      });
      
    } else {
      tracksResult.rows.forEach((track, index) => {
        console.log(`  Track ${index + 1} (${track.side_letter}):`, {
          track_id: track.track_id,
          title: track.title,
          has_stream_audio: !!track.stream_audio_url,
          has_final_audio: !!track.audio_url,
          has_lyrics: !!track.lyrics_content,
          has_cover: !!track.cover_r2_url
        });
      });
      
      // 模拟API返回的数据结构
      const isComplete = generation.status === 'complete';
      const tracks = tracksResult.rows.map((row: any) => ({
        id: row.track_id,
        sideLetter: row.side_letter,
        title: row.title || '',
        tags: row.tags || '',
        genre: row.genre || null,
        lyrics: row.lyrics_content || '',
        streamAudioUrl: row.stream_audio_url || '',
        audioUrl: isComplete ? (row.audio_url || '') : '',
        duration: isComplete ? (row.duration || null) : null,
        coverImage: row.cover_r2_url || null,
      }));
      
      console.log('🎵 模拟API返回的tracks数据:');
      console.log('tracks.length:', tracks.length);
      console.log('tracks[0]:', tracks[0]);
      
      // 检查前端条件
      const isTextCallbackComplete = generation.status === 'text' || generation.status === 'first' || generation.status === 'complete';
      console.log('✅ 前端条件检查:');
      console.log('  tracks.length > 0:', tracks.length > 0);
      console.log('  isTextCallbackComplete:', isTextCallbackComplete);
      console.log('  应该替换skeleton:', tracks.length > 0 && isTextCallbackComplete);
    }
    
  } catch (error) {
    console.error('❌ 调试过程中出错:', error);
  }
}

debugTextCallback().then(() => {
  console.log('🏁 调试完成');
  process.exit(0);
}).catch(console.error);
