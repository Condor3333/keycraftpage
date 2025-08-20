// Scale patterns (intervals from root note)
export const scalePatterns = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11],
  augmented: [0, 3, 4, 7, 8, 11],

  // Arpeggio patterns
  majorArp: [0, 4, 7],
  minorArp: [0, 3, 7],
  diminishedArp: [0, 3, 6],
  augmentedArp: [0, 4, 8],
  sus2Arp: [0, 2, 7],
  sus4Arp: [0, 5, 7],
  major7Arp: [0, 4, 7, 11],
  dominant7Arp: [0, 4, 7, 10],
  minor7Arp: [0, 3, 7, 10],
  diminished7Arp: [0, 3, 6, 9],
  halfDiminished7Arp: [0, 3, 6, 10],
  major9Arp: [0, 4, 7, 11, 14],
  dominant9Arp: [0, 4, 7, 10, 14],
  minor9Arp: [0, 3, 7, 10, 14],
  add9Arp: [0, 4, 7, 14],
  minorAdd9Arp: [0, 3, 7, 14],
  major6Arp: [0, 4, 7, 9],
  minor6Arp: [0, 3, 7, 9],
  major69Arp: [0, 4, 7, 9, 14],
  dominant7b5Arp: [0, 4, 6, 10],
  dominant7sharp5Arp: [0, 4, 8, 10],
  power5Arp: [0, 7],
};

// Scale names for display
export const scaleNames = {
  chromatic: 'Chromatic',
  major: 'Major',
  minor: 'Natural Minor',
  harmonicMinor: 'Harmonic Minor',
  melodicMinor: 'Melodic Minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  locrian: 'Locrian',
  pentatonicMajor: 'Major Pentatonic',
  pentatonicMinor: 'Minor Pentatonic',
  blues: 'Blues',
  wholeTone: 'Whole Tone',
  diminished: 'Diminished',
  augmented: 'Augmented',

  // Arpeggios
  majorArp: 'Major Arpeggio',
  minorArp: 'Minor Arpeggio',
  diminishedArp: 'Diminished Arpeggio',
  augmentedArp: 'Augmented Arpeggio',
  sus2Arp: 'Sus2 Arpeggio',
  sus4Arp: 'Sus4 Arpeggio',
  major7Arp: 'Major 7th Arpeggio',
  dominant7Arp: 'Dominant 7th Arpeggio',
  minor7Arp: 'Minor 7th Arpeggio',
  diminished7Arp: 'Diminished 7th Arpeggio',
  halfDiminished7Arp: 'Half-Diminished 7th Arpeggio',
  major9Arp: 'Major 9th Arpeggio',
  dominant9Arp: 'Dominant 9th Arpeggio',
  minor9Arp: 'Minor 9th Arpeggio',
  add9Arp: 'Add 9 Arpeggio',
  minorAdd9Arp: 'Minor Add 9 Arpeggio',
  major6Arp: 'Major 6th Arpeggio',
  minor6Arp: 'Minor 6th Arpeggio',
  major69Arp: 'Major 6/9 Arpeggio',
  dominant7b5Arp: '7b5 Arpeggio',
  dominant7sharp5Arp: '7#5 Arpeggio',
  power5Arp: 'Power (5) Arpeggio',
};

// Key definitions (MIDI note numbers for each root note)
export const keys = {
  'C': 60,
  'C#/Db': 61,
  'D': 62,
  'D#/Eb': 63,
  'E': 64,
  'F': 65,
  'F#/Gb': 66,
  'G': 67,
  'G#/Ab': 68,
  'A': 69,
  'A#/Bb': 70,
  'B': 71,
};

// Function to get the root note for a given key and octave
export const getRootNote = (key, octave = 4) => {
  const baseNote = keys[key];
  if (baseNote === undefined) return 60; // Default to C4 if key not found
  return baseNote + ((octave - 4) * 12); // Adjust for octave
};

// Get notes in a scale starting from a root note
export const getScaleNotes = (rootMidi, scaleType) => {
  const pattern = scalePatterns[scaleType] || scalePatterns.chromatic;
  const notes = [];
  let octave = 0;

  // For ascending scale
  while (rootMidi + pattern[pattern.length - 1] + (octave * 12) <= 127) {
    pattern.forEach(interval => {
      const note = rootMidi + interval + (octave * 12);
      if (note <= 127) {
        notes.push(note);
      }
    });
    octave++;
  }

  return notes;
};

// Get notes in a descending scale
export const getDescendingScaleNotes = (rootMidi, scaleType) => {
  const pattern = scalePatterns[scaleType] || scalePatterns.chromatic;
  const notes = [];
  let octave = 0;

  // For descending scale
  while (rootMidi - pattern[pattern.length - 1] - (octave * 12) >= 0) {
    [...pattern].reverse().forEach(interval => {
      const note = rootMidi - interval - (octave * 12);
      if (note >= 0) {
        notes.push(note);
      }
    });
    octave++;
  }

  return notes;
};

// Get scale notes between two MIDI notes with key consideration
export const getScaleNotesBetween = (startMidi, endMidi, scaleType, key = 'C') => {
  if (startMidi === endMidi) return [startMidi];
  
  // Find the nearest root note below the start note
  const rootNote = getRootNote(key, Math.floor((startMidi - 12) / 12));
  const pattern = scalePatterns[scaleType];
  
  if (!pattern) return [startMidi, endMidi];

  const ascending = startMidi < endMidi;
  let notes = [];
  
  if (ascending) {
    // Generate all possible notes in the scale from the root
    let currentOctave = Math.floor((startMidi - 12) / 12);
    let currentNote = rootNote;
    
    while (currentNote <= endMidi) {
      pattern.forEach(interval => {
        const note = rootNote + interval + ((currentOctave - Math.floor((rootNote - 12) / 12)) * 12);
        if (note >= startMidi && note <= endMidi) {
          notes.push(note);
        }
      });
      currentOctave++;
      currentNote = rootNote + ((currentOctave - Math.floor((rootNote - 12) / 12)) * 12);
    }
  } else {
    // For descending scale
    let currentOctave = Math.floor((startMidi - 12) / 12);
    let currentNote = rootNote;
    
    while (currentNote >= endMidi) {
      [...pattern].reverse().forEach(interval => {
        const note = rootNote + interval + ((currentOctave - Math.floor((rootNote - 12) / 12)) * 12);
        if (note <= startMidi && note >= endMidi) {
          notes.push(note);
        }
      });
      currentOctave--;
      currentNote = rootNote + ((currentOctave - Math.floor((rootNote - 12) / 12)) * 12);
    }
    notes.reverse();
  }

  // Ensure start and end notes are included if they're not already
  if (notes[0] !== startMidi) notes.unshift(startMidi);
  if (notes[notes.length - 1] !== endMidi) notes.push(endMidi);
  
  return notes;
};

// Get a formatted name for the scale and key
export const getScaleKeyName = (scaleType, key) => {
  const scaleName = scaleNames[scaleType] || 'Unknown Scale';
  return `${key} ${scaleName}`;
};
