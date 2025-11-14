"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X } from "lucide-react";
import Image from "next/image";

interface EditMusicInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; coverImageUrl?: string }) => Promise<void>;
  initialTitle: string;
  initialCoverImage?: string;
}

export const EditMusicInfoDialog: React.FC<EditMusicInfoDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTitle,
  initialCoverImage,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [coverImage, setCoverImage] = useState<string | undefined>(initialCoverImage);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setCoverImage(initialCoverImage);
      setCoverImageFile(null);
      setPreviewUrl(null);
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
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

      if (coverImageFile) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          await onSave({ title: title.trim(), coverImageUrl: dataUrl });
          setIsSaving(false);
        };
        reader.onerror = () => {
          alert('Failed to read image file');
          setIsSaving(false);
        };
        reader.readAsDataURL(coverImageFile);
        return;
      } else if (coverImage !== initialCoverImage) {
        coverImageUrl = '';
      }

      await onSave({ title: title.trim(), coverImageUrl });
    } catch (error) {
      console.error('Error saving music info:', error);
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
        className="max-w-[calc(100vw-2rem)] sm:max-w-[500px]"
        onClick={(e) => e.stopPropagation()}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit Music Info</DialogTitle>
          <DialogDescription>
            Update your track title and cover image.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2 pb-4">
          <div className="space-y-4">
            <div className="space-y-2">
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

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Cover Image
              </label>
              <div
                className={`relative border-2 border-dashed rounded-lg transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {displayImage ? (
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted">
                    <Image
                      src={displayImage}
                      alt="Cover preview"
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background border border-border shadow-sm transition-colors"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center p-8 cursor-pointer"
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
