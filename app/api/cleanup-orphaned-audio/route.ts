import { NextRequest, NextResponse } from 'next/server';
import { getAllAudioFiles, deleteAudioFiles } from '@/lib/r2-storage';
import { getAllAudioUrls } from '@/lib/music-db';

export async function GET(request: NextRequest) {
  try {
    console.log('开始检查孤立的音频文件...');
    
    // 获取R2中的所有音频文件
    const r2AudioFiles = await getAllAudioFiles();
    console.log(`R2中找到 ${r2AudioFiles.length} 个音频文件`);

    // 获取数据库中的所有音频URL
    const dbAudioUrls = await getAllAudioUrls();
    console.log(`数据库中找到 ${dbAudioUrls.length} 个音频URL`);

    // 创建数据库URL的Set以便快速查找
    const dbUrlSet = new Set(dbAudioUrls);

    // 找出只在R2中存在的音频文件
    const orphanedFiles = r2AudioFiles.filter(file => {
      return !dbUrlSet.has(file.url);
    });

    console.log(`发现 ${orphanedFiles.length} 个孤立的音频文件`);

    return NextResponse.json({
      success: true,
      data: {
        totalR2Files: r2AudioFiles.length,
        totalDbUrls: dbAudioUrls.length,
        orphanedFiles: orphanedFiles.length,
        orphanedFilesList: orphanedFiles.map(file => ({
          key: file.key,
          url: file.url,
          userId: file.userId,
          taskId: file.taskId,
          filename: file.filename,
          lastModified: file.lastModified
        }))
      }
    });

  } catch (error) {
    console.error('检查孤立音频文件时发生错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '检查孤立音频文件失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('开始删除孤立的音频文件...');
    
    // 获取R2中的所有音频文件
    const r2AudioFiles = await getAllAudioFiles();
    console.log(`R2中找到 ${r2AudioFiles.length} 个音频文件`);

    // 获取数据库中的所有音频URL
    const dbAudioUrls = await getAllAudioUrls();
    console.log(`数据库中找到 ${dbAudioUrls.length} 个音频URL`);

    // 创建数据库URL的Set以便快速查找
    const dbUrlSet = new Set(dbAudioUrls);

    // 找出只在R2中存在的音频文件
    const orphanedFiles = r2AudioFiles.filter(file => {
      return !dbUrlSet.has(file.url);
    });

    if (orphanedFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有发现孤立的音频文件',
        deletedCount: 0
      });
    }

    console.log(`准备删除 ${orphanedFiles.length} 个孤立的音频文件`);

    // 分批删除，每批50个文件
    const batchSize = 50;
    let totalDeleted = 0;
    
    for (let i = 0; i < orphanedFiles.length; i += batchSize) {
      const batch = orphanedFiles.slice(i, i + batchSize);
      const fileKeys = batch.map(file => file.key);
      
      console.log(`删除第 ${Math.floor(i / batchSize) + 1} 批 (${batch.length} 个文件)...`);
      await deleteAudioFiles(fileKeys);
      totalDeleted += batch.length;
    }

    console.log(`成功删除 ${totalDeleted} 个孤立的音频文件`);

    return NextResponse.json({
      success: true,
      message: `成功删除 ${totalDeleted} 个孤立的音频文件`,
      deletedCount: totalDeleted,
      deletedFiles: orphanedFiles.map(file => ({
        key: file.key,
        userId: file.userId,
        taskId: file.taskId,
        filename: file.filename
      }))
    });

  } catch (error) {
    console.error('删除孤立音频文件时发生错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '删除孤立音频文件失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
