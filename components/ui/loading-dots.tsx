import React from 'react';
import { cn } from '@/lib/utils';

// 内联样式用于loading dots动画
const loadingDotsStyle = `
  @keyframes loading-dots {
    0%, 80%, 100% {
      transform: scale(0.6);
      opacity: 0.4;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .loading-dot {
    animation: loading-dots 1.4s infinite ease-in-out;
  }

  .loading-dot:nth-child(1) { animation-delay: -0.32s; }
  .loading-dot:nth-child(2) { animation-delay: -0.16s; }
  .loading-dot:nth-child(3) { animation-delay: 0s; }
`;

interface LoadingDotsProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'muted';
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  className,
  size = 'md',
  color = 'primary'
}) => {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  const colorClasses = {
    primary: 'bg-primary',
    white: 'bg-white',
    muted: 'bg-muted-foreground'
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: loadingDotsStyle }} />
      <div className={cn('flex items-center gap-1', className)}>
        <div
          className={cn(
            'rounded-full loading-dot',
            sizeClasses[size],
            colorClasses[color]
          )}
        />
        <div
          className={cn(
            'rounded-full loading-dot',
            sizeClasses[size],
            colorClasses[color]
          )}
        />
        <div
          className={cn(
            'rounded-full loading-dot',
            sizeClasses[size],
            colorClasses[color]
          )}
        />
      </div>
    </>
  );
};

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'muted';
  vertical?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading',
  className,
  size = 'md',
  color = 'primary',
  vertical = false
}) => {
  return (
    <div className={cn(
      'flex items-center gap-3',
      vertical ? 'flex-col' : 'flex-row',
      className
    )}>
      <LoadingDots size={size} color={color} />
      {message && (
        <span className={cn(
          'text-muted-foreground',
          size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'
        )}>
          {message}
        </span>
      )}
    </div>
  );
};

// 专门用于覆盖层的loading组件
interface LoadingOverlayProps {
  className?: string;
  message?: string;
  blur?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  className,
  message = 'Loading',
  blur = true
}) => {
  return (
    <div className={cn(
      'absolute inset-0 flex items-center justify-center rounded-lg z-10',
      blur ? 'bg-black/60' : 'bg-black/60',
      className
    )}>
      <div className="flex flex-col items-center gap-3">
        <LoadingDots size="md" color="white" />
        {message && (
          <span className="text-white text-sm font-medium">
            {message}
          </span>
        )}
      </div>
    </div>
  );
};

// 用于页面级别的loading
interface PageLoadingProps {
  message?: string;
  className?: string;
}

export const PageLoading: React.FC<PageLoadingProps> = ({
  message = 'Loading',
  className
}) => {
  return (
    <div className={cn(
      'flex items-center justify-center h-full min-h-[200px]',
      className
    )}>
      <LoadingState 
        message={message} 
        size="lg" 
        color="primary" 
        vertical 
        className="text-center"
      />
    </div>
  );
};
