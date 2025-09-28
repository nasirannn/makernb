import { query } from '../lib/neon';

async function checkDatabaseTables() {
  try {
    console.log('🔍 Checking database tables...\n');

    // 检查所有表
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📋 Available tables:');
    tablesResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });

    // 检查是否存在 users 表
    const usersTableExists = tablesResult.rows.some(row => row.table_name === 'users');
    console.log(`\n👤 users table exists: ${usersTableExists ? '✅' : '❌'}`);

    // 检查是否存在 user_credits 表
    const userCreditsTableExists = tablesResult.rows.some(row => row.table_name === 'user_credits');
    console.log(`💰 user_credits table exists: ${userCreditsTableExists ? '✅' : '❌'}`);

    if (userCreditsTableExists) {
      // 检查 user_credits 表结构
      console.log('\n📊 user_credits table structure:');
      const structureResult = await query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'user_credits' 
        ORDER BY ordinal_position;
      `);

      structureResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
      });

      // 检查表中的数据
      const countResult = await query('SELECT COUNT(*) as count FROM user_credits');
      console.log(`\n📈 user_credits table has ${countResult.rows[0].count} records`);

      if (parseInt(countResult.rows[0].count) > 0) {
        const sampleResult = await query('SELECT * FROM user_credits LIMIT 3');
        console.log('\n📝 Sample records:');
        sampleResult.rows.forEach((row, index) => {
          console.log(`  ${index + 1}. User ID: ${row.user_id}, Credits: ${row.credits}`);
        });
      }
    }

    if (usersTableExists) {
      // 检查 users 表结构
      console.log('\n📊 users table structure:');
      const structureResult = await query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position;
      `);

      structureResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking database tables:', error);
  }
}

checkDatabaseTables();
