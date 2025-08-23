// Types for project state comparison (using JSDoc for type hints in JavaScript)
/**
 * @typedef {Object} ProjectState
 * @property {Object} midiData
 * @property {Array<{notes: Array<{id: string, midi: number, time: number, duration: number, velocity: number, name?: string}>}>} midiData.tracks
 * @property {Array<{id: string, text: string, x: number, y: number, fontSize?: number}>} textAnnotations
 * @property {string|null} backgroundImage
 * @property {{leftHand: string, rightHand: string}|null} customColors
 * @property {{numerator: number, denominator: number}} timeSignature
 * @property {number} bpm
 * @property {string} name
 */

/**
 * Helper function to compare arrays of notes
 * @param {Array} current 
 * @param {Array} saved 
 * @returns {boolean}
 */
function compareNotes(current, saved) {
  if (current.length !== saved.length) return false;
  
  // Sort both arrays by time to ensure consistent comparison
  const sortedCurrent = [...current].sort((a, b) => a.time - b.time);
  const sortedSaved = [...saved].sort((a, b) => a.time - b.time);
  
  return sortedCurrent.every((note, index) => {
    const savedNote = sortedSaved[index];
    return (
      note.midi === savedNote.midi &&
      note.time === savedNote.time &&
      note.duration === savedNote.duration &&
      note.velocity === savedNote.velocity
    );
  });
}

/**
 * Helper function to compare arrays of text annotations
 * @param {Array} current 
 * @param {Array} saved 
 * @returns {boolean}
 */
function compareAnnotations(current, saved) {
  if (current.length !== saved.length) return false;
  
  const sortedCurrent = [...current].sort((a, b) => a.id.localeCompare(b.id));
  const sortedSaved = [...saved].sort((a, b) => a.id.localeCompare(b.id));
  
  return sortedCurrent.every((annotation, index) => {
    const savedAnnotation = sortedSaved[index];
    return (
      annotation.text === savedAnnotation.text &&
      annotation.x === savedAnnotation.x &&
      annotation.y === savedAnnotation.y &&
      annotation.fontSize === savedAnnotation.fontSize
    );
  });
}

/**
 * Main comparison function
 * @param {ProjectState} current 
 * @param {ProjectState} lastSaved 
 * @returns {boolean}
 */
export function hasStateChanged(current, lastSaved) {
  if (!lastSaved) return true;
  
  // Compare basic properties
  if (
    current.name !== lastSaved.name ||
    current.bpm !== lastSaved.bpm ||
    current.timeSignature.numerator !== lastSaved.timeSignature.numerator ||
    current.timeSignature.denominator !== lastSaved.timeSignature.denominator ||
    current.backgroundImage !== lastSaved.backgroundImage
  ) {
    return true;
  }
  
  // Compare custom colors
  if (
    (current.customColors?.leftHand !== lastSaved.customColors?.leftHand) ||
    (current.customColors?.rightHand !== lastSaved.customColors?.rightHand)
  ) {
    return true;
  }
  
  // Compare notes
  if (!compareNotes(
    current.midiData.tracks[0].notes,
    lastSaved.midiData.tracks[0].notes
  )) {
    return true;
  }
  
  // Compare text annotations
  if (!compareAnnotations(current.textAnnotations, lastSaved.textAnnotations)) {
    return true;
  }
  
  return false;
}

/**
 * Get a summary of what changed
 * @param {ProjectState} current 
 * @param {ProjectState} lastSaved 
 * @returns {string[]}
 */
export function getChangeSummary(current, lastSaved) {
  if (!lastSaved) return ['New project'];
  
  const changes = [];
  
  if (current.name !== lastSaved.name) {
    changes.push('Project name');
  }
  
  if (current.bpm !== lastSaved.bpm) {
    changes.push('Tempo');
  }
  
  if (
    current.timeSignature.numerator !== lastSaved.timeSignature.numerator ||
    current.timeSignature.denominator !== lastSaved.timeSignature.denominator
  ) {
    changes.push('Time signature');
  }
  
  if (current.backgroundImage !== lastSaved.backgroundImage) {
    changes.push('Background image');
  }
  
  if (
    (current.customColors?.leftHand !== lastSaved.customColors?.leftHand) ||
    (current.customColors?.rightHand !== lastSaved.customColors?.rightHand)
  ) {
    changes.push('Note colors');
  }
  
  if (!compareNotes(
    current.midiData.tracks[0].notes,
    lastSaved.midiData.tracks[0].notes
  )) {
    changes.push('Notes');
  }
  
  if (!compareAnnotations(current.textAnnotations, lastSaved.textAnnotations)) {
    changes.push('Text annotations');
  }
  
  return changes;
} 
