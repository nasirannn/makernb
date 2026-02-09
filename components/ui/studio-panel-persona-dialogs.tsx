"use client";

import React from "react";
import Image from "next/image";
import { Check, ChevronRight, Info, MoreHorizontal, Music, Plus, Users } from "lucide-react";
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
import type { PersonaOption, PersonaTrackOption } from "@/hooks/use-studio-persona-manager";

interface StudioPanelPersonaDialogsProps {
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

export const StudioPanelPersonaDialogs: React.FC<StudioPanelPersonaDialogsProps> = ({
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
  return (
    <>
      <Dialog open={isPersonaDialogOpen} onOpenChange={setIsPersonaDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[620px] max-h-[82vh] flex flex-col overflow-hidden p-0 border-0 bg-background shadow-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent" />

          <DialogHeader className="relative px-6 pt-5 pb-4 text-left">
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Persona
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
              Music Persona
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Extract persona from your generated tracks.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
            <button
              type="button"
              onClick={onOpenSelectMusicDialog}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-muted/30 px-4 py-3 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Plus className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Create Persona</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Choose a song and continue to create your persona
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
            </button>

            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">My Personas</h3>
              {selectedPersonaId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPersonaId?.('');
                    setIsPersonaDialogOpen(false);
                  }}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Use No Persona
                </button>
              )}
            </div>

            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {isPersonaLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`persona-skeleton-${index}`} className="rounded-2xl bg-card/70 px-4 py-3">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : personaOptions.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl bg-muted/30 px-4 py-6 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Users className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="text-base font-semibold text-foreground">No Personas Yet</div>
                  <p className="mt-1 max-w-[420px] text-xs leading-relaxed text-muted-foreground">
                    No personas yet. Select music to create one.
                  </p>
                </div>
              ) : (
                personaOptions.map((persona) => {
                  const isSelected = selectedPersonaId === persona.personaId;
                  const isDeletingPersona = deletingPersonaRecordId === persona.id;

                  return (
                    <div
                      key={persona.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedPersonaId?.(persona.personaId);
                        setIsPersonaDialogOpen(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedPersonaId?.(persona.personaId);
                          setIsPersonaDialogOpen(false);
                        }
                      }}
                      className={`group w-full cursor-pointer rounded-2xl px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected
                          ? 'bg-primary/15 hover:bg-primary/20'
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex w-full items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {persona.name?.trim() || 'Unnamed Persona'}
                          </div>
                          {persona.trackTitle && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">From: {persona.trackTitle}</div>
                          )}
                          {persona.description && (
                            <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
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
                              aria-label="Persona actions"
                              title="More actions"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-[180] w-36">
                            <DropdownMenuItem
                              onSelect={() => {
                                toast.info('Edit persona (coming soon)');
                              }}
                              disabled={isDeletingPersona}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                void onDeletePersona(persona);
                              }}
                              disabled={isDeletingPersona}
                              className="text-destructive focus:text-destructive"
                            >
                              {isDeletingPersona ? 'Deleting...' : 'Delete'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[640px] max-h-[82vh] flex flex-col overflow-hidden p-0 border-0 bg-background shadow-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent" />

          <DialogHeader className="relative px-6 pt-5 pb-4 text-left">
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Current Songs
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              Select Music
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Choose one of your current songs, then confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-6 pb-4">
            {isSelectMusicLoading ? (
              <div className="max-h-[400px] space-y-1.5 overflow-y-auto rounded-2xl bg-muted/20 p-2 pr-1">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`select-music-skeleton-${index}`} className="rounded-xl bg-card/70 px-3 py-2.5">
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
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl bg-muted/30 px-4 py-6 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Music className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="text-base font-semibold text-foreground">No Songs Yet</div>
                <div className="mt-1 text-xs text-muted-foreground">Generate or upload a song to see it here.</div>
              </div>
            ) : (
              <div className="max-h-[400px] space-y-1.5 overflow-y-auto rounded-2xl bg-muted/20 p-2 pr-1">
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
                            ? 'cursor-not-allowed bg-muted/35 opacity-75'
                            : 'cursor-pointer bg-card/75 hover:bg-muted/40'
                      }`}
                      title={isUnavailable ? unavailableReason || undefined : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted/50">
                          {track.coverR2Url ? (
                            <Image
                              src={track.coverR2Url}
                              alt={track.title || 'Track cover'}
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
                            {track.title || 'Untitled Track'}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="rounded-md bg-muted/60 px-1.5 py-0.5">
                              {formatDuration(Math.floor(track.duration || 0)) || '0:00'}
                            </span>
                            <span className="rounded-md bg-muted/60 px-1.5 py-0.5">
                              {formatTrackCreatedAt(track.createdAt)}
                            </span>
                          </div>
                          {isUnavailable && unavailableReason && (
                            <div className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
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

          <div className="flex items-center gap-2 bg-background/95 px-6 py-4 backdrop-blur">
            <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {pendingMusicTrack
                ? pendingMusicTrackUnavailableReason
                  ? pendingMusicTrackUnavailableReason
                  : `Selected: ${pendingMusicTrack.title || 'Untitled Track'}`
                : "You haven't selected any tracks yet"}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeSelectMusicDialog}
                className="h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmSelectMusicDialog}
                className="h-9 px-4"
                disabled={isSelectMusicLoading || !pendingMusicTrackId || !!pendingMusicTrackUnavailableReason}
              >
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreatePersonaDialogOpen} onOpenChange={setIsCreatePersonaDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[620px] max-h-[82vh] flex flex-col overflow-hidden p-0 border-0 bg-background shadow-xl">
          <DialogHeader className="px-6 pt-5 pb-4 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              Create a Persona
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Add a name and description for this music persona.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
            {selectedMusicTrack ? (
              <div className="rounded-xl bg-muted/25 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted/50">
                    {selectedMusicTrack.coverR2Url ? (
                      <Image
                        src={selectedMusicTrack.coverR2Url}
                        alt={selectedMusicTrack.title || 'Track cover'}
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
                      {selectedMusicTrack.title || 'Untitled Track'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDuration(Math.floor(selectedMusicTrack.duration || 0)) || '0:00'} • {formatTrackCreatedAt(selectedMusicTrack.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="create-persona-name" className="text-sm font-medium text-foreground">
                  Name
                </Label>
                <button
                  type="button"
                  aria-label="Name field information"
                  title="A descriptive name that captures the essence of the musical style or character"
                  className="inline-flex h-7 w-7 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                id="create-persona-name"
                value={createPersonaName}
                onChange={(event) => setCreatePersonaName(event.target.value)}
                placeholder="Enter persona name"
                maxLength={100}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="create-persona-description" className="text-sm font-medium text-foreground">
                  Description
                </Label>
                <button
                  type="button"
                  aria-label="Description field information"
                  title="Detailed description of the Persona's musical characteristics, style, and personality. Be specific about genre, mood, instrumentation, and vocal qualities."
                  className="inline-flex h-7 w-7 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
              <Textarea
                id="create-persona-description"
                value={createPersonaDescription}
                onChange={(event) => setCreatePersonaDescription(event.target.value)}
                placeholder="Describe this persona"
                maxLength={1000}
                className="min-h-[120px] resize-none"
              />
              <div className="text-right text-[11px] text-muted-foreground">
                {createPersonaDescription.length}/1000
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 bg-background/95 px-6 py-4 backdrop-blur">
            <Button
              type="button"
              variant="ghost"
              onClick={closeCreatePersonaDialog}
              className="h-9 px-4"
              disabled={isCreatingPersona}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreatePersona}
              className="h-9 px-4"
              disabled={isCreatingPersona || !createPersonaName.trim() || !createPersonaDescription.trim()}
            >
              {isCreatingPersona ? 'Creating...' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
