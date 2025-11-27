"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Pencil, Upload, X } from "lucide-react";
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
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent
        className="max-w-[calc(100vw-2rem)] sm:max-w-[500px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertDialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Music Info
            </AlertDialogTitle>
            <button
              onClick={handleClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <AlertDialogDescription>
            Update your track title and cover image.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pt-2 pb-4 px-1">
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

        <AlertDialogFooter className="flex-shrink-0 border-t pt-4">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
