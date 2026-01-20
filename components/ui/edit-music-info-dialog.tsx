"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Trash2, Upload } from "lucide-react";
import NextImage from "next/image";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface EditMusicInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; coverImageUrl?: string }) => Promise<void>;
  initialTitle: string;
  initialCoverImage?: string;
  trackId?: string;
}

export const EditMusicInfoDialog: React.FC<EditMusicInfoDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTitle,
  initialCoverImage,
  trackId,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [coverImage, setCoverImage] = useState<string | undefined>(initialCoverImage);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [coverScale, setCoverScale] = useState<number[]>([100]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setCoverImage(initialCoverImage);
      setCoverImageFile(null);
      setPreviewUrl(null);
      setCoverScale([100]);
    }
  }, [isOpen, initialTitle, initialCoverImage]);

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image file (JPG, JPEG, or PNG)');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    setCoverImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  const loadImageFromBlob = (blob: Blob) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(error);
      };
      img.src = url;
    });

  const resolveCoverBlob = useCallback(
    async (src: string) => {
      const isRemote = src.startsWith('http');
      if (isRemote && trackId) {
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        const proxyResponse = await fetch(
          `/api/download-cover?trackId=${encodeURIComponent(trackId)}&purpose=edit`,
          authToken
            ? {
                headers: {
                  Authorization: `Bearer ${authToken}`,
                },
              }
            : undefined
        );
        if (proxyResponse.ok) {
          return proxyResponse.blob();
        }
      }

      const response = await fetch(src);
      if (!response.ok) {
        throw new Error('Failed to fetch cover image.');
      }
      return response.blob();
    },
    [trackId]
  );

  const buildScaledCoverDataUrl = useCallback(async (src: string, scale: number) => {
    const blob = await resolveCoverBlob(src);
    const image = await loadImageFromBlob(blob);
    const targetSize = Math.min(1024, Math.min(image.width, image.height));

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas is not supported in this browser.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const baseCoverScale = Math.max(targetSize / image.width, targetSize / image.height);
    const scaledCover = baseCoverScale * (scale / 100);
    const drawWidth = image.width * scaledCover;
    const drawHeight = image.height * scaledCover;
    const offsetX = (targetSize - drawWidth) / 2;
    const offsetY = (targetSize - drawHeight) / 2;
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    return canvas.toDataURL('image/png');
  }, [resolveCoverBlob]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setCoverImageFile(null);
    setPreviewUrl(null);
    setCoverImage(undefined);
    setCoverScale([100]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      let coverImageUrl: string | undefined = undefined;

      if (!displayImage && coverImage !== initialCoverImage) {
        coverImageUrl = '';
      } else if (displayImage && (coverImageFile || coverScale[0] !== 100)) {
        coverImageUrl = await buildScaledCoverDataUrl(displayImage, coverScale[0]);
      }

      await onSave({ title: title.trim(), coverImageUrl });
    } catch (error) {
      console.error('Error saving music info:', error);
      toast.error('Failed to update music info. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClose();
  };

  const displayImage = previewUrl || coverImage;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-[calc(100vw-2rem)] sm:max-w-[520px] max-h-[78vh] flex flex-col overflow-hidden p-0 bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="flex-shrink-0 px-5 pt-5 pb-3 text-left relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
          <div className="flex items-center justify-between pr-8 relative">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Music Info
              </div>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                Edit Music Info
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Update title or cover image for this track.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-0">
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="title" className="text-sm text-muted-foreground">
                Title
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Track title"
                maxLength={80}
                className="w-full"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground block text-left">
                Cover Image
              </label>
              <div
                className={`rounded-2xl bg-muted/40 p-3 transition-colors ${
                  isDragging ? 'bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onDrop={handleDrop}
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-full max-w-48 shrink-0 aspect-square rounded-lg overflow-hidden">
                    {displayImage ? (
                      <NextImage
                        src={displayImage}
                        alt="Cover preview"
                        fill
                        className="object-cover origin-center transition-transform duration-200"
                        style={{ transform: `scale(${coverScale[0] / 100})` }}
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center p-8 cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-center text-foreground font-medium mb-1">
                          Drag and drop or click to upload your Image
                        </p>
                        <p className="text-xs text-center text-muted-foreground">
                          Supported formats: JPG, JPEG, PNG; Maximum size per file: 10MB.
                        </p>
                      </div>
                    )}
                  </div>
                  {displayImage && (
                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex flex-1 items-center gap-3 rounded-full bg-muted/60 px-4 py-2">
                        <span className="text-xs font-medium text-foreground/80">Size</span>
                        <Slider
                          value={coverScale}
                          onValueChange={setCoverScale}
                          min={100}
                          max={140}
                          step={1}
                          className="flex-1"
                        />
                      </div>
                      <button
                        onClick={handleRemoveImage}
                        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        type="button"
                        aria-label="Remove cover image"
                      >
                        <Trash2 className="h-4 w-4 mx-auto" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 p-6 pt-0">
          <div className="w-full">
            <button
              onClick={handleSave}
              disabled={!title.trim() || isSaving}
              className="inline-flex w-full items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              {isSaving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
