import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import './Keyboard.css';

/**
 * The Keyboard container sets up the orthographic Canvas.
 */
const Keyboard = (props) => {
  const { noteRange } = props;
  const whiteCount = computeWhiteCount(noteRange);
  const totalWidth = whiteCount;
  const [heldNotes, setHeldNotes] = useState(new Set());

  return (
    <div className="piano-container">
      <Suspense fallback={<div>Loading...</div>}>
        <Canvas
          orthographic
          camera={{
            left: -totalWidth / 2,
            right: totalWidth / 2,
            top: 0.6,
            bottom: -0.6,
            near: -10,
            far: 10,
            position: [0, 0, 10],
          }}
          gl={{ 
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
          }}
        >
          <KeyboardScene 
            totalWidth={totalWidth} 
            heldNotes={heldNotes}
            setHeldNotes={setHeldNotes}
            {...props} 
          />
        </Canvas>
      </Suspense>
    </div>
  );
};

/**
 * KeyboardScene contains the actual 3D rendering of keys and lighting
 */
const KeyboardScene = ({ 
  noteRange, 
  activeNotes, 
  leftHandNotes, 
  onKeyClick, 
  totalWidth, 
  customColors,
  heldNotes,
  setHeldNotes
}) => {
  // Correct keyboard logic for A0 (MIDI 18) start
  // A starts at MIDI 18
  // White keys: [0,2,3,5,7,8,10] (A, B, C, D, E, F, G)
  // Black keys: [1,4,6,9,11] (A#, C#, D#, F#, G#)
  const isWhiteKey = (midi) => {
    const note = (midi - 21) % 12;
    return [0, 2, 3, 5, 7, 8, 10].includes(note);
  };
  
  const isBlackKey = (midi) => {
    const note = (midi - 21) % 12;
    return [1, 4, 6, 9, 11].includes(note);
  };

  const whiteKeys = [];
  const whiteKeyPositions = {};
  let whiteKeyIndex = 0;
  for (let midi = noteRange.min; midi <= noteRange.max; midi++) {
    if (isWhiteKey(midi)) {
      whiteKeys.push(midi);
      whiteKeyPositions[midi] = whiteKeyIndex;
      whiteKeyIndex++;
    }
  }

  const blackKeys = [];
  for (let midi = noteRange.min; midi <= noteRange.max; midi++) {
    if (isBlackKey(midi)) {
      // Find the white keys immediately before and after this black key
      let prevWhite = null;
      let nextWhite = null;
      for (let i = 0; i < whiteKeys.length; i++) {
        if (whiteKeys[i] < midi) prevWhite = whiteKeys[i];
        if (whiteKeys[i] > midi) {
          nextWhite = whiteKeys[i];
          break;
        }
      }
      let x;
      if (prevWhite !== null && nextWhite !== null) {
        x = (whiteKeyPositions[prevWhite] + whiteKeyPositions[nextWhite]) / 2;
      } else if (prevWhite !== null) {
        x = whiteKeyPositions[prevWhite] + 0.5;
      } else if (nextWhite !== null) {
        x = whiteKeyPositions[nextWhite] - 0.5;
      } else {
        x = 0;
      }
      blackKeys.push({ midi, x });
    }
  }

  const whiteKeyWidth = 1;
  const whiteKeyHeight = 1.2;
  const whiteKeyY = -0;

  const blackKeyWidth = whiteKeyWidth * 0.6;
  const blackKeyHeight = whiteKeyHeight * 0.6;
  const blackKeyY = 0.2;

  const numWhiteKeys = whiteKeys.length;
  const keyWidth = totalWidth / numWhiteKeys;

  // Get color for a key based on its state
  const getKeyColor = (midi, isBlackKey) => {
    const defaultColor = isBlackKey ? '#1a1a1a' : '#ffffff';
    
    // Check for held notes first - use exact MIDI note values
    if (heldNotes.has(midi)) {
      return leftHandNotes.has(midi) ?
        (customColors?.leftHand || '#ef4444') :
        (customColors?.rightHand || '#4287f5');
    }
    
    // Then check for active notes - use exact MIDI note values
    if (activeNotes.has(midi)) {
      return leftHandNotes.has(midi) ?
        (customColors?.leftHand || '#ef4444') :
        (customColors?.rightHand || '#4287f5');
    }
    
    return defaultColor;
  };

  const handleKeyDown = (midi) => {
    setHeldNotes(prev => new Set([...prev, midi]));
    onKeyClick?.(midi);
  };

  const handleKeyUp = (midi) => {
    setHeldNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(midi);
      return newSet;
    });
  };

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight 
        position={[10, 10, 10]} 
        intensity={2.5}
      />

      {whiteKeys.map((midi, idx) => (
        <mesh
          key={midi}
          position={[idx * keyWidth - totalWidth / 2 + keyWidth / 2, whiteKeyY, 0]}
          onPointerDown={(e) => {
            if (e.object === e.eventObject) {
              handleKeyDown(midi);
            }
          }}
          onPointerUp={() => handleKeyUp(midi)}
          onPointerLeave={() => handleKeyUp(midi)}
        >
          <boxGeometry args={[keyWidth * 0.98, whiteKeyHeight * 0.98, 0.25]} />
          <meshStandardMaterial 
            color={getKeyColor(midi, false)}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>
      ))}

      {blackKeys.map(({ midi, x }) => (
        <mesh
          key={midi}
          position={[x * keyWidth - totalWidth / 2 + keyWidth / 2, blackKeyY, 0.1]}
          onPointerDown={(e) => {
            e.stopPropagation();
            handleKeyDown(midi);
          }}
          onPointerUp={() => handleKeyUp(midi)}
          onPointerLeave={() => handleKeyUp(midi)}
        >
          <boxGeometry args={[keyWidth * 0.6, blackKeyHeight, 0.35]} />
          <meshStandardMaterial 
            color={getKeyColor(midi, true)}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>
      ))}

      <mesh position={[0, 0, -0.3]}>
        <planeGeometry args={[totalWidth + 1.5, 2.5]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
    </>
  );
};

/**
 * Computes the number of white keys in the given noteRange.
 * This value is used as the total width (in scene units) of the keyboard.
 */
const computeWhiteCount = (noteRange) => {
  // White keys are A, B, C, D, E, F, G (0, 2, 3, 5, 7, 8, 10 mod 12 from A0)
  const whiteNotes = [0, 2, 3, 5, 7, 8, 10];
  let count = 0;
  for (let midi = noteRange.min; midi <= noteRange.max; midi++) {
    const note = (midi - 21) % 12;
    if (whiteNotes.includes(note)) {
      count++;
    }
  }
  return count;
};

export default Keyboard;