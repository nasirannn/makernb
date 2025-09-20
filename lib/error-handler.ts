// 错误处理工具
export interface ErrorContext {
  taskId: string;
  callbackType?: string;
  operation: string;
  userId?: string;
}

export interface ErrorResult {
  success: boolean;
  error?: string;
  shouldRetry: boolean;
  shouldNotifyFrontend: boolean;
}

// 错误分类和处理策略
export function handleError(error: any, context: ErrorContext): ErrorResult {
  console.error(`=== ERROR HANDLER ===`);
  console.error(`Context:`, context);
  console.error(`Error:`, error);

  // 数据库连接错误
  if (error.message?.includes('connection') || error.message?.includes('database')) {
    return {
      success: false,
      error: 'Database connection failed',
      shouldRetry: true,
      shouldNotifyFrontend: true
    };
  }

  // R2存储错误
  if (error.message?.includes('R2') || error.message?.includes('storage') || error.message?.includes('upload')) {
    return {
      success: false,
      error: 'Storage service unavailable',
      shouldRetry: true,
      shouldNotifyFrontend: true
    };
  }

  // 网络错误
  if (error.message?.includes('fetch') || error.message?.includes('network') || error.code === 'ENOTFOUND') {
    return {
      success: false,
      error: 'Network error',
      shouldRetry: true,
      shouldNotifyFrontend: true
    };
  }

  // 数据验证错误
  if (error.message?.includes('validation') || error.message?.includes('invalid')) {
    return {
      success: false,
      error: 'Data validation failed',
      shouldRetry: false,
      shouldNotifyFrontend: true
    };
  }

  // 权限错误
  if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
    return {
      success: false,
      error: 'Permission denied',
      shouldRetry: false,
      shouldNotifyFrontend: true
    };
  }

  // 默认错误
  return {
    success: false,
    error: 'Unknown error occurred',
    shouldRetry: false,
    shouldNotifyFrontend: true
  };
}

// 安全推送错误信息到前端
export function createErrorNotification(context: ErrorContext, errorMessage: string) {
  return {
    type: 'error',
    taskId: context.taskId,
    status: 'ERROR',
    error: errorMessage,
    operation: context.operation,
    timestamp: new Date().toISOString()
  };
}

// 重试机制
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  context: ErrorContext
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} for ${context.operation}`);
      return await operation();
    } catch (error) {
      lastError = error;
      const errorResult = handleError(error, context);
      
      if (!errorResult.shouldRetry || attempt === maxRetries) {
        throw error;
      }
      
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // 指数退避
    }
  }
  
  throw lastError;
}

