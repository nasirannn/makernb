'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Music } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  fallbackContent?: React.ReactNode;
  priority?: boolean;
  sizes?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  width,
  height,
  fill,
  className,
  fallbackContent,
  priority,
  sizes
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

  return (
    <>
      {isLoading && (
        <div className={`bg-gradient-to-br from-gray-600/20 to-gray-500/40 flex items-center justify-center animate-pulse ${className}`}>
          <div className="text-center">
            <Music className="w-8 h-8 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Loading...</p>
          </div>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={handleError}
        onLoad={handleLoad}
        priority={priority}
        sizes={sizes}
        // 添加超时处理
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
      />
    </>
  );
};
