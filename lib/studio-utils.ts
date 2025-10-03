/**
 * Studio Utility Functions
 * Common utility functions for studio panel operations
 */

import musicOptions from '@/data/music-options.json';

// Extract options from musicOptions
const { genres, vibes, grooveTypes, leadInstruments, drumKits, bassTones, harmonyPalettes } = musicOptions;

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
  const textLower = text.toLowerCase();
  
  // Check for genre options
  const genreFound = genres.find(genre => textLower.includes(genre.name.toLowerCase()));
  if (genreFound && currentStates.selectedGenre !== genreFound.id) {
    setters.setSelectedGenre(genreFound.id);
  } else if (!genreFound && currentStates.selectedGenre) {
    setters.setSelectedGenre("");
  }
  
  // Check for vibe options
  const vibeFound = vibes.find(vibe => textLower.includes(vibe.name.toLowerCase()));
  if (vibeFound && currentStates.selectedVibe !== vibeFound.id) {
    setters.setSelectedVibe(vibeFound.id);
  } else if (!vibeFound && currentStates.selectedVibe) {
    setters.setSelectedVibe("");
  }
  
  // Check for groove options
  const grooveFound = grooveTypes.find(groove => textLower.includes(groove.name.toLowerCase()));
  if (grooveFound && currentStates.grooveType !== grooveFound.id) {
    setters.setGrooveType(grooveFound.id);
  } else if (!grooveFound && currentStates.grooveType) {
    setters.setGrooveType("");
  }
  
  // Check for tempo options
  if (textLower.includes('slow') && currentStates.bpmMode !== 'slow') {
    setters.setBpmMode('slow');
    setters.setBpm([60]);
  } else if (textLower.includes('moderate') && currentStates.bpmMode !== 'moderate') {
    setters.setBpmMode('moderate');
    setters.setBpm([90]);
  } else if (textLower.includes('medium') && currentStates.bpmMode !== 'medium') {
    setters.setBpmMode('medium');
    setters.setBpm([110]);
  } else if (!textLower.includes('slow') && !textLower.includes('moderate') && !textLower.includes('medium') && currentStates.bpmMode) {
    setters.setBpmMode('');
    setters.setBpm([60]);
  }
  
  // Check for instrument options
  const instrumentFound = leadInstruments.find(instrument => textLower.includes(instrument.name.toLowerCase()));
  if (instrumentFound && !currentStates.leadInstrument.includes(instrumentFound.id)) {
    setters.setLeadInstrument([instrumentFound.id]);
  } else if (!instrumentFound && currentStates.leadInstrument.length > 0) {
    setters.setLeadInstrument([]);
  }
  
  // Check for drum kit options
  const drumFound = drumKits.find(kit => textLower.includes(kit.name.toLowerCase()));
  if (drumFound && currentStates.drumKit !== drumFound.id) {
    setters.setDrumKit(drumFound.id);
  } else if (!drumFound && currentStates.drumKit) {
    setters.setDrumKit("");
  }
  
  // Check for bass tone options
  const bassFound = bassTones.find(tone => textLower.includes(tone.name.toLowerCase()));
  if (bassFound && currentStates.bassTone !== bassFound.id) {
    setters.setBassTone(bassFound.id);
  } else if (!bassFound && currentStates.bassTone) {
    setters.setBassTone("");
  }
  
  // Check for harmony palette options
  const harmonyFound = harmonyPalettes.find(palette => textLower.includes(palette.name.toLowerCase()));
  if (harmonyFound && currentStates.harmonyPalette !== harmonyFound.id) {
    setters.setHarmonyPalette(harmonyFound.id);
  } else if (!harmonyFound && currentStates.harmonyPalette) {
    setters.setHarmonyPalette("");
  }
};
