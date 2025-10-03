/**
 * Music Resources Mapping
 * Maps instrument and drum kit IDs to their corresponding icons and audio files
 */

// Lead Instrument Resources
export const getInstrumentIcon = (instrumentId: string): string => {
  const iconMap: { [key: string]: string } = {
    'saxophone': '/icons/Saxophone.svg',
    'rhodes-piano': '/icons/Rhodes-Piano.svg',
    'smooth-electric-guitar': '/icons/Smooth-Electric-Guitar.svg',
    'synth-lead': '/icons/Synth-Lead.svg'
  };
  return iconMap[instrumentId] || '';
};

export const getInstrumentAudio = (instrumentId: string): string => {
  const audioMap: { [key: string]: string } = {
    'saxophone': '/audio/Saxophone.mp3',
    'rhodes-piano': '/audio/Rhodes-Piano.mp3',
    'smooth-electric-guitar': '/audio/Smooth-Electric-Guitar.mp3',
    'synth-lead': '/audio/Synth.mp3'
  };
  return audioMap[instrumentId] || '';
};

// Drum Kit Resources
export const getDrumKitIcon = (kitId: string): string => {
  const iconMap: { [key: string]: string } = {
    'acoustic-kit': '/icons/Acoustic-Kit.svg',
    'electronic-kit': '/icons/Electronic-Kit.svg',
    'boom-bap-kit': '/icons/90s-Boom-Bap-Kit.svg',
    'lo-fi-kit': '/icons/Lo-fi Kit.svg'
  };
  return iconMap[kitId] || '';
};

export const getDrumKitAudio = (kitId: string): string => {
  const audioMap: { [key: string]: string } = {
    'acoustic-kit': '/audio/Acoustic-Kit.mp3',
    'electronic-kit': '/audio/Electronic-Kit.mp3',
    'boom-bap-kit': '/audio/90s-Boom-Bap-Kit.mp3',
    'lo-fi-kit': '/audio/Lo-fi-Kit.mp3'
  };
  return audioMap[kitId] || '';
};
