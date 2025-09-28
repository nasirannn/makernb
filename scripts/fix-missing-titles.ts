import { fixMissingTitlesFromLyrics } from '../lib/music-db';

async function main() {
  try {
    console.log('🔧 Running fix for missing titles...');
    const result = await fixMissingTitlesFromLyrics();
    console.log('✅ Fix completed:', result);
    
    if (result.updated > 0) {
      console.log(`✨ Successfully updated ${result.updated} records`);
    }
    
    if (result.errors.length > 0) {
      console.log('❌ Errors encountered:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
  } catch (error) {
    console.error('💥 Error running fix:', error);
    process.exit(1);
  }
}

main();
