"use client";
import React from "react";
import { Button } from "./button";
import { AlertTriangle, Info } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default"
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300"
      onClick={handleBackdropClick}
    >
      {/* Backdrop - 使用登录界面的样式 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/80 to-slate-900/90 backdrop-blur-md" />

      {/* Dialog - 使用登录界面的样式 */}
      <div className="relative bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-2xl p-8 max-w-md w-full mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Icon & Header */}
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            {variant === "destructive" ? (
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Info className="w-6 h-6 text-blue-400" />
              </div>
            )}
          </div>
          <h3 className="text-xl font-bold text-white">
            {title}
          </h3>
        </div>

        {/* Content */}
        <div className="mb-8">
          <div className="text-white/80 text-center text-base leading-relaxed">
            {message}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 justify-center">
          {cancelText && (
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 max-w-[120px] h-12 px-6 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200 font-medium text-sm"
            >
              {cancelText}
            </Button>
          )}
          <Button
            variant={variant}
            onClick={handleConfirm}
            className={`flex-1 max-w-[120px] h-12 px-6 rounded-xl font-medium text-sm transition-all duration-200 ${
              variant === "destructive"
                ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-red-500/25"
                : "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg hover:shadow-purple-500/25"
            }`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
