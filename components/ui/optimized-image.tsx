'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Music } from 'lucide-react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  fallbackContent?: React.ReactNode;
  priority?: boolean;
  sizes?: string;
  // 新增：是否启用优化
  optimized?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  fill,
  className,
  fallbackContent,
  priority = false,
  sizes,
  optimized = true
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    console.warn(`Failed to load image: ${src}`);
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // 如果图片加载失败，显示fallback内容
  if (hasError) {
    return (
      <div className={className}>
        {fallbackContent || (
          <div className="bg-gradient-to-br from-gray-600/20 to-gray-500/40 flex items-center justify-center h-full">
            <div className="text-center">
              <Music className="w-8 h-8 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Failed to load</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 检查URL是否有效
  if (!src || src.trim() === '') {
    return (
      <div className={className}>
        {fallbackContent || (
          <div className="bg-gradient-to-br from-gray-600/20 to-gray-500/40 flex items-center justify-center h-full">
            <div className="text-center">
              <Music className="w-8 h-8 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">No image</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 如果禁用优化，使用普通img标签
  if (!optimized) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        onError={handleError}
        onLoad={handleLoad}
        loading={priority ? 'eager' : 'lazy'}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      fill={fill}
      className={className}
      onError={handleError}
      onLoad={handleLoad}
      priority={priority}
      sizes={sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
      // 移除placeholder以减少transformations
      quality={85} // 设置质量以减少文件大小
    />
  );
};

// 针对不同场景的预设组件
export const CoverImage: React.FC<Omit<OptimizedImageProps, 'sizes'> & { size?: 'sm' | 'md' | 'lg' }> = ({
  size = 'md',
  ...props
}) => {
  const sizeMap = {
    sm: "(max-width: 640px) 100vw, 200px",
    md: "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 300px",
    lg: "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
  };

  return (
    <OptimizedImage
      {...props}
      sizes={sizeMap[size]}
      optimized={true}
    />
  );
};

export const AvatarImage: React.FC<Omit<OptimizedImageProps, 'sizes'> & { size?: number }> = ({
  size = 40,
  ...props
}) => {
  return (
    <OptimizedImage
      {...props}
      width={size}
      height={size}
      sizes={`${size}px`}
      optimized={true}
    />
  );
};

export const StaticImage: React.FC<OptimizedImageProps> = (props) => {
  return (
    <OptimizedImage
      {...props}
      optimized={false} // 静态图片不优化
    />
  );
};
