import React, { useMemo, useState, useEffect } from 'react';
import './Grid.css';
import { getScaleNotes, keys, scalePatterns } from './Data/scales';

const Grid = ({ 
  // width, // This prop was unused for main container width
  // height, // This prop was unused for main container height
  cellSize = 32, 
  noteRange, 
  songDuration, 
  hoverColumn, 
  showGrid,
  timeSignature = { numerator: 4, denominator: 4 }, // Add default time signature
  songPosition,
  PIXELS_PER_SECOND,
  heightFactor,
  playbackSpeed = 1, // Add playbackSpeed prop
  isSnapToGridActive = false,
  selectedDuration = 1,
  showScaleHighlight = false,
  selectedScale = 'chromatic',
  selectedKey = 'C',
  bpm = 120, // Add BPM prop with default value
  canvasWidth, 
  canvasHeight, // NEW: height of the roll container (passed from Roll)
  isPianoFullscreen, // ADDED: Receive isPianoFullscreen prop
  zoomLevel = 1 // ADDED: Receive zoom level prop
}) => {
  // REMOVED: Internal containerWidth state and its useEffect
  // const [containerWidth, setContainerWidth] = useState(0);
  // useEffect(() => {
  //   const updateWidth = () => {
  //     const container = document.querySelector('.grid-container');
  //     if (container) {
  //       setContainerWidth(container.offsetWidth);
  //     }
  //   };
  //   updateWidth();
  //   window.addEventListener('resize', updateWidth);
  //   return () => window.removeEventListener('resize', updateWidth);
  // }, []);

  // ADDED: console.log for debugging
  // console.log('Grid.jsx: Received isPianoFullscreen:', isPianoFullscreen);

  // Constants shared with Roll.jsx for vertical positioning
  const KEYBOARD_HEIGHT = 100; // Must match KEYBOARD_HEIGHT in Roll.jsx

  // Derive the drawable (note) area height so grid lines can align with notes
  const drawableHeight = (canvasHeight || 0) - KEYBOARD_HEIGHT;

  // Fixed reference BPM used for grid calculations
  const isBlackKey = (midiNote) => {
    const note = (midiNote - 21) % 12;
    return [1, 4, 6, 9, 11].includes(note); // A#, C#, D#, F#, G#
  };

  // Helper function to count white keys in a range
  const countWhiteKeysInRange = (min, max) => {
    if (!min || !max) return 0;
    let count = 0;
    for (let midi = min; midi <= max; midi++) {
      if (!isBlackKey(midi)) count++;
    }
    return count;
  };

  // Memoized calculation for number of white keys and their pixel width
  const { totalWhiteKeysInKeyboardRange, whiteKeyPixelWidth } = useMemo(() => {
    if (canvasWidth === 0 || !noteRange) return { totalWhiteKeysInKeyboardRange: 0, whiteKeyPixelWidth: 0 }; // USE canvasWidth
    const count = countWhiteKeysInRange(noteRange.min, noteRange.max);
    return {
      totalWhiteKeysInKeyboardRange: count,
      whiteKeyPixelWidth: count > 0 ? canvasWidth / count : 0, // USE canvasWidth
    };
  }, [canvasWidth, noteRange]); // USE canvasWidth in dependency array

  // Helper function to get X position for a MIDI note in pixels
  const getXPixelPosition = (midiNote) => {
    if (whiteKeyPixelWidth === 0 || !noteRange) return 0;

    let precedingWhiteKeyIndex = -1; // Index of the white key immediately before midiNote or group of black keys
    let currentMidi = noteRange.min;
    let whiteKeyCounter = 0;

    // Find the index of the white key just before midiNote
    // Or, if midiNote is white, its own index among white keys
    while(currentMidi < midiNote) {
        if (!isBlackKey(currentMidi)) {
            precedingWhiteKeyIndex = whiteKeyCounter;
            whiteKeyCounter++;
        }
        currentMidi++;
    }

    if (isBlackKey(midiNote)) {
      // Center of black key is at the boundary after its preceding white key
      // If precedingWhiteKeyIndex is -1 (e.g. range starts with A#0, A0 not in range), 
      // this correctly defaults to ( -1 + 1 ) * w = 0, meaning black key starts at left edge.
      // However, a black key usually doesn't start at the very edge of a keyboard (A#0 starts ~0.5W of A0).
      // This specific edge case (first key in range is black AND its preceding white is not in range)
      // might need a slight offset if visual feels off, but (precedingWhiteKeyIndex + 1) is the general rule from 3D keyboard.
      // If A0 is index -1, then A#0 is centered at `(-1 + 1) * whiteKeyPixelWidth = 0`. This might be too left.
      // A more robust way for very first black key is needed if it looks bad.
      // Let's use the general logic: center is boundary AFTER preceding white key.
      // If no preceding white key in range, precedingWhiteKeyIndex is -1. Center = (-1+1)*w = 0.
      return (precedingWhiteKeyIndex + 1) * whiteKeyPixelWidth; 
    } else {
      // If midiNote is white, currentMidi is now equal to midiNote.
      // whiteKeyCounter is now the 0-indexed count of this whiteKey.
      return whiteKeyCounter * whiteKeyPixelWidth; // Start of white key slot
    }
  };

  // Without useMemo, the grid calculations would run on every render
  // With useMemo, these calculations only run when timeSignature, songDuration, cellSize, or noteRange changes, even if the component re-renders for other reasons (like songPosition changes)
  const gridData = useMemo(() => {

    const beatsPerBar = timeSignature.numerator;
    const beatValue = 4 / timeSignature.denominator; // Convert denominator to quarter notes
    const quarterNotesPerBar = beatsPerBar * beatValue;
    const totalBars = Math.ceil((songDuration + 30) * (4 / quarterNotesPerBar)); // Add extra bars and convert to musical bars
    const totalCols = noteRange ? noteRange.max - noteRange.min + 1 : 0;
    
    // Grid calculations use a fixed reference BPM so visuals stay constant regardless of song tempo
    const fixedBpm = 120;
    const beatDuration = (60 / fixedBpm) / 2; // seconds per beat at the fixed BPM, divided by 2 for visual spacing
    
    // NOTE: barHeight is no longer used for line placement but is kept for potential external sizing logic
    const barHeight = PIXELS_PER_SECOND * beatDuration * beatsPerBar;
    
    // Calculate subdivisions based on the selected duration
    // For quarter notes (1), we'll have 1 subdivision per beat
    // For 8th notes (0.5), we'll have 2 subdivisions per beat
    // For 16th notes (0.25), we'll have 4 subdivisions per beat
    // For half notes (2), we'll have 1 subdivision every 2 beats
    // For whole notes (4), we'll have 1 subdivision every 4 beats
    const subdivisionsPerBeat = (() => {
      switch (selectedDuration) {
        case 0.25: return 4; // 16th notes: 4 subdivisions per beat
        case 0.5: return 2;  // 8th notes: 2 subdivisions per beat
        case 2: return 0.5;  // Half notes: 1 subdivision every 2 beats
        case 4: return 0.25; // Whole notes: 1 subdivision every 4 beats
        case 1: default: return 1; // Quarter notes: 1 subdivision per beat
      }
    })();
    
    return {
      beatsPerBar,
      totalBars,
      totalCols,
      barHeight,
      subdivisionsPerBeat,
      beatDuration
    };
  }, [timeSignature, songDuration, cellSize, noteRange, selectedDuration, PIXELS_PER_SECOND, heightFactor]); // Added heightFactor and cellSize

  // Improved scale highlight calculation
  const scaleHighlights = useMemo(() => {
    if (!showScaleHighlight || selectedScale === 'chromatic' || !noteRange) return [];
    const pattern = scalePatterns[selectedScale] || [];
    if (!pattern.length) return [];
    const rootMidi = keys[selectedKey] || 60;
    const rootPitchClass = rootMidi % 12;
    const highlights = [];
    for (let midi = noteRange.min; midi <= noteRange.max; midi++) {
      const currentPitchClass = midi % 12;
      if (pattern.some(interval => (rootPitchClass + interval) % 12 === currentPitchClass)) {
        highlights.push(midi);
      }
    }
    return highlights;
  }, [showScaleHighlight, selectedScale, selectedKey, noteRange]); // Removed keys, scalePatterns, stable

  const renderHighlight = (midiNote, isBlack) => {
    const highlightWidthBase = whiteKeyPixelWidth; // Using this as the base for calculations

    let leftPosition;
    let highlightWidth;
    let backgroundColor, borderColor;

    if (isBlack) {
      // For black keys, center the highlight within its typical width
      highlightWidth = highlightWidthBase * 0.6; // Typical visual width of a black key highlight
      const centerPosition = getXPixelPosition(midiNote); // getXPixelPosition returns center for black keys
      leftPosition = centerPosition - (highlightWidth / 2);
      backgroundColor = 'rgba(27, 165, 96, 0.4)';
      borderColor = 'rgba(130, 230, 180, 0)';
    } else {
      // For white keys, adjust width and position to avoid black key areas
      const slotStartX = getXPixelPosition(midiNote); // Left edge of the full slot for this white key
      let visualX = slotStartX;
      let visualWidth = highlightWidthBase; // Assume full slot width initially
      
      // Define how much a black key visually "cuts into" an adjacent white key's slot area from one side
      const encroachmentFactor = 0.35; // e.g., black key covers 35% of the white key's slot width on that side
      const visiblePortionFactor = 1.0 - encroachmentFactor; // e.g., 65% is visible

      const noteMod12 = (midiNote - 21 + 120) % 12; // Ensure positive: A=0, A#=1, B=2, C=3 ...

      // White keys potentially truncated on their RIGHT side by an adjacent black key:
      // These are A, C, D, F, G. (Pitch classes mod 12, relative to A=0: 0, 3, 5, 8, 10)
      if ([0, 3, 5, 8, 10].includes(noteMod12)) {
        if (isBlackKey(midiNote + 1) && (midiNote + 1) <= noteRange.max) {
          visualWidth = highlightWidthBase * visiblePortionFactor;
        }
      }
      // White keys potentially truncated on their LEFT side by an adjacent black key:
      // These are B, E. (Pitch classes mod 12, relative to A=0: 2, 7)
      else if ([2, 7].includes(noteMod12)) {
        if (isBlackKey(midiNote - 1) && (midiNote - 1) >= noteRange.min) {
          visualX = slotStartX + highlightWidthBase * encroachmentFactor;
          visualWidth = highlightWidthBase * visiblePortionFactor;
        }
      }
      // Default: If a white key is not affected by adjacent black keys (e.g., at edges or unusual layouts),
      // it takes its full slot width. visualX and visualWidth remain as initialized.

      leftPosition = visualX;
      highlightWidth = visualWidth;
      backgroundColor = 'rgba(170, 241, 197, 0.3)';
      borderColor = 'rgba(167, 246, 196, 0)';
    }

    return (
      <div
        key={`scale-highlight-${midiNote}`}
        style={{
          position: 'absolute',
          left: `${leftPosition}px`,
          width: `${highlightWidth}px`,
          height: '100%',
          backgroundColor,
          borderLeft: `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
          pointerEvents: 'none',
          zIndex: -1, // Keep highlights behind other grid elements like hover/C-lines
        }}
      />
    );
  };

  return (
    <div 
      className="grid-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${drawableHeight}px`, // only the drawable area (above the keyboard)
        zIndex: 0,
        pointerEvents: 'none'
      }}
    >
      {/* Render white key highlights first */}
      {showScaleHighlight && whiteKeyPixelWidth > 0 && 
        scaleHighlights.filter(midi => !isBlackKey(midi)).map(midiNote => renderHighlight(midiNote, false))}
      
      {/* Render black key highlights on top */}
      {showScaleHighlight && whiteKeyPixelWidth > 0 && 
        scaleHighlights.filter(midi => isBlackKey(midi)).map(midiNote => renderHighlight(midiNote, true))}

      {showGrid && (
        <>
          {/* Vertical lines (octaves C notes) */}
          {(() => {
            if (!noteRange) return null;
            const cNoteOctaveLines = [];
            for (let midi = noteRange.min; midi <= noteRange.max; midi++) {
              if (!isBlackKey(midi) && (midi - 21) % 12 === 3) { // C notes (3 semitones above A0)
                cNoteOctaveLines.push(
                  <div
                    key={`v-octave-${midi}`}
                    className="grid-line vertical"
                    style={{
                      position: 'absolute',
                      left: `${getXPixelPosition(midi)}px`, // Start of C key slot
                      height: '100%',
                      borderLeft: '1px solid rgba(255,255,255,0.2)',
                      zIndex: 1, // Ensure C-lines are above scale highlights
                    }}
                  />
                );
              }
            }
            return cNoteOctaveLines;
          })()}

          {/* Horizontal lines (bars and beats) */}
          {Array.from({ length: gridData.totalBars * gridData.beatsPerBar + 1 }).map((_, i) => {
            const lineTime = i * gridData.beatDuration; // seconds of this beat
            const lineTop = drawableHeight - ((lineTime - songPosition) * PIXELS_PER_SECOND);
            return (
            <div
              key={`h-${i}`}
              className="grid-line horizontal"
              style={{
                position: 'absolute',
                  top: `${lineTop}px`,
                width: '100%',
                borderTop: i % gridData.beatsPerBar === 0 
                  ? '1px solid rgba(255,255,255,0.3)' // Bar lines
                  : '1px solid rgba(255,255,255,0.1)', // Beat lines
                pointerEvents: 'none'
              }}
            />
            );
          })}
          
          {/* Add subdivision lines based on snap to grid setting */}
          {isSnapToGridActive && gridData.subdivisionsPerBeat !== 1 && (
            Array.from({ length: Math.ceil(gridData.totalBars * gridData.beatsPerBar * gridData.subdivisionsPerBeat) + 1 }).map((_, i) => {
              if (i % gridData.subdivisionsPerBeat === 0) return null; // Skip main beat lines

              const subdivTime = (i / gridData.subdivisionsPerBeat) * gridData.beatDuration; // seconds
              const lineTop = drawableHeight - ((subdivTime - songPosition) * PIXELS_PER_SECOND);
              
              return (
                <div
                  key={`sub-${i}`}
                  className="grid-line horizontal subdivision"
                  style={{
                    position: 'absolute',
                    top: `${lineTop}px`,
                    width: '100%',
                    borderTop: '1px dashed rgba(255,255,255,0.05)', // Subdivision lines
                    pointerEvents: 'none'
                  }}
                />
              );
            }).filter(Boolean)
          )}
        </>
      )}

      {/* Column highlight - Always show, independent of grid visibility */}
      {hoverColumn !== null && noteRange && whiteKeyPixelWidth > 0 && (
        <div
          style={{
            position: 'absolute',
            left: `${(hoverColumn * 100) / (noteRange.max - noteRange.min + 1)}%`, 
            width: `${100 / (noteRange.max - noteRange.min + 1)}%`, 
            height: '100%',
            backgroundColor: 'rgba(255,255,255,0.05)',
            pointerEvents: 'none',
            zIndex: 0 // Ensure hover column is above scale highlights but below C-lines
          }}
        />
      )}
    </div>
  );
};

export default React.memo(Grid);


