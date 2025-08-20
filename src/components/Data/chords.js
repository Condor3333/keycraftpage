// Chord type definitions with intervals
export const chordTypes = [
  // Basic Triads (easily playable)
  { value: 'major', label: 'Major', intervals: [0, 4, 7] }, // Root, Major Third, Perfect Fifth
  { value: 'minor', label: 'Minor', intervals: [0, 3, 7] }, // Root, Minor Third, Perfect Fifth
  { value: 'diminished', label: 'Diminished', intervals: [0, 3, 6] }, // Root, Minor Third, Diminished Fifth
  { value: 'augmented', label: 'Augmented', intervals: [0, 4, 8] }, // Root, Major Third, Augmented Fifth
  { value: 'sus2', label: 'Sus2', intervals: [0, 2, 7] }, // Root, Major Second, Perfect Fifth
  { value: 'sus4', label: 'Sus4', intervals: [0, 5, 7] }, // Root, Perfect Fourth, Perfect Fifth

  // Octave Chord
  { value: 'octave', label: 'Octave', intervals: [0, 12] }, // Root and octave above

  // Common Seventh Chords (standard piano voicings)
  { value: 'major7', label: 'Major 7th', intervals: [0, 4, 7, 11] }, // Root, Major Third, Perfect Fifth, Major Seventh
  { value: 'dominant7', label: 'Dominant 7th', intervals: [0, 4, 7, 10] }, // Root, Major Third, Perfect Fifth, Minor Seventh
  { value: 'minor7', label: 'Minor 7th', intervals: [0, 3, 7, 10] }, // Root, Minor Third, Perfect Fifth, Minor Seventh
  { value: 'diminished7', label: 'Diminished 7th', intervals: [0, 3, 6, 9] }, // Root, Minor Third, Diminished Fifth, Diminished Seventh
  { value: 'half-diminished7', label: 'Half-Diminished 7th', intervals: [0, 3, 6, 10] }, // Root, Minor Third, Diminished Fifth, Minor Seventh

  // Common Extended Chords (practical piano voicings)
  { value: 'major9', label: 'Major 9th', intervals: [0, 4, 7, 11, 14] }, // Major 7th + Major 9th
  { value: 'dominant9', label: 'Dominant 9th', intervals: [0, 4, 7, 10, 14] }, // Dominant 7th + Major 9th
  { value: 'minor9', label: 'Minor 9th', intervals: [0, 3, 7, 10, 14] }, // Minor 7th + Major 9th

  // Common Added Tone Chords
  { value: 'add9', label: 'Add 9', intervals: [0, 4, 7, 14] }, // Major + Major 9th
  { value: 'madd9', label: 'Minor Add 9', intervals: [0, 3, 7, 14] }, // Minor + Major 9th

  // 6th Chords (common in jazz piano)
  { value: 'major6', label: 'Major 6th', intervals: [0, 4, 7, 9] }, // Major + Major 6th
  { value: 'minor6', label: 'Minor 6th', intervals: [0, 3, 7, 9] }, // Minor + Major 6th
  { value: 'major69', label: 'Major 6/9', intervals: [0, 4, 7, 9, 14] }, // Major 6th + Major 9th

  // Basic Altered Dominants (common in jazz piano)
  { value: '7b5', label: '7b5', intervals: [0, 4, 6, 10] }, // Dominant 7th with flat 5
  { value: '7#5', label: '7#5', intervals: [0, 4, 8, 10] }, // Dominant 7th with sharp 5

  // Power Chord (common in all styles)
  { value: '5', label: 'Power (5)', intervals: [0, 7] }, // Root and Fifth only
];

// Note names for chord naming
export const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

// Get chord notes from root note and chord type
export const getChordNotes = (rootNote, chordType) => {
  const chord = chordTypes.find(type => type.value === chordType);
  return chord ? chord.intervals.map(interval => rootNote + interval) : [];
};

// Get chord name from root note and chord type
export const getChordName = (rootMidiNote, chordType) => {
  // MIDI 21 is A0, so we need to adjust the calculation
  const noteIndex = (rootMidiNote - 21) % 12;
  const rootName = noteNames[noteIndex];
  const chord = chordTypes.find(type => type.value === chordType);
  return chord ? `${rootName} ${chord.label}` : '';
};
