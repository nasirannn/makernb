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
        className="studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[82vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2 text-left">
          <div className="pr-8">
            <DialogTitle className="text-xl font-semibold tracking-tight">Edit Music Info</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Update title or cover image for this track.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 px-5 py-3">
          <section className="studio-panel-card rounded-2xl p-3 space-y-2">
            <label htmlFor="title" className="text-xs md:text-sm font-semibold text-foreground">
              Title
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Track title"
              maxLength={80}
              className="h-11 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
              autoFocus
            />
            <div className="text-xs text-muted-foreground">{title.length}/80</div>
          </section>

          <section className="studio-panel-card rounded-2xl p-3 space-y-2">
            <label className="text-xs md:text-sm font-semibold text-foreground block text-left">
              Cover Image
            </label>
            <div
              className={`rounded-xl bg-foreground/5 p-3 transition-colors ${
                isDragging ? 'bg-primary/10' : 'hover:bg-foreground/10'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative aspect-square w-full max-w-48 shrink-0 overflow-hidden rounded-lg bg-background/55">
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
                      className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center p-6 text-center"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="mb-1 text-sm font-medium text-foreground">
                        Drag and drop or click to upload your image
                      </p>
                      <p className="text-xs text-muted-foreground">
                        JPG, JPEG, PNG up to 10MB.
                      </p>
                    </div>
                  )}
                </div>

                {displayImage && (
                  <div className="flex flex-1 items-center gap-3">
                    <div className="studio-panel-card flex flex-1 items-center gap-3 rounded-full px-4 py-2">
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
                      className="h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      type="button"
                      aria-label="Remove cover image"
                    >
                      <Trash2 className="mx-auto h-4 w-4" />
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
          </section>
        </div>

        <DialogFooter className="flex-shrink-0 px-5 pt-1 pb-4">
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
