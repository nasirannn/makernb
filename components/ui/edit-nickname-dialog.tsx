"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, Copy, RefreshCw, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface EditNicknameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: string;
}

export function EditNicknameDialog({ open, onOpenChange, initialValue = "" }: EditNicknameDialogProps) {
  const { updateNickname, updateProfile, user } = useAuth();
  const [nickname, setNickname] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setNickname(initialValue);
      setError(null);
      setAvatarOverride(null);
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (avatarOverride && avatarOverride.startsWith("blob:")) {
      return () => URL.revokeObjectURL(avatarOverride);
    }
    return;
  }, [avatarOverride]);

  const trimmedNickname = useMemo(() => nickname.trim(), [nickname]);
  const isUnchanged = trimmedNickname === initialValue.trim();
  const canSave = trimmedNickname.length > 0 && !isUnchanged && !saving;

  const handleSave = async () => {
    if (!trimmedNickname) {
      setError("Nickname cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      await updateNickname(trimmedNickname);
      toast("Nickname updated.", { icon: <CheckCircle className="h-4 w-4 text-green-500" /> });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to update nickname:", err);
      setError("Failed to update nickname. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUserId = async () => {
    if (!user?.id) {
      return;
    }
    try {
      await navigator.clipboard.writeText(user.id);
      toast("User ID copied.");
    } catch (err) {
      console.error("Failed to copy user ID:", err);
      toast("Unable to copy user ID.");
    }
  };

  const handleChangePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be 5MB or smaller.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarOverride(previewUrl);
    setAvatarUploading(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("Authentication required");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to upload avatar");
      }

      const { avatarUrl } = await response.json();
      await updateProfile({ avatar_url: avatarUrl });
      setAvatarOverride(avatarUrl);
      toast("Profile photo updated.");
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setAvatarOverride(null);
      toast("Failed to update profile photo.");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const displayName = user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const avatarSrc = avatarOverride || avatarUrl || "";
  const fallbackLetter =
    displayName?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[440px] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-3 pt-1 pb-1 px-1">
          <div className="space-y-1">
            <div className="flex flex-col items-center gap-3 text-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarSrc} alt="User avatar" />
                <AvatarFallback className="bg-muted text-lg font-semibold">
                  {fallbackLetter}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handleChangePhoto}
                disabled={avatarUploading}
                className="inline-flex items-center gap-2 text-sm text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {avatarUploading ? "Uploading..." : "Change photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              {user?.email && (
                <p className="text-xs text-muted-foreground/80 tracking-wide">Email: {user.email}</p>
              )}
              {user?.id && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground/80 tracking-wide">
                  <span>User ID: {user.id}</span>
                  <button
                    type="button"
                    onClick={handleCopyUserId}
                    className="text-muted-foreground/70 hover:text-foreground"
                    aria-label="Copy user ID"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Enter your nickname"
                maxLength={32}
                className="w-full pl-10"
              />
            </div>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-2">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex w-full items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            {saving ? (
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
}
