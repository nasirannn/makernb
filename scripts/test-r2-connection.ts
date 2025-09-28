#!/usr/bin/env npx tsx

/**
 * R2连接测试脚本
 */

// 加载环境变量
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载.env.local文件
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// 创建R2客户端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

async function testR2Connection() {
  console.log('🧪 测试R2存储连接...\n');
  
  console.log('📋 配置信息:');
  console.log(`  Account ID: ${process.env.R2_ACCOUNT_ID}`);
  console.log(`  Bucket Name: ${BUCKET_NAME}`);
  console.log(`  Access Key ID: ${process.env.R2_ACCESS_KEY_ID?.substring(0, 8)}...`);
  console.log(`  Endpoint: https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com\n`);
  
  try {
    console.log('🔍 尝试列出存储桶中的文件...');
    
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 5 // 只获取前5个文件进行测试
    });
    
    const response = await r2Client.send(command);
    
    console.log('✅ R2连接成功!');
    console.log(`📊 存储桶统计:`);
    console.log(`  文件数量: ${response.KeyCount || 0}`);
    console.log(`  是否截断: ${response.IsTruncated ? '是' : '否'}`);
    
    if (response.Contents && response.Contents.length > 0) {
      console.log('\n📁 示例文件:');
      response.Contents.forEach((object, index) => {
        console.log(`  ${index + 1}. ${object.Key} (${object.Size} bytes)`);
      });
    } else {
      console.log('\n📁 存储桶为空');
    }
    
    return true;
  } catch (error) {
    console.error('❌ R2连接失败:', error);
    
    if (error instanceof Error) {
      console.error('\n🔍 错误详情:');
      console.error(`  消息: ${error.message}`);
      console.error(`  名称: ${error.name}`);
      
      // 提供常见错误的解决建议
      if (error.message.includes('credential')) {
        console.error('\n💡 可能的解决方案:');
        console.error('  1. 检查R2_ACCESS_KEY_ID和R2_SECRET_ACCESS_KEY是否正确');
        console.error('  2. 确认API令牌有正确的权限');
        console.error('  3. 检查Account ID是否正确');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
        console.error('\n💡 可能的解决方案:');
        console.error('  1. 检查网络连接');
        console.error('  2. 确认防火墙设置');
        console.error('  3. 尝试使用VPN');
      } else if (error.message.includes('NoSuchBucket')) {
        console.error('\n💡 可能的解决方案:');
        console.error('  1. 检查R2_BUCKET_NAME是否正确');
        console.error('  2. 确认存储桶是否存在');
        console.error('  3. 检查存储桶权限');
      }
    }
    
    return false;
  }
}

async function main() {
  console.log('🚀 开始R2连接测试...\n');
  
  // 检查必要的环境变量
  const requiredEnvVars = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID', 
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的环境变量:');
    missingVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\n请检查.env.local文件中的R2配置');
    process.exit(1);
  }
  
  const success = await testR2Connection();
  
  if (success) {
    console.log('\n✅ R2连接测试通过!');
    console.log('💡 现在可以运行完整的清理脚本: npm run cleanup-r2');
  } else {
    console.log('\n❌ R2连接测试失败!');
    console.log('💡 请解决上述问题后重试');
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}
