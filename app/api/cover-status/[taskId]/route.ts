import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const taskId = params.taskId;

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID cannot be empty' },
        { status: 400 }
      );
    }

    // 直接调用KIE API查询封面状态
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const response = await fetch(`https://api.kie.ai/api/v1/suno/cover/record-info?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get cover status: ${response.statusText}`);
    }

    const result = await response.json();

    console.log(`Cover status check for ${taskId}:`, JSON.stringify(result, null, 2));

    // 转换KIE API响应格式为我们的格式
    if (result.code === 200 && result.data?.response?.images) {
      // 封面生成完成
      return NextResponse.json({
        success: true,
        data: {
          code: 200,
          msg: 'success',
          data: {
            taskId: taskId,
            images: result.data.response.images
          }
        }
      });
    } else {
      // 封面生成进行中或失败
      return NextResponse.json({
        success: true,
        data: {
          code: 202,
          msg: 'Cover generation in progress',
          data: {
            taskId: taskId,
            images: null
          }
        }
      });
    }

  } catch (error) {
    console.error('Get cover status error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : 'Error occurred while getting cover status',
        success: false 
      },
      { status: 500 }
    );
  }
}
