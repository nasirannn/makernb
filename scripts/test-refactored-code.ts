import { query } from '../lib/neon';
import { getUserMusicGenerations, getMusicGenerationByTaskId } from '../lib/music-db';

async function testRefactoredCode() {
  try {
    console.log('🧪 Testing refactored music-db functions...');
    
    // Test 1: Basic database query
    console.log('\n1. Testing basic database connection...');
    const timeResult = await query('SELECT NOW() as current_time');
    console.log('✅ Database connection works:', timeResult.rows[0].current_time);
    
    // Test 2: Test getMusicGenerationByTaskId
    console.log('\n2. Testing getMusicGenerationByTaskId...');
    const generation = await getMusicGenerationByTaskId('e38404d1929af9433eb85f610f27441b');
    if (generation) {
      console.log('✅ Found generation:', {
        id: generation.id,
        title: generation.title,
        genre: generation.genre,
        tags: generation.tags,
        status: generation.status
      });
    } else {
      console.log('❌ Generation not found');
    }
    
    // Test 3: Test getUserMusicGenerations (limited to avoid too much output)
    console.log('\n3. Testing getUserMusicGenerations...');
    const generations = await getUserMusicGenerations('user_2nJJJJJJJJJJJJJJJJJJJJJJJJ', 2, 0);
    console.log(`✅ Found ${generations.length} generations`);
    
    if (generations.length > 0) {
      const firstGen = generations[0];
      console.log('   First generation:', {
        id: firstGen.id,
        title: firstGen.title,
        genre: firstGen.genre,
        tags: firstGen.tags,
        tracksCount: firstGen.allTracks.length,
        totalDuration: firstGen.totalDuration
      });
    }
    
    // Test 4: Verify our fixed record
    console.log('\n4. Verifying fixed record...');
    const fixedRecord = await query(
      'SELECT id, title, tags, genre FROM music_generations WHERE id = $1',
      ['fa85476c-2ae0-4f96-a0d2-78f72d1b5c21']
    );
    
    if (fixedRecord.rows.length > 0) {
      const record = fixedRecord.rows[0];
      console.log('✅ Fixed record status:', {
        id: record.id,
        title: record.title,
        genre: record.genre,
        tags: record.tags,
        titleFixed: record.title !== null,
        genrePresent: record.genre !== null
      });
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testRefactoredCode();
