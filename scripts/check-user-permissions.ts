#!/usr/bin/env npx tsx

/**
 * 检查指定用户的订阅和权限状态脚本
 * 
 * 此脚本会：
 * 1. 查询用户的订阅信息
 * 2. 查询用户的 tier_id 和 tier_code
 * 3. 查询用户的功能权限
 * 4. 列出用户所有可用的功能
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

// 加载.env.local文件
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// 创建数据库客户端
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL?.replace('channel_binding=require', 'channel_binding=disable'),
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

// 用户ID
const userId = process.argv[2] || '1c8b3dd3-64bc-4757-9773-501caefb70b2';

async function checkUserPermissions() {
  try {
    console.log('🔍 开始检查用户权限...\n');
    console.log(`用户ID: ${userId}\n`);

    // 连接数据库
    await dbClient.connect();
    console.log('✅ 数据库连接成功\n');

    // 1. 查询用户的订阅信息
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 订阅信息');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const subscriptionResult = await dbQuery(
      `SELECT 
        id,
        subscription_id,
        product_id,
        plan_id,
        tier_id,
        status,
        current_period_start,
        current_period_end,
        credits_per_period,
        created_at,
        updated_at
       FROM user_subscriptions
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC`,
      [userId]
    );

    if (subscriptionResult.rows.length === 0) {
      console.log('❌ 未找到任何订阅记录\n');
    } else {
      subscriptionResult.rows.forEach((sub, index) => {
        console.log(`\n订阅 #${index + 1}:`);
        console.log(`  ID: ${sub.id}`);
        console.log(`  订阅ID: ${sub.subscription_id}`);
        console.log(`  产品ID: ${sub.product_id}`);
        console.log(`  计划ID: ${sub.plan_id}`);
        console.log(`  层级ID: ${sub.tier_id || '未设置'}`);
        console.log(`  状态: ${sub.status}`);
        console.log(`  当前周期开始: ${sub.current_period_start}`);
        console.log(`  当前周期结束: ${sub.current_period_end}`);
        console.log(`  每周期积分: ${sub.credits_per_period}`);
        console.log(`  创建时间: ${sub.created_at}`);
        console.log(`  更新时间: ${sub.updated_at}`);
      });
      console.log('');
    }

    // 2. 查询用户的活跃订阅和层级信息
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 当前活跃订阅层级');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const tierResult = await dbQuery(
      `SELECT 
        us.tier_id,
        st.code as tier_code
       FROM user_subscriptions us
       INNER JOIN subscription_tiers st ON us.tier_id = st.id
       WHERE us.user_id = $1::uuid 
       AND us.status = 'active'
       ORDER BY us.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (tierResult.rows.length === 0) {
      console.log('❌ 没有活跃订阅，用户将没有任何功能权限\n');
    } else {
      const tier = tierResult.rows[0];
      console.log(`  Tier ID: ${tier.tier_id}`);
      console.log(`  Tier Code: ${tier.tier_code}\n`);
    }

    // 3. 查询用户的功能权限（所有功能）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 功能权限详情');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const tierId = tierResult.rows.length > 0 ? tierResult.rows[0].tier_id : null;

    if (!tierId) {
      console.log('❌ 没有活跃订阅，无法查询功能权限\n');
    } else {
      // 查询所有可用功能
      const featuresResult = await dbQuery(
        `SELECT 
          f.id as feature_id,
          f.code as feature_code,
          f.name as feature_name,
          f.description as feature_description,
          tf.is_enabled,
          tf.created_at
         FROM tier_features tf
         INNER JOIN features f ON tf.feature_id = f.id
         WHERE tf.tier_id = $1::uuid
         AND tf.is_enabled = TRUE
         ORDER BY f.code`,
        [tierId]
      );

      if (featuresResult.rows.length === 0) {
        console.log('❌ 该层级没有任何启用的功能\n');
      } else {
        console.log(`\n✅ 用户拥有以下 ${featuresResult.rows.length} 个功能权限:\n`);
        featuresResult.rows.forEach((feature, index) => {
          console.log(`${index + 1}. ${feature.feature_code}`);
          console.log(`   名称: ${feature.feature_name}`);
          console.log(`   描述: ${feature.feature_description || '无描述'}`);
          console.log(`   启用: ${feature.is_enabled ? '✅' : '❌'}`);
          console.log('');
        });
      }

      // 4. 检查特定功能权限（常见功能）
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎵 特定功能权限检查');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const commonFeatures = [
        'download_mp3',
        'download_wav',
        'extended_generation',
        'commercial_license'
      ];

      for (const featureCode of commonFeatures) {
        const hasPermission = await dbQuery(
          `SELECT tf.id 
           FROM tier_features tf
           INNER JOIN features f ON tf.feature_id = f.id
           WHERE f.code = $1 
           AND tf.tier_id = $2::uuid
           AND tf.is_enabled = TRUE`,
          [featureCode, tierId]
        );

        const status = hasPermission.rows.length > 0 ? '✅ 有权限' : '❌ 无权限';
        console.log(`  ${featureCode.padEnd(25)} ${status}`);
      }
      console.log('');
    }

    // 5. 查询所有功能列表（参考）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📚 数据库中所有可用功能');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const allFeaturesResult = await dbQuery(
      `SELECT 
        code,
        name,
        description
       FROM features
       ORDER BY code`
    );

    if (allFeaturesResult.rows.length > 0) {
      console.log(`\n数据库中共有 ${allFeaturesResult.rows.length} 个功能定义:\n`);
      allFeaturesResult.rows.forEach((feature, index) => {
        console.log(`${index + 1}. ${feature.code} - ${feature.name}`);
      });
      console.log('');
    }

    // 6. 查询所有订阅层级（参考）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 所有订阅层级');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const allTiersResult = await dbQuery(
      `SELECT 
        id,
        code
       FROM subscription_tiers
       ORDER BY code`
    );

    if (allTiersResult.rows.length > 0) {
      console.log(`\n数据库中共有 ${allTiersResult.rows.length} 个订阅层级:\n`);
      allTiersResult.rows.forEach((tier, index) => {
        console.log(`${index + 1}. ${tier.code}`);
        console.log(`   ID: ${tier.id}`);
        console.log('');
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 检查完成');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await dbClient.end();
    console.log('🔌 数据库连接已关闭');
  }
}

// 运行检查
checkUserPermissions();

