'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Gift, Coins } from 'lucide-react';

interface DailyCreditsNotificationProps {
  show: boolean;
  credits: number;
  onClose: () => void;
}

export default function DailyCreditsNotification({ 
  show, 
  credits, 
  onClose 
}: DailyCreditsNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300); // 等待动画完成
  }, [onClose]);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      // 自动关闭通知（5秒后）
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [show, handleClose]);

  if (!show) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className="bg-gradient-to-r from-purple-600 to-purple-600 text-white rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Gift className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm">每日登录积分</h3>
              <div className="flex items-center space-x-1 mt-1">
                <Coins className="w-4 h-4" />
                <span className="text-sm">+{credits} 积分</span>
              </div>
              <p className="text-xs opacity-90 mt-1">
                积分将在明天凌晨失效
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
