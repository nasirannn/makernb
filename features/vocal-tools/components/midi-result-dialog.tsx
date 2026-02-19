"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MidiGenerationData } from "@/types/track";

type MidiNoteView = {
  pitch: number;
  start: number;
  end: number;
  velocity: number;
};

type MidiInstrumentView = {
  id: string;
  name: string;
  notes: MidiNoteView[];
  minPitch: number;
  maxPitch: number;
  maxEnd: number;
};

const MIDI_CHART_WIDTH = 980;
const MIDI_CHART_HEIGHT = 220;
const MIDI_MAX_RENDERED_NOTES = 900;
const MIDI_PPQ = 480;
const MIDI_TEMPO_BPM = 120;

const toUint16Bytes = (value: number): number[] => [
  (value >>> 8) & 0xff,
  value & 0xff,
];

const toUint32Bytes = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

const encodeVariableLength = (value: number): number[] => {
  let remaining = Math.max(0, Math.floor(value));
  const bytes = [remaining & 0x7f];
  remaining >>= 7;

  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }

  return bytes;
};

const textToBytes = (value: string): number[] => {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(value));
};

const createChunk = (chunkType: string, chunkData: number[]): number[] => {
  const typeBytes = textToBytes(chunkType);
  return [...typeBytes, ...toUint32Bytes(chunkData.length), ...chunkData];
};

const buildTempoTrackChunk = (): number[] => {
  const microsecondsPerQuarterNote = Math.round(60_000_000 / MIDI_TEMPO_BPM);
  const trackData: number[] = [
    0x00,
    0xff,
    0x51,
    0x03,
    (microsecondsPerQuarterNote >>> 16) & 0xff,
    (microsecondsPerQuarterNote >>> 8) & 0xff,
    microsecondsPerQuarterNote & 0xff,
    0x00,
    0xff,
    0x2f,
    0x00,
  ];

  return createChunk('MTrk', trackData);
};

type MidiEvent = {
  tick: number;
  type: 'note_on' | 'note_off';
  note: number;
  velocity: number;
};

const getMidiChannel = (instrumentName: string, instrumentIndex: number): number => {
  if (/drum|percussion/i.test(instrumentName)) {
    return 9;
  }

  const melodicChannels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  return melodicChannels[instrumentIndex % melodicChannels.length];
};

const buildInstrumentTrackChunk = (
  instrument: MidiInstrumentView,
  instrumentIndex: number
): number[] => {
  const ticksPerSecond = (MIDI_PPQ * MIDI_TEMPO_BPM) / 60;
  const channel = getMidiChannel(instrument.name, instrumentIndex);
  const events: MidiEvent[] = [];

  instrument.notes.forEach((note) => {
    const normalizedStartTick = Math.max(0, Math.round(note.start * ticksPerSecond));
    const normalizedEndTick = Math.max(
      normalizedStartTick + 1,
      Math.round(note.end * ticksPerSecond)
    );
    const normalizedPitch = Math.round(Math.max(0, Math.min(127, note.pitch)));
    const normalizedVelocity = Math.max(1, Math.round(Math.max(0, Math.min(1, note.velocity)) * 127));

    events.push({
      tick: normalizedStartTick,
      type: 'note_on',
      note: normalizedPitch,
      velocity: normalizedVelocity,
    });

    events.push({
      tick: normalizedEndTick,
      type: 'note_off',
      note: normalizedPitch,
      velocity: 0,
    });
  });

  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.type !== b.type) return a.type === 'note_off' ? -1 : 1;
    return a.note - b.note;
  });

  const trackData: number[] = [];
  const safeTrackName = instrument.name.trim().slice(0, 80) || `Instrument ${instrumentIndex + 1}`;
  const trackNameBytes = textToBytes(safeTrackName);

  trackData.push(0x00, 0xff, 0x03, ...encodeVariableLength(trackNameBytes.length), ...trackNameBytes);

  let previousTick = 0;
  events.forEach((event) => {
    const delta = Math.max(0, event.tick - previousTick);
    trackData.push(...encodeVariableLength(delta));

    if (event.type === 'note_on') {
      trackData.push(0x90 | channel, event.note, event.velocity);
    } else {
      trackData.push(0x80 | channel, event.note, 0x00);
    }

    previousTick = event.tick;
  });

  trackData.push(0x00, 0xff, 0x2f, 0x00);

  return createChunk('MTrk', trackData);
};

const buildMidiFile = (instruments: MidiInstrumentView[]): Uint8Array | null => {
  if (instruments.length === 0) {
    return null;
  }

  const trackChunks: number[][] = [
    buildTempoTrackChunk(),
    ...instruments.map((instrument, index) => buildInstrumentTrackChunk(instrument, index)),
  ];

  const headerData = [...toUint16Bytes(1), ...toUint16Bytes(trackChunks.length), ...toUint16Bytes(MIDI_PPQ)];
  const headerChunk = createChunk('MThd', headerData);
  const totalBytesLength =
    headerChunk.length + trackChunks.reduce((sum, trackChunk) => sum + trackChunk.length, 0);
  const allBytes = new Uint8Array(totalBytesLength);

  let offset = 0;
  allBytes.set(headerChunk, offset);
  offset += headerChunk.length;

  trackChunks.forEach((trackChunk) => {
    allBytes.set(trackChunk, offset);
    offset += trackChunk.length;
  });

  return allBytes;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatSeconds = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0s';
  if (value < 10) return `${value.toFixed(1)}s`;
  if (value < 60) return `${Math.round(value)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const normalizeMidiInstruments = (midiData?: MidiGenerationData | null): MidiInstrumentView[] => {
  if (!midiData || !Array.isArray(midiData.instruments)) {
    return [];
  }

  return midiData.instruments
    .map((instrument, index) => {
      const name =
        typeof instrument?.name === 'string' && instrument.name.trim().length > 0
          ? instrument.name.trim()
          : `Instrument ${index + 1}`;

      const rawNotes = Array.isArray(instrument?.notes) ? instrument.notes : [];
      const notes: MidiNoteView[] = rawNotes
        .map((note) => {
          const pitch = toFiniteNumber((note as any)?.pitch);
          const start = toFiniteNumber((note as any)?.start);
          const end = toFiniteNumber((note as any)?.end);
          const velocity = toFiniteNumber((note as any)?.velocity);

          if (pitch === null || start === null) return null;
          const normalizedStart = Math.max(0, start);
          const normalizedEnd = end !== null ? Math.max(normalizedStart + 0.02, end) : normalizedStart + 0.02;
          const normalizedPitch = Math.round(Math.max(0, Math.min(127, pitch)));
          const normalizedVelocity = velocity !== null ? Math.max(0, Math.min(1, velocity)) : 1;

          return {
            pitch: normalizedPitch,
            start: normalizedStart,
            end: normalizedEnd,
            velocity: normalizedVelocity,
          };
        })
        .filter((note): note is MidiNoteView => !!note)
        .sort((a, b) => a.start - b.start);

      if (notes.length === 0) {
        return null;
      }

      const minPitch = Math.min(...notes.map((note) => note.pitch));
      const maxPitch = Math.max(...notes.map((note) => note.pitch));
      const maxEnd = Math.max(...notes.map((note) => note.end), 1);

      return {
        id: `${index}-${name}`,
        name,
        notes,
        minPitch,
        maxPitch,
        maxEnd,
      };
    })
    .filter((instrument): instrument is MidiInstrumentView => !!instrument);
};

export interface MidiResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle?: string;
  midiStatus?: 'idle' | 'checking' | 'generating' | 'completed' | 'error';
  midiErrorMessage?: string;
  midiInstrumentsCount?: number;
  midiData?: MidiGenerationData | null;
}

export const MidiResultDialog: React.FC<MidiResultDialogProps> = ({
  isOpen,
  onClose,
  trackTitle = 'Track',
  midiStatus = 'idle',
  midiErrorMessage,
  midiInstrumentsCount,
  midiData,
}) => {
  const [activeMidiInstrumentId, setActiveMidiInstrumentId] = useState<string | null>(null);
  const isLoadingState = midiStatus === 'checking' || midiStatus === 'generating';

  const midiInstruments = useMemo(() => normalizeMidiInstruments(midiData), [midiData]);

  const activeMidiInstrument = useMemo(() => {
    if (midiInstruments.length === 0) return null;
    return midiInstruments.find((instrument) => instrument.id === activeMidiInstrumentId) || midiInstruments[0];
  }, [activeMidiInstrumentId, midiInstruments]);

  const midiRollData = useMemo(() => {
    if (!activeMidiInstrument) return null;

    const chartPaddingX = 28;
    const chartPaddingY = 14;
    const innerWidth = MIDI_CHART_WIDTH - chartPaddingX * 2;
    const innerHeight = MIDI_CHART_HEIGHT - chartPaddingY * 2;
    const pitchSpan = Math.max(1, activeMidiInstrument.maxPitch - activeMidiInstrument.minPitch + 1);
    const timelineEnd = Math.max(1, activeMidiInstrument.maxEnd);
    const noteHeight = Math.max(2, Math.min(12, innerHeight / pitchSpan));
    const truncated = activeMidiInstrument.notes.length > MIDI_MAX_RENDERED_NOTES;
    const notes = activeMidiInstrument.notes.slice(0, MIDI_MAX_RENDERED_NOTES).map((note) => {
      const x = chartPaddingX + (Math.max(0, note.start) / timelineEnd) * innerWidth;
      const rawWidth = ((Math.max(note.end, note.start + 0.02) - note.start) / timelineEnd) * innerWidth;
      const width = Math.max(2, Math.min(rawWidth, chartPaddingX + innerWidth - x));
      const row = activeMidiInstrument.maxPitch - note.pitch;
      const y = Math.min(chartPaddingY + row * noteHeight, chartPaddingY + innerHeight - noteHeight);
      const opacity = 0.32 + note.velocity * 0.56;

      return {
        x,
        y,
        width,
        height: Math.max(2, noteHeight - 0.5),
        opacity,
      };
    });

    return {
      chartPaddingX,
      chartPaddingY,
      innerWidth,
      innerHeight,
      timelineEnd,
      notes,
      truncated,
      minPitch: activeMidiInstrument.minPitch,
      maxPitch: activeMidiInstrument.maxPitch,
      totalNotes: activeMidiInstrument.notes.length,
    };
  }, [activeMidiInstrument]);

  const canDownloadMidiData = midiStatus === 'completed' && midiInstruments.length > 0;

  const handleDownloadMidiData = () => {
    const midiBytes = buildMidiFile(midiInstruments);
    if (!midiBytes) return;

    const midiBinary = new Uint8Array(midiBytes.byteLength);
    midiBinary.set(midiBytes);
    const blob = new Blob([midiBinary.buffer], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeTrackTitle = (trackTitle || 'track')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    anchor.href = url;
    anchor.download = `${safeTrackTitle || 'track'}-midi.mid`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!isOpen) {
      setActiveMidiInstrumentId(null);
      return;
    }

    if (midiStatus !== 'completed' || midiInstruments.length === 0) {
      setActiveMidiInstrumentId(null);
      return;
    }

    const hasSelectedInstrument = midiInstruments.some((instrument) => instrument.id === activeMidiInstrumentId);
    if (!hasSelectedInstrument) {
      setActiveMidiInstrumentId(midiInstruments[0].id);
    }
  }, [activeMidiInstrumentId, isOpen, midiInstruments, midiStatus]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[860px] max-h-[84vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl"
        )}
      >
        <DialogHeader className="flex-shrink-0 px-5 pr-14 pt-4 pb-3 text-left sm:pr-16">
          <div className="min-w-0 space-y-1 pr-2">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              MIDI Result
            </DialogTitle>
            <p className="truncate text-sm text-muted-foreground">
              Extracts and visualizes note data for each detected instrument.
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 px-5 py-3">
          {isLoadingState && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="h-3 w-40 rounded-full" />
              </div>

              <div className="studio-panel-card rounded-xl p-1">
                <div className="flex gap-1">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={`midi-loading-tab-${index}`} className="h-8 w-24 rounded-lg" />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>

              <div className="studio-panel-card rounded-xl p-2">
                <Skeleton className="h-44 w-full rounded-lg" />
              </div>
            </div>
          )}

          {midiStatus === 'idle' && (
            <p className="text-sm text-muted-foreground">
              MIDI generation has not started yet.
            </p>
          )}

          {midiStatus === 'error' && (
            <p className="text-sm text-destructive">
              {midiErrorMessage || 'Failed to generate MIDI. Please try again.'}
            </p>
          )}

          {midiStatus === 'completed' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {trackTitle}
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  MIDI ready{typeof midiInstrumentsCount === 'number' ? ` • ${midiInstrumentsCount} instruments detected` : ''}.
                </p>
              </div>
              {midiInstruments.length > 0 ? (
                <div className="space-y-2">
                  <div
                    role="tablist"
                    aria-label="MIDI instruments"
                    className="studio-panel-card flex gap-1 overflow-x-auto rounded-xl p-1"
                  >
                    {midiInstruments.map((instrument) => (
                      <button
                        key={instrument.id}
                        type="button"
                        role="tab"
                        aria-selected={activeMidiInstrument?.id === instrument.id}
                        onClick={() => setActiveMidiInstrumentId(instrument.id)}
                        className={cn(
                          "h-8 max-w-[220px] shrink-0 truncate rounded-lg px-3 text-xs font-medium transition-colors",
                          activeMidiInstrument?.id === instrument.id
                            ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40"
                            : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                        )}
                      >
                        {instrument.name}
                      </button>
                    ))}
                  </div>

                  {activeMidiInstrument && midiRollData && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{midiRollData.totalNotes} notes</span>
                        <span>Range {midiRollData.minPitch} - {midiRollData.maxPitch}</span>
                        <span>Length {formatSeconds(midiRollData.timelineEnd)}</span>
                      </div>
                      <div className="studio-panel-card rounded-xl p-2">
                        <div className="w-full overflow-x-auto">
                          <svg
                            viewBox={`0 0 ${MIDI_CHART_WIDTH} ${MIDI_CHART_HEIGHT}`}
                            className="h-44 min-w-[680px] w-full"
                            preserveAspectRatio="none"
                            role="img"
                            aria-label={`MIDI piano roll for ${activeMidiInstrument.name}`}
                          >
                            <rect
                              x={0}
                              y={0}
                              width={MIDI_CHART_WIDTH}
                              height={MIDI_CHART_HEIGHT}
                              fill="hsl(var(--background))"
                            />
                            {Array.from({ length: 9 }).map((_, index) => {
                              const x = midiRollData.chartPaddingX + (index / 8) * midiRollData.innerWidth;
                              const time = (index / 8) * midiRollData.timelineEnd;
                              return (
                                <g key={`midi-grid-x-${index}`}>
                                  <line
                                    x1={x}
                                    y1={midiRollData.chartPaddingY}
                                    x2={x}
                                    y2={MIDI_CHART_HEIGHT - midiRollData.chartPaddingY}
                                    stroke="hsl(var(--border))"
                                    strokeOpacity={0.45}
                                    strokeWidth={1}
                                  />
                                  <text
                                    x={x}
                                    y={MIDI_CHART_HEIGHT - 2}
                                    fontSize={10}
                                    textAnchor={index === 0 ? 'start' : index === 8 ? 'end' : 'middle'}
                                    fill="hsl(var(--muted-foreground))"
                                  >
                                    {formatSeconds(time)}
                                  </text>
                                </g>
                              );
                            })}
                            {Array.from({ length: 6 }).map((_, index) => {
                              const y = midiRollData.chartPaddingY + (index / 5) * midiRollData.innerHeight;
                              return (
                                <line
                                  key={`midi-grid-y-${index}`}
                                  x1={midiRollData.chartPaddingX}
                                  y1={y}
                                  x2={MIDI_CHART_WIDTH - midiRollData.chartPaddingX}
                                  y2={y}
                                  stroke="hsl(var(--border))"
                                  strokeOpacity={0.35}
                                  strokeWidth={1}
                                />
                              );
                            })}
                            {midiRollData.notes.map((note, index) => (
                              <rect
                                key={`midi-note-${index}`}
                                x={note.x}
                                y={note.y}
                                width={note.width}
                                height={note.height}
                                rx={2}
                                fill="hsl(var(--primary))"
                                fillOpacity={note.opacity}
                              />
                            ))}
                          </svg>
                        </div>
                        {midiRollData.truncated && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Showing first {MIDI_MAX_RENDERED_NOTES} notes for performance.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  MIDI generated successfully, but no playable notes were detected in this track.
                </p>
              )}
            </div>
          )}
        </div>

        {canDownloadMidiData && (
          <div className="flex-shrink-0 px-5 pb-4 pt-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="h-11 flex-1 rounded-2xl border-0 bg-foreground/5 text-sm font-semibold text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDownloadMidiData}
                className="h-11 flex-1 rounded-2xl text-sm font-semibold"
              >
                <Download className="mr-1 h-4 w-4" />
                Download MIDI (.mid)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
