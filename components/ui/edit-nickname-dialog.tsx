"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, Loader2, RefreshCw, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/provider";

interface EditNicknameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: string;
}

export function EditNicknameDialog({ open, onOpenChange, initialValue = "" }: EditNicknameDialogProps) {
  const { t } = useI18n();
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

  const getAccessTokenOrThrow = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      throw new Error(t("toasts.authRequired"));
    }

    return session.access_token;
  }, [t]);

  const getAuthHeaders = useCallback((accessToken: string) => ({
    Authorization: `Bearer ${accessToken}`,
  }), []);

  const handleSave = async () => {
    if (!trimmedNickname) {
      setError(t("editNickname.nicknameCannotBeEmpty"));
      return;
    }

    setSaving(true);
    try {
      await updateNickname(trimmedNickname);
      toast.success(t("editNickname.nicknameUpdated"));
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to update nickname:", err);
      setError(t("editNickname.failedUpdateNickname"));
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
      toast(t("editNickname.userIdCopied"));
    } catch (err) {
      console.error("Failed to copy user ID:", err);
      toast(t("editNickname.unableCopyUserId"));
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
      toast(t("editNickname.selectImageFile"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast(t("editNickname.imageMaxSize"));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarOverride(previewUrl);
    setAvatarUploading(true);
    setError(null);

    try {
      const accessToken = await getAccessTokenOrThrow();

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: getAuthHeaders(accessToken),
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || t("editNickname.failedUploadAvatar"));
      }

      const { avatarUrl } = await response.json();
      await updateProfile({ avatar_url: avatarUrl });
      setAvatarOverride(avatarUrl);
      toast(t("editNickname.profilePhotoUpdated"));
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setAvatarOverride(null);
      toast(t("editNickname.failedUpdateProfilePhoto"));
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
      <DialogContent className="studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[82vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl">
          <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2 text-left">
            <div className="pr-8">
              <DialogTitle className="text-xl font-semibold tracking-tight">{t("editNickname.editProfileTitle")}</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("editNickname.editProfileDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="grid gap-3 sm:grid-cols-[168px_1fr]">
              <div className="studio-panel-card rounded-2xl p-3 sm:p-4">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Avatar className="h-20 w-20 shadow-sm">
                    <AvatarImage src={avatarSrc} alt={t("common.userAvatar")} />
                    <AvatarFallback className="bg-muted text-lg font-semibold">
                      {fallbackLetter}
                    </AvatarFallback>
                  </Avatar>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleChangePhoto}
                    disabled={avatarUploading}
                    className="h-10 w-full justify-center rounded-xl bg-foreground/5 text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  >
                    {avatarUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("editNickname.uploading")}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        {t("editNickname.changePhoto")}
                      </>
                    )}
                  </Button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />

                  <div className="w-full space-y-2 pt-1 text-left">
                    {user?.email && (
                      <div className="text-sm leading-5 text-muted-foreground/80">
                        <div className="font-semibold text-foreground/70">{t("editNickname.emailLabel")}</div>
                        <div className="truncate">{user.email}</div>
                      </div>
                    )}
                    {user?.id && (
                      <div className="text-sm leading-5 text-muted-foreground/80">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-foreground/70">{t("editNickname.userIdLabel")}</div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleCopyUserId}
                            className="h-8 w-8 rounded-full text-muted-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                            aria-label={t("editNickname.copyUserId")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="truncate font-mono text-sm tracking-tight text-muted-foreground/70">
                          {user.id}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="studio-panel-card rounded-2xl p-3 sm:p-4">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">{t("editNickname.displayNameLabel")}</div>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      placeholder={displayName ? displayName : t("editNickname.enterNicknamePlaceholder")}
                      maxLength={32}
                      className="h-11 w-full border-0 bg-transparent pl-10 pr-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    {error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground/70">
                        {t("editNickname.displayNameHint")}
                      </p>
                    )}
                    <p className="text-xs tabular-nums text-muted-foreground/60">
                      {Math.min(32, nickname.length)}/32
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 px-5 pt-1 pb-4">
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-11 w-full rounded-2xl border-0 bg-foreground/5 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground sm:w-auto"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="h-11 w-full rounded-2xl px-5 text-sm font-semibold sm:w-auto sm:min-w-[160px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("editNickname.saving")}
                  </>
                ) : (
                  t("editNickname.saveChanges")
                )}
              </Button>
            </DialogFooter>
          </div>
      </DialogContent>
    </Dialog>
  );
}
