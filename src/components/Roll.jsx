import React, { useEffect, useRef, useState, useCallback } from 'react';
import './Roll.css';
import * as Tone from 'tone';
import Keyboard from './Keyboard';
import { v4 as uuidv4 } from 'uuid';
import Note from './Note';
import Grid from './Grid';
import Toolbar from './Controls/Toolbar';
import ContextMenu from './Controls/ContextMenu'; // Import the new component
import NoteContextMenu from './Controls/NoteContextMenu'; // Import the note context menu component
import { getChordNotes, getChordName, chordTypes } from './Data/chords';
import { detectMusicalElements } from './Data/detection';
import { getScaleNotesBetween, scaleNames, keys, scalePatterns, getScaleNotes } from './Data/scales';
import { chordPatterns } from './Data/chords';

const NOTE_LIMIT = 20000;
const NOTE_VERTICAL_OFFSET = 0;

const Roll = ({ 
  midiData, 
  isPlaying, 
  bpm, // bpm is still used by Roll for grid/snap logic
  onUpdateMidiData,
  canUndo,
  canRedo,
  synth,
  onSave,
  onPlayPauseToggle,
  isTextToolActive,
  setIsTextToolActive,
  isLooping,
  setIsLooping,
  playbackSpeed, // Received from App.js
  onSpeedChange, // Received from App.js (this is App.js's handleSpeedChange)
  isAddChordToolActive,
  setIsAddChordToolActive,
  selectedChordType,
  setSelectedChordType,
  backgroundImage,
  onBackgroundImageChange,
  customColors,
  onCustomColorsChange,
  timeSignature,
  onTimeSignatureChange,
  onScrollPositionChange,
  scrollPositionRef,
  // Transposition props from App.js
  transpositionTargets,
  currentTransposeTargetId,
  onTranspose,
  // Lifted state and handlers from App.js
  noteGroups,
  groupColors,
  onNoteGroupsChange, // Renamed setter prop
  onGroupColorsChange, // Renamed setter prop
  onCopy, // Handler prop from App.js
  onPaste, // Handler prop from App.js
  onDelete, // Handler prop from App.js
  onUndo, // Handler prop from App.js (passed through for shortcuts)
  onRedo, // Handler prop from App.js (passed through for shortcuts)
  clipboardNotes, // Add clipboardNotes prop
  // Grid/Snap props from App.js
  showGrid,
  setShowGrid,
  isSnapToGridActive,
  setIsSnapToGridActive,
  // ADDED:
  hasSelection,
  onTotalBarsChange, // Add this prop to report total bars to parent
  isToolbarVisible, // Add this prop from App.js
  // ADDED: Props for textAnnotations from App.js
  textAnnotations,
  setTextAnnotations,
  // ADDED: Props for cursor in toolbar state from App.js
  isCursorInToolbar,
  setIsCursorInToolbar,
  isPianoFullscreen, // ADDED: Destructure isPianoFullscreen
  // ADDED: Scale highlight props from App.js
  showScaleHighlight,
  selectedScale,
  selectedKey,
  // ADDED: More props from App.js for ContextMenu
  noteCount,
  setIsToolbarVisible,
  togglePianoFullscreen,
  setSelectedScale, // Setter for scale
  setSelectedKey,    // Setter for key
  setShowScaleHighlight, // Added missing prop
  // ADDED: Run Tool props from App.js
  runToolScale,
  onRunToolScaleChange,
  runToolKey,
  onRunToolKeyChange,
  showNoteNames,
  noteGlow, // Add the noteGlow prop
  noteRoundness,
  noteBevel,
  noteOpacity,
  // ADDED: Zoom prop
  zoomLevel = 1,
  // ADDED: Recording mode props
  isRecordingMode = false,
  recordingPreset = 'minimal',
  // ADDED: Minimal mode prop
  isMinimalMode = false,
}) => {
  // Debug logs removed to reduce console spam
  
  const containerRef = useRef(null);

  // ADDED: console.log for debugging
  // console.log('Roll.jsx: Received isPianoFullscreen:', isPianoFullscreen);

  const NOTE_SPACING = 1;
  const PIXELS_PER_SECOND = 200 * zoomLevel; // Simple zoom - everything scales together
  const SCROLL_MARGINS = {
    top: 30,    // pixels from top edge to trigger scrolling
    bottom: 15  // pixels from bottom edge to trigger scrolling
  };
  const SCROLL_SPEED = 5;     // pixels per frame
  const TOOLBAR_HEIGHT = 40;  // height of the toolbar in pixels
  const BLACK_KEY_OFFSET = 3; // 3 pixels to the right for black keys
  const WHITE_KEY_OFFSET = 1; // 1 pixel to the right for white keys
  
  // Preview-specific offsets (additional adjustment for previews only)
  const WHITE_PREVIEW_OFFSET = -1.5; // Move white preview notes left
  const BLACK_PREVIEW_OFFSET = -1.5;  // Move black preview notes right

  // Add state for tracking note range
  const [noteRange, setNoteRange] = useState({ min: 21, max: 108 }); // 88-key piano: A0 (21) to C8 (108)

  // Mobile detection and keyboard height effect
  useEffect(() => {
    const checkMobileAndKeyboardHeight = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                           (window.innerWidth <= 768 && 'ontouchstart' in window);
      setIsMobile(isMobileDevice);
      
      // Update keyboard height based on device and orientation
      if (isMobileDevice && window.innerHeight > window.innerWidth) {
        // Mobile portrait - match CSS keyboard height exactly
        setKeyboardHeight(150);
      } else {
        // Desktop or mobile landscape - use larger keyboard
        setKeyboardHeight(100);
      }
    };
    
    checkMobileAndKeyboardHeight();
    window.addEventListener('resize', checkMobileAndKeyboardHeight);
    window.addEventListener('orientationchange', checkMobileAndKeyboardHeight);
    return () => {
      window.removeEventListener('resize', checkMobileAndKeyboardHeight);
      window.removeEventListener('orientationchange', checkMobileAndKeyboardHeight);
    };
  }, []);

  // Listen for note drag events to prevent selection conflicts
  useEffect(() => {
    const handleNoteDragStart = () => {
      setIsNoteDragging(true);
    };

    const handleNoteDragEnd = () => {
      setIsNoteDragging(false);
    };

    window.addEventListener('note-drag-start', handleNoteDragStart);
    window.addEventListener('note-drag-end', handleNoteDragEnd);

    return () => {
      window.removeEventListener('note-drag-start', handleNoteDragStart);
      window.removeEventListener('note-drag-end', handleNoteDragEnd);
    };
  }, []);

  // Add state for active notes
  const [activeNotes, setActiveNotes] = useState(new Set());

  // Add state for tracking left hand notes
  const [leftHandNotes, setLeftHandNotes] = useState(new Set());

  // Add height factor state
  const [heightFactor, setHeightFactor] = useState(1);

  // Add state for song position
  const [songPosition, setSongPosition] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  
  // Track previous zoom level to compensate for zoom changes
  const prevZoomLevelRef = useRef(zoomLevel);

  // Handle zoom changes by adjusting scroll position to maintain visual note positions
  useEffect(() => {
    if (prevZoomLevelRef.current !== zoomLevel && prevZoomLevelRef.current !== 0) {
      // When zoom changes, we need to adjust scrollPosition to keep notes in the same visual position
      // This maintains the current view's temporal position during zoom
      
      // The ratio of old to new zoom determines how much to adjust scroll position
      const zoomRatio = prevZoomLevelRef.current / zoomLevel;
      
      // Adjust scroll position to compensate for the zoom change
      // This keeps the center of the current view temporally consistent
      const currentScrollPosition = scrollPositionRef.current;
      const newScrollPosition = currentScrollPosition * zoomRatio;
      
      scrollPositionRef.current = newScrollPosition;
      setSongPosition(newScrollPosition);
      
      // Also update Tone.Transport if not playing
      if (!isPlaying) {
        Tone.Transport.seconds = newScrollPosition / playbackSpeed;
      }
      
      // Notify parent of scroll position change
      if (onScrollPositionChange) {
        onScrollPositionChange(newScrollPosition);
      }
    }
    
    // Update the ref for next comparison
    prevZoomLevelRef.current = zoomLevel;
  }, [zoomLevel, isPlaying, playbackSpeed, onScrollPositionChange]);

  // Add state for total bars
  const [totalBars, setTotalBars] = useState(0);

  // Add new state for scroll position
  const [scrollOffset, setScrollOffset] = useState(0);
  const lastWheelEvent = useRef(0);

  // Add state for selected duration
  const [selectedDuration, setSelectedDuration] = useState(1);
  
  // Add separate state for spacer duration
  const [spacerDuration, setSpacerDuration] = useState(1);

  // Add state for visible notes
  const [visibleNotes, setVisibleNotes] = useState([]);

  // Add animation frame ref
  const animationRef = useRef(null);

  // Add new state for audio context
  const [isAudioContextReady, setIsAudioContextReady] = useState(false);

  // Add state for dragging note
  const [draggingNote, setDraggingNote] = useState(null);
  const [draggingNoteInfo, setDraggingNoteInfo] = useState(null);

  // Add these new states
  const [isSelectionToolActive, setIsSelectionToolActive] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);

  // Add new state for group dragging
  const [isGroupDragging, setIsGroupDragging] = useState(false);
  const [groupDragOffset, setGroupDragOffset] = useState({ x: 0, y: 0 });

  // Add these new constants at the top of the component
  const scrollIntervalRef = useRef(null);

  // Add state for current group ID
  const [currentGroupId, setCurrentGroupId] = useState(null); // Keep this for internal selection logic

  // Add this constant at the top with other constants
  const DEFAULT_DURATIONS = {
    1: 0.25,  // quarter note
    2: 0.5,   // half note
    4: 1.0,   // whole note
    0.5: 0.125,  // eighth note
    0.25: 0.0625  // sixteenth note
  };

  // ADDED: State to hold the width of the roll container
  const [rollContainerWidth, setRollContainerWidth] = useState(0);

  // ADDED: useEffect to observe container width and height for Grid
  const [rollDimensions, setRollDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const currentRef = containerRef.current;
    if (!currentRef) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setRollDimensions({ width: entries[0].contentRect.width, height: entries[0].contentRect.height });
      }
    });

    resizeObserver.observe(currentRef);
    // Set initial width
    setRollDimensions({ width: currentRef.offsetWidth, height: currentRef.offsetHeight });

    return () => {
      resizeObserver.unobserve(currentRef);
    };
  }, []); // Runs once on mount

  // Calculate total bars based on song duration and time signature
  useEffect(() => {
    if (!songDuration) return;
    
    const beatsPerBar = timeSignature.numerator;
    const beatValue = 4 / timeSignature.denominator; // Convert denominator to quarter notes
    const quarterNotesPerBar = beatsPerBar * beatValue;
    const calculatedTotalBars = Math.ceil((songDuration + 5) * (4 / quarterNotesPerBar)); // Add 5 seconds buffer
    
    setTotalBars(calculatedTotalBars);
    
    // Report total bars to parent component if callback exists
    if (onTotalBarsChange) {
      onTotalBarsChange(calculatedTotalBars);
    }
  }, [songDuration, timeSignature, onTotalBarsChange]);

  // Add to state declarations
  const [isAddNoteToolActive, setIsAddNoteToolActive] = useState(false);

  // Add new state for spacer tool
  const [isSpacerToolActive, setIsSpacerToolActive] = useState(false);

  // REMOVED: Internal state for text annotations, now using props
  // const [textAnnotations, setTextAnnotations] = useState([]);
  const [editingText, setEditingText] = useState(null);

  // Add these new states after other state declarations
  const [draggingText, setDraggingText] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Add new state for tracking processed notes during brushing
  const [processedNotes, setProcessedNotes] = useState(new Set());
  const [isBrushing, setIsBrushing] = useState(false);

  // Add new state for run tool
  const [isRunToolActive, setIsRunToolActive] = useState(false);
  const [runStartNote, setRunStartNote] = useState(null);
  const [runPreviewNotes, setRunPreviewNotes] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // Add state for context menu
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0
  });

  // Add state for note-specific context menu
  const [noteContextMenu, setNoteContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    noteId: null,
    currentVelocity: 0.8
  });

  // Add mobile touch support states
  const [isMobile, setIsMobile] = useState(false);
  const [touchStartData, setTouchStartData] = useState(null);
  const [isTouch, setIsTouch] = useState(false);
  const [lastTouchTime, setLastTouchTime] = useState(0);
  const [touchScrollVelocity, setTouchScrollVelocity] = useState(0);
  const [touchScrollMomentum, setTouchScrollMomentum] = useState(null);
  const [isNoteDragging, setIsNoteDragging] = useState(false);
  
  // Dynamic keyboard height state
  const [keyboardHeight, setKeyboardHeight] = useState(100);
  const KEYBOARD_HEIGHT = keyboardHeight;

  // Paste preview state
  const [isPastePreviewActive, setIsPastePreviewActive] = useState(false);
  const [pastePreviewNotes, setPastePreviewNotes] = useState([]);
  const [currentMousePosition, setCurrentMousePosition] = useState({ x: 0, y: 0 });

  // Helper function to determine what should be visible in recording mode
  const shouldShowElement = (elementType) => {
    if (!isRecordingMode) return true; // Normal mode - show everything
    
    const recordingVisible = {
      toolbar: false,
      grid: false,
      contextMenu: false,
      textAnnotations: false,
      selectionBox: false,
      resizeHandles: false,
      guideLines: false,
      previewNotes: false,
      // Keep these
      notes: true,
      keyboard: true,
      playhead: true,
      backgroundImage: recordingPreset === 'cinematic'
    };
    
    return recordingVisible[elementType];
  };

  // Add function to sync selected chords
  // const handleSyncChords = () => { // REMOVED
  //   if (!midiData || noteGroups.size === 0) return;

  //   const newTracks = midiData.tracks.map(track => {
  //     const notes = [...track.notes];
  //     const processedGroups = new Set();

  //     notes.forEach((note, i) => {
  //       const groupId = noteGroups.get(note.id);
        
  //       // Skip if note isn't in a group or if group was already processed
  //       if (!groupId || processedGroups.has(groupId)) return;
        
  //       // Find all notes in this group
  //       const groupNotes = notes.filter(n => noteGroups.get(n.id) === groupId);
        
  //       // Calculate average time for the group
  //       const avgTime = groupNotes.reduce((sum, n) => sum + n.time, 0) / groupNotes.length;
        
  //       // Update all notes in this group to the average time
  //       groupNotes.forEach(groupNote => {
  //         const noteIndex = notes.findIndex(n => n.id === groupNote.id);
  //         if (noteIndex !== -1) {
  //           notes[noteIndex] = { ...notes[noteIndex], time: avgTime };
  //         }
  //       });
        
  //       processedGroups.add(groupId);
  //     });

  //     return { ...track, notes: notes.sort((a, b) => a.time - b.time) };
  //   });

  //   onUpdateMidiData({ ...midiData, tracks: newTracks });
  // };

  // Replace getRandomColor with getColor
  const getColor = () => {
    const colors = [
      '#FFFFFF', // White
      '#00BFFF',  // Neon Sky Blue
      '#FFFF44', // Bright Yellow
      '#FF4444', // Bright Red
      '#44FF44', // Bright Green
      '#FFA500', // Bright Orange
      '#A020F0', // Neon Purple
      '#FF6F91', // Neon Pink
      '#000000', // Neon Black
    ];
    
    // Get the number of existing groups
    const existingGroups = new Set(noteGroups.values()).size;
    
    // Use modulo to cycle through colors if we exceed the array length
    return colors[existingGroups % colors.length];
  };

  // Helper functions should be defined before they're used
  const setsAreEqual = (a, b) => {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  };

  // Identifies left hand from midi track
  const checkIsLeftHand = (note, track) => {
    const trackNameCheck = (name) => {
      if (!name) return false;
      const lowerName = name.toLowerCase();
      return lowerName.includes('left') || 
             lowerName.includes('lh') ||
             lowerName.includes('l.h.') ||
             lowerName.includes('piano lh');
    };
    
    return trackNameCheck(note.trackName) || 
           trackNameCheck(note.originalTrack) ||
           trackNameCheck(track?.name) ||
           note.channel === 1;
  };

  // Update the isBlackKey function at the component level
  const isBlackKey = useCallback((midiNote) => {
    // A0 starts at MIDI 21
    // Black keys are A#, C#, D#, F#, G#, which are 1, 4, 6, 9, 11 mod 12 from A
    const note = (midiNote - 21) % 12;
    return [1, 4, 6, 9, 11].includes(note); // A#, C#, D#, F#, G#
  }, []);

  const computeWhiteCount = useCallback((noteRange) => {
    // White keys are A, B, C, D, E, F, G, which are 0, 2, 3, 5, 7, 8, 10 mod 12 from A
    const whiteNotes = [0, 2, 3, 5, 7, 8, 10];
    let count = 0;
    for (let midi = noteRange.min; midi <= noteRange.max; midi++) {
      const note = (midi - 21) % 12;
      if (whiteNotes.includes(note)) {
        count++;
      }
    }
    return count;
  }, []);

  const getNoteAndOctave = (midiNumber) => {
    // A0 starts at MIDI 21
    const notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
    const noteIndex = (midiNumber - 21) % 12;
    const baseOctave = Math.floor((midiNumber - 21) / 12);
    
    // For C through G#, increment the octave by 1
    // A, A#, B keep the base octave
    // This follows standard convention where C1 comes after B0
    const octave = (noteIndex >= 3) ? baseOctave + 1 : baseOctave;
    
    return {
      note: notes[noteIndex],
      octave: octave
    };
  };

  const getXPosition = useCallback((midiNote) => {
    // Add a fixed pixel offset to better align with the keyboard
    const BLACK_KEY_OFFSET = 3; // 3 pixels to the right for black keys
    const WHITE_KEY_OFFSET = 1; // 1 pixel to the right for white keys
    
    const containerWidth = containerRef.current?.clientWidth || 0;
    const whiteKeyCount = computeWhiteCount(noteRange);
    const whiteKeyWidth = containerWidth / whiteKeyCount;

    // Build white key positions
    const whiteKeys = [];
    const whiteKeyPositions = {};
    let whiteKeyIndex = 0;
    
    // White keys are A, B, C, D, E, F, G (0, 2, 3, 5, 7, 8, 10 mod 12 from A0)
    const whiteNotes = [0, 2, 3, 5, 7, 8, 10];
    
    for (let midi = noteRange.min; midi <= noteRange.max; midi++) {
      const note = (midi - 21) % 12;
      if (whiteNotes.includes(note)) {
        whiteKeys.push(midi);
        whiteKeyPositions[midi] = whiteKeyIndex;
        whiteKeyIndex++;
      }
    }

    if (isBlackKey(midiNote)) {
      // Find neighboring white keys
      let prevWhite = null;
      let nextWhite = null;
      for (let i = 0; i < whiteKeys.length; i++) {
        if (whiteKeys[i] < midiNote) {
          prevWhite = whiteKeys[i];
        }
        if (whiteKeys[i] > midiNote) {
          nextWhite = whiteKeys[i];
          break;
        }
      }
      
      // Position black key between white keys with slight adjustment
      let position;
      if (prevWhite !== null && nextWhite !== null) {
        position = (whiteKeyPositions[prevWhite] + whiteKeyPositions[nextWhite]) / 2;
      } else if (prevWhite !== null) {
        position = whiteKeyPositions[prevWhite] + 0.5;
      } else if (nextWhite !== null) {
        position = whiteKeyPositions[nextWhite] - 0.5;
      } else {
        position = 0;
      }
      return position * whiteKeyWidth + BLACK_KEY_OFFSET;
    }

    // For white keys, find their position directly
    return (whiteKeyPositions[midiNote] || 0) * whiteKeyWidth + WHITE_KEY_OFFSET;
  }, [noteRange, computeWhiteCount, isBlackKey]);

  const handlePianoKeyClick = (note) => {
    // Play the note without any offset adjustment
    if (synth) {
      const noteName = Tone.Frequency(note, "midi").toNote();
      synth.triggerAttackRelease(noteName, "8n");
    }
  };

  // Add position slider handlers
  const handlePositionChange = (e) => {
    const newPosition = Number(e.target.value);
    setSongPosition(newPosition);
    scrollPositionRef.current = newPosition;
    Tone.Transport.seconds = newPosition / playbackSpeed;
    // Update scroll position to match the new position
    const rollComponent = document.querySelector('.notes-container');
    if (rollComponent) {
      rollComponent.scrollLeft = newPosition * 100; // Adjust multiplier based on your zoom level
    }
  };

  // Function to snap a time value to the grid based on the selected duration and time signature
  const snapTimeToGrid = (time) => {
    if (!isSnapToGridActive) return time;

    // const currentContainerClientHeight = containerRef.current?.clientHeight || 600; // Fallback to default CSS height // REMOVED
    // const currentEffectiveRollHeight = currentContainerClientHeight - KEYBOARD_HEIGHT - (isToolbarVisible ? TOOLBAR_HEIGHT : 0); // REMOVED

    // REFERENCE_OFFSET_PX is the desired pixel offset when the roll's effective height is REFERENCE_EFFECTIVE_HEIGHT. // REMOVED
    // const REFERENCE_OFFSET_PX = 11; // User found 11px good for their fullscreen setup. // REMOVED
    // Adjust REFERENCE_EFFECTIVE_HEIGHT to match the effective drawing height of your // REMOVED
    // piano roll when the 11px offset looks correct (e.g., in your typical fullscreen view). // REMOVED
    // Effective height = total component height - keyboard height - toolbar height. // REMOVED
    // const REFERENCE_EFFECTIVE_HEIGHT =1500; // Placeholder: e.g., for a ~700px tall component. // REMOVED

    // Calculate the desired visual offset in pixels, proportional to the current effective roll height. // REMOVED
    // let calculatedDesiredOffset = (currentEffectiveRollHeight / REFERENCE_EFFECTIVE_HEIGHT) * REFERENCE_OFFSET_PX; // REMOVED
    
    // Optional: Clamp the offset to prevent extreme values if heights are unexpected. // REMOVED
    // calculatedDesiredOffset = Math.max(0, Math.min(calculatedDesiredOffset, 20)); // Clamp between 0 and 20px. // REMOVED

    // const DESIRED_VISUAL_OFFSET_PIXELS = calculatedDesiredOffset; // REMOVED
    
    // Get duration of a single beat in seconds
    const snapOffset = 120; // This is a BPM value, used as a reference for grid timing calculations, consistent with Grid.jsx
    const beatDuration = 60 / snapOffset; // in seconds
    
    // Calculate the grid size based on the selected duration (as a fraction of a beat)
    let gridSizeInBeats;
    switch (selectedDuration) {
      case 0.25: gridSizeInBeats = 0.25; break; // 16th note
      case 0.5: gridSizeInBeats = 0.5; break;   // 8th note
      case 2: gridSizeInBeats = 2; break;       // half note
      case 4: gridSizeInBeats = 4; break;       // whole note
      case 1: default: gridSizeInBeats = 1;     // quarter note
    }
    
    // Calculate grid size in seconds
    // Apply the same scaling factor (÷2) that we used in the Grid component
    // This ensures perfect alignment between snap points and grid lines
    const gridSize = (beatDuration * gridSizeInBeats) / 2;
    
    // Calculate how many grid units have passed
    const gridUnits = Math.round(time / gridSize);
    
    // Calculate a dynamic time offset to achieve a consistent visual pixel offset. // REMOVED
    // This shifts notes slightly upwards from the exact grid line for better visual appearance. // REMOVED
    // const DESIRED_VISUAL_OFFSET_PIXELS = 11; // User changed this manually // This line is now replaced by the calculation above // REMOVED
    // let timePixelOffset = 0; // REMOVED
    // PIXELS_PER_SECOND is a constant (e.g., 200) // REMOVED
    // heightFactor is a state variable (e.g., 1) // REMOVED
    // if (PIXELS_PER_SECOND > 0 && heightFactor > 0) {  // REMOVED
      // timePixelOffset = DESIRED_VISUAL_OFFSET_PIXELS / (PIXELS_PER_SECOND * heightFactor); // REMOVED
    // } // REMOVED
    
    // Return the snapped time without the dynamic offset
    return gridUnits * gridSize; // MODIFIED: Removed + timePixelOffset
  };

  // Helper function for Note component to calculate snapped visual positions during resize
  const calculateSnappedVisualPosition = (visualY, visualHeight, resizeDirection) => {
    if (!isSnapToGridActive || !containerRef.current) return { visualY, visualHeight };

    const containerHeight = containerRef.current.clientHeight;
    const keyboardHeight = KEYBOARD_HEIGHT;
    
    // Convert visual positions to musical time
    const currentScrollTime = scrollPositionRef.current;
    
    if (resizeDirection === 'top') {
      // Top handle: convert top position to time and snap it
          const topTime = (containerHeight - keyboardHeight - visualY) / PIXELS_PER_SECOND + currentScrollTime;
    const snappedTopTime = snapTimeToGrid(topTime);
    const snappedVisualY = containerHeight - keyboardHeight - ((snappedTopTime - currentScrollTime) * PIXELS_PER_SECOND);
      
      // Keep bottom position fixed, adjust height
      const bottomY = visualY + visualHeight;
      const snappedVisualHeight = bottomY - snappedVisualY;
      
      return { visualY: snappedVisualY, visualHeight: snappedVisualHeight };
    } else {
      // Bottom handle: convert height to duration and snap it
      const duration = visualHeight / (PIXELS_PER_SECOND * heightFactor); // Keep heightFactor for duration - this is height scaling
      
      // Get duration of a single beat in seconds (same as snapTimeToGrid)
      const snapOffset = 120;
      const beatDuration = 60 / snapOffset;
      
      // Calculate the grid size based on the selected duration
      let gridSizeInBeats;
      switch (selectedDuration) {
        case 0.25: gridSizeInBeats = 0.25; break;
        case 0.5: gridSizeInBeats = 0.5; break;
        case 2: gridSizeInBeats = 2; break;
        case 4: gridSizeInBeats = 4; break;
        case 1: default: gridSizeInBeats = 1; break;
      }
      
      const gridSize = (beatDuration * gridSizeInBeats) / 2;
      const gridUnits = Math.round(duration / gridSize);
      const snappedDuration = Math.max(gridSize, gridUnits * gridSize);
              const snappedVisualHeight = snappedDuration * PIXELS_PER_SECOND * heightFactor; // Keep heightFactor for visual height
      
      return { visualY, visualHeight: snappedVisualHeight };
    }
  };

  useEffect(() => {
    if (!midiData) return;
    
    // Calculate total duration from MIDI data
    let maxDuration = 0;
    midiData.tracks.forEach(track => {
      track.notes.forEach(note => {
        maxDuration = Math.max(maxDuration, note.time + note.duration);
      });
    });
    // Add 1 second to the duration
    setSongDuration(maxDuration + 1);
    //Loops after this
  }, [midiData]);

  const handleWheel = (e) => {
    // Skip wheel events on mobile devices - use touch instead
    if (isMobile) return;
    
    // 1. Check if scrolling event originated from within the toolbar
    if (e.target.closest('.toolbar')) {
      // Allow default scrolling behavior for the toolbar
      return true;
    }
    
    // 2. Dont allow manual scroll while playing
    if (isPlaying) return;
    
    // 3. Prevent default scrolling behavior
    e.preventDefault();

    // 4. calculate scroll amount
    const scrollSpeed = 0.005;
    const delta = -e.deltaY * scrollSpeed;
    
    // 5. Update the ref directly for smoother animation
    scrollPositionRef.current = Math.max(0, Math.min(scrollPositionRef.current + delta, songDuration));
    
    // 6. Update the UI and Audio state less frequently
    requestAnimationFrame(() => {
      setSongPosition(scrollPositionRef.current);
      Tone.Transport.seconds = scrollPositionRef.current;
      // Call onScrollPositionChange to update the App component's state
      onScrollPositionChange?.(scrollPositionRef.current);
    });
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e) => {
    if (!isMobile) return;
    
    // Clear any existing momentum
    if (touchScrollMomentum) {
      clearInterval(touchScrollMomentum);
      setTouchScrollMomentum(null);
    }
    
    const touch = e.touches[0];
    const currentTime = Date.now();
    
    setIsTouch(true);
    setLastTouchTime(currentTime);
    setTouchStartData({
      x: touch.clientX,
      y: touch.clientY,
      scrollPosition: scrollPositionRef.current,
      time: currentTime,
      target: e.target
    });
    
    // Check if touch is in toolbar area
    if (e.target.closest('.toolbar')) {
      return;
    }
    
    // Check if touch is on a note or if note dragging is active - if so, don't interfere with note dragging
          if (e.target.closest('.note-component') || isNoteDragging) {
      return; // Let the note component handle its own touch events
    }
    
    // Don't prevent default here - let other handlers decide
  };

  const handleTouchMove = (e) => {
    if (!isMobile || !touchStartData || !isTouch) return;
    
    const touch = e.touches[0];
    const currentTime = Date.now();
    const deltaTime = currentTime - touchStartData.time;
    const deltaY = touch.clientY - touchStartData.y;
    const deltaX = touch.clientX - touchStartData.x;
    
    // Check if this is primarily a vertical scroll (timeline) or horizontal (selection)
    const isVerticalScroll = Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10;
    const isHorizontalScroll = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10;
    
    // Handle toolbar area differently
    if (e.target.closest('.toolbar')) {
      return; // Allow default behavior for toolbar
    }
    
    // Don't interfere if touch started on a note component or if a note is being dragged
          if (touchStartData.target.closest('.note-component') || isNoteDragging) {
      return; // Let note component handle its own drag
    }
    
    if (isVerticalScroll && !isPlaying) {
      // Prevent default scroll for timeline navigation
      e.preventDefault();
      
      // Calculate scroll velocity for momentum
      const velocity = deltaY / Math.max(deltaTime, 1);
      setTouchScrollVelocity(velocity);
      
      // Timeline scrolling - map touch movement to time
      const scrollSensitivity = 0.01;
      const timeChange = -deltaY * scrollSensitivity;
      const newPosition = Math.max(0, Math.min(touchStartData.scrollPosition + timeChange, songDuration));
      
      scrollPositionRef.current = newPosition;
      setSongPosition(newPosition);
      Tone.Transport.seconds = newPosition;
      onScrollPositionChange?.(newPosition);
    } else if (isHorizontalScroll || Math.abs(deltaX) > 20) {
      // Potential selection box creation - but only if no note is being dragged
      if (!e.target.closest('.note-component, .text-annotation-div') && 
          !isAddNoteToolActive && !isAddChordToolActive && !isRunToolActive && 
          !isTextToolActive && !isSpacerToolActive && !isNoteDragging) {
        
        e.preventDefault();
        
        // Create selection box
        if (!isSelecting) {
          setIsSelecting(true);
          setSelectionStart({ x: touchStartData.x, y: touchStartData.y });
          setCurrentGroupId(uuidv4());
        }
        
        setSelectionEnd({ x: touch.clientX, y: touch.clientY });
        
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const left = Math.min(touchStartData.x - rect.left, touch.clientX - rect.left);
          const width = Math.abs(touch.clientX - touchStartData.x);
          const top = Math.min(touchStartData.y - rect.top, touch.clientY - rect.top);
          const height = Math.abs(touch.clientY - touchStartData.y);
          
          setSelectionBox({ left, top, width, height });
          
          // Apply selection logic (similar to mouse selection)
          const containerHeight = containerRef.current.clientHeight;
          const keyboardHeight = KEYBOARD_HEIGHT;
          const containerWidth = containerRef.current.clientWidth;
          const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
          
          const startNote = Math.floor(left / keyWidth) + noteRange.min;
          const endNote = Math.ceil((left + width) / keyWidth) + noteRange.min;
          
          const startTime = (containerHeight - keyboardHeight - (top + height)) / PIXELS_PER_SECOND + scrollPositionRef.current;
          const endTime = (containerHeight - keyboardHeight - top) / PIXELS_PER_SECOND + scrollPositionRef.current;

          const newSelectedNotes = midiData?.tracks?.flatMap(track => 
            track.notes.filter(note => {
              const noteEndTime = note.time + note.duration;
              const isInPitchRange = note.midi >= startNote && note.midi <= endNote;
              const isInTimeRange = (
                (note.time >= Math.min(startTime, endTime) && note.time <= Math.max(startTime, endTime)) ||
                (noteEndTime >= Math.min(startTime, endTime) && noteEndTime <= Math.max(startTime, endTime)) ||
                (note.time <= Math.min(startTime, endTime) && noteEndTime >= Math.max(startTime, endTime))
              );
              return isInPitchRange && isInTimeRange;
            })
          ) || [];

          const updatedGroups = new Map();
          let colorNeedsUpdate = false;
          if (newSelectedNotes.length > 0 && !groupColors.has(currentGroupId)) {
            colorNeedsUpdate = true;
          }
          newSelectedNotes.forEach(note => {
            updatedGroups.set(note.id, currentGroupId);
          });
          
          onNoteGroupsChange(updatedGroups);

          if (colorNeedsUpdate) {
            const newColors = new Map(groupColors);
            newColors.set(currentGroupId, getColor());
            onGroupColorsChange(newColors);
          }
        }
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!isMobile) return;
    
    const currentTime = Date.now();
    const touchDuration = currentTime - lastTouchTime;
    
    // Handle momentum scrolling for timeline
    if (touchScrollVelocity && Math.abs(touchScrollVelocity) > 0.1 && touchDuration < 300) {
      let momentum = touchScrollVelocity * 0.8; // Initial momentum
      const momentumInterval = setInterval(() => {
        if (Math.abs(momentum) < 0.01) {
          clearInterval(momentumInterval);
          setTouchScrollMomentum(null);
          return;
        }
        
        const timeChange = -momentum * 16; // 16ms frame time
        const newPosition = Math.max(0, Math.min(scrollPositionRef.current + timeChange * 0.01, songDuration));
        
        scrollPositionRef.current = newPosition;
        setSongPosition(newPosition);
        Tone.Transport.seconds = newPosition;
        onScrollPositionChange?.(newPosition);
        
        momentum *= 0.95; // Decay momentum
      }, 16);
      
      setTouchScrollMomentum(momentumInterval);
    }
    
    // End selection if it was active
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionBox(null);
    }
    
    // Reset touch state
    setIsTouch(false);
    setTouchStartData(null);
    setTouchScrollVelocity(0);
  };

  // Update the useEffect for wheel and touch events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const wheelHandler = (e) => handleWheel(e);
    const touchStartHandler = (e) => handleTouchStart(e);
    const touchMoveHandler = (e) => handleTouchMove(e);
    const touchEndHandler = (e) => handleTouchEnd(e);

    container.addEventListener('wheel', wheelHandler, { passive: false });
    
    if (isMobile) {
      container.addEventListener('touchstart', touchStartHandler, { passive: false });
      container.addEventListener('touchmove', touchMoveHandler, { passive: false });
      container.addEventListener('touchend', touchEndHandler, { passive: true });
      container.addEventListener('touchcancel', touchEndHandler, { passive: true });
    }

    return () => {
      container.removeEventListener('wheel', wheelHandler);
      if (isMobile) {
        container.removeEventListener('touchstart', touchStartHandler);
        container.removeEventListener('touchmove', touchMoveHandler);
        container.removeEventListener('touchend', touchEndHandler);
        container.removeEventListener('touchcancel', touchEndHandler);
      }
    };
  }, [isPlaying, songPosition, songDuration, isMobile, touchScrollMomentum, touchStartData, isTouch, lastTouchTime, touchScrollVelocity, scrollPositionRef, setSongPosition, onScrollPositionChange, isSelecting, setIsSelecting, setSelectionStart, setCurrentGroupId, setSelectionEnd, setSelectionBox, containerRef, noteRange, PIXELS_PER_SECOND, heightFactor, KEYBOARD_HEIGHT, midiData, noteGroups, onNoteGroupsChange, groupColors, getColor, onGroupColorsChange, isAddNoteToolActive, isAddChordToolActive, isRunToolActive, isTextToolActive, isSpacerToolActive, isNoteDragging]);

  // Modify the animation frame update useEffect
  useEffect(() => {
    if (!midiData || !containerRef.current) return;
    
    let lastFrameTime = performance.now();
    const targetFrameTime = 1000 / 60; // Target 60 FPS
    let lastUpdateTime = 0;
    const updateInterval = 16; // ~60fps
    
    const updateVisibleNotes = () => {
      if (!containerRef.current) { // Add this guard
        animationRef.current = requestAnimationFrame(updateVisibleNotes); // Re-queue if not ready, or just return if unmounting
        return;
      }

      const frameTime = performance.now();
      const deltaTime = frameTime - lastFrameTime;
      
      lastFrameTime = frameTime;
      
      // Get the actual Transport time and convert to musical time
      const transportTime = isPlaying ? Tone.Transport.seconds * playbackSpeed : scrollPositionRef.current;
      
      // Always use this time for position tracking to keep UI and audio in sync
      const musicalTime = transportTime;
      
      const containerHeight = containerRef.current.clientHeight;
      const containerWidth = containerRef.current.clientWidth;
      
      // Add loop logic
      if (isPlaying && musicalTime >= songDuration) {
        if (isLooping) {
          Tone.Transport.seconds = 0;
          scrollPositionRef.current = 0;
        }
      }

      // Create new Sets for active notes
      const newActiveNotes = new Set();
      const newLeftHandNotes = new Set();
      
      // Keep PIXELS_PER_SECOND constant - don't adjust for playback speed
      const adjustedPixelsPerSecond = PIXELS_PER_SECOND;
      
      // Single pass through notes to check active status and calculate visible notes
      const newVisibleNotes = [];
      const bufferZone = containerHeight * heightFactor;
      
      // Only update visible notes if enough time has passed
      const now = performance.now();
      if (now - lastUpdateTime >= updateInterval) {
        lastUpdateTime = now;
        
        midiData.tracks.forEach(track => {
          // Removed debug log to reduce console spam
          track.notes.forEach(note => {
            const timeOffset = note.time - musicalTime;
            const y = containerHeight - KEYBOARD_HEIGHT - 
                             (timeOffset * PIXELS_PER_SECOND);
        const height = note.duration * PIXELS_PER_SECOND * heightFactor;
            
            // Check if note is visible
            if (y + height >= -bufferZone && y <= containerHeight + bufferZone) {
              const x = getXPosition(note.midi);
              newVisibleNotes.push({
                ...note,
                x,
                y: Math.round(y - height),
                width: (containerWidth / (noteRange.max - noteRange.min + 1)) - NOTE_SPACING,
                height,
                isBlack: isBlackKey(note.midi),
                isLeftHand: note.isLeftHand
              });
            }
            
            // Check if note is active
            if (musicalTime >= note.time && musicalTime <= note.time + note.duration) {
              // Don't apply any offset correction - use the raw MIDI note
              newActiveNotes.add(note.midi);
              
              if (note.isLeftHand) {
                newLeftHandNotes.add(note.midi);
              }
            }
          });
        });

        // Only update states if they've changed
        // Batch visibleNotes
        const notesChanged = visibleNotes.length !== newVisibleNotes.length ||
          visibleNotes.some((n, i) => n.id !== newVisibleNotes[i].id || n.x !== newVisibleNotes[i].x || n.y !== newVisibleNotes[i].y);
        if (notesChanged) {
          setVisibleNotes(newVisibleNotes);
        }
        // Batch activeNotes
        let activeChanged = activeNotes.size !== newActiveNotes.size;
        if (!activeChanged) {
          for (const n of newActiveNotes) {
            if (!activeNotes.has(n)) { activeChanged = true; break; }
          }
        }
        if (activeChanged) {
          setActiveNotes(newActiveNotes);
        }
        // Batch leftHandNotes
        let leftChanged = leftHandNotes.size !== newLeftHandNotes.size;
        if (!leftChanged) {
          for (const n of newLeftHandNotes) {
            if (!leftHandNotes.has(n)) { leftChanged = true; break; }
          }
        }
        if (leftChanged) {
          setLeftHandNotes(newLeftHandNotes);
        }
      }

      if (isPlaying) {
        // Always update the song position to match the Transport time
        setSongPosition(transportTime); // MODIFIED: Restored to ensure Grid and other components sync with playback
        scrollPositionRef.current = transportTime;
      }

      animationRef.current = requestAnimationFrame(updateVisibleNotes);
    };

    animationRef.current = requestAnimationFrame(updateVisibleNotes);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [midiData, isPlaying, isLooping, playbackSpeed, getXPosition, noteRange, heightFactor, KEYBOARD_HEIGHT, PIXELS_PER_SECOND, NOTE_SPACING, isBlackKey, visibleNotes.length]); // MODIFIED: Removed activeNotes, leftHandNotes. Added getXPosition, noteRange, heightFactor, KEYBOARD_HEIGHT, PIXELS_PER_SECOND, NOTE_SPACING, isBlackKey, visibleNotes.length as they are used in the effect or its calculations.

  const handleNoteMove = (updatedNote) => {
    if (!midiData) return;

    const containerWidth = containerRef.current?.clientWidth || 0;
    const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
    
    const newMidiNote = Math.round(updatedNote.x / keyWidth) + noteRange.min;
    
    const containerHeight = containerRef.current?.clientHeight || 0;
    const keyboardHeight = KEYBOARD_HEIGHT;
    const newTime = (containerHeight - keyboardHeight - updatedNote.y) / PIXELS_PER_SECOND;

    const newTracks = midiData.tracks.map(track => ({
      ...track,
      notes: track.notes.map(note => 
        note.id === updatedNote.id
          ? { ...note, midi: newMidiNote, time: newTime }
          : note
      )
    }));

    handleMidiDataUpdate({ ...midiData, tracks: newTracks });
  };

  const handleNoteDragStart = (note) => {
    // Optional: Add any logic needed when dragging starts
  };

  const getPositionFromMidi = (midiNote) => {
    return midiNote - noteRange.min; // Convert MIDI note to position starting from noteRange.min
  };

  const getMidiFromPosition = (position) => {
    return position + noteRange.min; // Convert position back to MIDI note starting from noteRange.min
  };

  // Add these refs near the top with other refs
  const lastUpdateTime = useRef(0);
  const updateInterval = 16; // ~60fps
  const draggedNoteRef = useRef(null); // Add this line to track the currently dragged note

  const handleNoteDrag = (updatedNote) => {
    // Store the dragged note reference for visual updates
    draggedNoteRef.current = updatedNote;
    
    const now = performance.now();
    if (now - lastUpdateTime.current < updateInterval) {
      return updatedNote; // Return original note if skipping update
    }
    lastUpdateTime.current = now;

    const containerWidth = containerRef.current?.clientWidth || 0;
    const containerHeight = containerRef.current?.clientHeight || 0;
    const keyboardHeight = KEYBOARD_HEIGHT;
    const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
    
    // Get mouse position relative to container
    const mouseY = updatedNote.y + (updatedNote.height / 2);
    
    // Check if mouse is in scrolling zones
    const isInTopScrollZone = mouseY < SCROLL_MARGINS.top + TOOLBAR_HEIGHT;
    const isInBottomScrollZone = mouseY > containerHeight - SCROLL_MARGINS.bottom - keyboardHeight;
    
    // Handle scrolling
    if (isInTopScrollZone || isInBottomScrollZone) {
      if (!scrollIntervalRef.current) {
        scrollIntervalRef.current = setInterval(() => {
          const newPosition = isInTopScrollZone
            ? Math.min(songDuration, scrollPositionRef.current + (SCROLL_SPEED / PIXELS_PER_SECOND))
            : Math.max(0, scrollPositionRef.current - (SCROLL_SPEED / PIXELS_PER_SECOND));
          
          scrollPositionRef.current = newPosition;
          setSongPosition(newPosition);
        }, 16);
      }
    } else if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    // Find the closest MIDI note to the x position
    const xPosition = updatedNote.x;
    
    // Determine the MIDI note based on position
    // Instead of simple division/rounding, find the closest note visually
    let closestNote = noteRange.min;
    let closestDistance = Number.MAX_SAFE_INTEGER;
    
    for (let midi = noteRange.min; midi <= noteRange.max; midi++) {
      const noteX = getXPosition(midi);
      const distance = Math.abs(noteX - xPosition);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestNote = midi;
      }
    }
    
    const newMidiNote = closestNote;
    
    // Calculate time based on the bottom edge of the note
    const timeFromTop = (containerHeight - keyboardHeight - (updatedNote.y + updatedNote.height)) / 
      PIXELS_PER_SECOND;
    const unsnappedTime = scrollPositionRef.current + timeFromTop;
    const newTime = isSnapToGridActive ? snapTimeToGrid(unsnappedTime) : unsnappedTime;

    // Calculate the visual position for the dragged note
    const newY = containerHeight - keyboardHeight - 
                 ((newTime - scrollPositionRef.current) * PIXELS_PER_SECOND) - 
                 updatedNote.height;
    
    // When snap-to-grid is active, use snapped positions for visual feedback while dragging
    const visualNote = {
      ...updatedNote,
      y: isSnapToGridActive ? newY : updatedNote.y,
      x: getXPosition(newMidiNote)
    };
    
    // Update dragging states
    setDraggingNote(newMidiNote);
    setDraggingNoteInfo({
      midi: newMidiNote,
      isLeftHand: updatedNote.isLeftHand
    });

    // Get all notes in the same group
    const groupId = noteGroups.get(updatedNote.id);
    const notesToMove = groupId 
      ? midiData.tracks.flatMap(track => 
          track.notes.filter(note => noteGroups.get(note.id) === groupId)
        )
      : [updatedNote];

    // Calculate offsets
    const midiOffset = newMidiNote - updatedNote.midi;
    const timeOffset = newTime - updatedNote.time;

    // Batch the MIDI data update
    requestAnimationFrame(() => {
      const currentMidiData = JSON.parse(JSON.stringify(midiData));
      const newTracks = currentMidiData.tracks.map(track => ({
        ...track,
        notes: track.notes.map(note => {
          if (notesToMove.find(n => n.id === note.id)) {
            return {
              ...note,
              midi: note.midi + midiOffset,
              time: Math.max(0, note.time + timeOffset)
            };
          }
          return note;
        })
      }));

      onUpdateMidiData({ ...currentMidiData, tracks: newTracks });
    });
    
    // Return modified visual position for the Note component for immediate feedback
    return isSnapToGridActive ? visualNote : updatedNote;
  };

  // Update handleNoteDragEnd to clear both dragging states
  const handleNoteDragEnd = (note) => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    setDraggingNote(null);
    setDraggingNoteInfo(null);
  };

  useEffect(() => {
    if (midiData) {
      console.log('MIDI Data Structure:', {
        header: midiData.header,
        tracks: midiData.tracks.map(track => ({
          name: track.name,
          noteCount: track.notes?.length,
          sampleNotes: track.notes?.slice(0, 3), // Show first 3 notes as sample
        }))
      });
    }
  }, [midiData]);

  //==============TEXT SECTION====================

  // Add a helper function to calculate the relative x position (as percentage)
  const getRelativeXPosition = (absoluteX) => {
    const containerWidth = containerRef.current?.clientWidth || 0;
    return (absoluteX / containerWidth) * 100; // Convert to percentage
  };
  
  // Add a helper function to calculate the absolute x position from relative
  const getAbsoluteXPosition = (relativeX) => {
    const containerWidth = containerRef.current?.clientWidth || 0;
    return (relativeX * containerWidth) / 100; // Convert from percentage to pixels
  };

  // Update handleTextClick to store relative positions
  const handleTextClick = (e) => {
    if (!isTextToolActive || isPlaying) return;

    if (e.target.closest('.toolbar')) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    if (y > rect.height - KEYBOARD_HEIGHT) {
      return;
    }

    const absoluteX = e.clientX - rect.left;
    const relativeX = getRelativeXPosition(absoluteX);
    
    const containerHeight = containerRef.current.clientHeight;
    const keyboardHeight = KEYBOARD_HEIGHT;
    const clickTime = (containerHeight - keyboardHeight - y) / PIXELS_PER_SECOND;
    const timePosition = scrollPositionRef.current + clickTime;

    const newAnnotation = {
      id: uuidv4(),
      x: relativeX, // Store as percentage of container width
      y,  // Store the actual y position
      time: timePosition,
      text: '',
      fixed: false, // Default to not fixed
      fontSize: 14 // Default font size
    };

    setTextAnnotations(prev => [...prev, newAnnotation]); // Use prop setter
    setEditingText(newAnnotation.id);
  };

  // Add useEffect to log current state of textAnnotations for debugging
  useEffect(() => {
    const fixedCount = textAnnotations.filter(a => a.fixed).length;
    console.log(`Text annotations: ${textAnnotations.length} (${fixedCount} fixed)`);
  }, [textAnnotations]);

  // Update the handleToggleFixed function to include console logs for debugging
  const handleToggleFixed = (id) => {
    console.log('Toggling fixed state for annotation:', id);
    const annotation = textAnnotations.find(a => a.id === id); // Use prop
    console.log('Current fixed state:', annotation?.fixed);
    
    const updatedAnnotations = textAnnotations.map(annotation => { // Use prop
      if (annotation.id !== id) return annotation;
      
      // If annotation is becoming fixed, calculate and store its current absolute y position
      if (!annotation.fixed) {
        const containerHeight = containerRef.current.clientHeight;
        const keyboardHeight = KEYBOARD_HEIGHT;
        const timeOffset = annotation.time - scrollPositionRef.current;
        const currentY = containerHeight - keyboardHeight - (timeOffset * PIXELS_PER_SECOND);
        
        return { 
          ...annotation, 
          fixed: true,
          y: currentY
        };
      } else {
        // If being unfixed, remove the y property
        const { y, ...rest } = annotation;
        return { 
          ...rest,
          fixed: false 
        };
      }
    });
    
    console.log('New annotations state:', updatedAnnotations);
    setTextAnnotations(updatedAnnotations); // Use prop setter
  };

  // Update handleTextMouseDown
  const handleTextMouseDown = (e, annotation) => {
    if (editingText === annotation.id) return;
    e.stopPropagation();
    
    const rect = containerRef.current.getBoundingClientRect();
    const absoluteX = getAbsoluteXPosition(annotation.x);
    
    // Different handling for fixed vs regular annotations
    if (annotation.fixed) {
      // For fixed annotations, use the actual screen position
      setDragOffset({
        x: e.clientX - (absoluteX + rect.left),
        y: e.clientY - rect.top - (annotation.y !== undefined ? annotation.y : 0)
      });
    } else {
      // For regular annotations, calculate based on time
      const containerHeight = rect.height;
      const keyboardHeight = KEYBOARD_HEIGHT;
      const timeOffset = annotation.time - scrollPositionRef.current;
      const y = containerHeight - keyboardHeight - (timeOffset * PIXELS_PER_SECOND);
      
      setDragOffset({
        x: e.clientX - (absoluteX + rect.left),
        y: e.clientY - (y + rect.top)
      });
    }
    
    setDraggingText(annotation.id);
  };

  // Update handleTextDrag
  const handleTextDrag = (e) => {
    if (!draggingText) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const absoluteX = e.clientX - rect.left - dragOffset.x;
    const relativeX = getRelativeXPosition(absoluteX);
    const y = e.clientY - rect.top - dragOffset.y;
    
    // Update annotations based on whether they're fixed or not
    setTextAnnotations(annotations =>  // Use prop setter
      annotations.map(annotation => {
        if (annotation.id !== draggingText) return annotation;
        
        if (annotation.fixed) {
          // For fixed annotations, just update x and y coordinates
          return {
            ...annotation,
            x: relativeX, // Store as percentage
            y: y
          };
        } else {
          // For regular annotations, update time and x coordinates
          const containerHeight = rect.height;
          const keyboardHeight = KEYBOARD_HEIGHT;
          const timeOffset = (containerHeight - keyboardHeight - y) / PIXELS_PER_SECOND;
          const newTime = scrollPositionRef.current + timeOffset;
          
          return {
            ...annotation,
            x: relativeX, // Store as percentage
            time: newTime
          };
        }
      })
    );
  };

  const handleTextDragEnd = () => {
    setDraggingText(null);
  };

  // Add drag effect
  useEffect(() => {
    if (draggingText) {
      const handleMouseMove = (e) => handleTextDrag(e);
      const handleMouseUp = () => handleTextDragEnd();
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingText]);

  // Simplify handleMouseDown
  const handleMouseDown = (e) => {
    // Skip mouse events on mobile when touch is active
    if (isMobile && isTouch) {
      return;
    }
    
    if (contextMenu.visible) { // If context menu is open, do nothing in the roll
      return;
    }

    if (e.target.closest('.toolbar') || e.target.closest('.text-annotation-div input, .text-annotation-div select, .text-annotation-div button') || editingText) {
      return;
    }

    // Handle paste preview click
    if (isPastePreviewActive) {
      // Execute the paste operation using preview position information
      console.log('Click: Executing paste at preview position');
      handlePasteAtPreviewPosition();
      setIsPastePreviewActive(false);
      setPastePreviewNotes([]);
      return;
    }

    // Reset selection if clicking empty space and not using a specific tool
    // Don't clear selection on right-click (which might be for context menu)
    const isUsingCreationTool = isAddNoteToolActive || isAddChordToolActive || isRunToolActive || isTextToolActive || isSpacerToolActive; // REMOVED isHandToolActive
          if (!e.target.closest('.note-component') && !isUsingCreationTool && e.button !== 2) {
        onNoteGroupsChange(new Map());
        onGroupColorsChange(new Map());
    }

    if (isRunToolActive) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const containerHeight = containerRef.current.clientHeight;
      const keyboardHeight = KEYBOARD_HEIGHT;
      const headerHeight = 40; // Height of the header bar

      // Don't allow clicking in keyboard area, toolbar, or header
      if (y > containerHeight - keyboardHeight || y < TOOLBAR_HEIGHT + headerHeight) {
        return;
      }

      const containerWidth = containerRef.current.clientWidth;
      const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
      const noteIndex = Math.floor(x / keyWidth);
      const startMidiNote = noteIndex + noteRange.min;

      const clickTime = (containerHeight - keyboardHeight - y) / PIXELS_PER_SECOND;
      const startTime = scrollPositionRef.current + clickTime;

      setRunStartNote({ midi: startMidiNote, time: startTime });
      setIsRunning(true);
      return;
    }

    if (editingText && 
        !e.target.matches('input, select, option')) {
      setTextAnnotations(prev => prev.filter(annotation =>  // Use prop setter
        annotation.id !== editingText || annotation.text.trim() !== ''
      ));
      setEditingText(null);
      setIsTextToolActive(false);
      return;
    }

    e.preventDefault();

    if (isTextToolActive) {
      handleTextClick(e);
      return;
    }

    if (isSpacerToolActive) {
      handleSpacerClick(e);
      return;
    }

    if (isAddNoteToolActive) {
      handleAddNoteClick(e);
      return;
    }

    if (isAddChordToolActive) {
      handleAddChordClick(e);
      return;
    }

    // Only proceed with selection if no other tool is active
    if (!isTextToolActive && !isSpacerToolActive && !isAddNoteToolActive && 
        /*!isHandToolActive &&*/ !isAddChordToolActive) { // REMOVED isHandToolActive
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Only start selection if not clicking directly on a note 
      // (note selection is handled by Note component's onClick which calls handleNoteSelection)
      if (!e.target.closest('.note-component')) {
        setIsSelecting(true);
        setSelectionStart({ x, y });
        setSelectionEnd({ x, y });

        // Don't create group here, handleMouseMove will do it
        setCurrentGroupId(uuidv4()); // Generate potential group ID
      } 
    }
  };

  // Simplify handleMouseMove
  const handleMouseMove = (e) => {
    // Skip mouse events on mobile when touch is active
    if (isMobile && isTouch) {
      return;
    }
    
    if (isRunning && isRunToolActive && runStartNote) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const containerHeight = containerRef.current.clientHeight;
      const keyboardHeight = KEYBOARD_HEIGHT;
      const containerWidth = containerRef.current.clientWidth;
      const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
      const headerHeight = 40; // Height of the header bar
      
      // Restrict y position to roll area only, accounting for both toolbar and header
      const clampedY = Math.max(TOOLBAR_HEIGHT + headerHeight, Math.min(y, containerHeight - keyboardHeight));
      
      const noteIndex = Math.floor(x / keyWidth);
      const currentMidiNote = noteIndex + noteRange.min;
      
      const clickTime = (containerHeight - keyboardHeight - clampedY) / PIXELS_PER_SECOND;
      const currentTime = scrollPositionRef.current + clickTime;

      const previewNotes = createRunNotes(
        runStartNote.midi,
        currentMidiNote,
        runStartNote.time,
        currentTime
      );

      setRunPreviewNotes(previewNotes);

      // Play the last note in the run for audio feedback
      /*
      if (synth && previewNotes.length > 0) {
        const lastNote = previewNotes[previewNotes.length - 1];
        const noteName = Tone.Frequency(lastNote.midi, "midi").toNote();
        synth.triggerAttackRelease(noteName, "32n");
      }
      */
      return;
    }

    if (isSelecting) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setSelectionEnd({ x, y });
      
      const left = Math.min(selectionStart.x, x);
      const width = Math.abs(x - selectionStart.x);
      
      const scrolledY = (scrollPositionRef.current - songPosition) * PIXELS_PER_SECOND;
      const adjustedStartY = selectionStart.y + scrolledY;
      const top = Math.min(adjustedStartY, y);
      const height = Math.abs(y - adjustedStartY);
      
      setSelectionBox({ left, top, width, height });

      const containerHeight = containerRef.current.clientHeight;
      const keyboardHeight = KEYBOARD_HEIGHT;
      const containerWidth = containerRef.current.clientWidth;
      const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
      
      const startNote = Math.floor(left / keyWidth) + noteRange.min;
      const endNote = Math.ceil((left + width) / keyWidth) + noteRange.min;
      
      const startTime = (containerHeight - keyboardHeight - (top + height)) / PIXELS_PER_SECOND + scrollPositionRef.current;
      const endTime = (containerHeight - keyboardHeight - top) / PIXELS_PER_SECOND + scrollPositionRef.current;

      // Add auto-scrolling when selection reaches top or bottom
      const isInTopScrollZone = y < SCROLL_MARGINS.top + TOOLBAR_HEIGHT;
      const isInBottomScrollZone = y > containerHeight - SCROLL_MARGINS.bottom - keyboardHeight;

      // Clear scroll interval if not in either scroll zone
      if (!isInTopScrollZone && !isInBottomScrollZone && scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }

      // Keep scroll speed constant
      if (isInTopScrollZone) {
        if (!scrollIntervalRef.current) {
          scrollIntervalRef.current = setInterval(() => {
            const newPosition = Math.min(
              songDuration,
              scrollPositionRef.current + (SCROLL_SPEED / PIXELS_PER_SECOND)
            );
            scrollPositionRef.current = newPosition;
            setSongPosition(newPosition);
          }, 16);
        }
      } else if (isInBottomScrollZone) {
        if (!scrollIntervalRef.current) {
          scrollIntervalRef.current = setInterval(() => {
            const newPosition = Math.max(
              0,
              scrollPositionRef.current - (SCROLL_SPEED / PIXELS_PER_SECOND)
            );
            scrollPositionRef.current = newPosition;
            setSongPosition(newPosition);
          }, 16);
        }
      }

      // Modified selection logic for single group
      const newSelectedNotes = midiData.tracks.flatMap(track => 
        track.notes.filter(note => {
          const noteEndTime = note.time + note.duration;
          const isInPitchRange = note.midi >= startNote && note.midi <= endNote;
          const isInTimeRange = (
            (note.time >= Math.min(startTime, endTime) && note.time <= Math.max(startTime, endTime)) ||
            (noteEndTime >= Math.min(startTime, endTime) && noteEndTime <= Math.max(startTime, endTime)) ||
            (note.time <= Math.min(startTime, endTime) && noteEndTime >= Math.max(startTime, endTime))
          );
          return isInPitchRange && isInTimeRange;
        })
      );

      // Update groups with only the current selection
      const updatedGroups = new Map();
      let colorNeedsUpdate = false;
      if (newSelectedNotes.length > 0 && !groupColors.has(currentGroupId)) {
          // If starting a new selection group, assign its color
          colorNeedsUpdate = true;
      }
      newSelectedNotes.forEach(note => {
        updatedGroups.set(note.id, currentGroupId);
      });
      
      onNoteGroupsChange(updatedGroups); // Update parent state

      if (colorNeedsUpdate) {
          const newColors = new Map(groupColors); // Use prop
          newColors.set(currentGroupId, getColor());
          onGroupColorsChange(newColors); // Update parent color state
      }
    }
  };

  // Simplify handleMouseUp
  const handleMouseUp = () => {
    // Skip mouse events on mobile when touch is active
    if (isMobile && isTouch) {
      return;
    }
    
    if (isRunning && isRunToolActive && runStartNote && runPreviewNotes.length > 0) {
      // ADDED: Note limit check for Run Tool
      const currentNoteCount = midiData?.tracks?.[0]?.notes?.length || 0;
      if (currentNoteCount + runPreviewNotes.length > NOTE_LIMIT) {
        alert(`Adding these notes would exceed the project note limit of ${NOTE_LIMIT.toLocaleString()}.`);
        // Reset run tool state without adding notes
        setRunStartNote(null);
        setRunPreviewNotes([]);
        setIsRunning(false);
        return;
      }

      // Add the run notes to the MIDI data
      const currentData = JSON.parse(JSON.stringify(midiData || { tracks: [{ notes: [] }] }));
      const newTracks = [...(currentData.tracks || [])];
      if (newTracks.length === 0) {
        newTracks.push({ notes: [] });
      }

      newTracks[0].notes = [...newTracks[0].notes, ...runPreviewNotes]
        .sort((a, b) => a.time - b.time);

      onUpdateMidiData({ ...currentData, tracks: newTracks });

      // Reset run tool state
      setRunStartNote(null);
      setRunPreviewNotes([]);
      setIsRunning(false);
      return;
    }

    // if (isHandToolActive) { // REMOVED Hand Tool Logic
    //   setIsBrushing(false);
    //   setProcessedNotes(new Set());
    //   return;
    // }

    // Clear any active scroll interval
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    
    setIsSelecting(false);
    setSelectionBox(null);
  };

  // Update useEffect for mouse events
  useEffect(() => {
    if (isSelecting || isRunning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isSelecting, isRunning, selectionStart, runStartNote]);

  // Add cleanup in useEffect
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, []);

  //==============COPY, PASTE, DELETE SECTION====================

  // Paste Tool
  const handlePaste = () => {
    if (!clipboardNotes.length || !midiData) return;

    const newGroupId = uuidv4();

    // Determine color based on group count from props.midiData (authoritative historical state)
    // Ensure midiData.groupColors is properly converted to a Map if it's an object
    const propGroupColorsMap = midiData.groupColors
      ? (midiData.groupColors instanceof Map ? midiData.groupColors : new Map(Object.entries(midiData.groupColors)))
      : new Map();
    const existingGroupsCountForColor = propGroupColorsMap.size;

    // Color palette (ensure this matches the one in the original getColor or is defined centrally)
    const colorPalette = [
      '#FFFFFF', // White
      '#00BFFF',  // Neon Sky Blue
      '#FFFF44', // Bright Yellow
      '#FF4444', // Bright Red
      '#44FF44', // Bright Green
      '#FFA500', // Bright Orange
      '#A020F0', // Neon Purple
      '#FF6F91', // Neon Pink
      '#000000', // Neon Black
    ];
    const newColor = colorPalette[existingGroupsCountForColor % colorPalette.length];

    // Create new notes at current song position
    const newNotes = clipboardNotes.map(note => ({
      ...note,
      id: uuidv4(),
      time: note.time + songPosition // Ensure songPosition is considered if it affects paste time
    }));

    // Deep copy tracks to avoid modifying the prop directly before update
    const newTracks = JSON.parse(JSON.stringify(midiData.tracks || [{ notes: [] }]));
    if (newTracks.length === 0) {
      newTracks.push({ notes: [] });
    }
    
    newTracks[0].notes = [...newTracks[0].notes, ...newNotes]
      .sort((a, b) => a.time - b.time);

    // Create new group mappings with ONLY the newly pasted notes
    // This clears all previous selections
    const updatedGroups = new Map();
    newNotes.forEach(note => {
      updatedGroups.set(note.id, newGroupId);
    });

    // Create a new groupColors map with just this new group
    // Preserve any existing colors from midiData for undo/redo consistency
    const baseGroupColors = midiData.groupColors
      ? (midiData.groupColors instanceof Map ? new Map(midiData.groupColors) : new Map(Object.entries(midiData.groupColors)))
      : new Map();
    const updatedColors = new Map(baseGroupColors);
    updatedColors.set(newGroupId, newColor);

    // Prepare the complete data object for update and history
    const dataToUpdate = {
      ...midiData, // Spread existing midiData to preserve header, textAnnotations, bpm, etc.
      tracks: newTracks,
      noteGroups: updatedGroups,
      groupColors: updatedColors
    };

    // Update the MIDI data via App.js, ensuring history captures the new groups/colors
    onUpdateMidiData(dataToUpdate);

    // Update local state for immediate UI consistency.
    // Ideally, Roll component would derive these purely from props in the long run.
    onNoteGroupsChange(updatedGroups);
    onGroupColorsChange(updatedColors);
  };

  // Paste Tool at Preview Position
  const handlePasteAtPreviewPosition = () => {
    // Debug logs removed
    const notesArray = clipboardNotes?.notes || clipboardNotes || [];
    
    if (!notesArray.length || !midiData || !pastePreviewNotes.length) {
              // Debug log removed
      return;
    }

    const newGroupId = uuidv4();

    // Determine color based on group count from props.midiData (authoritative historical state)
    const propGroupColorsMap = midiData.groupColors
      ? (midiData.groupColors instanceof Map ? midiData.groupColors : new Map(Object.entries(midiData.groupColors)))
      : new Map();
    const existingGroupsCountForColor = propGroupColorsMap.size;

    // Color palette
    const colorPalette = [
      '#FFFFFF', // White
      '#00BFFF',  // Neon Sky Blue
      '#FFFF44', // Bright Yellow
      '#FF4444', // Bright Red
      '#44FF44', // Bright Green
      '#FFA500', // Bright Orange
      '#A020F0', // Neon Purple
      '#FF6F91', // Neon Pink
      '#000000', // Neon Black
    ];
    const newColor = colorPalette[existingGroupsCountForColor % colorPalette.length];

    // Use the preview information to create the notes at the correct position
    const firstPreview = pastePreviewNotes[0];
    if (!firstPreview) {
      // Debug log removed
      return;
    }

    const pasteTime = firstPreview.pasteTime;
    const pitchOffset = firstPreview.pitchOffset;
    
          // Debug log removed
    
    // Calculate the earliest time in clipboard notes to use as offset reference
    const earliestClipboardTime = Math.min(...notesArray.map(note => note.time));

    // Create new notes using the preview positioning
    const newNotes = notesArray.map(note => ({
      ...note,
      id: uuidv4(),
      midi: note.midi + pitchOffset,
      time: pasteTime + (note.time - earliestClipboardTime)
    }));

          // Debug log removed

    // Deep copy tracks to avoid modifying the prop directly before update
    const newTracks = JSON.parse(JSON.stringify(midiData.tracks || [{ notes: [] }]));
    if (newTracks.length === 0) {
      newTracks.push({ notes: [] });
    }
    
    newTracks[0].notes = [...newTracks[0].notes, ...newNotes]
      .sort((a, b) => a.time - b.time);

    // Create new group mappings with ONLY the newly pasted notes
    const updatedGroups = new Map();
    newNotes.forEach(note => {
      updatedGroups.set(note.id, newGroupId);
    });

    // Create a new groupColors map with just this new group
    const baseGroupColors = midiData.groupColors
      ? (midiData.groupColors instanceof Map ? new Map(midiData.groupColors) : new Map(Object.entries(midiData.groupColors)))
      : new Map();
    const updatedColors = new Map(baseGroupColors);
    updatedColors.set(newGroupId, newColor);

    // Prepare the complete data object for update and history
    const dataToUpdate = {
      ...midiData,
      tracks: newTracks,
      noteGroups: updatedGroups,
      groupColors: updatedColors
    };

          // Debug log removed
    // Update the MIDI data via App.js, ensuring history captures the new groups/colors
    onUpdateMidiData(dataToUpdate);

    // Update local state for immediate UI consistency
    onNoteGroupsChange(updatedGroups);
    onGroupColorsChange(updatedColors);
  };

  // Delete Tool
  const handleDelete = () => {
    if (!midiData) return;

    // Get all notes that are in any group
    const groupedNoteIds = new Set(Array.from(noteGroups.keys()));

    if (groupedNoteIds.size === 0) return;

    const newTracks = midiData.tracks.map(track => ({
      ...track,
      notes: track.notes.filter(note => !groupedNoteIds.has(note.id))
    }));

    // Include the group information in the update
    onUpdateMidiData({
      ...midiData,
      tracks: newTracks,
      noteGroups: new Map(), // Clear groups after deletion
      groupColors: new Map()
    });
  };

  // Add this function to handle any MIDI data updates
  const handleMidiDataUpdate = (newMidiData) => {
    // Preserve the current group information if it's not included in the new data
    onUpdateMidiData({
      ...newMidiData,
      noteGroups: noteGroups, // These are props from App.js
      groupColors: groupColors, // These are props from App.js
      textAnnotations: textAnnotations // Pass current textAnnotations (from props) with other MIDI updates
    });
  };

  //==============KEYBOARD SHORTCUTS SECTION====================

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isCursorInToolbar) return; // Do nothing if cursor is in toolbar

      // Existing shortcuts (delete, copy, paste, undo, redo)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hasSelection) {
          onDelete();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (hasSelection) {
          onCopy();
          // Activate paste preview mode after copying
          // Debug log removed
          setIsPastePreviewActive(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (isPastePreviewActive) {
          // If already in paste preview mode, execute the paste at preview position
                      // Debug log removed
          handlePasteAtPreviewPosition();
          setIsPastePreviewActive(false);
          setPastePreviewNotes([]);
        } else {
          // If not in paste preview mode, activate it if clipboard has notes
          const notesArray = clipboardNotes?.notes || clipboardNotes || [];
          if (notesArray.length > 0) {
            // Debug log removed
            setIsPastePreviewActive(true);
          } else {
            onPaste(); // Fallback to immediate paste if no clipboard
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        onUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        onRedo();
      }

      // ADDED: Cycle through chord types with K and L when Add Chord tool is active
      if (isAddChordToolActive) {
        if (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'l') {
          e.preventDefault(); // Prevent any default browser behavior
          const currentIndex = chordTypes.findIndex(ct => ct.value === selectedChordType);
          let nextIndex;

          if (e.key.toLowerCase() === 'l') { // 'L' for next chord type
            nextIndex = (currentIndex + 1) % chordTypes.length;
          } else { // 'K' for previous chord type
            nextIndex = (currentIndex - 1 + chordTypes.length) % chordTypes.length;
          }
          setSelectedChordType(chordTypes[nextIndex].value);
        }
      }

      // Cancel paste preview mode with Escape
      if (e.key === 'Escape' && isPastePreviewActive) {
        e.preventDefault();
        setIsPastePreviewActive(false);
        setPastePreviewNotes([]);
        return;
      }

      // Tool activation shortcuts
      if (!editingText) { // CORRECTED: Use !editingText instead of !isTextAnnotationFocused
        // Add shortcut for Add Note tool
        if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          setIsAddNoteToolActive(!isAddNoteToolActive);
          setIsSelectionToolActive(false);
        }

        // Add shortcut for Spacer tool
        if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setIsSpacerToolActive(!isSpacerToolActive);
          setIsSelectionToolActive(false);
          setIsAddNoteToolActive(false);
        }

        // Add shortcut for Run tool
        if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setIsRunToolActive(!isRunToolActive);
          setIsSelectionToolActive(false);
          setIsAddNoteToolActive(false);
          setIsSpacerToolActive(false);
          // setIsHandToolActive(false); // REMOVED
          setIsTextToolActive(false);
          setIsAddChordToolActive(false);
        }

        // Add arrow key shortcuts for moving selected notes
        if (noteGroups.size > 0 && [
          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
        ].includes(e.key)) {
          e.preventDefault();

          const timeStep = 0.05; // 50ms for left/right movement
          const midiStep = 1;    // 1 semitone for up/down movement

          const selectedNoteIds = new Set(Array.from(noteGroups.keys()));

          const newTracks = midiData.tracks.map(track => ({
            ...track,
            notes: track.notes.map(note => {
              if (selectedNoteIds.has(note.id)) {
                let newTime = note.time;
                let newMidi = note.midi;

                switch (e.key) {
                  case 'ArrowDown': // Should affect time
                    newTime = Math.max(0, note.time - timeStep);
                    break;
                  case 'ArrowUp': // Should affect time
                    newTime = note.time + timeStep;
                    break;
                  case 'ArrowRight': // Should affect MIDI pitch
                    newMidi = Math.min(108, note.midi + midiStep); 
                    break;
                  case 'ArrowLeft': // Should affect MIDI pitch
                    newMidi = Math.max(21, note.midi - midiStep);  
                    break;
                  default:
                    break;
                }
                return { ...note, time: newTime, midi: newMidi };
              }
              return note;
            })
          }));

          onUpdateMidiData({ ...midiData, tracks: newTracks });
        }

        // Add comma and period shortcuts for adjusting selected note duration
        if (noteGroups.size > 0 && (e.key === ',' || e.key === '.')) {
          e.preventDefault();
          
          const durationFactor = e.key === ',' ? 0.5 : 2; // Halve or double duration
          const selectedNoteIds = new Set(Array.from(noteGroups.keys()));
          
          const newTracks = midiData.tracks.map(track => ({
            ...track,
            notes: track.notes.map(note => {
              if (selectedNoteIds.has(note.id)) {
                // Adjust duration, ensuring it doesn't get too small
                const newDuration = Math.max(0.0625, note.duration * durationFactor);
                return { ...note, duration: newDuration };
              }
              return note;
            })
          }));
          
          onUpdateMidiData({ ...midiData, tracks: newTracks });
        }

        // ADDED: Modify preview note duration with comma and period when Add Note or Add Chord tool is active
        if ((isAddNoteToolActive || isAddChordToolActive) && (e.key === ',' || e.key === '.')) {
          e.preventDefault();
          const durationKeys = Object.keys(DEFAULT_DURATIONS).map(Number).sort((a, b) => a - b);
          let currentIndex = durationKeys.indexOf(selectedDuration);

          if (e.key === ',') { // Previous duration
            currentIndex = (currentIndex - 1 + durationKeys.length) % durationKeys.length;
          } else { // Next duration
            currentIndex = (currentIndex + 1) % durationKeys.length;
          }
          setSelectedDuration(durationKeys[currentIndex]);
        }

        // Arrow key logic for preview adjustment
        if ((isAddNoteToolActive || isAddChordToolActive || isPastePreviewActive) && 
            !isPlaying && 
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            setIsPreviewControlledByKeyboard(true);

            setPreviewCoordinates(prevCoords => {
                let newX = prevCoords.x;
                let newY = prevCoords.y;

                const containerWidth = containerRef.current?.clientWidth || 0;
                const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1); // Width of a single key slot

                // Vertical step for preview, to match selected note movement timeStep
                const timeStepForPreview = 0.05; // 50ms, same as selected note time adjustment
                const stepY = timeStepForPreview * PIXELS_PER_SECOND;
                // console.log('Calculated stepY:', stepY, 'PIXELS_PER_SECOND:', PIXELS_PER_SECOND, 'heightFactor:', heightFactor, 'DEFAULT_DURATIONS[0.25]:', DEFAULT_DURATIONS[0.25]);

                switch (e.key) {
                    case 'ArrowLeft': {
                        const currentNoteIndex = Math.floor(prevCoords.x / keyWidth);
                        const targetNoteIndex = Math.max(0, currentNoteIndex - 1);
                        newX = (targetNoteIndex * keyWidth) + (keyWidth / 2); // Center on the target key
                        // newY += stepY; // Incorrectly added by previous edit - REMOVE
                        break;
                    }
                    case 'ArrowRight': {
                        const currentNoteIndex = Math.floor(prevCoords.x / keyWidth);
                        const targetNoteIndex = Math.min((noteRange.max - noteRange.min), currentNoteIndex + 1);
                        newX = (targetNoteIndex * keyWidth) + (keyWidth / 2); // Center on the target key
                        // newY += stepY; // Incorrectly added by previous edit - REMOVE
                        break;
                    }
                    case 'ArrowUp': 
                        newY -= stepY; 
                        break;
                    case 'ArrowDown': 
                        newY += stepY; 
                        break;
                }

                const rollRect = containerRef.current?.getBoundingClientRect();
                if (rollRect) {
                  newX = Math.max(0, Math.min(newX, rollRect.width -1)); // Ensure newX is within bounds
                  // Ensure newY is within the roll area (above keyboard, below toolbar)
                  newY = Math.max(TOOLBAR_HEIGHT, Math.min(newY, rollRect.height - KEYBOARD_HEIGHT -1)); 
                }
                console.log('Arrow key ', e.key, ' newX:', newX, ' newY:', newY, 'prevY:', prevCoords.y);
                return { x: newX, y: newY };
            });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    midiData, noteGroups, clipboardNotes, songPosition, 
    isAddNoteToolActive, isSelectionToolActive, isSpacerToolActive, 
    editingText, canUndo, canRedo, onUndo, onRedo, 
    isRunToolActive, selectedDuration, isAddChordToolActive,
    isPastePreviewActive, hasSelection, onCopy, onPaste, onDelete, handlePasteAtPreviewPosition, // Added paste preview dependencies
    // Dependencies for arrow key preview control
    // previewCoordinates, // Removed to prevent initialization error
    // setIsPreviewControlledByKeyboard, // State setters are stable, no need to list as dependency
    // Dependencies for step calculation and bounds
    heightFactor, noteRange, PIXELS_PER_SECOND, DEFAULT_DURATIONS, // Added PIXELS_PER_SECOND and DEFAULT_DURATIONS
    // For spacebar playback of previewNote & runPreviewNotes
    synth, // previewNote, // Removed to prevent initialization error
    runPreviewNotes, isPlaying
  ]);

  // Add new handler for double click
  const handleNoteDoubleClick = (noteId) => {
    const groupId = noteGroups.get(noteId); // Use prop
    if (!groupId) return;

    const updatedGroups = new Map(noteGroups); // Use prop
    for (const [key, value] of updatedGroups.entries()) {
      if (value === groupId) {
        updatedGroups.delete(key);
      }
    }
    onNoteGroupsChange(updatedGroups); // Call parent setter

    const updatedColors = new Map(groupColors); // Use prop
    updatedColors.delete(groupId);
    onGroupColorsChange(updatedColors); // Call parent setter
  };

  //==============ADD NOTE SECTION====================

  // Add this new function to handle clicks for adding notes
  const handleAddNoteClick = (e) => {
    if (!isAddNoteToolActive || isPlaying) return;

    // ADDED: Note limit check
    const currentNoteCount = midiData?.tracks?.[0]?.notes?.length || 0;
    if (currentNoteCount >= NOTE_LIMIT) {
      alert(`You have reached the project note limit of ${NOTE_LIMIT.toLocaleString()}.`);
      return;
    }

    // Check if click is within toolbar or keyboard area
    if (e.target.closest('.toolbar') || e.target.closest('.piano-keyboard')) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Get keyboard height and container height
    const containerHeight = containerRef.current.clientHeight;
    const keyboardHeight = KEYBOARD_HEIGHT;

    // Return if click is in keyboard area
    if (y > containerHeight - keyboardHeight) {
      return;
    }

    // Calculate the time at click position
    const clickTime = (containerHeight - keyboardHeight - y) / PIXELS_PER_SECOND;
    const unsnappedTime = scrollPositionRef.current + clickTime;
    const insertTime = isSnapToGridActive ? snapTimeToGrid(unsnappedTime) : unsnappedTime;

    // Calculate MIDI note from x position
    const containerWidth = containerRef.current.clientWidth;
    const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
    const noteIndex = Math.floor(x / keyWidth);
    const midiNote = noteIndex + noteRange.min;

    // Create new note
    const newNote = {
      id: uuidv4(),
      midi: midiNote,
      time: insertTime,
      duration: DEFAULT_DURATIONS[selectedDuration] || 0.25,
      name: getNoteAndOctave(midiNote).note + getNoteAndOctave(midiNote).octave,
      velocity: 0.8
    };

    // Play the note sound
    if (synth) {
      const noteName = Tone.Frequency(midiNote, "midi").toNote();
      synth.triggerAttackRelease(noteName, "8n", Tone.now(), 0.8);
    }

    // Create a new copy of the MIDI data
    const currentData = JSON.parse(JSON.stringify(midiData || { tracks: [{ notes: [] }] }));
    const newTracks = [...(currentData.tracks || [])];
    if (newTracks.length === 0) {
      newTracks.push({ notes: [] });
    }
    
    // Add the new note and sort
    newTracks[0].notes = [...newTracks[0].notes, newNote].sort((a, b) => a.time - b.time);

    // Update MIDI data using the provided update function
    onUpdateMidiData({ ...currentData, tracks: newTracks });
  };

  // Add state declarations
  const [hoverColumn, setHoverColumn] = useState(null);

  // Add new state for preview note
  const [previewNote, setPreviewNote] = useState(null);
  const [previewCoordinates, setPreviewCoordinates] = useState({ x: 0, y: 0 });
  const [isPreviewControlledByKeyboard, setIsPreviewControlledByKeyboard] = useState(false);
  
  const MOUSE_OVERRIDE_THRESHOLD = 5; // pixels



  // Simple paste preview calculation
  useEffect(() => {
    const notesArray = clipboardNotes?.notes || clipboardNotes || [];
    if (!isPastePreviewActive || !notesArray.length || !containerRef.current) {
      setPastePreviewNotes([]);
      return;
    }

              // Debug log removed
    
    const rect = containerRef.current.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const keyboardHeight = KEYBOARD_HEIGHT;
    const mouseX = currentMousePosition.x;
    const mouseY = currentMousePosition.y;

    // Don't show preview in keyboard or toolbar area
    if (mouseY >= containerHeight - keyboardHeight || mouseY < TOOLBAR_HEIGHT) {
      setPastePreviewNotes([]);
      return;
    }

    // Calculate paste position
    const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
    const cursorNoteIndex = Math.floor(mouseX / keyWidth);
    const cursorMidiNote = Math.max(noteRange.min, Math.min(noteRange.max, cursorNoteIndex + noteRange.min));
    
    // Calculate paste time
    const rawTime = (containerHeight - keyboardHeight - mouseY) / PIXELS_PER_SECOND;
    const pasteTime = songPosition + rawTime;
    
    // Calculate offsets based on clipboard content
    const earliestClipboardTime = Math.min(...notesArray.map(note => note.time));
    const lowestClipboardMidi = Math.min(...notesArray.map(note => note.midi));
    const pitchOffset = cursorMidiNote - lowestClipboardMidi;
    
    // Create preview notes
    const previewNotes = notesArray.map(note => {
      const previewMidi = note.midi + pitchOffset;
      const isBlackNote = isBlackKey(previewMidi);
      const whiteKeyCount = computeWhiteCount(noteRange);
      const whiteKeyWidth = containerWidth / whiteKeyCount;
      const noteWidth = isBlackNote ? (whiteKeyWidth * 0.6) : (whiteKeyWidth * 0.98);
      
      // Calculate position
      const relativeTimeOffset = note.time - earliestClipboardTime;
      const noteTime = pasteTime + relativeTimeOffset;
      const noteTimeOffsetFromScroll = noteTime - songPosition;
      const noteY = containerHeight - keyboardHeight - (noteTimeOffsetFromScroll * PIXELS_PER_SECOND);
      const noteHeight = note.duration * PIXELS_PER_SECOND * heightFactor;
      
      return {
        x: getXPosition(previewMidi),
        y: noteY - noteHeight,
        width: noteWidth,
        height: noteHeight,
        isBlack: isBlackNote,
        midi: previewMidi,
        originalNote: note,
        pasteTime: pasteTime,
        pitchOffset: pitchOffset
      };
    });
    
          // Debug log removed
    setPastePreviewNotes(previewNotes);
  }, [isPastePreviewActive, currentMousePosition, clipboardNotes, songPosition, noteRange, heightFactor, computeWhiteCount, isBlackKey, getXPosition]);

  // New comprehensive useEffect for preview note calculation
  useEffect(() => {
    if (!containerRef.current) return;

    if (isCursorInToolbar || (!isAddNoteToolActive && !isAddChordToolActive && !isRunToolActive && !isPastePreviewActive) || isPlaying || isRunning) { // ADDED: isCursorInToolbar check and isPastePreviewActive
      setPreviewNote(null);
      setPastePreviewNotes([]);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const keyboardHeight = KEYBOARD_HEIGHT;
    const whiteKeyCount = computeWhiteCount(noteRange);
    const whiteKeyWidth = containerWidth / whiteKeyCount;
    const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);

    const currentX = previewCoordinates.x;
    const currentY = previewCoordinates.y;

    // Prevent preview if cursor is in toolbar or keyboard area
    if (currentY >= containerHeight - keyboardHeight || currentY < TOOLBAR_HEIGHT) {
      setPreviewNote(null);
      return;
    }

    const noteIndex = Math.floor(currentX / keyWidth);
    const rootMidiNote = Math.max(noteRange.min, Math.min(noteRange.max, noteIndex + noteRange.min));

    const duration = DEFAULT_DURATIONS[selectedDuration] || 0.25;
          const noteVisualHeight = duration * PIXELS_PER_SECOND * heightFactor;

    const rawTime = (containerHeight - keyboardHeight - currentY) / PIXELS_PER_SECOND;
    const unsnappedTime = songPosition + rawTime; // Use songPosition state which reflects scrollPositionRef.current
    const previewTime = isSnapToGridActive ? snapTimeToGrid(unsnappedTime) : unsnappedTime;
    
    const timeOffsetFromScroll = previewTime - songPosition;
    const snappedYBaseForNoteTop = containerHeight - keyboardHeight - (timeOffsetFromScroll * PIXELS_PER_SECOND);
    // finalPreviewY is the top of the note visual
    const finalPreviewY = isSnapToGridActive ? (snappedYBaseForNoteTop - noteVisualHeight) : (currentY - noteVisualHeight);

    let newPreviewNotes = null;
    
    if (isAddChordToolActive) {
      const chordNotesData = getChordNotes(rootMidiNote, selectedChordType);
      newPreviewNotes = chordNotesData.map(midiNote => {
        const isBlackNote = isBlackKey(midiNote);
        return {
          x: getXPosition(midiNote) + (isBlackNote ? BLACK_PREVIEW_OFFSET : WHITE_PREVIEW_OFFSET),
          y: finalPreviewY,
          width: isBlackNote ? (whiteKeyWidth * 0.6) : (whiteKeyWidth * 0.98),
          height: noteVisualHeight,
          isBlack: isBlackNote,
          midi: midiNote
        };
      });
      if (newPreviewNotes.length > 0) {
        newPreviewNotes[0].chordName = getChordName(rootMidiNote, selectedChordType);
        newPreviewNotes[0].isRoot = true;
      }
    } else if (isAddNoteToolActive || (isRunToolActive && !isRunning)) {
      const isBlackNote = isBlackKey(rootMidiNote);
      const noteWidth = isBlackNote ? (whiteKeyWidth * 0.6) : (whiteKeyWidth * 0.98);
      const { note, octave } = getNoteAndOctave(rootMidiNote);
      newPreviewNotes = [{
        x: getXPosition(rootMidiNote) + (isBlackNote ? BLACK_PREVIEW_OFFSET : WHITE_PREVIEW_OFFSET),
        y: finalPreviewY,
        width: noteWidth,
        height: noteVisualHeight,
        isBlack: isBlackNote,
        midi: rootMidiNote,
        noteName: `${note}${octave}`
      }];
    }
    
    setPreviewNote(newPreviewNotes);
    // Paste preview notes are handled directly in updatePastePreview function

  }, [
    previewCoordinates,
    isAddNoteToolActive, isAddChordToolActive, isPlaying, isCursorInToolbar, isRunToolActive, isRunning,
    selectedDuration, selectedChordType, 
    isSnapToGridActive, heightFactor, noteRange, songPosition, 
    // Constants & stable functions: PIXELS_PER_SECOND, KEYBOARD_HEIGHT, TOOLBAR_HEIGHT, 
    // computeWhiteCount, getXPosition, getChordNotes, getChordName, getNoteAndOctave, isBlackKey, DEFAULT_DURATIONS, snapTimeToGrid
    // BLACK_PREVIEW_OFFSET, WHITE_PREVIEW_OFFSET
  ]);

  // Modify the handleContainerMouseMove function to include chord name
  const handleContainerMouseMove = (e) => {
    if (!containerRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Always update mouse position for paste preview
    setCurrentMousePosition({ x: currentX, y: currentY });

    // Check if mouse is over toolbar and disable tool previews if it is
    if (e.target.closest('.toolbar')) {
      setHoverColumn(null);
      return;
    }

    if ((isAddNoteToolActive || isAddChordToolActive || (isRunToolActive && !isRunning) || isPastePreviewActive) && !isPlaying) {
      const column = Math.floor((currentX / rect.width) * (noteRange.max - noteRange.min + 1));
      setHoverColumn(column);

      if (isPreviewControlledByKeyboard) {
        const dx = currentX - previewCoordinates.x;
        const dy = currentY - previewCoordinates.y;
        if (Math.sqrt(dx * dx + dy * dy) > MOUSE_OVERRIDE_THRESHOLD) {
          setIsPreviewControlledByKeyboard(false);
          setPreviewCoordinates({ x: currentX, y: currentY });
        } // Else: keyboard keeps control, coordinates are not updated by insignificant mouse move
      } else {
        setPreviewCoordinates({ x: currentX, y: currentY });
      }
      // Direct setPreviewNote calls are removed from here.
      // The main preview logic will be in a useEffect hook watching previewCoordinates.
    } else {
      setHoverColumn(null); // Clear hover column if tools are not active or if playing
      // setPreviewNote(null); // Also handled by central useEffect if conditions change
    }
  };

  // Add handleAddChordClick function
  const handleAddChordClick = (e) => {
    if (!isAddChordToolActive || isPlaying) return;

    if (e.target.closest('.toolbar') || e.target.closest('.piano-keyboard')) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const containerHeight = containerRef.current.clientHeight;
    const keyboardHeight = KEYBOARD_HEIGHT;

    if (y > containerHeight - keyboardHeight) {
      return;
    }

    const clickTime = (containerHeight - keyboardHeight - y) / PIXELS_PER_SECOND;
    const unsnappedTime = scrollPositionRef.current + clickTime;
    const insertTime = isSnapToGridActive ? snapTimeToGrid(unsnappedTime) : unsnappedTime;

    const containerWidth = containerRef.current.clientWidth;
    const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
    const noteIndex = Math.floor(x / keyWidth);
    const rootMidiNote = noteIndex + noteRange.min;

    // Generate chord notes
    const chordNotes = getChordNotes(rootMidiNote, selectedChordType);
    
    // ADDED: Note limit check
    const currentNoteCount = midiData?.tracks?.[0]?.notes?.length || 0;
    if (currentNoteCount + chordNotes.length > NOTE_LIMIT) {
      alert(`Adding this chord would exceed the project note limit of ${NOTE_LIMIT.toLocaleString()}.`);
      return;
    }
    
    // Create new notes for each note in the chord
    const newNotes = chordNotes.map(midiNote => ({
      id: uuidv4(),
      midi: midiNote,
      time: insertTime,
      duration: DEFAULT_DURATIONS[selectedDuration] || 0.25,
      name: getNoteAndOctave(midiNote).note + getNoteAndOctave(midiNote).octave,
      velocity: 0.8
    }));

    // Play chord preview
    if (synth) {
      newNotes.forEach(note => {
        const noteName = Tone.Frequency(note.midi, "midi").toNote();
        synth.triggerAttackRelease(noteName, "8n", Tone.now(), note.velocity || 0.8);
      });
    }

    // Update MIDI data with new chord notes
    const currentData = JSON.parse(JSON.stringify(midiData || { tracks: [{ notes: [] }] }));
    const newTracks = [...(currentData.tracks || [])];
    if (newTracks.length === 0) {
      newTracks.push({ notes: [] });
    }

    newTracks[0].notes = [...newTracks[0].notes, ...newNotes].sort((a, b) => a.time - b.time);
    onUpdateMidiData({ ...currentData, tracks: newTracks });
  };

  //==============SPACER SECTION====================

  // Update handleSpacerClick to use spacerDuration instead of selectedDuration
  const handleSpacerClick = (e) => {
    if (!isSpacerToolActive || isPlaying) return;

    // Check if click is within toolbar or keyboard area
    if (e.target.closest('.toolbar') || e.target.closest('.piano-keyboard')) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const containerHeight = containerRef.current.clientHeight;
    const keyboardHeight = KEYBOARD_HEIGHT;

    // Return if click is in keyboard area
    if (y > containerHeight - keyboardHeight) {
      return;
    }

    // Calculate the time at click position
    const clickTime = (containerHeight - keyboardHeight - y) / PIXELS_PER_SECOND;
    const unsnappedTime = scrollPositionRef.current + clickTime;
    const insertTime = isSnapToGridActive ? snapTimeToGrid(unsnappedTime) : unsnappedTime;

    // Create new tracks with shifted notes
    const newTracks = midiData.tracks.map(track => ({
      ...track,
      notes: track.notes.map(note => {
        // Only shift notes that are after the click position
        if (note.time >= insertTime) {
          const shiftAmount = DEFAULT_DURATIONS[spacerDuration] || DEFAULT_DURATIONS[1]; // Use selected spacer duration value, fallback to 1/4 note
          const newTime = note.time + shiftAmount;
          return {
            ...note,
            time: isSnapToGridActive ? snapTimeToGrid(newTime) : newTime
          };
        }
        return note;
      })
    }));

    // Update MIDI data
    onUpdateMidiData({ ...midiData, tracks: newTracks });
  };

  // Add cleanup effect right before the return statement
  useEffect(() => {
    // Return cleanup function
    return () => {
      // Stop all audio when component unmounts
      if (synth) {
        synth.releaseAll();
      }
      
      // Stop Tone.js transport
      Tone.Transport.stop();
      Tone.Transport.seconds = 0;
      Tone.Transport.position = 0;
      Tone.Transport.cancel(); // Cancel all scheduled events
      
      // Cancel any pending animation frames
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // Clear any scroll intervals
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [synth]); // Only re-run if synth changes

  //==============TEXT SECTION AGAIN?====================

  // Add text editing handlers
  const handleTextChange = (id, newText) => {
    const updatedAnnotations = textAnnotations.map(annotation => // Use prop
      annotation.id === id ? { ...annotation, text: newText } : annotation
    );
    setTextAnnotations(updatedAnnotations); // Use prop setter
  };

  // Update handleTextBlur to check if we're clicking within the editing container
  const handleTextBlur = (e, id) => {
    // Don't close if clicking within editing controls
    const isClickingEditControls = e.relatedTarget && 
      (e.relatedTarget.tagName === 'SELECT' || 
       e.relatedTarget.tagName === 'OPTION' ||
       e.relatedTarget.tagName === 'BUTTON' ||
       e.relatedTarget.closest('button'));
    
    if (isClickingEditControls) {
      console.log('Clicked on editing controls, keeping editor open');
      return; // Don't close if clicking edit controls
    }

    const updatedAnnotations = textAnnotations.filter(annotation => // Use prop
      annotation.id !== id || annotation.text.trim() !== ''
    );
    setTextAnnotations(updatedAnnotations); // Use prop setter
    setEditingText(null);
    setIsTextToolActive(false);
  };

  const handleTextKeyPress = (e, id) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  };

  const handleTextDoubleClick = (id) => {
    setEditingText(id);
  };

  // Add console log to track state changes
  useEffect(() => {
    console.log('Text annotations:', textAnnotations);
    console.log('Editing text:', editingText);
  }, [textAnnotations, editingText]);

  // Add new state for font size
  const [textFontSize, setTextFontSize] = useState(14);

  // Add new state for background image
  // const [backgroundImage, setBackgroundImage] = useState(null);

  // Add this function to handle font size changes for individual annotations
  const handleFontSizeChange = (id, newSize) => {
    // We still store the base font size that will be used for responsive calculations
    const updatedAnnotations = textAnnotations.map(annotation => // Use prop
      annotation.id === id 
        ? { ...annotation, fontSize: newSize }
        : annotation
    );
    setTextAnnotations(updatedAnnotations); // Use prop setter
  };

  // Add new state for hand tool
  // const [isHandToolActive, setIsHandToolActive] = useState(false); // REMOVED

  // Add new function to handle hand tool interaction
  // const handleHandToolInteraction = (noteId) => { ... }; // REMOVED

  //==============ERASE SECTION====================

  const handleNoteClick = (note) => {
    // Remove the clicked note
    const newTracks = midiData.tracks.map(track => ({
      ...track,
      notes: track.notes.filter(n => n.id !== note.id)
    }));
    onUpdateMidiData({ ...midiData, tracks: newTracks });
  };

  //==============NOTE RESIZE SECTION====================

  // Add handleNoteResize before the return statement
  const handleNoteResize = (noteBeingResized, newCalculatedDurationSeconds, newVisualTopY_px, resizeDirection) => {
    if (!midiData || !containerRef.current) return;

    const originalNoteMaster = midiData.tracks
      .flatMap(track => track.notes)
      .find(n => n.id === noteBeingResized.id);

    if (!originalNoteMaster) return;

    const minAllowedDuration = 0.0625;
    let finalNewDuration = Math.max(minAllowedDuration, newCalculatedDurationSeconds);
    
    // Apply grid snapping to duration if snap to grid is active
    if (isSnapToGridActive) {
      // Get duration of a single beat in seconds
      const snapOffset = 120; // This is a BPM value, used as a reference for grid timing calculations
      const beatDuration = 60 / snapOffset; // in seconds
      
      // Calculate the grid size based on the selected duration (as a fraction of a beat)
      let gridSizeInBeats;
      switch (selectedDuration) {
        case 0.25: gridSizeInBeats = 0.25; break; // 16th note
        case 0.5: gridSizeInBeats = 0.5; break;   // 8th note
        case 2: gridSizeInBeats = 2; break;       // half note
        case 4: gridSizeInBeats = 4; break;       // whole note
        case 1: default: gridSizeInBeats = 1;     // quarter note
      }
      
      // Calculate grid size in seconds (same calculation as in snapTimeToGrid)
      const gridSize = (beatDuration * gridSizeInBeats) / 2;
      
      // Snap the duration to the nearest grid size
      const gridUnits = Math.round(finalNewDuration / gridSize);
      finalNewDuration = Math.max(gridSize, gridUnits * gridSize); // Ensure minimum duration of one grid unit
    }

    const groupId = noteGroups.get(noteBeingResized.id);
    const notesToUpdateIds = new Set();
    if (groupId) {
      noteGroups.forEach((gId, noteId) => {
        if (gId === groupId) {
          notesToUpdateIds.add(noteId);
        }
      });
    } else {
      notesToUpdateIds.add(noteBeingResized.id);
    }

    const newTracks = midiData.tracks.map(track => ({
      ...track,
      notes: track.notes.map(n => {
        if (notesToUpdateIds.has(n.id)) {
          // Find the original state of *this specific note n* for accurate calculations
          const originalNoteCurrent = midiData.tracks
            .flatMap(tr => tr.notes)
            .find(noteToFind => noteToFind.id === n.id);
          
          if (!originalNoteCurrent) return n; // Should not happen

          let noteSpecificNewTime;
          if (resizeDirection === 'top') {
            // Top handle dragged: Musical start time is anchored for this note.
            noteSpecificNewTime = originalNoteCurrent.time;
          } else { // 'bottom'
            // Bottom handle dragged: Musical end time is anchored for this note.
            // new_startTime = (old_startTime + old_duration) - new_duration
            noteSpecificNewTime = (originalNoteCurrent.time + originalNoteCurrent.duration) - finalNewDuration;
            // Ensure time doesn't go negative
            noteSpecificNewTime = Math.max(0, noteSpecificNewTime);
            
            // Apply grid snapping to the new start time if snap to grid is active
            if (isSnapToGridActive) {
              noteSpecificNewTime = snapTimeToGrid(noteSpecificNewTime);
            }
          }
          return {
            ...n,
            time: noteSpecificNewTime,
            duration: finalNewDuration // All notes in group get the same new duration
          };
        }
        return n;
      })
    }));

    onUpdateMidiData({ ...midiData, tracks: newTracks });
    
    // Force immediate visual update to prevent jumping due to scroll position calculations
    // The issue: visible notes are calculated as timeOffset = note.time - currentScrollTime
    // When note.time changes (especially with bottom resize), the visual position jumps
    // until the scroll position or other factors cause a recalculation
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;
      const containerWidth = containerRef.current.clientWidth;
      const adjustedPixelsPerSecond = PIXELS_PER_SECOND;
      const keyboardHeight = KEYBOARD_HEIGHT;
      const bufferZone = containerHeight * heightFactor;
      const currentTime = scrollPositionRef.current;
      const noteWidth = (containerWidth / (noteRange.max - noteRange.min + 1)) - NOTE_SPACING;
      
      const newVisibleNotesArray = [];
      newTracks.forEach(track => {
        track.notes.forEach(note => {
          const timeOffset = note.time - currentTime;
          const y = containerHeight - keyboardHeight - (timeOffset * adjustedPixelsPerSecond);
          const noteHeight = note.duration * adjustedPixelsPerSecond * heightFactor;
          
          if (y + noteHeight >= -bufferZone && y <= containerHeight + bufferZone) {
            const x = getXPosition(note.midi);
            newVisibleNotesArray.push({
              ...note,
              x,
              y: Math.round(y - noteHeight),
              width: noteWidth,
              height: noteHeight,
              isBlack: isBlackKey(note.midi),
              isLeftHand: note.isLeftHand
            });
          }
        });
      });
      
      setVisibleNotes(newVisibleNotesArray);
    }
  };

  // Add this useEffect to sync the scrollPosition with Tone.Transport
  useEffect(() => {
    if (!isPlaying) {
      // When not playing, keep Tone.Transport in sync with scroll position
      Tone.Transport.seconds = songPosition / playbackSpeed;
    }
  }, [songPosition, isPlaying, playbackSpeed]);

  // Update the detectChordFromNotes function
  const detectChordFromNotes = (notes) => {
    if (!notes || notes.length === 0) return null;

    // Group notes that are visually close (e.g., start at very similar times)
    // This is a simplified approach for display purposes after removing explicit sync.
    // A more sophisticated visual grouping might be needed for complex scores.
    const groups = [];
    const sortedNotes = [...notes].sort((a, b) => a.time - b.time);
    let currentGroup = [sortedNotes[0]];
    const visualTimeThreshold = 0.02; // Small threshold for visual grouping, e.g., 20ms

    for (let i = 1; i < sortedNotes.length; i++) {
      const timeDiff = Math.abs(sortedNotes[i].time - currentGroup[0].time);
      if (timeDiff <= visualTimeThreshold) { // Use a small visual threshold
        currentGroup.push(sortedNotes[i]);
      } else {
        groups.push([...currentGroup]);
        currentGroup = [sortedNotes[i]];
      }
    }
    groups.push(currentGroup);

    // Return array of detected chords with their positions
    return groups.map(group => {
      const detected = detectMusicalElements(group);
      return detected ? {
        chordName: detected.description,
        time: group[0].time, // Use the time of the first note in the visual group
        midi: Math.min(...group.map(n => n.midi))
      } : null;
    }).filter(Boolean);
  };

  // Add handleNoteSelection function before the return statement
  const handleNoteSelection = (note) => {
    console.log('=== HANDLE NOTE SELECTION DEBUG ===');
    console.log('Selecting note:', note.id);
    console.log('Current noteGroups before selection:', Array.from(noteGroups.entries()));
    
    const newGroupId = uuidv4();
    const newColor = getColor(); // Uses groupColors prop via getColor helper

    const updatedGroups = new Map(); // Start fresh selection
    const updatedColors = new Map(); // Start fresh colors

    updatedGroups.set(note.id, newGroupId);
    updatedColors.set(newGroupId, newColor);

    console.log('New noteGroups after selection:', Array.from(updatedGroups.entries()));
    console.log('Calling onNoteGroupsChange with:', Array.from(updatedGroups.entries()));

    onNoteGroupsChange(updatedGroups); // Call parent setter
    onGroupColorsChange(updatedColors); // Call parent setter
    setCurrentGroupId(newGroupId); // Keep local currentGroupId for selection process
  };

  // Add this new function for creating arpeggio notes
  const createArpeggioNotes = (startMidi, endMidi, startTime, endTime, arpeggioScaleType) => {
    // Get all notes between start and end, regardless of direction
    const minMidi = Math.min(startMidi, endMidi);
    const maxMidi = Math.max(startMidi, endMidi);
    
    // For arpeggio patterns, we need to determine the root note first
    const rootNote = startMidi; // Always use the starting point as the root
    const pattern = scalePatterns[arpeggioScaleType] || []; // CHANGED: Use passed arpeggioScaleType
    if (!pattern || pattern.length === 0) return [];
    
    // Generate all possible notes in this arpeggio pattern starting from the root
    let allNotes = [];
    let octave = -10; // Start from very low to ensure we capture all possible notes
    
    while (rootNote + pattern[pattern.length - 1] + (octave * 12) <= 127) {
      pattern.forEach(interval => {
        const note = rootNote + interval + (octave * 12);
        if (note >= 0 && note <= 127) {
          allNotes.push(note);
        }
      });
      octave++;
    }
    
    // Filter to only notes within our range
    const notesToUse = allNotes.filter(midi => midi >= minMidi && midi <= maxMidi);
    
    // Determine direction for note order
    const isGoingUp = endMidi >= startMidi;
    if (!isGoingUp) {
      notesToUse.reverse();
    }

    // Create actual note objects with timing
    const horizontalDirection = endTime >= startTime ? 1 : -1;
    let notes = [];
    let currentTime = startTime;
    const noteSpacing = 0.125 * horizontalDirection; // Fixed 1/8th note spacing, direction aware
    const noteDuration = 0.125; // Fixed 1/8th note duration for each note
    
    for (let midi of notesToUse) {
      const snappedTime = isSnapToGridActive ? snapTimeToGrid(currentTime) : currentTime;
      notes.push({
        id: uuidv4(),
        midi: midi,
        time: snappedTime,
        duration: noteDuration,
        name: getNoteAndOctave(midi).note + getNoteAndOctave(midi).octave,
        velocity: 0.8
      });
      currentTime += noteSpacing;
    }

    return notes;
  };

  // Update createRunNotes to always use the start point as anchor
  const createRunNotes = (startMidi, endMidi, startTime, endTime) => {
    // ADDED: Hide preview if cursor in toolbar
    if (isCursorInToolbar) { // This prop comes from App.js
      return [];
    }
    // Check if we're using an arpeggio pattern
    if (runToolScale.endsWith('Arp')) { // CHANGED: Use runToolScale
      return createArpeggioNotes(startMidi, endMidi, startTime, endTime, runToolScale); // CHANGED: Pass runToolScale
    }

    // Original run behavior for scales
    const scaleNotes = getScaleNotesBetween(
      Math.min(startMidi, endMidi),
      Math.max(startMidi, endMidi),
      runToolScale, // CHANGED: Use runToolScale
      runToolKey    // CHANGED: Use runToolKey
    );

    // If we're going in reverse direction, reverse the notes
    if (endMidi < startMidi) {
      scaleNotes.reverse();
    }

    const timeStep = Math.abs(endTime - startTime) / Math.max(1, scaleNotes.length - 1);
    const horizontalDirection = endTime >= startTime ? 1 : -1;

    return scaleNotes.map((midi, i) => {
      // Calculate the raw time first
      const rawTime = startTime + (i * timeStep * horizontalDirection);
      // Apply snap to grid if active
      const noteTime = isSnapToGridActive ? snapTimeToGrid(rawTime) : rawTime;
      
      return {
        id: uuidv4(),
        midi: midi,
        time: noteTime,
        duration: DEFAULT_DURATIONS[selectedDuration] || 0.25,  // Use DEFAULT_DURATIONS instead of selectedDuration directly
        name: getNoteAndOctave(midi).note + getNoteAndOctave(midi).octave,
        velocity: 0.8
      };
    });
  };

  // Update handleRunToolMouseDown to store more initial state
  const handleRunToolMouseDown = (e) => {
    if (!isRunToolActive || isPlaying) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const containerHeight = containerRef.current.clientHeight;
    const keyboardHeight = KEYBOARD_HEIGHT;

    if (y > containerHeight - keyboardHeight) return;

    const containerWidth = containerRef.current.clientWidth;
    const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
    const noteIndex = Math.floor(x / keyWidth);
    const startMidiNote = noteIndex + noteRange.min;

    const clickTime = (containerHeight - keyboardHeight - y) / PIXELS_PER_SECOND;
    const startTime = scrollPositionRef.current + clickTime;

    // Store the initial click coordinates along with MIDI and time info
    setRunStartNote({
      midi: startMidiNote,
      time: startTime,
      x: x,
      y: y
    });
    setIsRunning(true);
  };

  // Update handleRunToolMouseMove to use the stored initial position
  const handleRunToolMouseMove = (e) => {
    if (!isRunning || !runStartNote || !isRunToolActive) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const containerHeight = containerRef.current.clientHeight;
    const keyboardHeight = KEYBOARD_HEIGHT;
    const containerWidth = containerRef.current.clientWidth;
    const keyWidth = containerWidth / (noteRange.max - noteRange.min + 1);
    
    const noteIndex = Math.floor(x / keyWidth);
    const currentMidiNote = noteIndex + noteRange.min;
    
    const clickTime = (containerHeight - keyboardHeight - y) / PIXELS_PER_SECOND;
    const currentTime = scrollPositionRef.current + clickTime;

    // Create preview notes using the stored initial position and current selectedDuration
    const previewNotes = createRunNotes(
      runStartNote.midi,
      currentMidiNote,
      runStartNote.time,
      currentTime
    );

    // Update preview notes state
    setRunPreviewNotes(previewNotes);

    // Play the last note in the run for audio feedback
    /*
    if (synth && previewNotes.length > 0) {
      const lastNote = previewNotes[previewNotes.length - 1];
      const noteName = Tone.Frequency(lastNote.midi, "midi").toNote();
      synth.triggerAttackRelease(noteName, "32n");
    }
    */
  };

  // Add effect to update preview notes when duration changes
  useEffect(() => {
    if (isRunning && runStartNote && runPreviewNotes.length > 0 && !isCursorInToolbar) { // ADDED: !isCursorInToolbar check
      const previewNotes = createRunNotes(
        runStartNote.midi,
        runPreviewNotes[runPreviewNotes.length - 1].midi,
        runStartNote.time,
        runPreviewNotes[runPreviewNotes.length - 1].time
      );
      setRunPreviewNotes(previewNotes);
    }
  }, [selectedDuration]);

  const handleRunToolMouseUp = () => {
    if (!isRunning || !runStartNote || !midiData || !isRunToolActive) return;

    // Add the run notes to the MIDI data
    const currentData = JSON.parse(JSON.stringify(midiData));
    const newTracks = [...currentData.tracks];
    if (newTracks.length === 0) {
      newTracks.push({ notes: [] });
    }

    // Ensure we have preview notes to add
    if (runPreviewNotes.length > 0) {
      // Add all preview notes to the track
      newTracks[0].notes = [...newTracks[0].notes, ...runPreviewNotes]
        .sort((a, b) => a.time - b.time);

      // Update MIDI data with new notes
      onUpdateMidiData({ ...currentData, tracks: newTracks });
    }

    // Reset run tool state
    setRunStartNote(null);
    setRunPreviewNotes([]);
    setIsRunning(false);
  };

  // Add effect to clean up run tool state when deactivated
  useEffect(() => {
    if (!isRunToolActive) {
      setRunStartNote(null);
      setRunPreviewNotes([]);
      setIsRunning(false);
    }
  }, [isRunToolActive]);

  // Add a ref to track if we're currently updating from midiData
  const updatingFromMidiDataRef = useRef(false);
  
  // Update the save annotations useEffect: Now this useEffect in Roll.jsx is responsible
  // for communicating changes in textAnnotations *back up* to App.js via onUpdateMidiData.
  // App.js then incorporates this into its history and auto-save logic.
  useEffect(() => {
    // Only trigger update if textAnnotations actually changed from what midiData might have.
    // This prevents loops if App.js sends down midiData that already contains these textAnnotations.
    // A more robust check might involve comparing with the textAnnotations part of the last known midiData.
    // For now, we assume that if textAnnotations state in Roll changes, it should be reported.

    // Check if the current textAnnotations (from props) are different from what might be in midiData prop
    // This comparison is a bit tricky because midiData prop might not always have textAnnotations directly
    // or it might be from a previous state.
    // The primary responsibility here is that when textAnnotations *managed by Roll's UI* change,
    // these changes are sent up.
    // App.js will receive these and then include them in its own state and history.

    // Avoid calling onUpdateMidiData if the component is just receiving props
    // (e.g., on initial load or when App.js updates midiData from history/load).
    // We only want to call this when Roll *itself* modifies textAnnotations.
    // The direct calls to setTextAnnotations (the prop) within Roll's handlers signify this.

    // Let App.js handle the integration of textAnnotations into the main data structure for saving/history.
    // This useEffect might not be strictly necessary anymore if all modifications to textAnnotations
    // in Roll correctly call setTextAnnotations (the prop), and then App.js uses its textAnnotations state
    // when constructing data for saving or history in handleEditorUpdate.

    // Consider if onUpdateMidiData should be called directly from text annotation handlers if immediate
    // history update is desired for every text change.
    // The current `handleMidiDataUpdate` in Roll already includes `textAnnotations` from props.
    // So, if Roll wants to signify an update that *only* involves textAnnotations, it needs a way
    // to call `onUpdateMidiData` with the current `midiData` (notes, etc.) plus the *new* `textAnnotations`.

    // This useEffect is removed as App.js now directly manages textAnnotations state.
    // Roll.jsx will call the `setTextAnnotations` prop when its internal text editing UI changes them.
    // `App.js`'s `handleEditorUpdate` will be the central place to consolidate changes into history
    // and for auto-save. If Roll needs to trigger an update *just* for text annotations (e.g., for history),
    // it should call `onUpdateMidiData` with a structure that `handleEditorUpdate` can process.
    // For simplicity, we assume `setTextAnnotations` prop updates App.js, and then App.js handles history/saving.

  }, [textAnnotations, onUpdateMidiData]); // midiData was removed from deps as it caused loops

  // Add useEffect for spacebar preview playback and play/pause toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !isCursorInToolbar) {
        // Priority 1: Note preview for Add Note tool
        if (synth && isAddNoteToolActive && previewNote && previewNote.length > 0) {
          e.preventDefault(); // Prevent default spacebar action
          const note = previewNote[0];
          const noteName = Tone.Frequency(note.midi, "midi").toNote();
          synth.triggerAttackRelease(noteName, "8n", Tone.now(), 0.8);
          return; // Exit early to prevent play/pause toggle
        }
        
        // Priority 2: Chord preview for Add Chord tool
        if (synth && isAddChordToolActive && previewNote && previewNote.length > 0) {
          e.preventDefault(); // Prevent default spacebar action
          previewNote.forEach(note => {
            const noteName = Tone.Frequency(note.midi, "midi").toNote();
            synth.triggerAttackRelease(noteName, "8n", Tone.now() + previewNote.indexOf(note) * 0.01, 0.8); // Slight offset for chords
          });
          return; // Exit early to prevent play/pause toggle
        }
        
        // Priority 3: Run tool preview
        if (synth && isRunToolActive && runPreviewNotes && runPreviewNotes.length > 0) {
          e.preventDefault(); // Prevent default spacebar action
          runPreviewNotes.forEach((note, index) => {
            const noteName = Tone.Frequency(note.midi, "midi").toNote();
            // Play notes sequentially with a small delay
            synth.triggerAttackRelease(noteName, "16n", Tone.now() + index * 0.1, note.velocity || 0.8); 
          });
          return; // Exit early to prevent play/pause toggle
        }
        
        // Priority 4: Paste preview - execute paste on spacebar
        if (isPastePreviewActive && pastePreviewNotes && pastePreviewNotes.length > 0) {
          e.preventDefault(); // Prevent default spacebar action
                      // Debug log removed
          handlePasteAtPreviewPosition();
          setIsPastePreviewActive(false);
          setPastePreviewNotes([]);
          return; // Exit early to prevent play/pause toggle
        }
        
        // Priority 5: Global play/pause toggle (when no preview tools are active with content)
        // Only trigger if not focused on form elements that might use spacebar
        const activeElement = document.activeElement;
        const isFormElement = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.tagName === 'SELECT' ||
          activeElement.contentEditable === 'true'
        );
        
        if (!isFormElement && onPlayPauseToggle) {
          e.preventDefault(); // Prevent default spacebar action (page scroll)
          onPlayPauseToggle();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddNoteToolActive, isAddChordToolActive, previewNote, synth, isRunToolActive, runPreviewNotes, isPastePreviewActive, pastePreviewNotes, onPaste, isCursorInToolbar, onPlayPauseToggle]);

  // Add memoized visible notes calculation
  const calculateVisibleNotes = React.useCallback((currentTime, containerHeight, containerWidth, adjustedPixelsPerSecond) => {
    if (!midiData || !containerRef.current) return [];
    
    const keyboardHeight = KEYBOARD_HEIGHT;
    const noteWidth = (containerWidth / (noteRange.max - noteRange.min + 1)) - NOTE_SPACING;
    const bufferZone = containerHeight * heightFactor;
    const newVisibleNotes = [];

    midiData.tracks.forEach(track => {
      track.notes.forEach(note => {
        const timeOffset = note.time - currentTime;
        const y = containerHeight - keyboardHeight - 
                 (timeOffset * adjustedPixelsPerSecond);
        const height = note.duration * adjustedPixelsPerSecond;
        
        if (y + height >= -bufferZone && y <= containerHeight + bufferZone) {
          const x = getXPosition(note.midi);
          
          newVisibleNotes.push({
            ...note,
            x,
            y: Math.round(y - height),
            width: noteWidth,
            height,
            isBlack: isBlackKey(note.midi),
            isLeftHand: note.isLeftHand
          });
        }
      });
    });

    return newVisibleNotes;
  }, [midiData, heightFactor, noteRange, getXPosition]);

  // Common Time Signatures (can be defined here or passed from App.js if shared)
  const commonTimeSignatures = [
    { numerator: 4, denominator: 4 },
    { numerator: 3, denominator: 4 },
    { numerator: 6, denominator: 8 },
    { numerator: 2, denominator: 4 },
    { numerator: 5, denominator: 4 },
  ];

  // Context menu handler
  const handleRollContextMenu = (e) => {
    e.preventDefault();
    
    // Check if right-clicking on a note
    const noteElement = e.target.closest('.note-component');
    if (noteElement) {
      // Get the note ID from the element's data attribute or find it in visibleNotes
      const noteId = noteElement.getAttribute('data-note-id');
      if (noteId) {
        // Find the full note object from midiData
        const noteObject = midiData.tracks.flatMap(track => track.notes).find(note => note.id === noteId);
        if (!noteObject) return; // Note not found, do nothing

        // Check if this note is part of an existing selection
        if (noteGroups && noteGroups.has(noteId)) {
          // It's part of a selection, show context menu for the group
          const firstSelectedNote = midiData.tracks.flatMap(track => track.notes).find(note => noteGroups.has(note.id));
          const currentVelocity = firstSelectedNote ? firstSelectedNote.velocity : 0.8;
          
          console.log('=== CONTEXT MENU OPEN DEBUG (GROUP) ===');
          console.log('Group context menu - first selected note:', firstSelectedNote, 'velocity:', currentVelocity);
          console.log('noteGroups size:', noteGroups.size);
          console.log('noteGroups entries:', Array.from(noteGroups.entries()));
          
          setNoteContextMenu({ 
            visible: true, 
            x: e.clientX, 
            y: e.clientY, 
            noteId: null, // null indicates a group is selected
            currentVelocity: currentVelocity
          });
        } else {
          // It's not part of a selection. Select this single note first.
          handleNoteSelection(noteObject); 
          
          // Now show the context menu for the newly selected single note
          console.log('=== CONTEXT MENU OPEN DEBUG (SINGLE) ===');
          console.log('Single note context menu - selected note:', noteObject, 'velocity:', noteObject.velocity);
          
          setNoteContextMenu({ 
            visible: true, 
            x: e.clientX, 
            y: e.clientY, 
            noteId: noteId,
            currentVelocity: noteObject.velocity
          });
        }
        return; // Stop further processing
      }
    }
    
    // Check if right-clicking on text annotation
    if (e.target.closest('.text-annotation-div')) {
      return; 
    }
    
    // Show regular context menu for empty space
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  const closeNoteContextMenu = useCallback(() => {
    setNoteContextMenu({ visible: false, x: 0, y: 0, noteId: null, currentVelocity: 0.8 });
  }, []);

  // ADDED: useEffect to observe container width
  useEffect(() => {
    const currentRef = containerRef.current;
    if (!currentRef) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setRollContainerWidth(entries[0].contentRect.width);
      }
    });

    resizeObserver.observe(currentRef);
    // Set initial width
    setRollContainerWidth(currentRef.offsetWidth);

    return () => {
      resizeObserver.unobserve(currentRef);
    };
  }, []); // Runs once on mount

  // ADDED: useEffect to deactivate tools on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        // Deactivate internal tools
        setIsAddNoteToolActive(false);
        setIsSpacerToolActive(false);
        setIsRunToolActive(false);
        setIsPastePreviewActive(false);
        setPastePreviewNotes([]);
        // setIsHandToolActive(false); // REMOVED
        // Deactivate tools via prop setters from App.js
        setIsTextToolActive(false);
        setIsAddChordToolActive(false);
        setIsSelectionToolActive(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    containerRef,
    setIsAddNoteToolActive,
    setIsSpacerToolActive,
    setIsRunToolActive,
    setIsPastePreviewActive,
    setPastePreviewNotes,
    // setIsHandToolActive, // REMOVED
    setIsTextToolActive,
    setIsAddChordToolActive,
    setIsSelectionToolActive
  ]);

  // Function to update note velocities
  const handleUpdateNoteVelocity = (velocity) => {
    if (!midiData) return;

    console.log('=== VELOCITY UPDATE DEBUG START ===');
    console.log('Updating velocity to:', velocity, 'for noteId:', noteContextMenu.noteId, 'hasSelection:', hasSelection);
    console.log('Current noteGroups size:', noteGroups.size);
    console.log('Current noteGroups:', Array.from(noteGroups.entries()));
    console.log('Current midiData before update:', JSON.stringify(midiData, null, 2));

    const newTracks = midiData.tracks.map(track => ({
      ...track,
      notes: track.notes.map(note => {
        let shouldUpdate = false;
        
        if (noteContextMenu.noteId) {
          // Single note context menu - update the specific note
          shouldUpdate = note.id === noteContextMenu.noteId;
        } else if (noteGroups && noteGroups.size > 0) {
          // Group selection context menu - update all notes in the selection
          shouldUpdate = noteGroups.has(note.id);
        }
        
        if (shouldUpdate) {
          console.log('Updating note:', note.id, 'velocity from', note.velocity, 'to', velocity);
          const updatedNote = { ...note, velocity: velocity };
          console.log('Updated note object:', updatedNote);
          return updatedNote;
        }
        return note;
      })
    }));

    const updatedMidiData = { 
      ...midiData, 
      tracks: newTracks,
      noteGroups: noteGroups, // Preserve the selection state
      groupColors: groupColors // Preserve the group colors
    };

    console.log('Calling onUpdateMidiData with updated velocity');
    console.log('Updated MIDI data structure:', JSON.stringify(updatedMidiData, null, 2));
    
    // Check if the velocity was actually updated in the new data
    const updatedNotes = updatedMidiData.tracks.flatMap(track => track.notes);
    const velocityUpdatedNotes = updatedNotes.filter(note => {
      if (noteContextMenu.noteId) {
        return note.id === noteContextMenu.noteId;
      } else if (noteGroups && noteGroups.size > 0) {
        return noteGroups.has(note.id);
      }
      return false;
    });
    console.log('Notes that should have updated velocity:', velocityUpdatedNotes.map(n => ({ id: n.id, velocity: n.velocity })));
    
    onUpdateMidiData(updatedMidiData);

    // Update the context menu's current velocity display
    setNoteContextMenu(prev => ({
      ...prev,
      currentVelocity: velocity
    }));

    console.log('=== VELOCITY UPDATE DEBUG END ===');
    // Don't close the context menu immediately - let user make multiple adjustments
    // The menu will close when clicking outside or pressing Escape
  };

  // New function to apply hand color to selected notes
  const handleApplyHandColorToSelection = (hand) => {
    if (!midiData || !noteGroups || noteGroups.size === 0) return;

    const isLeft = hand === 'left';

    const newTracks = midiData.tracks.map(track => ({
      ...track,
      notes: track.notes.map(note => {
        if (noteGroups.has(note.id)) {
          return {
            ...note,
            isLeftHand: isLeft
          };
        }
        return note;
      })
    }));

    onUpdateMidiData({ 
      ...midiData, 
      tracks: newTracks,
      // Potentially clear selection after applying, or keep it based on desired UX
      // noteGroups: new Map(), // Example: clear selection
      // groupColors: new Map() // Example: clear selection colors
    });

    // Immediately update visibleNotes for instant UI feedback
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;
      const containerWidth = containerRef.current.clientWidth;
      const adjustedPixelsPerSecond = PIXELS_PER_SECOND;
      const keyboardHeight = KEYBOARD_HEIGHT;
      const bufferZone = containerHeight * heightFactor;
      const currentTime = scrollPositionRef.current;
      const noteWidth = (containerWidth / (noteRange.max - noteRange.min + 1)) - NOTE_SPACING;
      const newVisibleNotesArray = []; 
      newTracks.forEach(track => {
        track.notes.forEach(note => {
          const timeOffset = note.time - currentTime;
          const y = containerHeight - keyboardHeight - (timeOffset * adjustedPixelsPerSecond);
          const noteHeight = note.duration * adjustedPixelsPerSecond * heightFactor;
          if (y + noteHeight >= -bufferZone && y <= containerHeight + bufferZone) {
            const x = getXPosition(note.midi);
            newVisibleNotesArray.push({ 
              ...note,
              x,
              y: Math.round(y - noteHeight),
              width: noteWidth,
              height: noteHeight, // Use calculated noteHeight
              isBlack: isBlackKey(note.midi),
              isLeftHand: note.isLeftHand 
            });
          }
        });
      });
      setVisibleNotes(newVisibleNotesArray); 
    }
  };

  // Add a log to check if the prop is being received
      // Removed debug log to reduce console spam

  return (
    <div 
      id="piano-roll-container" // Added ID here
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '600px',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none',
        backgroundColor: '#282828',
        cursor: isRecordingMode ? 'default' :
               isTextToolActive ? 'text' : 
               isAddNoteToolActive ? 'crosshair' : 
               isSpacerToolActive ? 'row-resize' : 
               // isHandToolActive ? 'pointer' :  // REMOVED
               isRunToolActive ? 'crosshair' :
               isPastePreviewActive ? 'copy' :
               'default'
      }}
      className={isRecordingMode ? 'recording-mode' : ''}
      onMouseDown={handleMouseDown}
      onContextMenu={handleRollContextMenu} // Attach context menu handler
      onMouseMove={handleContainerMouseMove}
      onMouseLeave={() => {
        setHoverColumn(null);
        setPreviewNote(null);
        // Clear paste preview when mouse leaves
        if (isPastePreviewActive) {
          setPastePreviewNotes([]);
        }
      }}
    >
      {/* Conditionally render the Toolbar */}
      {shouldShowElement('toolbar') && isToolbarVisible && !isMinimalMode && (
        <Toolbar
          // Props related to Undo/Redo/Copy/Paste/Delete/Selection are handled in App/HeaderBar
          hasSelection={hasSelection}
          heightFactor={heightFactor}
          setHeightFactor={setHeightFactor}
          onUpdateMidiData={onUpdateMidiData} // Keep for potential remaining tools
          selectedDuration={selectedDuration}
          setSelectedDuration={setSelectedDuration}
          spacerDuration={spacerDuration}
          setSpacerDuration={setSpacerDuration}
          isSelectionToolActive={isSelectionToolActive} // Keep for potential remaining tools
          setIsSelectionToolActive={setIsSelectionToolActive} // Keep for potential remaining tools
          isAddNoteToolActive={isAddNoteToolActive}
          setIsAddNoteToolActive={setIsAddNoteToolActive}
          isSpacerToolActive={isSpacerToolActive}
          setIsSpacerToolActive={setIsSpacerToolActive}
          // showGrid, setShowGrid are now handled by HeaderBar/App
          isTextToolActive={isTextToolActive}
          setIsTextToolActive={setIsTextToolActive}
          backgroundImage={backgroundImage}
          onBackgroundImageChange={onBackgroundImageChange}
          customColors={customColors}
          onCustomColorsChange={onCustomColorsChange}
          // isHandToolActive={isHandToolActive} // REMOVED
          // setIsHandToolActive={setIsHandToolActive} // REMOVED
          // timeSignature, onTimeSignatureChange MOVED
          isAddChordToolActive={isAddChordToolActive}
          setIsAddChordToolActive={setIsAddChordToolActive}
          selectedChordType={selectedChordType}
          setSelectedChordType={setSelectedChordType}
          isRunToolActive={isRunToolActive} // Pass isRunToolActive
          setIsRunToolActive={setIsRunToolActive} // Pass setIsRunToolActive
          // REMOVED: Scale highlight props are now in HeaderBar
          // showScaleHighlight={showScaleHighlight}
          // setShowScaleHighlight={setShowScaleHighlight}
          // selectedScale={selectedScale}
          // setSelectedScale={setSelectedScale}
          // selectedKey={selectedKey}
          // setSelectedKey={setSelectedKey}
          // isSnapToGridActive, setIsSnapToGridActive are now handled by HeaderBar/App
          // playbackSpeed, onSpeedChange MOVED
          bpm={bpm} // Keep bpm prop if Toolbar needs it internally 
          // transpositionTargets, currentTransposeTargetId, onTranspose MOVED
          totalBars={totalBars} // Add totalBars prop
          setIsCursorInToolbar={setIsCursorInToolbar} // Pass down to Toolbar
          // ADDED: Pass Run Tool props to Toolbar
          runScale={runToolScale} 
          onRunScaleChange={onRunToolScaleChange}
          runKey={runToolKey}
          onRunKeyChange={onRunToolKeyChange}
          // Pass Theory and View related props
          playbackSpeed={playbackSpeed}
          onApplyHandColorToSelection={handleApplyHandColorToSelection} // Pass down the new handler
        />
      )}
      
      {shouldShowElement('contextMenu') && (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isVisible={contextMenu.visible}
        onClose={closeContextMenu}
        isSnapToGridActive={isSnapToGridActive} // Pass down prop
        setIsSnapToGridActive={setIsSnapToGridActive} // Pass down prop setter
        showGrid={showGrid} // Pass down prop
        setShowGrid={setShowGrid} // Pass down prop setter
        timeSignature={timeSignature}
        onTimeSignatureChange={onTimeSignatureChange}
        commonTimeSignatures={commonTimeSignatures}      
        // Pass Theory and View related props
        playbackSpeed={playbackSpeed}
        totalBars={totalBars}
        noteCount={noteCount}
        transpositionTargets={transpositionTargets}
        currentTransposeTargetId={currentTransposeTargetId}
        onTranspose={onTranspose}
        isToolbarVisible={isToolbarVisible}
        setIsToolbarVisible={setIsToolbarVisible}
        isPianoFullscreen={isPianoFullscreen}
        togglePianoFullscreen={togglePianoFullscreen}
        showScaleHighlight={showScaleHighlight}
        setShowScaleHighlight={setShowScaleHighlight} // Assuming setShowScaleHighlight comes from App.js for context menu too
        selectedScale={selectedScale}
        setSelectedScale={setSelectedScale}
        selectedKey={selectedKey}
        setSelectedKey={setSelectedKey}
      />
      )}

      {/* Note-specific context menu */}
      {shouldShowElement('contextMenu') && (
        <NoteContextMenu
          x={noteContextMenu.x}
          y={noteContextMenu.y}
          isVisible={noteContextMenu.visible}
          onClose={closeNoteContextMenu}
          onUpdateVelocity={handleUpdateNoteVelocity}
          noteId={noteContextMenu.noteId}
          noteGroups={noteGroups}
          hasSelection={hasSelection}
          currentVelocity={noteContextMenu.currentVelocity}
        />
      )}
      
      {/* Update background image container to use background-image style */}
      {shouldShowElement('backgroundImage') && backgroundImage && (
        <div 
          className="background-image-container"
          style={{
            backgroundImage: `url(${backgroundImage})`
          }}
        />
      )}

      {/* ADDED: console.log for debugging */}
      {/* console.log('Roll.jsx: Passing isPianoFullscreen to Grid:', isPianoFullscreen) */}
      {shouldShowElement('grid') && (
      <Grid 
        noteRange={noteRange}
        songDuration={songDuration}
        cellSize={PIXELS_PER_SECOND / 4}
        hoverColumn={hoverColumn}
        showGrid={showGrid} // Pass down prop
        timeSignature={timeSignature}
        songPosition={songPosition}
        heightFactor={heightFactor}
        PIXELS_PER_SECOND={PIXELS_PER_SECOND}
        playbackSpeed={playbackSpeed}
        isSnapToGridActive={isSnapToGridActive} // Pass down prop
        selectedDuration={selectedDuration}
        showScaleHighlight={showScaleHighlight}
        selectedScale={selectedScale}
        selectedKey={selectedKey}
        bpm={bpm}
        canvasWidth={rollContainerWidth} // ADDED: Pass the measured width
        canvasHeight={rollDimensions.height} // ADDED: Pass the measured height
        isPianoFullscreen={isPianoFullscreen} // Pass isPianoFullscreen to Grid
        zoomLevel={zoomLevel} // ADDED: Pass zoom level to Grid
      />
      )}

      {/* Add selection box overlay */}
      {shouldShowElement('selectionBox') && selectionBox && (
        <div
          style={{
            position: 'absolute',
            left: `${selectionBox.left}px`,
            top: `${selectionBox.top}px`,
            width: `${selectionBox.width}px`,
            height: `${selectionBox.height}px`,
            border: '1px solid #fff',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            pointerEvents: 'none',
            zIndex: 999,
          }}
        />
      )}

      {/* Update preview notes rendering to handle array of notes and display chord name */}
      {shouldShowElement('previewNotes') && previewNote && previewNote.map((note, index) => (
        <React.Fragment key={index}>
          {/* Display chord name above the root note */}
          {note.isRoot && note.chordName && (
            <div
              style={{
                position: 'absolute',
                left: `${note.x}px`,
                top: `${note.y - 25}px`,
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 1001
              }}
            >
              {note.chordName}
            </div>
          )}
          {/* Display note name for single notes */}
          {note.noteName && !note.chordName && (
            <div
              style={{
                position: 'absolute',
                left: `${note.x}px`,
                top: `${note.y - 25}px`,
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 1001
              }}
            >
              {note.noteName}
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              left: `${note.x}px`,
              top: `${note.y + NOTE_VERTICAL_OFFSET}px`,
              width: `${note.width}px`,
              height: `${note.height}px`,
              backgroundColor: note.isBlack ? 'rgba(200, 200, 200, 0.2)' : 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '4px',
              pointerEvents: 'none',
              zIndex: 1000
            }}
          />
        </React.Fragment>
      ))}

      {/* Add run preview notes */}
      {shouldShowElement('previewNotes') && runPreviewNotes.map((note, index) => {
        const containerWidth = containerRef.current?.clientWidth || 0;
        const whiteKeyCount = computeWhiteCount(noteRange);
        const whiteKeyWidth = containerWidth / whiteKeyCount;
        const isBlackNote = isBlackKey(note.midi);
        const noteWidth = isBlackNote ? (whiteKeyWidth * 0.6) : (whiteKeyWidth * 0.98);
        const timeOffset = note.time - scrollPositionRef.current;
        const y = containerRef.current.clientHeight - KEYBOARD_HEIGHT - 
                 (timeOffset * PIXELS_PER_SECOND);
        const height = note.duration * PIXELS_PER_SECOND * heightFactor;

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${getXPosition(note.midi) + (isBlackNote ? BLACK_PREVIEW_OFFSET : WHITE_PREVIEW_OFFSET)}px`,
              top: `${y - height + NOTE_VERTICAL_OFFSET}px`,
              width: `${noteWidth}px`,
              height: `${height}px`,
              backgroundColor: isBlackNote ? 'rgba(200, 200, 200, 0.2)' : 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '4px',
              pointerEvents: 'none',
              zIndex: 1000
            }}
          />
        );
      })}

      {/* Add paste preview notes */}
      {shouldShowElement('previewNotes') && pastePreviewNotes.map((note, index) => (
        <div
          key={`paste-preview-${index}`}
          style={{
            position: 'absolute',
            left: `${note.x}px`,
            top: `${note.y + NOTE_VERTICAL_OFFSET}px`,
            width: `${note.width}px`,
            height: `${note.height}px`,
            backgroundColor: note.isBlack ? 'rgba(100, 200, 255, 0.3)' : 'rgba(100, 200, 255, 0.2)',
            border: '2px solid rgba(100, 200, 255, 0.6)',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 1001 // Higher than other previews to show it's the active mode
          }}
        />
      ))}

      {/* Guide Line for Note Previews */}
      {shouldShowElement('guideLines') && ((isAddNoteToolActive || isAddChordToolActive) && previewNote && previewNote.length > 0) && (
        <div
          className="interaction-guide-line"
          style={{
            top: `${previewNote[0].y + previewNote[0].height}px`,
          }}
        />
      )}
      {shouldShowElement('guideLines') && (isRunToolActive && runPreviewNotes && runPreviewNotes.length > 0) && (
        <div
          className="interaction-guide-line"
          style={{
            // Position based on the bottom of the last note in the run preview
            top: `${runPreviewNotes[runPreviewNotes.length - 1].y + runPreviewNotes[runPreviewNotes.length - 1].height}px`,
          }}
        />
      )}
      {shouldShowElement('guideLines') && (isPastePreviewActive && pastePreviewNotes && pastePreviewNotes.length > 0) && (
        <div
          className="interaction-guide-line"
          style={{
            // Position based on the bottom of the first note in the paste preview
            top: `${pastePreviewNotes[0].y + pastePreviewNotes[0].height}px`,
          }}
        />
      )}

      <div className="notes-container">
        {visibleNotes.map((note) => {
          const containerWidth = containerRef.current?.clientWidth || 0;
          const whiteKeyCount = computeWhiteCount(noteRange);
          const whiteKeyWidth = containerWidth / whiteKeyCount;
          const isBlack = isBlackKey(note.midi);
          const noteWidth = isBlack ? (whiteKeyWidth * 0.6) : (whiteKeyWidth * 0.98);

          // Get all notes in the current group
          const groupId = noteGroups.get(note.id);
          const groupNotes = groupId ? 
            visibleNotes.filter(n => noteGroups.get(n.id) === groupId) : 
            [];

          // Detect chords
          const detectedChords = groupNotes.length > 0 ?
            detectChordFromNotes(groupNotes) : null;

          // Only show chord name if this note is the root note of one of the detected chords
          const isRootNote = detectedChords?.some(chord => 
            // Loosen matching for display: check if note.time is close to chord.time
            // and if note.midi matches chord.midi
            Math.abs(note.time - chord.time) < 0.02 && // Small threshold for time match
            note.midi === chord.midi
          );

          const chordToShow = isRootNote ?
            detectedChords.find(chord => 
              Math.abs(note.time - chord.time) < 0.02 && // Small threshold
              note.midi === chord.midi
            ) : null;

          return (
            <React.Fragment key={note.id}>
              {/* Display chord name above the root note */}
              {chordToShow && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${getXPosition(note.midi)}px`,
                    top: `${note.y - 25}px`,
                    color: 'white',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    zIndex: 1001
                  }}
                >
                  {chordToShow.chordName}
                </div>
              )}
              <Note
                note={note}
                isLeftHand={note.isLeftHand}
                isBlack={isBlack}
                x={getXPosition(note.midi)}
                y={note.y + NOTE_VERTICAL_OFFSET}
                width={noteWidth}
                height={note.height}
                onClick={handleNoteSelection}
                onDragStart={isPlaying ? null : handleNoteDragStart}
                onDrag={isPlaying ? null : handleNoteDrag}
                onDragEnd={isPlaying ? null : handleNoteDragEnd}
                onDoubleClick={() => handleNoteDoubleClick(note.id)}
                containerHeight={containerRef.current?.clientHeight}
                groupId={noteGroups.get(note.id)}
                groupColor={groupColors.get(noteGroups.get(note.id))}
                synth={synth}
                midiData={midiData}
                noteGroups={noteGroups}
                customColors={customColors}
                heightFactor={heightFactor}
                onResize={handleNoteResize}
                PIXELS_PER_SECOND={PIXELS_PER_SECOND} // Add this prop
                showNoteNames={showNoteNames} // Pass down
                noteGlow={noteGlow} // Pass the noteGlow prop to Note
                noteRoundness={noteRoundness}
                noteBevel={noteBevel}
                noteOpacity={noteOpacity}
                // Add grid snapping props
                isSnapToGridActive={isSnapToGridActive}
                selectedDuration={selectedDuration}
                songPosition={songPosition}
                scrollPositionRef={scrollPositionRef}
                calculateSnappedVisualPosition={calculateSnappedVisualPosition}
                // Recording mode props
                isRecordingMode={isRecordingMode}
              />
            </React.Fragment>
          );
        })}
      </div>
      
      {/*Keyboard component and it's properties*/}
      <Keyboard
        noteRange={noteRange}
        activeNotes={new Set([
          ...activeNotes, 
          ...(draggingNoteInfo ? [draggingNoteInfo.midi] : []),
          ...(previewNote ? previewNote.map(note => note.midi) : []) // Add preview notes to active notes
        ])}
        leftHandNotes={new Set([
          ...leftHandNotes,
          ...(draggingNoteInfo?.isLeftHand ? [draggingNoteInfo.midi] : [])
        ])}
        onKeyClick={handlePianoKeyClick}
        customColors={customColors}
      />

      {/* Add text annotations */}
      {shouldShowElement('textAnnotations') && textAnnotations.map(annotation => {
        const containerHeight = containerRef.current?.clientHeight || 0;
        const containerWidth = containerRef.current?.clientWidth || 0;
        const keyboardHeight = KEYBOARD_HEIGHT;
        
        // Convert relative X position to absolute pixel position
        const absoluteX = getAbsoluteXPosition(annotation.x);
        
        // Calculate position differently based on fixed status
        let yPosition;
        
        if (annotation.fixed) {
          // For fixed annotations, use their direct y coordinate
          // This ensures they remain fixed on screen regardless of scroll
          yPosition = annotation.y;
          
          // If the y coordinate is undefined (legacy data), calculate it
          if (yPosition === undefined) {
            const timeOffset = annotation.time - scrollPositionRef.current;
            yPosition = containerHeight - keyboardHeight - (timeOffset * PIXELS_PER_SECOND);
          }
        } else {
          // Regular annotations are positioned relative to scroll
          const timeOffset = annotation.time - scrollPositionRef.current;
          yPosition = containerHeight - keyboardHeight - (timeOffset * PIXELS_PER_SECOND);
          
          // Skip rendering if out of view
          if (yPosition >= containerHeight - keyboardHeight || yPosition < 0) {
            return null;
          }
        }

        // Calculate font size based on container width for responsiveness
        const responsiveFontSize = (annotation.fontSize || 14) * (containerWidth / 1000);
        const minFontSize = 10; // Minimum font size to ensure readability
        const fontSizeToUse = Math.max(responsiveFontSize, minFontSize);

        return (
          <div
            key={annotation.id}
            style={{
              position: 'absolute',
              left: `${absoluteX}px`,
              top: `${yPosition}px`,
              zIndex: 1000,
              color: '#fff',
              fontSize: `${fontSizeToUse}px`,
              fontFamily: 'Arial, sans-serif',
              pointerEvents: 'auto',
              cursor: editingText === annotation.id ? 'text' : 'move',
              userSelect: 'none',
              // Remove clipping for fixed annotations so they're always fully visible
              clipPath: annotation.fixed ? undefined : `polygon(0 0, 100% 0, 100% ${Math.min(containerHeight - keyboardHeight - yPosition, 100)}px, 0 ${Math.min(containerHeight - keyboardHeight - yPosition, 100)}px)`
            }}
            onMouseDown={(e) => handleTextMouseDown(e, annotation)}
            onDoubleClick={() => handleTextDoubleClick(annotation.id)}
          >
            {editingText === annotation.id ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '4px',
                borderRadius: '4px'
              }}>
                <input
                  type="text"
                  value={annotation.text}
                  onChange={(e) => handleTextChange(annotation.id, e.target.value)}
                  onBlur={(e) => handleTextBlur(e, annotation.id)}
                  onKeyPress={(e) => handleTextKeyPress(e, annotation.id)}
                  autoFocus
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #fff',
                    color: '#fff',
                    outline: 'none',
                    fontSize: `${fontSizeToUse}px`,
                    fontFamily: 'Arial, sans-serif',
                    minWidth: '50px',
                    cursor: 'text'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <select
                  value={annotation.fontSize || 14}
                  onChange={(e) => handleFontSizeChange(annotation.id, Number(e.target.value))}
                  style={{
                    background: '#333',
                    border: '1px solid #555',
                    color: '#fff',
                    padding: '2px',
                    fontSize: '12px',
                    borderRadius: '3px'
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {[10, 12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </select>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleToggleFixed(annotation.id);
                  }}
                  style={{
                    background: annotation.fixed ? '#4a90e2' : '#333',
                    border: `1px solid ${annotation.fixed ? '#2a70c2' : '#555'}`,
                    color: '#fff',
                    padding: '3px 6px',
                    fontSize: '12px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: annotation.fixed ? 'bold' : 'normal',
                    marginLeft: '4px'
                  }}
                  title={annotation.fixed ? "Unpin annotation (will scroll with music)" : "Pin annotation to stay fixed on screen"}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <i className={`fas fa-${annotation.fixed ? 'thumbtack' : 'map-pin'}`}></i>
                  {annotation.fixed ? " Fixed" : " Pin"}
                </button>
              </div>
            ) : (
              <span>
                {annotation.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Roll;