#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { query, testConnection, pool } from '../lib/neon';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...\n');

  // 检查环境变量
  console.log('Environment check:');
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`Host: ${url.hostname}`);
    console.log(`Port: ${url.port || 5432}`);
    console.log(`Database: ${url.pathname.slice(1)}`);
  }
  console.log('');

  try {
    // 1. 基本连接测试
    console.log('1. Testing basic connection...');
    const start = Date.now();
    const isConnected = await testConnection();
    const duration = Date.now() - start;
    
    if (isConnected) {
      console.log(`✅ Basic connection successful (${duration}ms)\n`);
    } else {
      console.log(`❌ Basic connection failed (${duration}ms)\n`);
      return;
    }

    // 2. 测试user_credits表
    console.log('2. Testing user_credits table...');
    try {
      const userCreditsTest = await query('SELECT COUNT(*) FROM user_credits');
      console.log(`✅ user_credits table exists with ${userCreditsTest.rows[0].count} records\n`);
    } catch (error) {
      console.log(`❌ user_credits table test failed:`, error instanceof Error ? error.message : String(error));
      console.log('');
    }

    // 3. 测试其他重要表
    const tables = [
      'music_generations',
      'tracks',
      'credit_transactions',
      'generation_errors'
    ];

    console.log('3. Testing other tables...');
    for (const table of tables) {
      try {
        const result = await query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`✅ ${table}: ${result.rows[0].count} records`);
      } catch (error) {
        console.log(`❌ ${table}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log('');

    // 4. 测试连接池状态
    console.log('4. Connection pool status:');
    console.log(`   Total connections: ${pool.totalCount}`);
    console.log(`   Idle connections: ${pool.idleCount}`);
    console.log(`   Waiting clients: ${pool.waitingCount}`);
    console.log('');

    // 5. 测试多个并发查询
    console.log('5. Testing concurrent queries...');
    const concurrentStart = Date.now();
    const promises = Array.from({ length: 5 }, (_, i) => 
      query('SELECT NOW() as current_time, $1 as query_id', [i + 1])
    );
    
    try {
      const results = await Promise.all(promises);
      const concurrentDuration = Date.now() - concurrentStart;
      console.log(`✅ All 5 concurrent queries completed successfully (${concurrentDuration}ms)`);
      results.forEach((result, i) => {
        console.log(`   Query ${i + 1}: ${result.rows[0].current_time}`);
      });
    } catch (error) {
      console.log(`❌ Concurrent queries failed:`, error instanceof Error ? error.message : String(error));
    }
    console.log('');

    // 6. 测试长时间查询
    console.log('6. Testing long-running query...');
    try {
      const longQueryStart = Date.now();
      await query('SELECT pg_sleep(2)'); // 2秒延迟
      const longQueryDuration = Date.now() - longQueryStart;
      console.log(`✅ Long query completed (${longQueryDuration}ms)\n`);
    } catch (error) {
      console.log(`❌ Long query failed:`, error instanceof Error ? error.message : String(error));
      console.log('');
    }

    console.log('🎉 Database connection test completed!');

  } catch (error) {
    console.error('💥 Database connection test failed:', error);
  } finally {
    // 关闭连接池
    await pool.end();
    console.log('🔌 Connection pool closed.');
  }
}

// 运行测试
testDatabaseConnection().catch(console.error);
