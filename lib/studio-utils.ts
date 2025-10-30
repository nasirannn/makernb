/**
 * Studio Utility Functions
 * Common utility functions for studio panel operations
 */

import musicOptions from '@/data/music-options.json';
import { BPM_VALUES } from './studio-constants';

// Extract options from musicOptions
const { genres, vibes, grooveTypes, leadInstruments, drumKits, bassTones, harmonyPalettes } = musicOptions;

/**
 * Get a random BPM value from the specified tempo mode
 * @param tempoMode - The tempo mode ('slow', 'moderate', 'medium')
 * @returns A random BPM value from the mode's range
 */
export const getRandomBpm = (tempoMode: 'slow' | 'moderate' | 'medium'): number => {
  const bpmOptions = BPM_VALUES[tempoMode];
  const randomIndex = Math.floor(Math.random() * bpmOptions.length);
  return bpmOptions[randomIndex];
};

/**
 * Replace text in style textarea, removing existing keywords and adding new text
 * @param styleText - Current style text
 * @param keywords - Keywords to remove from text
 * @param newText - New text to add
 * @returns Updated style text
 */
export const replaceTextInStyle = (styleText: string, keywords: string[], newText: string): string => {
  const otherText = styleText.split(',').filter(item => {
    const trimmed = item.trim().toLowerCase();
    return !keywords.includes(trimmed);
  }).join(',').replace(/^,|,$/g, '').trim();
  return otherText ? `${otherText}, ${newText}` : newText;
};

/**
 * Update all studio states based on textarea content
 * @param text - Text content from textarea
 * @param setters - Object containing all setter functions
 */
export const updateStatesFromTextarea = (
  text: string,
  setters: {
    setSelectedGenre: (genre: string) => void;
    setSelectedVibe: (vibe: string) => void;
    setGrooveType: (type: string) => void;
    setBpmMode: (mode: 'slow' | 'moderate' | 'medium' | '') => void;
    setBpm: (bpm: number[]) => void;
    setLeadInstrument: (instruments: string[]) => void;
    setDrumKit: (kit: string) => void;
    setBassTone: (tone: string) => void;
    setHarmonyPalette: (palette: string) => void;
  },
  currentStates: {
    selectedGenre: string;
    selectedVibe: string;
    grooveType: string;
    bpmMode: 'slow' | 'moderate' | 'medium' | '';
    leadInstrument: string[];
    drumKit: string;
    bassTone: string;
    harmonyPalette: string;
  }
) => {
  // Prevent infinite loops by batching all state updates
  const textLower = text.toLowerCase();
  const updates: Array<() => void> = [];

  // Check for genre options
  const genreFound = genres.find(genre => textLower.includes(genre.name.toLowerCase()));
  if (genreFound && currentStates.selectedGenre !== genreFound.id) {
    updates.push(() => setters.setSelectedGenre(genreFound.id));
  } else if (!genreFound && currentStates.selectedGenre) {
    updates.push(() => setters.setSelectedGenre(""));
  }

  // Check for vibe options
  const vibeFound = vibes.find(vibe => textLower.includes(vibe.name.toLowerCase()));
  if (vibeFound && currentStates.selectedVibe !== vibeFound.id) {
    updates.push(() => setters.setSelectedVibe(vibeFound.id));
  } else if (!vibeFound && currentStates.selectedVibe) {
    updates.push(() => setters.setSelectedVibe(""));
  }

  // Check for groove options
  const grooveFound = grooveTypes.find(groove => textLower.includes(groove.name.toLowerCase()));
  if (grooveFound && currentStates.grooveType !== grooveFound.id) {
    updates.push(() => setters.setGrooveType(grooveFound.id));
  } else if (!grooveFound && currentStates.grooveType) {
    updates.push(() => setters.setGrooveType(""));
  }

  // Check for tempo options
  let newBpmMode: 'slow' | 'moderate' | 'medium' | '' = currentStates.bpmMode;
  let shouldUpdateBpm = false;

  if (textLower.includes('slow') && currentStates.bpmMode !== 'slow') {
    newBpmMode = 'slow';
    shouldUpdateBpm = true;
  } else if (textLower.includes('moderate') && currentStates.bpmMode !== 'moderate') {
    newBpmMode = 'moderate';
    shouldUpdateBpm = true;
  } else if (textLower.includes('medium') && currentStates.bpmMode !== 'medium') {
    newBpmMode = 'medium';
    shouldUpdateBpm = true;
  } else if (!textLower.includes('slow') && !textLower.includes('moderate') && !textLower.includes('medium') && currentStates.bpmMode) {
    newBpmMode = '';
    shouldUpdateBpm = true;
  }

  if (shouldUpdateBpm) {
    updates.push(() => {
      setters.setBpmMode(newBpmMode);
      if (newBpmMode) {
        setters.setBpm([getRandomBpm(newBpmMode)]);
      } else {
        setters.setBpm([getRandomBpm('slow')]);
      }
    });
  }

  // Check for instrument options
  const instrumentFound = leadInstruments.find(instrument => textLower.includes(instrument.name.toLowerCase()));
  if (instrumentFound && !currentStates.leadInstrument.includes(instrumentFound.id)) {
    updates.push(() => setters.setLeadInstrument([instrumentFound.id]));
  } else if (!instrumentFound && currentStates.leadInstrument.length > 0) {
    updates.push(() => setters.setLeadInstrument([]));
  }

  // Check for drum kit options
  const drumFound = drumKits.find(kit => textLower.includes(kit.name.toLowerCase()));
  if (drumFound && currentStates.drumKit !== drumFound.id) {
    updates.push(() => setters.setDrumKit(drumFound.id));
  } else if (!drumFound && currentStates.drumKit) {
    updates.push(() => setters.setDrumKit(""));
  }

  // Check for bass tone options
  const bassFound = bassTones.find(tone => textLower.includes(tone.name.toLowerCase()));
  if (bassFound && currentStates.bassTone !== bassFound.id) {
    updates.push(() => setters.setBassTone(bassFound.id));
  } else if (!bassFound && currentStates.bassTone) {
    updates.push(() => setters.setBassTone(""));
  }

  // Check for harmony palette options
  const harmonyFound = harmonyPalettes.find(palette => textLower.includes(palette.name.toLowerCase()));
  if (harmonyFound && currentStates.harmonyPalette !== harmonyFound.id) {
    updates.push(() => setters.setHarmonyPalette(harmonyFound.id));
  } else if (!harmonyFound && currentStates.harmonyPalette) {
    updates.push(() => setters.setHarmonyPalette(""));
  }

  // Execute all updates in the next tick to prevent infinite loops
  if (updates.length > 0) {
    setTimeout(() => {
      updates.forEach(update => update());
    }, 0);
  }
};
