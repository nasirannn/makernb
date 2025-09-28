'use client';

import React from 'react';

interface AudioWaveIndicatorProps {
  isPlaying: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AudioWaveIndicator: React.FC<AudioWaveIndicatorProps> = ({
  isPlaying,
  className = '',
  size = 'sm'
}) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const barClasses = {
    sm: 'w-0.5',
    md: 'w-0.5',
    lg: 'w-1'
  };

  return (
    <div className={`flex items-end justify-center space-x-0.5 ${sizeClasses[size]} ${className}`}>
      {[...Array(4)].map((_, index) => (
        <div
          key={index}
          className={`${barClasses[size]} bg-white rounded-full transition-all duration-200 ${
            isPlaying 
              ? 'animate-bounce' 
              : 'opacity-30'
          }`}
          style={{
            height: isPlaying ? `${25 + (index * 12)}%` : '25%',
            animationDelay: isPlaying ? `${index * 0.12}s` : '0s',
            animationDuration: isPlaying ? '0.7s' : '0s',
            animationIterationCount: isPlaying ? 'infinite' : '1'
          }}
        />
      ))}
    </div>
  );
};

// 更复杂的音波动画组件
export const AdvancedAudioWaveIndicator: React.FC<AudioWaveIndicatorProps> = ({
  isPlaying,
  className = '',
  size = 'sm'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const barClasses = {
    sm: 'w-0.5',
    md: 'w-0.5',
    lg: 'w-1'
  };

  return (
    <div className={`flex items-end justify-center space-x-0.5 ${sizeClasses[size]} ${className}`}>
      {[...Array(5)].map((_, index) => (
        <div
          key={index}
          className={`${barClasses[size]} bg-white rounded-full transition-all duration-200 ${
            isPlaying 
              ? 'animate-bounce' 
              : 'opacity-40'
          }`}
          style={{
            height: isPlaying ? `${30 + (index * 10)}%` : '30%',
            animationDelay: isPlaying ? `${index * 0.15}s` : '0s',
            animationDuration: isPlaying ? '0.8s' : '0s'
          }}
        />
      ))}
    </div>
  );
};

// 脉冲音波指示器
export const PulseAudioWaveIndicator: React.FC<AudioWaveIndicatorProps> = ({
  isPlaying,
  className = '',
  size = 'sm'
}) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* 中心圆点 */}
      <div 
        className={`absolute inset-0 bg-white rounded-full transition-all duration-300 ${
          isPlaying 
            ? 'animate-pulse scale-100' 
            : 'opacity-50 scale-75'
        }`}
      />
      
      {/* 脉冲环 */}
      {isPlaying && (
        <>
          <div 
            className="absolute inset-0 bg-white rounded-full animate-ping opacity-20"
            style={{ animationDuration: '1s' }}
          />
          <div 
            className="absolute inset-0 bg-white rounded-full animate-ping opacity-10"
            style={{ animationDuration: '1.5s', animationDelay: '0.2s' }}
          />
        </>
      )}
    </div>
  );
};

// 自定义音波动画组件
export const CustomAudioWaveIndicator: React.FC<AudioWaveIndicatorProps> = ({
  isPlaying,
  className = '',
  size = 'sm'
}) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const barClasses = {
    sm: 'w-0.5',
    md: 'w-0.5',
    lg: 'w-1'
  };

  const waveClasses = [
    'audio-wave-bar-1',
    'audio-wave-bar-2', 
    'audio-wave-bar-3',
    'audio-wave-bar-4',
    'audio-wave-bar-5'
  ];

  return (
    <div className={`flex items-end justify-center space-x-0.5 ${sizeClasses[size]} ${className}`}>
      {[...Array(5)].map((_, index) => (
        <div
          key={index}
          className={`${barClasses[size]} bg-white rounded-full transition-opacity duration-200 shadow-lg ${
            isPlaying 
              ? waveClasses[index]
              : 'opacity-40'
          }`}
          style={{
            height: isPlaying ? '20%' : '20%',
            boxShadow: isPlaying ? '0 0 4px rgba(255, 255, 255, 0.5)' : 'none'
          }}
        />
      ))}
    </div>
  );
};
