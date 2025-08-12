// Interval names and their semitone distances
const intervalNames = {
  0: 'Unison',
  1: 'Minor 2nd',
  2: 'Major 2nd',
  3: 'Minor 3rd',
  4: 'Major 3rd',
  5: 'Perfect 4th',
  6: 'Tritone',
  7: 'Perfect 5th',
  8: 'Minor 6th',
  9: 'Major 6th',
  10: 'Minor 7th',
  11: 'Major 7th',
  12: 'Octave',
  13: 'Minor 9th',
  14: 'Major 9th',
  15: 'Minor 10th',
  16: 'Major 10th',
  17: 'Perfect 11th',
  19: 'Minor 13th',
  20: 'Major 13th'
};

// Note names for detection
const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

// Extended chord types for detection (separate from the chord tool)
const extendedChordTypes = [
  // Triads
  { name: 'Major', intervals: [0, 4, 7], required: [0, 4] },
  { name: 'Minor', intervals: [0, 3, 7], required: [0, 3] },
  { name: 'Diminished', intervals: [0, 3, 6], required: [0, 3, 6] },
  { name: 'Augmented', intervals: [0, 4, 8], required: [0, 4, 8] },
  { name: 'Sus2', intervals: [0, 2, 7], required: [0, 2] },
  { name: 'Sus4', intervals: [0, 5, 7], required: [0, 5] },
  
  // Seventh Chords
  { name: 'Major 7th', intervals: [0, 4, 7, 11], required: [0, 4, 11] },
  { name: 'Dominant 7th', intervals: [0, 4, 7, 10], required: [0, 4, 10] },
  { name: 'Minor 7th', intervals: [0, 3, 7, 10], required: [0, 3, 10] },
  { name: 'Minor Major 7th', intervals: [0, 3, 7, 11], required: [0, 3, 11] },
  { name: 'Half Diminished', intervals: [0, 3, 6, 10], required: [0, 3, 6, 10] },
  { name: 'Fully Diminished', intervals: [0, 3, 6, 9], required: [0, 3, 6, 9] },
  
  // Extended and Altered Chords
  { name: 'Major 9th', intervals: [0, 4, 7, 11, 14], required: [0, 4, 11, 14] },
  { name: 'Dominant 9th', intervals: [0, 4, 7, 10, 14], required: [0, 4, 10, 14] },
  { name: 'Minor 9th', intervals: [0, 3, 7, 10, 14], required: [0, 3, 10, 14] },
  { name: 'Major 11th', intervals: [0, 4, 7, 11, 14, 17], required: [0, 4, 11, 17] },
  { name: 'Minor 11th', intervals: [0, 3, 7, 10, 14, 17], required: [0, 3, 10, 17] },
  { name: '7#9', intervals: [0, 4, 7, 10, 15], required: [0, 4, 10, 15] },
  { name: '7b9', intervals: [0, 4, 7, 10, 13], required: [0, 4, 10, 13] },
  
  // Add chords
  { name: 'Add9', intervals: [0, 4, 7, 14], required: [0, 4, 14] },
  { name: 'Minor Add9', intervals: [0, 3, 7, 14], required: [0, 3, 14] },
  { name: '6/9', intervals: [0, 4, 7, 9, 14], required: [0, 4, 9, 14] },

  // Additional Jazz Voicings
  { name: 'Major 13th', intervals: [0, 4, 7, 11, 14, 17, 21], required: [0, 4, 11, 21] },
  { name: 'Dominant 13th', intervals: [0, 4, 7, 10, 14, 17, 21], required: [0, 4, 10, 21] },
  { name: 'Minor 13th', intervals: [0, 3, 7, 10, 14, 17, 21], required: [0, 3, 10, 21] },
  { name: '7#11', intervals: [0, 4, 7, 10, 18], required: [0, 4, 10, 18] },
  { name: '7b13', intervals: [0, 4, 7, 10, 20], required: [0, 4, 10, 20] },
  { name: '7alt', intervals: [0, 4, 7, 10, 15, 20], required: [0, 4, 10] },
  
  // Quartal and Modern Voicings
  { name: 'Quartal', intervals: [0, 5, 10, 15], required: [0, 5, 10] },
  { name: 'So What', intervals: [0, 5, 10, 15, 19], required: [0, 5, 10, 15] },
  { name: 'Mystic', intervals: [0, 6, 10, 16], required: [0, 6, 10] },
  
  // Slash Chords
  { name: 'Major/3rd', intervals: [-8, 0, 4, 7], required: [-8, 0, 4] },
  { name: 'Major/7th', intervals: [-1, 0, 4, 7], required: [-1, 0, 4] },
];

// Get note name and octave from MIDI number
const getNoteNameAndOctave = (midiNumber) => {
  // Adjust for A0 starting at MIDI 21
  const noteIndex = (midiNumber - 21) % 12;
  const baseOctave = Math.floor((midiNumber - 21) / 12);
  
  // For C through G#, increment the octave by 1
  // A, A#, B keep the base octave
  // This follows standard convention where C1 comes after B0
  const octave = (noteIndex >= 3) ? baseOctave + 1 : baseOctave;
  
  const noteName = noteNames[noteIndex];
  return { noteName, octave };
};

// Get interval name from semitone distance
const getIntervalName = (semitones) => {
  if (semitones === 0) return '';
  return intervalNames[semitones % 12] || `${semitones} semitones`;
};

// Helper function to determine chord inversion and voicing
const analyzeVoicing = (notes, rootMidi, chordIntervals) => {
  const sortedNotes = [...notes].sort((a, b) => a.midi - b.midi);
  const bassNote = sortedNotes[0].midi;
  const intervals = sortedNotes.map(note => (note.midi - rootMidi + 1200) % 12);
  
  // Determine inversion
  const bassInterval = (bassNote - rootMidi + 1200) % 12;
  let inversionName = '';
  if (bassInterval === 0) {
    inversionName = 'root position';
  } else if (bassInterval === 4 || bassInterval === 3) {
    inversionName = 'first inversion';
  } else if (bassInterval === 7) {
    inversionName = 'second inversion';
  } else if (bassInterval === 10 || bassInterval === 11) {
    inversionName = 'third inversion';
  }

  // Analyze voicing type
  let voicingType = '';
  const intervalGaps = [];
  for (let i = 0; i < sortedNotes.length - 1; i++) {
    intervalGaps.push(sortedNotes[i + 1].midi - sortedNotes[i].midi);
  }

  // Check for specific voicing patterns
  if (intervalGaps.every(gap => gap >= 6)) {
    voicingType = 'spread';
  } else if (intervalGaps.every(gap => gap <= 4)) {
    voicingType = 'close';
  } else if (intervalGaps.some(gap => gap >= 8)) {
    voicingType = 'open';
  }

  // Check for specific voicing types
  if (intervals.length >= 4) {
    if (intervals.includes(7) && !intervals.includes(3) && !intervals.includes(4)) {
      voicingType = 'shell';
    } else if (intervals.every(interval => interval % 4 === 0)) {
      voicingType = 'quartal';
    }
  }

  // Combine information
  let voicingInfo = [];
  if (inversionName) voicingInfo.push(inversionName);
  if (voicingType) voicingInfo.push(voicingType + ' voicing');
  
  return voicingInfo.length > 0 ? ` (${voicingInfo.join(', ')})` : '';
};

// Detect musical elements in a group of notes
export const detectMusicalElements = (notes, timeThreshold = 0.05) => { // 50ms threshold
  if (!notes || notes.length === 0) return null;

  // Group notes by time (within threshold)
  const timeGroups = [];
  const sortedByTime = [...notes].sort((a, b) => a.time - b.time);
  let currentGroup = [sortedByTime[0]];
  
  for (let i = 1; i < sortedByTime.length; i++) {
    const timeDiff = sortedByTime[i].time - sortedByTime[i-1].time;
    if (timeDiff <= timeThreshold) {
      currentGroup.push(sortedByTime[i]);
    } else {
      timeGroups.push([...currentGroup]);
      currentGroup = [sortedByTime[i]];
    }
  }
  timeGroups.push(currentGroup);

  // If all groups have the same number of notes, analyze them as similar structures
  const allGroupsHaveSameSize = timeGroups.every(group => group.length === timeGroups[0].length);
  
  if (allGroupsHaveSameSize) {
    // Get the analysis of the first group
    let firstGroupAnalysis;
    const firstGroup = timeGroups[0];

    if (firstGroup.length === 1) {
      // Single note analysis
      const { noteName } = getNoteNameAndOctave(firstGroup[0].midi);
      firstGroupAnalysis = {
        type: 'single',
        description: noteName
      };
    } else if (firstGroup.length === 2) {
      // Interval analysis
      const sortedNotes = [...firstGroup].sort((a, b) => a.midi - b.midi);
      const rootNote = sortedNotes[0].midi;
      const { noteName: rootName } = getNoteNameAndOctave(rootNote);
      const interval = sortedNotes[1].midi - rootNote;
      const intervalName = getIntervalName(interval);
      firstGroupAnalysis = {
        type: 'interval',
        description: `${rootName} ${intervalName}`
      };
    } else {
      // Chord analysis
      const chordName = detectChord(firstGroup);
      firstGroupAnalysis = {
        type: 'chord',
        description: chordName
      };
    }

    // If all groups have the same structure, return the common name
    if (firstGroupAnalysis) {
      return firstGroupAnalysis;
    }
  }

  // If we reach here, treat as a sequence
  return {
    type: 'sequence',
    description: timeGroups.map(group => {
      if (group.length === 1) {
        const { noteName } = getNoteNameAndOctave(group[0].midi);
        return noteName;
      } else if (group.length === 2) {
        const sortedNotes = [...group].sort((a, b) => a.midi - b.midi);
        const rootNote = sortedNotes[0].midi;
        const { noteName: rootName } = getNoteNameAndOctave(rootNote);
        const interval = sortedNotes[1].midi - rootNote;
        const intervalName = getIntervalName(interval);
        return intervalName ? `${rootName} ${intervalName}` : '';
      } else {
        const chordName = detectChord(group);
        return chordName || '';
      }
    }).filter(name => name !== '').join(', ')
  };
};

// Update the chord detection logic in detectMusicalElements function
const detectChord = (notes) => {
  const sortedNotes = [...notes].sort((a, b) => a.midi - b.midi);
  
  // Try each note as potential root
  for (let rootIndex = 0; rootIndex < sortedNotes.length; rootIndex++) {
    const rootNote = sortedNotes[rootIndex].midi;
    const intervals = sortedNotes.map(note => (note.midi - rootNote + 1200) % 12);
    
    for (const chord of extendedChordTypes) {
      const requiredIntervals = chord.required.map(i => i % 12);
      const chordIntervals = chord.intervals.map(i => i % 12);
      
      // Check if all required intervals are present
      const hasRequiredIntervals = requiredIntervals.every(req => 
        intervals.includes(req)
      );
      
      // Check if all present intervals are part of the chord
      const allIntervalsValid = intervals.every(interval =>
        chordIntervals.includes(interval)
      );
      
      if (hasRequiredIntervals && allIntervalsValid) {
        const { noteName } = getNoteNameAndOctave(rootNote);
        const voicingInfo = analyzeVoicing(notes, rootNote, chordIntervals);
        return `${noteName} ${chord.name}${voicingInfo}`;
      }
    }
  }
  
  return '';
};
