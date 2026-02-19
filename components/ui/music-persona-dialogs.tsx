"use client";

import React from "react";
import Image from "next/image";
import { Check, MoreHorizontal, Music, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/format-utils";
import { useI18n } from "@/lib/i18n/provider";
import type { PersonaOption, PersonaTrackOption } from "@/hooks/use-studio-persona-manager";

interface MusicPersonaDialogsProps {
  isPersonaDialogOpen: boolean;
  setIsPersonaDialogOpen: (open: boolean) => void;
  isPersonaLoading: boolean;
  personaOptions: PersonaOption[];
  selectedPersonaId: string;
  setSelectedPersonaId?: (personaId: string) => void;
  deletingPersonaRecordId: string | null;
  onDeletePersona: (persona: PersonaOption) => Promise<void> | void;
  onOpenSelectMusicDialog: () => void;

  isSelectMusicOpen: boolean;
  setIsSelectMusicOpen: (open: boolean) => void;
  closeSelectMusicDialog: () => void;
  isSelectMusicLoading: boolean;
  selectMusicOptions: PersonaTrackOption[];
  pendingMusicTrackId: string;
  setPendingMusicTrackId: (trackId: string) => void;
  selectedMusicTrackId: string;
  pendingMusicTrack: PersonaTrackOption | null;
  pendingMusicTrackUnavailableReason: string | null;
  getPersonaTrackUnavailableReason: (track: PersonaTrackOption | null | undefined) => string | null;
  formatTrackCreatedAt: (value: string) => string;
  confirmSelectMusicDialog: () => void;

  isCreatePersonaDialogOpen: boolean;
  setIsCreatePersonaDialogOpen: (open: boolean) => void;
  selectedMusicTrack: PersonaTrackOption | null;
  createPersonaName: string;
  setCreatePersonaName: (name: string) => void;
  createPersonaDescription: string;
  setCreatePersonaDescription: (description: string) => void;
  closeCreatePersonaDialog: () => void;
  handleCreatePersona: () => Promise<void> | void;
  isCreatingPersona: boolean;
}

export const MusicPersonaDialogs: React.FC<MusicPersonaDialogsProps> = ({
  isPersonaDialogOpen,
  setIsPersonaDialogOpen,
  isPersonaLoading,
  personaOptions,
  selectedPersonaId,
  setSelectedPersonaId,
  deletingPersonaRecordId,
  onDeletePersona,
  onOpenSelectMusicDialog,
  isSelectMusicOpen,
  setIsSelectMusicOpen,
  closeSelectMusicDialog,
  isSelectMusicLoading,
  selectMusicOptions,
  pendingMusicTrackId,
  setPendingMusicTrackId,
  selectedMusicTrackId,
  pendingMusicTrack,
  pendingMusicTrackUnavailableReason,
  getPersonaTrackUnavailableReason,
  formatTrackCreatedAt,
  confirmSelectMusicDialog,
  isCreatePersonaDialogOpen,
  setIsCreatePersonaDialogOpen,
  selectedMusicTrack,
  createPersonaName,
  setCreatePersonaName,
  createPersonaDescription,
  setCreatePersonaDescription,
  closeCreatePersonaDialog,
  handleCreatePersona,
  isCreatingPersona,
}) => {
  const { t } = useI18n();
  const [pendingPersonaId, setPendingPersonaId] = React.useState(selectedPersonaId);

  React.useEffect(() => {
    if (!isPersonaDialogOpen) return;
    setPendingPersonaId(selectedPersonaId);
  }, [isPersonaDialogOpen, selectedPersonaId]);

  return (
    <>
      <Dialog open={isPersonaDialogOpen} onOpenChange={setIsPersonaDialogOpen}>
        <DialogContent className="studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[620px] max-h-[82vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl">
          <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2 text-left">
            <div className="pr-8">
              <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                {t("personaDialog.title")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("personaDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
            <section className="studio-panel-card rounded-2xl p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{t("personaDialog.myPersonas")}</h3>
                <button
                  type="button"
                  onClick={onOpenSelectMusicDialog}
                  className="studio-panel-card inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t("personaDialog.create")}</span>
                </button>
              </div>

              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {isPersonaLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={`persona-skeleton-${index}`} className="rounded-2xl bg-foreground/5 px-4 py-3">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-3 w-1/3" />
                          <Skeleton className="h-3 w-4/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : personaOptions.length === 0 ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl bg-foreground/5 px-4 py-6 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <Users className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="text-base font-semibold text-foreground">{t("personaDialog.noPersonasTitle")}</div>
                    <p className="mt-1 max-w-[420px] text-sm leading-relaxed text-muted-foreground">
                      {t("personaDialog.noPersonasDescription")}
                    </p>
                  </div>
                ) : (
                  personaOptions.map((persona) => {
                    const isSelected = pendingPersonaId === persona.personaId;
                    const isDeletingPersona = deletingPersonaRecordId === persona.id;

                    return (
                      <div
                        key={persona.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setPendingPersonaId((current) =>
                            current === persona.personaId ? '' : persona.personaId
                          );
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setPendingPersonaId((current) =>
                              current === persona.personaId ? '' : persona.personaId
                            );
                          }
                        }}
                        className={`group w-full cursor-pointer rounded-2xl px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isSelected
                            ? 'bg-primary/15 hover:bg-primary/20'
                            : 'bg-foreground/5 hover:bg-foreground/10'
                        }`}
                      >
                        <div className="flex w-full items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-foreground">
                              {persona.name?.trim() || t("personaDialog.unnamedPersona")}
                            </div>
                            {persona.trackTitle && (
                              <div className="mt-0.5 text-sm text-muted-foreground">
                                {t("personaDialog.fromTrack", { title: persona.trackTitle })}
                              </div>
                            )}
                            {persona.description && (
                              <div className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                                {persona.description}
                              </div>
                            )}
                          </div>

                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 pointer-events-none transition-[opacity,color,background-color] duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={t("trackActions.moreActions")}
                                title={t("trackActions.moreActions")}
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-[180] w-36">
                              <DropdownMenuItem
                                onSelect={() => {
                                  toast.info(t("personaDialog.editComingSoon"));
                                }}
                                disabled={isDeletingPersona}
                              >
                                {t("personaDialog.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  void onDeletePersona(persona);
                                }}
                                disabled={isDeletingPersona}
                                className="text-destructive focus:text-destructive"
                              >
                                {isDeletingPersona ? t("personaDialog.deleting") : t("personaDialog.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 pt-1 pb-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsPersonaDialogOpen(false)}
              className="h-11 rounded-2xl border-0 bg-foreground/5 px-4 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="h-11 rounded-2xl px-5 text-sm font-semibold"
              onClick={() => {
                setSelectedPersonaId?.(pendingPersonaId);
                setIsPersonaDialogOpen(false);
              }}
            >
              {t("common.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSelectMusicOpen}
        onOpenChange={(open) => {
          if (open) {
            setPendingMusicTrackId(selectedMusicTrackId);
            setIsSelectMusicOpen(true);
            return;
          }
          closeSelectMusicDialog();
        }}
      >
        <DialogContent className="studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[640px] max-h-[82vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl">
          <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2 text-left">
            <div className="pr-8">
              <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                {t("personaDialog.selectMusicTitle")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("personaDialog.selectMusicDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
            {isSelectMusicLoading ? (
              <div className="studio-panel-card max-h-[400px] space-y-1.5 overflow-y-auto rounded-2xl p-2 pr-1">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`select-music-skeleton-${index}`} className="rounded-xl bg-foreground/5 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-2/3" />
                        <div className="flex items-center gap-1.5">
                          <Skeleton className="h-4 w-12 rounded-md" />
                          <Skeleton className="h-4 w-28 rounded-md" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectMusicOptions.length === 0 ? (
              <div className="studio-panel-card flex min-h-[200px] flex-col items-center justify-center rounded-2xl px-4 py-6 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Music className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="text-base font-semibold text-foreground">{t("personaDialog.noSongsTitle")}</div>
                <div className="mt-1 text-sm text-muted-foreground">{t("personaDialog.noSongsDescription")}</div>
              </div>
            ) : (
              <div className="studio-panel-card max-h-[400px] space-y-1.5 overflow-y-auto rounded-2xl p-2 pr-1">
                {selectMusicOptions.map((track) => {
                  const unavailableReason = getPersonaTrackUnavailableReason(track);
                  const isUnavailable = Boolean(unavailableReason);
                  const isPending = pendingMusicTrackId === track.id;

                  return (
                    <button
                      key={track.id}
                      type="button"
                      disabled={isUnavailable}
                      onClick={() => {
                        if (isUnavailable) {
                          return;
                        }
                        setPendingMusicTrackId(track.id);
                      }}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isPending && !isUnavailable
                          ? 'cursor-pointer bg-primary/15 hover:bg-primary/20'
                        : isUnavailable
                            ? 'cursor-not-allowed bg-foreground/10 opacity-75'
                            : 'cursor-pointer bg-foreground/5 hover:bg-foreground/10'
                      }`}
                      title={isUnavailable ? unavailableReason || undefined : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-foreground/10">
                          {track.coverR2Url ? (
                            <Image
                              src={track.coverR2Url}
                              alt={track.title || t("personaDialog.trackCoverAlt")}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground/70">
                              <Music className="h-4 w-4" aria-hidden="true" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {track.title || t("studioTracks.untitledTrack")}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <span className="rounded-md bg-foreground/10 px-1.5 py-0.5">
                              {formatDuration(Math.floor(track.duration || 0)) || '0:00'}
                            </span>
                            <span className="rounded-md bg-foreground/10 px-1.5 py-0.5">
                              {formatTrackCreatedAt(track.createdAt)}
                            </span>
                          </div>
                          {isUnavailable && unavailableReason && (
                            <div className="mt-1.5 text-sm text-amber-600 dark:text-amber-400">
                              {unavailableReason}
                            </div>
                          )}
                        </div>

                        {isPending && !isUnavailable && (
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                            <Check className="h-3 w-3 text-primary-foreground" strokeWidth={2.8} aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-5 pt-1 pb-4 space-y-2">
            <div className="studio-panel-card min-w-0 truncate rounded-xl px-3 py-2 text-sm text-muted-foreground">
              {pendingMusicTrack
                ? pendingMusicTrackUnavailableReason
                  ? pendingMusicTrackUnavailableReason
                  : t("personaDialog.selectedTrack", { title: pendingMusicTrack.title || t("studioTracks.untitledTrack") })
                : t("personaDialog.noTracksSelected")}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeSelectMusicDialog}
                className="h-11 rounded-2xl border-0 bg-foreground/5 px-4 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={confirmSelectMusicDialog}
                className="h-11 rounded-2xl px-5 text-sm font-semibold"
                disabled={isSelectMusicLoading || !pendingMusicTrackId || !!pendingMusicTrackUnavailableReason}
              >
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreatePersonaDialogOpen} onOpenChange={setIsCreatePersonaDialogOpen}>
        <DialogContent className="studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[620px] max-h-[82vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl">
          <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2 text-left">
            <div className="pr-8">
              <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                {t("personaDialog.createPersonaTitle")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("personaDialog.createPersonaDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
            {selectedMusicTrack ? (
              <section className="px-1">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-foreground/10">
                    {selectedMusicTrack.coverR2Url ? (
                      <Image
                        src={selectedMusicTrack.coverR2Url}
                        alt={selectedMusicTrack.title || t("personaDialog.trackCoverAlt")}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/70">
                        <Music className="h-4 w-4" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {selectedMusicTrack.title || t("studioTracks.untitledTrack")}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {formatDuration(Math.floor(selectedMusicTrack.duration || 0)) || '0:00'} • {formatTrackCreatedAt(selectedMusicTrack.createdAt)}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="studio-panel-card rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="create-persona-name" className="text-xs md:text-sm font-semibold text-foreground">
                  {t("personaDialog.nameLabel")}
                </Label>
              </div>
              <Input
                id="create-persona-name"
                value={createPersonaName}
                onChange={(event) => setCreatePersonaName(event.target.value)}
                placeholder={t("personaDialog.namePlaceholder")}
                maxLength={100}
                className="h-11 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="text-xs text-muted-foreground">{createPersonaName.length}/100</div>
            </section>

            <section className="studio-panel-card rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="create-persona-description" className="text-xs md:text-sm font-semibold text-foreground">
                  {t("personaDialog.descriptionLabel")}
                </Label>
              </div>
              <Textarea
                id="create-persona-description"
                value={createPersonaDescription}
                onChange={(event) => setCreatePersonaDescription(event.target.value)}
                placeholder={t("personaDialog.descriptionPlaceholder")}
                maxLength={1000}
                className="min-h-[120px] resize-none border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="text-right text-xs text-muted-foreground">
                {createPersonaDescription.length}/1000
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 pt-1 pb-4">
            <Button
              type="button"
              variant="ghost"
              onClick={closeCreatePersonaDialog}
              className="h-11 rounded-2xl border-0 bg-foreground/5 px-4 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
              disabled={isCreatingPersona}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleCreatePersona}
              className="h-11 rounded-2xl px-5 text-sm font-semibold"
              disabled={isCreatingPersona || !createPersonaName.trim() || !createPersonaDescription.trim()}
            >
              {isCreatingPersona ? t("personaDialog.creating") : t("common.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
