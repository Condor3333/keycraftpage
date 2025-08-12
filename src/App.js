import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Roll from './components/Roll';
import * as Tone from 'tone';
import { v4 as uuidv4 } from 'uuid';
import { Midi } from '@tonejs/midi';
import ProjectList from './components/ProjectList';
import HeaderBar from './components/Controls/HeaderBar';
import PlaybackControls from './components/Controls/PlaybackControls';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import html2canvas from 'html2canvas';
import { hasStateChanged, getChangeSummary } from './utils/projectStateComparison.js';
import Note from './components/Note';

function AppContent() {
  const { currentUser, forceSessionRefresh } = useAuth(); // ADDED: forceSessionRefresh from context
  // ADDED: Extract payment status from currentUser
  const hasPaid = currentUser?.hasPaid === true; 

  const [isPlaying, setIsPlaying] = useState(false);
  const [synth, setSynth] = useState(null);
  const [currentPart, setCurrentPart] = useState(null);
  const [pianoReady, setPianoReady] = useState(false);
  const [noteData, setNoteData] = useState({
    tracks: [{ notes: [] }]
  });
  const [history, setHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [isEditorView, setIsEditorView] = useState(false);
  const [isTextToolActive, setIsTextToolActive] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentPlaybackPosition, setCurrentPlaybackPosition] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isAddChordToolActive, setIsAddChordToolActive] = useState(false);
  const [selectedChordType, setSelectedChordType] = useState('major');
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [customColors, setCustomColors] = useState(null);
  const scrollPositionRef = useRef(0);
  const [timeSignature, setTimeSignature] = useState({ numerator: 4, denominator: 4 });
  const [bpm, setBpm] = useState(120);
  const [isSavingOnExit, setIsSavingOnExit] = useState(false);
  const [isReturningToProjects, setIsReturningToProjects] = useState(false);
  const [cloudSaveError, setCloudSaveError] = useState(null);
  const [totalBars, setTotalBars] = useState(0);
  const [songDuration, setSongDuration] = useState(0);

  // ADDED: State for piano roll fullscreen
  const [isPianoFullscreen, setIsPianoFullscreen] = useState(false);

  // Auto-enable fullscreen on mobile
  useEffect(() => {
    const checkMobileAndSetFullscreen = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                            (window.innerWidth <= 768 && 'ontouchstart' in window);
      
      if (isMobileDevice) {
        setIsPianoFullscreen(true);
      }
    };
    
    checkMobileAndSetFullscreen();
    window.addEventListener('resize', checkMobileAndSetFullscreen);
    
    return () => window.removeEventListener('resize', checkMobileAndSetFullscreen);
  }, []);

  // ADDED: State for manual cloud save status
  const [isManuallySaving, setIsManuallySaving] = useState(false);

  // ADDED: State for projects loading and error
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [loadProjectsError, setLoadProjectsError] = useState(null);

  // LIFTED STATE: For text annotations
  const [textAnnotations, setTextAnnotations] = useState([]);

  // ADDED: State for save success popup
  const [showSaveSuccessPopup, setShowSaveSuccessPopup] = useState(false);

  // Lifted State from Roll
  const [noteGroups, setNoteGroups] = useState(new Map());
  const [groupColors, setGroupColors] = useState(new Map());
  const [clipboardNotes, setClipboardNotes] = useState({ notes: [], originalMaxEndTime: 0 });

  // State for Grid and Snap (lifted from Roll)
  const [showGrid, setShowGrid] = useState(false);
  const [isSnapToGridActive, setIsSnapToGridActive] = useState(false);

  // State for Transposition
  const [originalMidiDataForTranspose, setOriginalMidiDataForTranspose] = useState(null);
  const [currentTransposeTargetId, setCurrentTransposeTargetId] = useState('original');

  // Add theme state
  const [theme, setTheme] = useState('dark'); // 'dark' or 'light'

  // Add development storage fallback
  const isDev = process.env.NODE_ENV === 'development';
  
  // Add state for toolbar visibility
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  
  // ADDED: State to track if cursor is in toolbar
  const [isCursorInToolbar, setIsCursorInToolbar] = useState(false);

  // ADDED: State for tracking changes
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedState, setLastSavedState] = useState(null);
  const [dirtyChanges, setDirtyChanges] = useState([]);
  const [lastSaveTime, setLastSaveTime] = useState(null);

  // ADDED: State for MIDI import loading
  const [isImportingMidi, setIsImportingMidi] = useState(false);
  
  // ADDED: State for audio transcription loading
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);

  // ADDED: State for Scale Highlight (lifted from Toolbar)
  const [showScaleHighlight, setShowScaleHighlight] = useState(false);
  const [selectedScale, setSelectedScale] = useState('major'); 
  const [selectedKey, setSelectedKey] = useState('C');

  // ADDED: State for Run Tool scale and key
  const [runToolScale, setRunToolScale] = useState('major');
  const [runToolKey, setRunToolKey] = useState('C');

  // ADDED: State for showing note names
  const [showNoteNames, setShowNoteNames] = useState(false);

  // ADDED: State for minimal mode
  const [isMinimalMode, setIsMinimalMode] = useState(false);

  // ADDED: State for note styling
  const [noteGlow, setNoteGlow] = useState(0);
  const [noteRoundness, setNoteRoundness] = useState(4);
  const [noteBevel, setNoteBevel] = useState(0);
  const [noteOpacity, setNoteOpacity] = useState(1);

  // States for video recording
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [recordingPreset, setRecordingPreset] = useState('minimal');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [showVideoExportDialog, setShowVideoExportDialog] = useState(false);

  // ADDED: Zoom state
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 0.5 = 50%, 2 = 200%, etc.

  // ADDED: Note limit constant
  const NOTE_LIMIT = 20000;

  // ADDED: State to track current transposition offset in semitones
  const [transpositionOffset, setTranspositionOffset] = useState(0);

  const handleSetNoteGlow = (value) => {
    console.log(`[App.js] Setting noteGlow to: ${value}`);
    setNoteGlow(value);
  };

  const resetNoteStyles = () => {
    setNoteGlow(0);
    setNoteRoundness(4);
    setNoteBevel(0);
    setNoteOpacity(1);
  };

  // ADDED: Zoom handler functions
  const handleZoomChange = (newZoomLevel) => {
    setZoomLevel(Math.max(0.25, Math.min(newZoomLevel, 2))); // Clamp between 25% and 200%
  };

  const handleZoomReset = () => {
    setZoomLevel(1); // Reset to 100%
  };

  // ADDED: Helper function to fetch an image and convert it to a data URL
  const imageToDataURL = (url) => {
    console.log('[imageToDataURL] Attempting to fetch URL:', url);
    return fetch(url, { mode: 'cors' }) // Explicitly set mode: 'cors' for the fetch
      .then(response => {
        console.log('[imageToDataURL] Fetch response status:', response.status, 'ok:', response.ok, 'for URL:', url);
        if (!response.ok) {
          // Try to get more error info if possible
          return response.text().then(text => {
            console.error('[imageToDataURL] Fetch response error text:', text, 'for URL:', url);
            throw new Error(`HTTP error! status: ${response.status}, message: ${text}, for URL: ${url}`);
          }).catch(() => {
            // Fallback if .text() also fails or isn't appropriate
            throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`);
          });
        }
        return response.blob();
      })
      .then(blob => {
        console.log('[imageToDataURL] Successfully fetched blob. Type:', blob.type, 'Size:', blob.size, 'for URL:', url);
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            console.log('[imageToDataURL] FileReader successfully converted blob to dataURL for URL:', url);
            resolve(reader.result);
          };
          reader.onerror = (err) => {
            console.error('[imageToDataURL] FileReader error for URL:', url, err);
            reject(new Error(`FileReader error for URL ${url}: ${err.message || 'Unknown FileReader error'}`));
          };
          reader.readAsDataURL(blob);
        });
      })
      .catch(error => {
        console.error('[imageToDataURL] Overall error in imageToDataURL for URL:', url, error.message);
        return null; // Return null on error
      });
  };

  // ADDED: Effect to toggle class on body for fullscreen
  useEffect(() => {
    // Only apply body class if both fullscreen mode is active AND in editor view
    if (isPianoFullscreen && isEditorView) {
      document.body.classList.add('fullscreen-piano-active');
    } else {
      document.body.classList.remove('fullscreen-piano-active');
    }
    return () => {
      document.body.classList.remove('fullscreen-piano-active'); // Cleanup on unmount or when conditions change
    };
  }, [isPianoFullscreen, isEditorView]); // ADD isEditorView to dependencies

  useEffect(() => {
    console.log('Environment:', process.env.NODE_ENV);
    // console.log('Electron API:', window.electronAPI); // Removed Electron logging

    // Setup devThumbnailAPI for thumbnail mocks
    // This part is preserved but no longer inside an Electron-specific conditional
    if (isDev) { // Keep the isDev check if you want these only in development
      console.log('Initializing window.devThumbnailAPI for development');
      window.devThumbnailAPI = {
        saveThumbnail: async (projectId, thumbnailDataUrl) => {
          console.log('Dev Thumbnail API: Saving thumbnail for project', projectId);
          localStorage.setItem(`thumbnail_${projectId}`, thumbnailDataUrl);
          return true;
        },
        loadThumbnail: async (projectId) => {
          console.log('Dev Thumbnail API: Loading thumbnail for project', projectId);
          return localStorage.getItem(`thumbnail_${projectId}`);
        },
        deleteThumbnail: async (projectId) => {
          console.log('Dev Thumbnail API: Deleting thumbnail for project', projectId);
          localStorage.removeItem(`thumbnail_${projectId}`);
          return true;
        }
      };

      // Setup devBackgroundImageAPI for background image mocks
      console.log('Initializing window.devBackgroundImageAPI for development');
      window.devBackgroundImageAPI = {
        saveBackgroundImage: async (projectId, imageDataUrl) => {
          console.log('Dev Background Image API: Saving background image for project', projectId);
          try {
            localStorage.setItem(`bg_image_${projectId}`, imageDataUrl);
            return true;
          } catch (e) {
            console.error('Dev Background Image API: Error saving to localStorage (image might be too large for localStorage):', e);
            return false;
          }
        },
        loadBackgroundImage: async (projectId) => {
          console.log('Dev Background Image API: Loading background image for project', projectId);
          return localStorage.getItem(`bg_image_${projectId}`);
        },
        deleteBackgroundImage: async (projectId) => {
          console.log('Dev Background Image API: Deleting background image for project', projectId);
          localStorage.removeItem(`bg_image_${projectId}`);
          return true;
        }
      };
      // console.log('window.electronAPI for dev:', window.electronAPI); // Removed
      console.log('window.devThumbnailAPI for dev:', window.devThumbnailAPI);
      console.log('window.devBackgroundImageAPI for dev:', window.devBackgroundImageAPI);
    }
  }, [isDev]);
  // ALL ABOVE is a mock API using browser storage for development purposes. 

  // Add this useEffect to test Firebase connection
  useEffect(() => {
    console.log('User-related useEffect (App.js) - currentUser will be managed by AuthJS');
  }, [currentUser]);

  //==============SYNTH INITIALIZATION====================
  // Replaces synth initialization with sampler
  //Creates realistic piano sounds via audio samples
  useEffect(() => {
    const piano = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        A7: "A7.mp3",
      },
      release: 0.8,
      volume: -6,
      attack: 0.005,
      curve: "linear",
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => {
        setPianoReady(true);
      }
    }).toDestination();

//Audio Processing Chain
   
    //Limiter prevents audio from exceeding maximum volume
    const masterLimiter = new Tone.Limiter(-2).toDestination();
    
    //Multiband compressor splits audio into 3 frequency bands
    const multiband = new Tone.MultibandCompressor({
      lowFrequency: 200,
      highFrequency: 2000,
      low: {
        threshold: -24,
        ratio: 6,
        attack: 0.005,
        release: 0.1
      },
      mid: {
        threshold: -24,
        ratio: 6,
        attack: 0.003,
        release: 0.1
      },
      high: {
        threshold: -24,
        ratio: 4,
        attack: 0.002,
        release: 0.1
      }
    });

    //EQ3 is a 3 band equalizer
    // Allows for independent control of low, mid, and high frequencies
    // Adjusts volume of each frequency band independently
    const eq = new Tone.EQ3({
      low: 0,
      mid: -3,
      high: -2,
      lowFrequency: 250,
      highFrequency: 2000
    });

    // Connect the audio chain, each component processes audio before passing it to next
    piano.chain(eq, multiband, masterLimiter);
    setSynth(piano);

    //Runs when 
    return () => {
      if (currentPart) {
        currentPart.dispose();
      }
      piano.dispose();
      masterLimiter.dispose();
      multiband.dispose();
      eq.dispose();
    };
  }, []);

  useEffect(() => {
    // Update looping behavior whenever isLooping changes
    Tone.Transport.loop = isLooping;
    if (isLooping && noteData.tracks[0].notes.length > 0) {
      // Calculate loopEnd based on musical time, then it will be adjusted by playbackSpeed in setup
      Tone.Transport.loopEnd = noteData.tracks[0].notes.reduce(
        (max, note) => Math.max(max, note.time + note.duration),
        0
      ) + 1; // Add 1 second buffer, musical time
      Tone.Transport.loopStart = 0; // Musical time
    }
  }, [isLooping, noteData, playbackSpeed]);

  // New refactored function to setup and start playback
  const setupAndStartPlayback = useCallback((startTime = 0, continuePlaying = true) => {
    if (!synth || !pianoReady) return;

    if (Tone.context.state !== 'running') {
      Tone.start(); // Tone.start() is async but we can proceed
    }

    if (currentPart) {
      currentPart.dispose();
    }
    Tone.Transport.cancel(); // Clean up previous scheduled events, including old scheduleOnce

    Tone.Transport.bpm.value = bpm * playbackSpeed;

    const newPart = new Tone.Part((time, note) => {
      try {
        const noteName = Tone.Frequency(note.midi, "midi").toNote();
        if (note.midi >= 18 && note.midi <= 108) {
          synth.triggerAttackRelease(
            noteName,
            note.duration / playbackSpeed,
            time,
            note.velocity
          );
        }
      } catch (error) {
        console.warn(`Skipping note ${note.midi}: ${error.message}`);
      }
    }, []);

    let contentMusicalEnd = 0;
    if (noteData.tracks[0].notes.length > 0) {
      noteData.tracks[0].notes.forEach(note => {
        newPart.add(note.time / playbackSpeed, note);
        contentMusicalEnd = Math.max(contentMusicalEnd, note.time + note.duration);
      });
    }

    newPart.loop = isLooping;
    if (isLooping && noteData.tracks[0].notes.length > 0) {
      const partLoopEnd = (contentMusicalEnd + 1) / playbackSpeed; 
      newPart.loopEnd = partLoopEnd;
      newPart.loopStart = 0;
    }
    
    newPart.start(0);
    setCurrentPart(newPart);

    if (continuePlaying) {
      Tone.Transport.start(Tone.now(), startTime);
      setIsPlaying(true);

      // Schedule auto-pause if not looping and there are notes
      if (!isLooping && noteData.tracks[0].notes.length > 0) {
        // Schedule slightly *after* the last note finishes
        const transportScheduledEndTime = (contentMusicalEnd / playbackSpeed) + 0.4; // Increased buffer to 150ms
        Tone.Transport.scheduleOnce(time => {
          // Double-check state to prevent race conditions if user interacts
          if (Tone.Transport.state === 'started' && !Tone.Transport.loop) {
            Tone.Transport.pause();
            setIsPlaying(false);
            // Set position to the actual end of content, not the UI duration buffer
            setCurrentPlaybackPosition(contentMusicalEnd);
          }
        }, transportScheduledEndTime);
      }
    } else {
      Tone.Transport.seconds = startTime;
      setIsPlaying(false);
    }
  }, [synth, pianoReady, noteData, bpm, playbackSpeed, isLooping, songDuration]);

  //==============PLAY/PAUSE TOGGLE====================
  const handlePlayPauseToggle = async () => {
    if (!synth || !pianoReady) return;
    if (Tone.context.state !== 'running') await Tone.start();

    if (!isPlaying) {
      // Play logic: calculate transport time from current musical position
      const positionToStart = scrollPositionRef.current / playbackSpeed; 
      setupAndStartPlayback(positionToStart, true);
    } else {
      // Pause logic
      scrollPositionRef.current = Tone.Transport.seconds * playbackSpeed; // Store current musical time
      Tone.Transport.pause();
      // No need to dispose part here if setupAndStartPlayback handles it, but ensure isPlaying is false
      setIsPlaying(false);
      // If currentPart exists and you want to explicitly stop its events upon pause:
      if (currentPart) {
         currentPart.stop(); // This stops future events of the part but doesn't dispose it.
                            // setupAndStartPlayback will dispose and recreate on next play.
      }
    }
    // setIsPlaying is handled by setupAndStartPlayback or set directly for pause
  };


  //==============EDITOR UPDATE====================
  const handleEditorUpdate = (updatedNoteData, shouldAddToHistory = true, isDragging = false) => {
    console.log("=== APP.JS EDITOR UPDATE DEBUG START ===");
    console.log("App.js handleEditorUpdate RECEIVED:", JSON.stringify(updatedNoteData));
    console.log("[handleEditorUpdate] Number of notes in update:", updatedNoteData?.tracks?.[0]?.notes?.length || 0);
    console.log("[handleEditorUpdate] shouldAddToHistory:", shouldAddToHistory, "isDragging:", isDragging);
    
    // Debug velocity values in the incoming data
    if (updatedNoteData?.tracks?.[0]?.notes) {
      const velocityDebug = updatedNoteData.tracks[0].notes.map(note => ({
        id: note.id,
        velocity: note.velocity,
        midi: note.midi
      }));
      console.log("Velocity values in incoming data:", velocityDebug);
    }
    
    if (updatedNoteData.bpm !== undefined && updatedNoteData.bpm !== bpm) {
      setBpm(updatedNoteData.bpm);
      if (isPlaying) {
        Tone.Transport.bpm.value = updatedNoteData.bpm * playbackSpeed;
      }
      if (updatedNoteData._source === 'handleBpmChange') {
        setNoteData(prev => ({ ...prev, bpm: updatedNoteData.bpm }));
        return;
      }
    }

    const { textAnnotations: newTextAnnotations, ...restOfMidiData } = updatedNoteData;

    setNoteData(prevNoteData => ({
      ...prevNoteData, 
      ...restOfMidiData 
    }));

    if (newTextAnnotations !== undefined) {
      setTextAnnotations(newTextAnnotations);
    }
    
    if (!shouldAddToHistory || isDragging) {
      return;
    }
    
    const historyEntry = {
      ...restOfMidiData,
      textAnnotations: newTextAnnotations !== undefined ? newTextAnnotations : textAnnotations,
      noteGroups: updatedNoteData.noteGroups || noteGroups,
      groupColors: updatedNoteData.groupColors || groupColors,
    };

    const newHistory = [...history.slice(0, currentHistoryIndex + 1), historyEntry];
    setHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
    
    if (currentProject) {
      const projectForUpdate = {
        ...currentProject,
        midiData: historyEntry,
        backgroundImage: backgroundImage,
        customColors: customColors,
        timeSignature,
        dateModified: new Date()
      };
      setCurrentProject(projectForUpdate);
      
      // Debug final velocity values in the project
      if (historyEntry?.tracks?.[0]?.notes) {
        const finalVelocityDebug = historyEntry.tracks[0].notes.map(note => ({
          id: note.id,
          velocity: note.velocity,
          midi: note.midi
        }));
        console.log("Final velocity values in history entry:", finalVelocityDebug);
      }
    }
    
    console.log("=== APP.JS EDITOR UPDATE DEBUG END ===");

    if (shouldAddToHistory && !isDragging) {
      if (updatedNoteData.noteGroups === undefined) setNoteGroups(new Map());
      if (updatedNoteData.groupColors === undefined) setGroupColors(new Map());
    }
  };

  //==============UNDO/REDO====================
  const handleUndo = () => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      const previousState = history[newIndex];
      setCurrentHistoryIndex(newIndex);

      const { textAnnotations: prevTextAnnotations, ...restOfPrevMidiData } = previousState;
      setNoteData(restOfPrevMidiData); // Set the core MIDI data
      if (prevTextAnnotations !== undefined) {
        setTextAnnotations(prevTextAnnotations); // Set the text annotations
      }

      const restoredGroups = previousState.noteGroups 
          ? (previousState.noteGroups instanceof Map ? previousState.noteGroups : new Map(Object.entries(previousState.noteGroups))) 
          : new Map();
      const restoredColors = previousState.groupColors 
          ? (previousState.groupColors instanceof Map ? previousState.groupColors : new Map(Object.entries(previousState.groupColors))) 
          : new Map();

      setNoteGroups(restoredGroups);
      setGroupColors(restoredColors);
    }
  };

  const handleRedo = () => {
    if (currentHistoryIndex < history.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      const nextState = history[newIndex];
      setCurrentHistoryIndex(newIndex);

      const { textAnnotations: nextTextAnnotations, ...restOfNextMidiData } = nextState;
      setNoteData(restOfNextMidiData); // Set the core MIDI data
      if (nextTextAnnotations !== undefined) {
        setTextAnnotations(nextTextAnnotations); // Set the text annotations
      }
          
      const restoredGroups = nextState.noteGroups 
          ? (nextState.noteGroups instanceof Map ? nextState.noteGroups : new Map(Object.entries(nextState.noteGroups))) 
          : new Map();
      const restoredColors = nextState.groupColors 
          ? (nextState.groupColors instanceof Map ? nextState.groupColors : new Map(Object.entries(nextState.groupColors))) 
          : new Map();
          
      setNoteGroups(restoredGroups);
      setGroupColors(restoredColors);
    }
  };


  //==============NEW PROJECT====================

  //Projects properties: Note data, Background Image, Note Colors, etc.
  const handleNewProject = () => {
    // ADDED: Payment check
    if (!hasPaid) {
      alert("You need an active membership to create new projects. Please visit our membership page.");
      // Optionally, redirect to membership page or show a modal
      // window.location.href = '/membership'; // Example redirect
      return;
    }

    const newProjectMidiData = {
      tracks: [{ notes: [] }]
      // BPM and timeSignature will use current App.js defaults or be set by Roll
    };
    const newProject = {
      id: uuidv4(),
      name: `Untitled Project ${projects.length + 1}`,
      dateCreated: new Date(),
      dateModified: new Date(),
      midiData: newProjectMidiData, // This is just the core note data
      projectData: { // For storage, midiData will go inside here
        midiData: newProjectMidiData,
        textAnnotations: [], // Initialize text annotations for the project data structure
        bpm: bpm, // Default BPM
        timeSignature: timeSignature, // Default time signature
      },
      appearance: {
        backgroundImage: null,
        customColors: null,
      },
      // textAnnotations will be managed by App.js state for UI, but saved inside projectData
    };
    setProjects([...projects, newProject]);
    setCurrentProject(newProject);
    setNoteData(newProjectMidiData); // Set core note data for Roll
    setTextAnnotations([]); // Reset text annotations for the new project
    setIsEditorView(true);
    setHistory([{ ...newProjectMidiData, textAnnotations: [] }]); // History includes textAnnotations
    setCurrentHistoryIndex(0);
    setBackgroundImage(null);
    setCustomColors(null);
    
    // Reset transposition state for the new project
    setTranspositionOffset(0);
    setCurrentTransposeTargetId('original');
    
    // REMOVED: saveProjectToStorage(newProject);
    // This was causing a premature save of an empty project upon creation.
    // The project will now be saved only when the user manually saves or exits with changes.
  };

  //==============CHOOSE PROJECT====================
  const handleProjectSelect = async (projectListItem) => {
    // ADDED: Payment check
    if (!hasPaid) {
      alert("You need an active membership to open projects. Please visit our membership page.");
      // Optionally, redirect to membership page or show a modal
      return;
    }

    try {
      if (currentPart) {
        currentPart.dispose();
        setCurrentPart(null);
      }
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      Tone.Transport.seconds = 0;
      Tone.Transport.cancel();
      if (synth) synth.releaseAll();
      setIsPlaying(false);
      scrollPositionRef.current = 0;
      setCurrentPlaybackPosition(0);
      setTranspositionOffset(0);
      setCurrentTransposeTargetId('original');

      console.log("[HPS LOG 1] handleProjectSelect called. projectListItem:", JSON.stringify(projectListItem));

      const { 
        bundledDataUrl, // NEW: Single URL for both midiData and textAnnotations
        midiDataUrl, 
        textAnnotationsUrl, 
        backgroundImageUrl, // This is the S3 URL for the background
        thumbnailUrl, 
        ...projectMetadata
      } = projectListItem;

      console.log(`[HPS LOG 2] Extracted URLs: bundledDataUrl: ${bundledDataUrl}, midiDataUrl: ${midiDataUrl}, textAnnotationsUrl: ${textAnnotationsUrl}, backgroundImageUrl: ${backgroundImageUrl}`);
      console.log("[HPS LOG 2.1] Project Metadata:", JSON.stringify(projectMetadata));

      let fetchedMidiData = null;
      let fetchedTextAnnotations = null;
      let finalBackgroundImageForState = null; // Will hold dataURL or null

      // Attempt to convert S3 URL to data URL for background image
      if (backgroundImageUrl) {
        console.log("[HPS LOG 2.5] Attempting to convert backgroundImageUrl to dataURL:", backgroundImageUrl);
        try {
          finalBackgroundImageForState = await imageToDataURL(backgroundImageUrl);
          if (finalBackgroundImageForState) {
            console.log("[HPS LOG 2.6] Successfully converted backgroundImageUrl to dataURL.");
          } else {
            console.warn("[HPS LOG 2.7] Failed to convert backgroundImageUrl to dataURL. Background will be null.");
          }
        } catch (e) {
          console.error("[HPS Error] Error in imageToDataURL during project select:", e);
          finalBackgroundImageForState = null; // Ensure it's null on error
        }
      } else {
        console.log("[HPS LOG 2.8] No backgroundImageUrl provided.");
      }

      // NEW: Check for bundled data first (more efficient - single HTTP request)
      if (bundledDataUrl) {
        try {
          console.log("[HPS LOG 3] Fetching bundled data from:", bundledDataUrl);
          const bundledResponse = await fetch(bundledDataUrl);
          console.log(`[HPS LOG 4] Bundled Response Status: ${bundledResponse.status}, OK: ${bundledResponse.ok}`);
          if (!bundledResponse.ok) {
            const errorText = await bundledResponse.text();
            console.error("[HPS Error] Failed to fetch bundled data. Status:", bundledResponse.status, "Text:", errorText);
            alert(`Error loading project's data. Server Response: ${bundledResponse.statusText} - ${errorText}`);
            return;
          }
          const rawBundledText = await bundledResponse.text();
          console.log("[HPS LOG 5] Raw Bundled Response Text:", rawBundledText);
          const bundledData = JSON.parse(rawBundledText);
          console.log("[HPS LOG 6] Parsed Bundled Data:", JSON.stringify(bundledData));
          
          // Extract midiData and textAnnotations from bundled data
          fetchedMidiData = bundledData.midiData;
          fetchedTextAnnotations = bundledData.textAnnotations || [];
          
          if (!fetchedMidiData || !Array.isArray(fetchedMidiData.tracks)) {
            console.error("[HPS Error] Bundled MIDI data is not in the expected format (missing tracks array). Data:", fetchedMidiData);
            alert("Error loading project's MIDI data: The data format is incorrect.");
            return;
          }
          console.log("[HPS LOG 6.5] Successfully extracted data from bundle. MIDI tracks:", fetchedMidiData.tracks.length, "Annotations:", fetchedTextAnnotations.length);
        } catch (e) {
          console.error("[HPS Error] Error fetching or parsing bundled data from S3 URL:", bundledDataUrl, e);
          alert("Error loading project's data. Check console and S3.");
          return;
        }
      } else {
        // Fallback to separate files (existing logic for older projects)
        console.log("[HPS LOG 3] No bundled data URL, falling back to separate files");

      if (midiDataUrl) {
        try {
          console.log("[HPS LOG 3] Fetching MIDI from:", midiDataUrl);
          const midiResponse = await fetch(midiDataUrl);
          console.log(`[HPS LOG 4] MIDI Response Status: ${midiResponse.status}, OK: ${midiResponse.ok}`);
          if (!midiResponse.ok) {
            const errorText = await midiResponse.text();
            console.error("[HPS Error] Failed to fetch MIDI data. Status:", midiResponse.status, "Text:", errorText);
            alert(`Error loading project's MIDI data. Server Response: ${midiResponse.statusText} - ${errorText}`);
            return;
          }
          const rawMidiText = await midiResponse.text(); // Get raw text first for logging
          console.log("[HPS LOG 5] Raw MIDI Response Text:", rawMidiText);
          fetchedMidiData = JSON.parse(rawMidiText); // Then parse
          console.log("[HPS LOG 6] Parsed MIDI Data:", JSON.stringify(fetchedMidiData));
          if (!fetchedMidiData || !Array.isArray(fetchedMidiData.tracks)) {
            console.error("[HPS Error] Fetched MIDI data is not in the expected format (missing tracks array). Data:", fetchedMidiData);
            alert("Error loading project's MIDI data: The data format is incorrect.");
            return;
          }
        } catch (e) {
          console.error("[HPS Error] Error fetching or parsing MIDI data from S3 URL:", midiDataUrl, e);
          alert("Error loading project's MIDI data. Check console and S3.");
          return;
        }
      } else {
        console.warn("[HPS LOG 7] No midiDataUrl provided. Using default empty MIDI data.");
        fetchedMidiData = { tracks: [{ notes: [] }] }; 
      }

      if (textAnnotationsUrl) {
        try {
          console.log("[HPS LOG 8] Fetching Annotations from:", textAnnotationsUrl);
          const annotationsResponse = await fetch(textAnnotationsUrl);
          console.log(`[HPS LOG 9] Annotations Response Status: ${annotationsResponse.status}, OK: ${annotationsResponse.ok}`);
          if (!annotationsResponse.ok) {
            const errorText = await annotationsResponse.text();
            console.error("[HPS Error] Failed to fetch Annotation data. Status:", annotationsResponse.status, "Text:", errorText);
            alert(`Warning: Failed to load text annotations. Server Response: ${annotationsResponse.statusText} - ${errorText}`);
            fetchedTextAnnotations = [];
          } else {
            const rawAnnotationsText = await annotationsResponse.text(); // Get raw text first
            console.log("[HPS LOG 10] Raw Annotations Response Text:", rawAnnotationsText);
            fetchedTextAnnotations = JSON.parse(rawAnnotationsText); // Then parse
            console.log("[HPS LOG 11] Parsed Annotations Data:", JSON.stringify(fetchedTextAnnotations));
            if (!Array.isArray(fetchedTextAnnotations)){
              console.error("[HPS Error] Fetched annotation data is not an array. Data:", fetchedTextAnnotations);
              alert("Warning: Text annotations for this project are in an incorrect format.");
              fetchedTextAnnotations = [];
            }
          }
        } catch (e) {
          console.error("[HPS Error] Error fetching or parsing text annotations from S3 URL:", textAnnotationsUrl, e);
          alert("Warning: Could not load text annotations.");
          fetchedTextAnnotations = [];
        }
      } else {
          console.warn("[HPS LOG 12] No textAnnotationsUrl provided. Using empty annotations.");
          fetchedTextAnnotations = [];
        }
      }
      
      if (midiDataUrl && fetchedMidiData === null) {
          console.error("[HPS Error] Critical error - midiDataUrl was present but fetchedMidiData is null. Aborting selection.");
          return;
      }

      const loadedBpm = projectMetadata.projectData?.bpm || 120;
      const loadedTimeSignature = projectMetadata.projectData?.timeSignature || { numerator: 4, denominator: 4 };

      setBpm(loadedBpm);
      setTimeSignature(loadedTimeSignature);
      Tone.Transport.bpm.value = loadedBpm * playbackSpeed;
      Tone.Transport.timeSignature = [loadedTimeSignature.numerator, loadedTimeSignature.denominator];

      const fullProjectForState = {
        ...projectMetadata, 
        midiData: fetchedMidiData || { tracks: [{ notes: [] }] },
        textAnnotations: fetchedTextAnnotations || [],
        backgroundImage: finalBackgroundImageForState, // Use the converted data URL or null
        // IMPORTANT: Persist the original URLs from projectListItem for potential future use if needed (e.g. re-fetch link)
        midiDataUrl: midiDataUrl,
        textAnnotationsUrl: textAnnotationsUrl,
        backgroundImageUrl: backgroundImageUrl, // Keep original S3 URL for reference
        thumbnailUrl: thumbnailUrl, 
      };
      console.log("[HPS LOG 13] fullProjectForState prepared with backgroundImage as dataURL/null.");

      setCurrentProject(fullProjectForState);
      console.log("[HPS LOG 14] setCurrentProject called with fullProjectForState. CurrentProject (after set attempt) might not be updated yet due to async nature of setState.");

      console.log("[HPS CRITICAL] About to set note data. fetchedMidiData:", JSON.stringify(fetchedMidiData));
      console.log("[HPS CRITICAL] fullProjectForState.midiData:", JSON.stringify(fullProjectForState.midiData));
      console.log("[HPS CRITICAL] fullProjectForState.midiData.tracks[0].notes.length:", fullProjectForState.midiData?.tracks?.[0]?.notes?.length || 0);

      setNoteData(fullProjectForState.midiData);    
      console.log("[HPS LOG 15] setNoteData called with:", JSON.stringify(fullProjectForState.midiData));
      
      setTextAnnotations(fullProjectForState.textAnnotations); 
      console.log("[HPS LOG 16] setTextAnnotations called with:", JSON.stringify(fullProjectForState.textAnnotations));
      
      setIsEditorView(true);
      const historyEntry = { ...fullProjectForState.midiData, textAnnotations: fullProjectForState.textAnnotations };
      setHistory([historyEntry]);
      console.log("[HPS LOG 17] Initial history set with:", JSON.stringify(historyEntry));
      setCurrentHistoryIndex(0);
      
      setBackgroundImage(finalBackgroundImageForState); // Set state with dataURL or null
      
      const savedColors = projectMetadata.appearance?.customColors || {
        leftHand: '#ef4444',
        rightHand: '#4287f5'
      };
      setCustomColors(savedColors);
      
      console.log('[HPS LOG 18] Project selected successfully. Background URL:', backgroundImageUrl, "Colors:", JSON.stringify(savedColors));

    } catch (error) {
      console.error('[HPS Error] Outer try-catch in handleProjectSelect:', error);
      alert('Error loading project. Please try again.');
    }
  };

  //==============MIDI FILE UPLOAD====================
  const handleMidiFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // ADDED: File size check for a better user experience before reading
    const MAX_FILE_SIZE_MB = 5;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please import a file smaller than ${MAX_FILE_SIZE_MB}MB.`);
      event.target.value = null; // Reset file input
      return;
    }
    
    setIsImportingMidi(true); // Set loading state to true

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const midi = new Midi(e.target.result);
        
        let allNotes = midi.tracks.flatMap(track => 
          track.notes.map(note => ({
            id: uuidv4(),
            midi: note.midi,
            time: note.time,
            duration: note.duration,
            name: `${note.name}${note.octave}`,
            velocity: 0.8,
            trackName: track.name,
            originalTrack: track.name,
            channel: track.channel,
            isLeftHand: track.name?.toLowerCase().includes('lh') || 
                       track.name?.toLowerCase().includes('left')
          }))
        );

        // ADDED: Check against the note limit after parsing
        if (allNotes.length > NOTE_LIMIT) {
          alert(`This MIDI file contains approximately ${allNotes.length.toLocaleString()} notes, which exceeds the project limit of ${NOTE_LIMIT.toLocaleString()}. Please import a smaller file.`);
          setIsImportingMidi(false);
          // Reset file input so user can select another file
          event.target.value = null;
          return;
        }

        // Deduplicate notes that have the same midi value and very similar time/duration
        const uniqueNotes = [];
        const timeThreshold = 0.01; // 10ms threshold for considering notes as duplicates
        
        allNotes.forEach(note => {
          // Check if this note is a duplicate of one we've already included
          const isDuplicate = uniqueNotes.some(existingNote => 
            existingNote.midi === note.midi && 
            Math.abs(existingNote.time - note.time) < timeThreshold &&
            Math.abs((existingNote.time + existingNote.duration) - (note.time + note.duration)) < timeThreshold
          );
          
          if (!isDuplicate) {
            uniqueNotes.push(note);
          }
        });

        // Sort notes by time
        uniqueNotes.sort((a, b) => a.time - b.time);

        const midiNoteData = {
          header: {
            name: file.name,
            ppq: midi.header.ppq,
            tempos: midi.header.tempos,
            timeSignatures: midi.header.timeSignatures,
          },
          tracks: [
            {
              notes: uniqueNotes.filter(note => note.midi >= 18 && note.midi <= 108),
              name: 'Combined Track'
            }
          ]
        };

        // Create new project from MIDI file
        const newProject = {
          id: uuidv4(),
          name: file.name.replace('.mid', '').replace('.midi', ''),
          dateCreated: new Date(),
          dateModified: new Date(),
          midiData: midiNoteData,
          backgroundImage: null,
          customColors: null
        };

        // Save project immediately after creation
        try {
          const saveResult = await saveProjectToStorage(newProject);
          if (!saveResult.success) {
            console.error('Error saving project:', saveResult.error);
            alert(`Error saving project: ${saveResult.error}`);
            return;
          }

          // After a successful save, reload the project list from the cloud.
          // This ensures we get the new project with its proper data loading URLs.
          await loadProjectsFromCloud();

          // Set the current project to the one returned from the save operation and switch to editor view
          setCurrentProject(saveResult.project);
          setNoteData(midiNoteData);
          setIsEditorView(true);
          setHistory([midiNoteData]);
          setCurrentHistoryIndex(0);
          setBackgroundImage(null);
          setCustomColors(null);
        } catch (error) {
          console.error('Error in saveProjectToStorage call:', error);
          alert('Error saving project. The MIDI file might be too large.');
          return;
        }

        handleRestart();
      } catch (error) {
        console.error('Error parsing MIDI file:', error);
        alert('Error loading MIDI file. Please try another file.');
      } finally {
        setIsImportingMidi(false); // Unset loading state
      }
    };

    reader.onerror = () => {
      console.error("FileReader failed to read the file.");
      alert("There was an error reading the file. Please try again.");
      setIsImportingMidi(false);
    };

    reader.readAsArrayBuffer(file);
  };

  //==============AUDIO TRANSCRIPTION====================
  // Helper function to get audio duration
  const getAudioDuration = (file) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const objectURL = URL.createObjectURL(file);
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(objectURL); // Clean up object URL
        resolve(audio.duration);
      });
      
      audio.addEventListener('error', (error) => {
        URL.revokeObjectURL(objectURL); // Clean up object URL
        reject(error);
      });
      
      audio.src = objectURL;
    });
  };

  const handleAudioFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // File size check
    const MAX_FILE_SIZE_MB = 50; // Audio files can be larger than MIDI
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please select a file smaller than ${MAX_FILE_SIZE_MB}MB.`);
      event.target.value = null;
      return;
    }

    // Audio duration check
    const MAX_DURATION_MINUTES = 12; // Maximum 8 minutes to ensure processing completes
    try {
      const duration = await getAudioDuration(file);
      const durationMinutes = duration / 60;
      
      if (durationMinutes > MAX_DURATION_MINUTES) {
        alert(`Audio file is too long (${durationMinutes.toFixed(1)} minutes). Please select a file shorter than ${MAX_DURATION_MINUTES} minutes to ensure successful transcription.`);
        event.target.value = null;
        return;
      }
    } catch (error) {
      console.warn('Could not determine audio duration, proceeding with upload:', error);
      // Continue with upload if duration check fails
    }

    setIsTranscribingAudio(true);

    try {
      // Create FormData to send the audio file
      const formData = new FormData();
      formData.append('audio', file);

      // Send to your deployed transcription service
      const apiBase = process.env.REACT_APP_API_BASE_URL || '';
      const response = await fetch(`${apiBase}/api/video-to-midi/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.code === 'QUOTA_EXCEEDED') {
            errorMsg = errorData.message || 'You have reached your monthly transcription limit.';
          } else if (errorData.error || errorData.message) {
            errorMsg = errorData.error || errorData.message;
          }
        } catch {}
        alert(errorMsg);
        return;
      }

      // Async job pattern: get jobId and poll for status
      const { jobId } = await response.json();
      if (!jobId) {
        alert('Failed to start transcription job.');
        return;
      }

      // Poll for job status
      let jobStatus = 'pending';
      let midiUrl = null;
      let pollError = null;
      const pollInterval = 3000; // 3 seconds
      const maxPolls = 120; // up to 6 minutes
      let pollCount = 0;
      while (jobStatus === 'pending' && pollCount < maxPolls) {
        await new Promise(res => setTimeout(res, pollInterval));
        pollCount++;
        try {
          const statusRes = await fetch(`${apiBase}/api/video-to-midi/status/${jobId}`, {
            credentials: 'include',
          });
          const statusData = await statusRes.json();
          if (statusData.status === 'done') {
            jobStatus = 'done';
            midiUrl = statusData.midiUrl;
          } else if (statusData.status === 'error') {
            jobStatus = 'error';
            pollError = statusData.error || 'Unknown error during transcription.';
          }
        } catch (e) {
          jobStatus = 'error';
          pollError = e.message || 'Network error while polling job status.';
        }
      }
      if (jobStatus === 'pending') {
        alert('Transcription timed out. Please try again later.');
        return;
      }
      if (jobStatus === 'error') {
        alert(`Transcription failed: ${pollError}`);
        return;
      }
      if (!midiUrl) {
        alert('Transcription completed but no MIDI result was returned.');
        return;
      }
      // Fetch the MIDI data from the data URL (in-memory demo)
      const midiResponse = await fetch(midiUrl);
      const arrayBuffer = await midiResponse.arrayBuffer();
      // Parse the MIDI data using the same logic as MIDI import
      const midi = new Midi(arrayBuffer);
      
      let allNotes = midi.tracks.flatMap(track => 
        track.notes.map(note => ({
          id: uuidv4(),
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          name: `${note.name}${note.octave}`,
          velocity: 0.8,
          trackName: track.name || 'Transcribed Audio',
          originalTrack: track.name || 'Transcribed Audio',
          channel: track.channel || 0,
          isLeftHand: false // Default to right hand for transcribed audio
        }))
      );

      // Check note limit
      if (allNotes.length > NOTE_LIMIT) {
        alert(`The transcribed audio contains approximately ${allNotes.length.toLocaleString()} notes, which exceeds the project limit of ${NOTE_LIMIT.toLocaleString()}.`);
        return;
      }

      // Deduplicate and sort notes (same as MIDI import)
      const uniqueNotes = [];
      const timeThreshold = 0.01;
      
      allNotes.forEach(note => {
        const isDuplicate = uniqueNotes.some(existingNote => 
          existingNote.midi === note.midi && 
          Math.abs(existingNote.time - note.time) < timeThreshold &&
          Math.abs((existingNote.time + existingNote.duration) - (note.time + note.duration)) < timeThreshold
        );
        
        if (!isDuplicate) {
          uniqueNotes.push(note);
        }
      });

      uniqueNotes.sort((a, b) => a.time - b.time);

      const midiNoteData = {
        header: {
          name: file.name,
          ppq: midi.header.ppq || 480,
          tempos: midi.header.tempos || [{ time: 0, bpm: 120 }],
          timeSignatures: midi.header.timeSignatures || [{ time: 0, timeSignature: [4, 4] }],
        },
        tracks: [
          {
            notes: uniqueNotes.filter(note => note.midi >= 18 && note.midi <= 108),
            name: 'Transcribed Audio'
          }
        ]
      };

      // Create new project from transcribed audio
      const newProject = {
        id: uuidv4(),
        name: file.name.replace(/\.(mp3|wav|m4a|flac|ogg)$/i, '') + ' (Transcribed)',
        dateCreated: new Date(),
        dateModified: new Date(),
        midiData: midiNoteData,
        backgroundImage: null,
        customColors: null
      };

      // Save and load project (same as MIDI import)
      const saveResult = await saveProjectToStorage(newProject);
      if (!saveResult.success) {
        console.error('Error saving transcribed project:', saveResult.error);
        alert(`Error saving transcribed project: ${saveResult.error}`);
        return;
      }

      await loadProjectsFromCloud();
      setCurrentProject(saveResult.project);
      setNoteData(midiNoteData);
      setIsEditorView(true);
      setHistory([midiNoteData]);
      setCurrentHistoryIndex(0);
      setBackgroundImage(null);
      setCustomColors(null);
      handleRestart();

      // Show success message
      alert(`🎵 Audio transcription completed! Found ${uniqueNotes.length} notes.`);

    } catch (error) {
      console.error('Error transcribing audio:', error);
      alert(`Error transcribing audio: ${error.message}`);
    } finally {
      setIsTranscribingAudio(false);
      event.target.value = null; // Reset file input
    }
  };

  //==============RESTART====================
  const handleRestart = () => {
    if (currentPart) {
      currentPart.dispose();
      setCurrentPart(null);
    }
    Tone.Transport.stop();
    Tone.Transport.seconds = 0;
    setIsPlaying(false);
    setCurrentPlaybackPosition(0);
    scrollPositionRef.current = 0;
    setTranspositionOffset(0);
    setCurrentTransposeTargetId('original');
  };

  const handleSave = () => {
    setShowSaveDialog(true);
    setSaveFileName(currentProject?.name ? `${currentProject.name}.mid` : 'my-piano-roll.mid');
  };

  const handleSaveConfirm = () => {
    // Create a new MIDI file
    const midi = new Midi();
    
    // Add a track with all notes
    const track = midi.addTrack();
    
    // Add notes to the track
    noteData.tracks[0].notes.forEach(note => {
      track.addNote({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity || 0.8
      });
    });

    // Convert to blob
    const bytes = midi.toArray();
    const blob = new Blob([bytes], { type: 'audio/midi' });
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    // Add .mid extension if not present
    const finalFilename = saveFileName.toLowerCase().endsWith('.mid') ? 
      saveFileName : `${saveFileName}.mid`;
    
    // Trigger download
    link.download = finalFilename;
    link.click();
    
    // Cleanup
    URL.revokeObjectURL(link.href);
    setShowSaveDialog(false);
  };

  // Add this helper function to convert Map objects to plain objects
  const convertMapToObject = (data) => {
    if (data === null || data === undefined) {
      return data;
    }

    if (data instanceof Map) {
      const obj = {};
      data.forEach((value, key) => {
        obj[key] = convertMapToObject(value);
      });
      return obj;
    }

    if (Array.isArray(data)) {
      return data.map(item => convertMapToObject(item));
    }

    if (typeof data === 'object') {
      const obj = {};
      Object.entries(data).forEach(([key, value]) => {
        obj[key] = convertMapToObject(value);
      });
      return obj;
    }

    return data;
  };

  // Modify handleBackToProjects
  const handleBackToProjects = async () => {
    console.log("[BackToProjects] Starting handleBackToProjects. isDirty:", isDirty);
    
    setIsReturningToProjects(true); // Show "Returning to Project List..." modal
    
    if (isDirty) {
      console.log("[BackToProjects] Project is dirty. Initiating save and exit process.");
      setIsSavingOnExit(true); // Show "Saving..." modal
      setCloudSaveError(null); // Clear previous errors
      // handleManualCloudSave calls saveProjectToStorage, which now correctly calls loadProjectsFromCloud on success.
      await handleManualCloudSave(); 
      setIsSavingOnExit(false); // Hide "Saving..." modal after operation completes
    } else {
      console.log("[BackToProjects] Project is not dirty. Triggering project list reload.");
      // Explicitly trigger a reload for the non-dirty case to ensure the list is always fresh.
      await loadProjectsFromCloud();
    }

    // Common navigation and state reset logic, executed whether saved or not
    setIsEditorView(false);       // Switch view
    setCurrentProject(null);      // Clear current project context
    
    // Reset editor-specific states to defaults or empty
    setNoteData({ tracks: [{ notes: [] }] }); 
    setTextAnnotations([]);
    setBackgroundImage(null);     // Assuming this should reset, or be handled by project load
    setCustomColors(null);        // Reset custom colors
    setBpm(120);                  // Reset BPM to default
    setTimeSignature({ numerator: 4, denominator: 4 }); // Reset time signature to default
    
    setHistory([]);               // Clear undo/redo history for the closed project
    setCurrentHistoryIndex(-1);
    
    // isDirty is already false if we skipped the save, 
    // or it was set to false by handleManualCloudSave if a save occurred.
    // setLastSavedState(null); // Clearing lastSavedState as we are exiting the project editor context.
                               // This ensures a fresh state comparison if the same project is reopened.
    if (!isDirty) { // If we didn't go through a save (which would set lastSavedState via successful saveProjectToStorage), clear it now.
      setLastSavedState(null);
    }
    setDirtyChanges([]);

    // Reset transposition state when going back to project list
    setTranspositionOffset(0);
    setCurrentTransposeTargetId('original');

    // Consider resetting other UI/tool states specific to the editor view if necessary
    // For example:
    // setIsTextToolActive(false);
    // setSelectedNotes(new Set());
    // setPlaybackPosition(0);
    // setIsLooping(false);
    
    setIsReturningToProjects(false); // Hide "Returning to Project List..." modal
  };

  //==============PROJECT NAME CHANGE====================
  const handleProjectNameChange = async (projectId, newName) => {
    try {
      console.log(`Attempting to change project name for ${projectId} to ${newName}. Firestore call removed.`);

      // Update projects list in state
      setProjects(prevProjects => 
        prevProjects.map(project => 
          project.id === projectId 
            ? { ...project, name: newName, dateModified: new Date() }
            : project
        )
      );
      
      // If this is the current project, update current project state
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => ({ 
          ...prev, 
          name: newName, 
          dateModified: new Date() 
        }));
      }
    } catch (error) {
      console.error('Error updating project name (local state change only):', error);
      // alert('Failed to update project name. Please try again.'); // Alerting might be too disruptive now
    }
  };

  //==============PROJECT DELETE====================
  const handleProjectDelete = async (projectId) => {
    if (!currentUser || !currentUser.id) {
      alert('You must be logged in to delete projects.');
      return;
    }

    // Optimistically update UI or wait for server confirmation
    // For now, let's wait for server confirmation before updating UI

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/projects/delete/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const responseData = await response.json();

      if (response.ok) {
        console.log(`Project ${projectId} deleted successfully from server.`); // Corrected "MongoDB" to "server"
        
        // Delete thumbnail from local storage in dev mode
        if (isDev && window.devThumbnailAPI && typeof window.devThumbnailAPI.deleteThumbnail === 'function') {
          await window.devThumbnailAPI.deleteThumbnail(projectId);
        }

        // Delete background image from local storage in dev mode
        if (isDev && typeof window.devBackgroundImageAPI?.deleteBackgroundImage === 'function') {
          await window.devBackgroundImageAPI.deleteBackgroundImage(projectId);
        }
        
        setProjects(projects.filter(project => project.id !== projectId));
        if (currentProject?.id === projectId) {
          setCurrentProject(null);
          setIsEditorView(false);
        }
      } else {
        console.error('Error deleting project from server:', responseData.message || response.statusText); // Corrected "MongoDB" to "server"
        alert(`Error deleting project: ${responseData.message || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Network or other error deleting project:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown network error occurred.';
      alert(`Error deleting project: ${errorMessage}`);
    }
  };

  //==============PROJECT DUPLICATE====================
  const handleProjectDuplicate = async (projectToDuplicate) => {
    try {
      console.log(`Attempting to duplicate project ${projectToDuplicate.id}. Firestore calls removed.`);

      // Load the full project data
      const fullProject = await loadProjectFromStorage(projectToDuplicate.id); // This will now return a placeholder
      if (!fullProject) {
        // throw new Error('Failed to load project data for duplication'); // May fail if loadProjectFromStorage returns null
        console.warn('Project duplication might not work as expected as loadProjectFromStorage is stubbed.');
      }

      // Create a new project with the same data but a new ID
      const newProject = {
        ...(fullProject || projectToDuplicate), // Use projectToDuplicate as fallback
        id: uuidv4(),
        name: `${(fullProject || projectToDuplicate).name} (Copy)`,
        dateCreated: new Date(),
        dateModified: new Date()
      };

      // If the source project's background was stored locally, copy it for the new project
      if (isDev && typeof (fullProject || projectToDuplicate).appearance?.background === 'string' && (fullProject || projectToDuplicate).appearance.background.startsWith('local_data_url:')) {
        const bgDataUrl = (fullProject || projectToDuplicate).appearance.background;
        if (bgDataUrl && typeof window.devBackgroundImageAPI?.saveBackgroundImage === 'function') {
          await window.devBackgroundImageAPI.saveBackgroundImage(newProject.id, bgDataUrl);
        }
      } 
      // Removed Electron-specific file copying logic
      // else if (window.electronAPI && typeof (fullProject || projectToDuplicate).appearance?.background === 'string' && !((fullProject || projectToDuplicate).appearance.background.startsWith('local_data_url:'))) {
      //   // Placeholder for production: if background is a file path, copy file and update path for newProject.id
      //   // const newBgPath = await window.electronAPI.copyFile((fullProject || projectToDuplicate).appearance.background, newProject.id, 'background');
      //   // newProject.appearance.background = newBgPath;
      // }


      // Save the new project (saveProjectToStorage will correctly handle storing the background)
      await saveProjectToStorage(newProject); // This will now call the stubbed version
      
      // Update projects list - REMOVED, saveProjectToStorage will call loadProjectsFromCloud
      // setProjects(prev => [...prev, newProject]);
      
    } catch (error) {
      console.error('Error duplicating project (local state change only):', error);
      // alert('Error duplicating project. Please try again.');
    }
  };

  //==============SAVE, LOAD, DELETE STORAGE====================
  // Modify saveProjectToStorage to use Firestore
  const saveProjectToStorage = async (projectToSave) => {
    console.log("[saveProjectToStorage] About to save project with noteData:", JSON.stringify(noteData));
    console.log("[saveProjectToStorage] Number of notes in noteData:", noteData?.tracks?.[0]?.notes?.length || 0);
    console.log("[saveProjectToStorage] projectToSave.midiData:", JSON.stringify(projectToSave.midiData));
    console.log("[saveProjectToStorage] Number of notes in projectToSave.midiData:", projectToSave.midiData?.tracks?.[0]?.notes?.length || 0);
    
    if (!projectToSave || !projectToSave.id) {
      console.error("[Client Save] No project data or project ID to save.");
      return { success: false, error: 'No project data or project ID to save.' };
    }

    let backgroundImageHasChanged = false;
    let thumbnailHasChanged = false;

    if (lastSavedState) {
      if (projectToSave.backgroundImage !== lastSavedState.backgroundImage) {
        backgroundImageHasChanged = true;
      }
      // Thumbnail is generated fresh during the save operation (e.g. in handleManualCloudSave).
      // So, if projectToSave.thumbnailDataUrl exists, it's new or regenerated.
      // We compare with a potential lastSavedState.thumbnailS3Key to see if a thumbnail existed before.
      // If a new thumbnailDataUrl is present, it's a change.
      // If thumbnailDataUrl is null, but an old thumbnailS3Key existed, it's also a change (deletion).
      if (projectToSave.thumbnailDataUrl) { // New thumbnail data exists
        thumbnailHasChanged = true;
      } else { // No new thumbnail data
        if (lastSavedState.thumbnailS3Key) { // But an old thumbnail existed
           // This case implies thumbnail should be deleted, but thumbnailPayload will be undefined.
           // Server needs to handle thumbnailPayload: undefined && thumbnailHasChanged: true (if we want to signal deletion this way)
           // For now, if thumbnailDataUrl is null, we send undefined, and if there was an old key, server should handle it if thumbnailHasChanged implies deletion.
           // Let's simplify: thumbnailHasChanged is true if there's new data, or if we intend to clear an existing one.
           // The current logic for thumbnailPayload on server handles `null` for deletion.
           // The client should send `null` if it intends to delete.
           // For now, this `thumbnailHasChanged` will primarily drive if new data is uploaded.
        }
      }
      // A more explicit check for thumbnail change:
      // If there's new thumbnail data, it has changed.
      // If there's no new thumbnail data, but there was an old S3 key, and the intent is to remove it, that's also a change.
      // However, projectToSave.thumbnailDataUrl is usually only populated if a new one is generated.
      // Let's stick to: if projectToSave.thumbnailDataUrl is populated, then thumbnailHasChanged = true.
      // If projectToSave.thumbnailDataUrl is null/undefined, it means no new thumbnail was part of *this save operation's data prep*.
      // The server handles deletion if thumbnailPayload is explicitly null.
      // We need a way for the client to explicitly signal "delete thumbnail".
      // Current structure: thumbnailPayload will be projectToSave.thumbnailDataUrl (data or null).
      // Let's define thumbnailHasChanged based on if new data is present.
      // The server will handle `thumbnailPayload: null` as a directive to delete.
      if (projectToSave.thumbnailDataUrl) {
        thumbnailHasChanged = true;
      }


    } else {
      // No lastSavedState, so any content is considered a "change" from a void state.
      if (projectToSave.backgroundImage) {
        backgroundImageHasChanged = true;
      }
      if (projectToSave.thumbnailDataUrl) {
        thumbnailHasChanged = true;
      }
    }

    console.log(`[Client Save] backgroundImageHasChanged: ${backgroundImageHasChanged}`);
    // console.log(`[Client Save] Current BG: ${projectToSave.backgroundImage ? 'Exists' : 'null'}, Last Saved BG: ${lastSavedState?.backgroundImage ? 'Exists' : 'null'}`);
    console.log(`[Client Save] thumbnailHasChanged (based on presence of new data): ${thumbnailHasChanged}`);


    // Construct the payload for the API
    const payload = {
      id: projectToSave.id,
      name: projectToSave.name || 'Untitled Project',
      
      bpm: projectToSave.bpm || bpm, 
      timeSignature: projectToSave.timeSignature || timeSignature, 
      customColors: projectToSave.customColors || customColors || { leftHand: '#ef4444', rightHand: '#4287f5' }, 
      dateCreated: (projectToSave.dateCreated instanceof Date ? projectToSave.dateCreated.toISOString() : new Date(projectToSave.dateCreated || Date.now()).toISOString()),

      midiDataPayload: convertMapToObject(projectToSave.midiData || projectToSave.projectData?.midiData || { tracks: [{ notes: [] }] }),
      textAnnotationsPayload: projectToSave.textAnnotations || projectToSave.projectData?.textAnnotations || [],
      
      // Send image data only if it has changed.
      // If backgroundImageHasChanged is false, backgroundImagePayload will be undefined.
      // The server will use backgroundImageHasChanged to decide whether to touch S3.
      backgroundImagePayload: backgroundImageHasChanged ? projectToSave.backgroundImage : undefined,
      backgroundImageHasChanged, // Send the flag

      // Thumbnail payload logic:
      // - If thumbnailDataUrl exists, it's new, send it. thumbnailHasChanged will be true.
      // - If thumbnailDataUrl is null/undefined, it means no new thumbnail was generated for *this* save operation.
      //   In this case, thumbnailPayload will be undefined. thumbnailHasChanged will be false.
      //   If the user *intended* to delete a thumbnail, they'd need to set projectToSave.thumbnailDataUrl to `null` explicitly
      //   AND we'd need a way to set thumbnailHasChanged to true for deletion.
      //   For now: `thumbnailHasChanged` means "new data to upload". Server handles actual `null` payload for deletion.
      thumbnailPayload: projectToSave.thumbnailDataUrl, // This will be dataURL or null/undefined
      thumbnailHasChanged: !!projectToSave.thumbnailDataUrl, // True if there's data, false otherwise
    };
    
    console.log("[Client Save] About to send payload to /api/projects/save. Full payload:", {
      ...payload,
      midiDataPayload: payload.midiDataPayload ? `Exists (Size: ${JSON.stringify(payload.midiDataPayload).length})` : "null",
      textAnnotationsPayload: payload.textAnnotationsPayload ? `Exists (Size: ${JSON.stringify(payload.textAnnotationsPayload).length})` : "null",
      backgroundImagePayload: payload.backgroundImagePayload ? `Exists (Type: ${typeof payload.backgroundImagePayload}, Length: ${payload.backgroundImagePayload.length})` : (backgroundImageHasChanged && payload.backgroundImagePayload === null ? "Exists (null for delete)" : "Not sent/No change"),
      thumbnailPayload: payload.thumbnailPayload ? `Exists (Type: ${typeof payload.thumbnailPayload}, Length: ${payload.thumbnailPayload.length})` : (!!projectToSave.thumbnailDataUrl && payload.thumbnailPayload === null ? "Exists (null for delete)" : "Not sent/No change")
    });

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/projects/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for sending the session cookie
        body: JSON.stringify(payload),
      });

      // const responseData = await response.json(); // Moved down

      if (response.ok) {
        const responseData = await response.json(); // Define and await here
        console.log('Project saved successfully. Server response:', responseData.project);
        
        const serverProjectItem = responseData.project;

        const updatedProjectForState = {
          ...projectToSave, // Start with the data the client intended to save
          
          // Override with confirmed data from the server
          id: serverProjectItem.projectId, // server returns projectId, client uses id
          userId: serverProjectItem.userId,
          name: serverProjectItem.name,
          dateCreated: new Date(serverProjectItem.dateCreated),
          dateModified: new Date(serverProjectItem.dateModified),
          
          projectData: { // This holds S3 keys and core metadata from server perspective
            // ...projectToSave.projectData, // Not strictly needed if server sends all projectData fields
            bpm: serverProjectItem.projectData.bpm,
            timeSignature: serverProjectItem.projectData.timeSignature,
            midiDataS3Key: serverProjectItem.projectData.midiDataS3Key,
            textAnnotationsS3Key: serverProjectItem.projectData.textAnnotationsS3Key,
          },
          appearance: {
            // ...projectToSave.appearance, // Not strictly needed if server sends all appearance fields
            customColors: serverProjectItem.appearance.customColors,
            backgroundImageS3Key: serverProjectItem.appearance.backgroundImageS3Key,
          },
          thumbnailS3Key: serverProjectItem.thumbnailS3Key,

          // Ensure the core data for the Roll component uses what the client has/sent,
          // as the server doesn't return these full payloads on save.
          midiData: projectToSave.midiDataPayload !== undefined ? projectToSave.midiDataPayload : projectToSave.midiData,
          textAnnotations: projectToSave.textAnnotationsPayload !== undefined ? projectToSave.textAnnotationsPayload : projectToSave.textAnnotations,
          
          // Keep client-side direct backgroundImage URL for display if it exists from projectToSave (e.g. data URL)
          // but also store the S3 key from server for future loads.
          backgroundImage: projectToSave.backgroundImage, // This might be a dataURL client was using
        };

        if (currentProject && currentProject.id === updatedProjectForState.id) {
          setCurrentProject(updatedProjectForState);
        }

        // After a successful save, reload the entire project list from the cloud.
        // This is more robust than trying to surgically update one project's URLs and ensures all data is fresh.
        await loadProjectsFromCloud();
        
        return { success: true, project: updatedProjectForState };
      } else {
        let errorMessage = `Failed to save project. Status: ${response.status}`;
        const responseForText = response.clone(); 

        try {
          if (response.status === 429) {
            const errorText = await response.text(); // Original response for text
            const resetTimestamp = response.headers.get('X-RateLimit-Reset');
            console.log('[Client Save 429] X-RateLimit-Reset header:', resetTimestamp); // Log the header
            let specificMessage = errorText || 'Too many save requests.';
            if (resetTimestamp) {
              const resetTime = new Date(resetTimestamp).getTime();
              const now = Date.now();
              const diffSeconds = Math.max(0, Math.ceil((resetTime - now) / 1000));
              if (diffSeconds > 0) {
                specificMessage += ` Please try again in ${diffSeconds} seconds.`;
              } else {
                specificMessage += ` Please try again now or in a few moments.`;
              }
            } else {
              specificMessage += ' Please try again shortly.'; // Fallback if no resetTimestamp
            }
            errorMessage = `Rate limit exceeded: ${specificMessage}`;
          } else {
            const responseData = await response.json(); 
            errorMessage = responseData?.message || errorMessage;
          }
        } catch (e) {
          // If JSON parsing fails (or it was a 429 already handled as text), try to read the cloned response as text
          try {
            const errorText = await responseForText.text(); // Use cloned response for text attempt
            // If it was a 429 and we are in this catch block, it means the initial text read for 429 failed,
            // which is unlikely if the first if (response.status === 429) block worked.
            // This path is more for non-429 errors that weren't valid JSON.
            errorMessage = errorText || errorMessage; 
          } catch (textError) {
            console.error('Failed to parse error response as JSON or text:', textError);
            // Stick with the status code if all parsing fails
          }
        }
        console.error('Error saving project:', errorMessage);
        setCloudSaveError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Network or other error saving project:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown network error occurred.';
      setCloudSaveError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Modify loadProjectFromStorage to use Firestore
  const loadProjectFromStorage = async (projectId) => {
    console.log(`loadProjectFromStorage called for ${projectId}. Firebase/Firestore logic removed. This is a placeholder.`);
    // try {
    //   if (!currentUser) {
    //     throw new Error('User not authenticated');
    //   }

    //   const projectRef = doc(db, 'users', currentUser.uid, 'projects', projectId);
    //   const projectDoc = await getDoc(projectRef);
      
    //   if (!projectDoc.exists()) {
    //     throw new Error('Project not found');
    //   }

    //   const projectData = projectDoc.data();
    //   let loadedBackgroundImage = projectData.appearance?.background || null;

    //   if (isDev && typeof loadedBackgroundImage === 'string' && loadedBackgroundImage.startsWith('local:') && typeof window.devBackgroundImageAPI?.loadBackgroundImage === 'function') {
    //     const storedProjectIdForBg = loadedBackgroundImage.split(':')[1];
    //     console.log('Dev: Loading background image from local storage for project:', storedProjectIdForBg);
    //     const localBgDataUrl = await window.devBackgroundImageAPI.loadBackgroundImage(storedProjectIdForBg);
    //     if (localBgDataUrl) {
    //       loadedBackgroundImage = localBgDataUrl; // Replace identifier with actual Data URL
    //       console.log('Dev: Background image loaded successfully from local storage.');
    //     } else {
    //       console.warn(`Dev: Background image for project ${storedProjectIdForBg} not found in local storage.`);
    //       loadedBackgroundImage = null;
    //     }
    //   } 
    //   // Removed Electron-specific file reading logic
    //   // else if (window.electronAPI && typeof loadedBackgroundImage === 'string' && typeof window.electronAPI.readFileAsDataUrl === 'function' && !loadedBackgroundImage.startsWith('local:')) {
    //   //   // Placeholder for production: if it's a file path, load it
    //   //   // loadedBackgroundImage = await window.electronAPI.readFileAsDataUrl(loadedBackgroundImage);
    //   // }


    //   return {
    //     ...projectData,
    //     dateCreated: projectData.dateCreated?.toDate() || new Date(),
    //     dateModified: projectData.dateModified?.toDate() || new Date(),
    //     // Ensure the appearance object contains the potentially loaded Data URL
    //     appearance: {
    //       ...projectData.appearance,
    //       background: loadedBackgroundImage
    //     }
    //   };
    // } catch (error) {
    //   console.error('Error loading project:', error);
    //   return null;
    // }
    // Placeholder: return a found project from local state if available, or null
    const project = projects.find(p => p.id === projectId);
    if (project) {
        console.log(`Placeholder load: Found project ${projectId} in local state.`);
        return JSON.parse(JSON.stringify(project)); // Return a copy
    }
    console.log(`Placeholder load: Project ${projectId} not found in local state.`);
    return null;
  };

  // Transposition Targets Definition
  const transpositionTargets = [
    { id: 'original', label: 'Original Key', shift: null },
    { id: 'C', label: 'C Maj / A min', shift: 0 },
    { id: 'Db', label: 'Db Maj / Bb min', shift: 1 },
    { id: 'D', label: 'D Maj / B min', shift: 2 },
    { id: 'Eb', label: 'Eb Maj / C min', shift: 3 },
    { id: 'E', label: 'E Maj / C# min', shift: 4 },
    { id: 'F', label: 'F Maj / D min', shift: 5 },
    { id: 'Gb', label: 'Gb Maj / Eb min', shift: 6 },
    { id: 'G', label: 'G Maj / E min', shift: 7 },
    { id: 'Ab', label: 'Ab Maj / F min', shift: 8 },
    { id: 'A', label: 'A Maj / F# min', shift: 9 },
    { id: 'Bb', label: 'Bb Maj / G min', shift: 10 },
    { id: 'B', label: 'B Maj / G# min', shift: 11 },
  ];

  // Helper to get note name from MIDI number
  const getNoteNameFromMidi = (midiNumber) => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1; // Standard octave numbering
    const noteName = notes[midiNumber % 12];
    return `${noteName}${octave}`;
  };
  
  // Core transposition function
  const transposeSingleMidiData = (inputMidiData, semitoneShift) => {
    if (!inputMidiData || !inputMidiData.tracks) {
      console.warn("Transpose: Invalid MIDI data provided", inputMidiData);
      return inputMidiData; 
    }
    // No shift needed if semitoneShift is 0
    if (semitoneShift === 0) {
      return inputMidiData;
    }


    const newMidiData = JSON.parse(JSON.stringify(inputMidiData)); // Deep copy

    newMidiData.tracks.forEach(track => {
      if (track.notes) {
        track.notes.forEach(note => {
          const newMidi = note.midi + semitoneShift;
          // Clamp to a standard 88-key piano range A0 (21) to C8 (108)
          note.midi = Math.max(21, Math.min(108, newMidi));
          note.name = getNoteNameFromMidi(note.midi); 
        });
      }
    });
    return newMidiData;
  };

  const handleTranspose = (targetId) => {
    const target = transpositionTargets.find(t => t.id === targetId);
    if (!target) {
      console.error("Invalid transposition target:", targetId);
      return;
    }

    const wasPlaying = isPlaying;
    let transportTimeBeforeTranspose = 0;

    if (wasPlaying) {
      transportTimeBeforeTranspose = Tone.Transport.seconds;
      Tone.Transport.stop();
    }

    // The target shift is absolute (from C). 'original' is our 0 point.
    const targetShift = (target.id === 'original' || target.shift === null) ? 0 : target.shift;

    // Calculate the relative shift to apply to the current notes on the roll
    const relativeShift = targetShift - transpositionOffset;

    // If there's no change in pitch, just update the UI state and exit.
    if (relativeShift === 0) {
      setCurrentTransposeTargetId(targetId); // Update dropdown display
      if (wasPlaying) {
        // Restart playback since we stopped it
        setupAndStartPlayback(transportTimeBeforeTranspose, true);
      }
      return;
    }

    // Transpose the *current* noteData using the calculated relative shift
    const newTransposedData = transposeSingleMidiData(noteData, relativeShift);

    // Update the main note data and add to history
    handleEditorUpdate(newTransposedData, true);

    // Update the transposition state trackers
    setTranspositionOffset(targetShift);
    setCurrentTransposeTargetId(targetId);

    if (wasPlaying) {
      setupAndStartPlayback(transportTimeBeforeTranspose, true);
    }
  };

  //==============SPEED CHANGE====================
  
  const handleSpeedChange = (newSpeed) => {
    // Store current playback position and state
    const wasPlaying = isPlaying;
    const currentTime = Tone.Transport.seconds * playbackSpeed; // Convert to musical time
    
    // Stop everything first
    if (currentPart) {
      currentPart.dispose();
      setCurrentPart(null);
    }
    Tone.Transport.stop();
    
    // Update the speed state
    setPlaybackSpeed(newSpeed);
    
    // Update Transport settings
    Tone.Transport.bpm.value = 120 * newSpeed;
    
    // Create new part with the updated speed
    const part = new Tone.Part((time, note) => {
      try {
        const noteName = Tone.Frequency(note.midi, "midi").toNote();
        if (note.midi >= 18 && note.midi <= 108) {
          synth.triggerAttackRelease(
            noteName,
            note.duration / newSpeed,
            time,
            note.velocity
          );
        }
      } catch (error) {
        console.warn(`Skipping note ${note.midi}: ${error.message}`);
      }
    }, []);

    // Add notes with adjusted timing
    noteData.tracks[0].notes.forEach(note => {
      part.add(note.time / newSpeed, note);
    });

    // Start the new part
    part.start(0);
    setCurrentPart(part);
    
    // If it was playing before, resume from the current position
    if (wasPlaying) {
      // Set the position in the new speed context
      Tone.Transport.seconds = currentTime / newSpeed;
      
      // Then start playback after a brief delay to ensure everything is set up
      setTimeout(() => {
        Tone.Transport.start();
        setIsPlaying(true);
      }, 50);
    } else {
      // If it wasn't playing, just update the position
      Tone.Transport.seconds = currentTime / newSpeed;
    }
  };

  // Add effect to calculate song duration when noteData changes
  useEffect(() => {
    if (noteData && noteData.tracks && noteData.tracks[0] && noteData.tracks[0].notes.length > 0) {
      const duration = noteData.tracks[0].notes.reduce(
        (max, note) => Math.max(max, note.time + note.duration),
        0
      ); // REMOVED: + 1; // Add 1 second buffer for UI display and slider max
      setSongDuration(duration);
    } else {
      setSongDuration(0); // Default or no notes
    }
  }, [noteData]);

  // Simplified useEffect for updating playback position visually
  useEffect(() => {
    let animationFrame;
    const updatePosition = () => {
      if (isPlaying) { // only update if playing
        setCurrentPlaybackPosition(Tone.Transport.seconds * playbackSpeed);
        animationFrame = requestAnimationFrame(updatePosition);
      } else {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame); // Clear if not playing
        }
      }
    };

    if (isPlaying) {
      animationFrame = requestAnimationFrame(updatePosition);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, playbackSpeed]); // Removed songDuration from dependencies here

  // Add effect to update project when background or colors change
  useEffect(() => {
    if (currentProject) {
      const updatedProject = {
        ...currentProject,
        backgroundImage, // This is the dataURL or null
        appearance: { // Ensure appearance object exists
          ...currentProject.appearance,
          customColors: customColors || currentProject.appearance?.customColors,
          // backgroundImageS3Key is managed by saveProjectToStorage response
        },
        projectData: { // Ensure projectData object exists
            ...currentProject.projectData,
            timeSignature: timeSignature || currentProject.projectData?.timeSignature,
            bpm: bpm || currentProject.projectData?.bpm, // Also include BPM if it's part of this logic
        },
        dateModified: new Date()
      };
      
      setCurrentProject(updatedProject); // Update current project in memory
      
      // Update the project in the main projects list as well
      setProjects(prevProjects => 
        prevProjects.map(project => 
          project.id === currentProject.id ? updatedProject : project
        )
      );
      
      // console.log('[App.js useEffect] Project updated in state for BG/color/TS change, auto-save REMOVED.');
      // saveProjectToStorage(updatedProject).catch(error => {
      //   console.error('Error saving project with background:', error);
      // });
    }
  }, [currentProject?.id, backgroundImage, customColors, timeSignature, bpm]); // Added bpm and currentProject.id for safety

  // Add console log to track background image changes
  useEffect(() => {
    console.log('Background image updated:', backgroundImage ? 'Set' : 'Not set');
    console.log('Current project:', currentProject?.id);
  }, [backgroundImage]);

  // Add effect to sync background image with current project
  useEffect(() => {
    const s3Key = currentProject?.appearance?.backgroundImageS3Key;
    if (!s3Key) { // If there's no S3 key (either no current project, or project has no key)
      if (backgroundImage !== null) { // And the current UI state is not already null
        // console.log(`App.js effect[currentProjectS3Key]: S3 key is ${s3Key}. Clearing backgroundImage state.`);
        setBackgroundImage(null);
      }
    }
    // If an s3Key *does* exist, this effect does NOT modify `backgroundImage`.
    // `backgroundImage` (the display URL/data) is set by:
    // 1. handleProjectSelect (from projectListItem.backgroundImageUrl)
    // 2. handleBackgroundImageChange (from user uploading a new file -> data URL)
    // This effect primarily ensures cleanup if the S3 key is removed or the project is cleared.
  }, [currentProject?.id, currentProject?.appearance?.backgroundImageS3Key]); // Monitor the true S3 key

  // Add handler for background image changes
  const handleBackgroundImageChange = (newBackgroundImage) => {
    setBackgroundImage(newBackgroundImage);
    
    // If we have a current project, update it immediately
    if (currentProject) {
      const updatedProject = {
        ...currentProject,
        backgroundImage: newBackgroundImage,
        dateModified: new Date()
      };
      
      setCurrentProject(updatedProject);
      
      // Update projects list
      setProjects(prevProjects => 
        prevProjects.map(project => 
          project.id === currentProject.id ? updatedProject : project
        )
      );
      
      // Save to storage immediately - COMMENTING THIS OUT
      // saveProjectToStorage(updatedProject).catch(error => {
      //   console.error('Error saving project with new background:', error);
      // });
    }
  };

  // Add handler for custom colors changes
  const handleCustomColorsChange = (newColors) => {
    setCustomColors(newColors);
    
    // If we have a current project, update it immediately
    if (currentProject) {
      const updatedProject = {
        ...currentProject,
        appearance: {
          ...currentProject.appearance,
          customColors: newColors
        },
        dateModified: new Date()
      };
      
      setCurrentProject(updatedProject);
      
      // Update projects list
      setProjects(prevProjects => 
        prevProjects.map(project => 
          project.id === currentProject.id ? updatedProject : project
        )
      );
      
      // Save to storage immediately - COMMENTING THIS OUT
      // saveProjectToStorage(updatedProject).catch(error => {
      //   console.error('Error saving project with new colors:', error);
      // });
    }
  };

  // Add handler for time signature changes
  const handleTimeSignatureChange = (newTimeSignature) => {
    setTimeSignature(newTimeSignature);

    // Optionally update Tone.js settings if needed
    Tone.Transport.timeSignature = [newTimeSignature.numerator, newTimeSignature.denominator];

    // Update the noteData with the new timeSignature
    const updatedNoteData = {
      ...noteData,
      timeSignature: newTimeSignature
    };
    
    handleEditorUpdate(updatedNoteData, true);
  };

  // Add a BPM change handler
  const handleBpmChange = (newBpm) => {
    setBpm(newBpm);
    if (isPlaying) {
      // If playing, update the Transport BPM immediately
      Tone.Transport.bpm.value = newBpm * playbackSpeed;
    }
    
    // Update the noteData with the new BPM
    const updatedNoteData = {
      ...noteData,
      bpm: newBpm,
      _source: 'handleBpmChange'  // Add a source flag to prevent recursion
    };
    
    handleEditorUpdate(updatedNoteData, true);
  };

  // Add menu event listeners
  useEffect(() => {
    // Entire block for window.electronAPI.onMenuAction is removed
    // If menu actions are still needed, they must be triggered by UI elements in the app.
    // For example, a "New Project" button in the UI would directly call handleNewProject().
    // A "File -> Import MIDI" in a custom web-based menu bar would trigger the file input.
  }, [currentProject, isEditorView, isPlaying, currentPart]); // Dependencies might need adjustment if actions are moved

  // Function to toggle theme
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  const dismissCloudSaveError = () => {
    setCloudSaveError(null);
  };

  // Add volume change handler
  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (synth) {
      synth.volume.value = Tone.gainToDb(newVolume);
    }
  };

  //==============SELECTION & CLIPBOARD LOGIC (Lifted from Roll)====================

  // Helper to get a new color
  const getNextGroupColor = () => {
    const colors = [
      '#FFFFFF', '#00BFFF', '#FFFF44', '#FF4444', 
      '#44FF44', '#FFA500', '#A020F0', '#FF6F91'
    ];
    const existingGroupCount = groupColors.size;
    return colors[existingGroupCount % colors.length];
  };

  const handleCopy = () => {
    if (!noteData || noteGroups.size === 0) return;

    const groupedNotes = noteData.tracks.flatMap(track =>
      track.notes.filter(note => noteGroups.has(note.id))
    );

    if (groupedNotes.length === 0) return;

    const minTime = Math.min(...groupedNotes.map(note => note.time));
    const originalMaxEndTime = Math.max(...groupedNotes.map(note => note.time + note.duration)); // Calculate max end time

    const relativeNotes = groupedNotes.map(note => ({
      ...note,
      time: note.time - minTime,
      originalGroupId: noteGroups.get(note.id)
    }));

    setClipboardNotes({ notes: relativeNotes, originalMaxEndTime }); // Store notes and originalMaxEndTime
    console.log("Notes copied to clipboard:", relativeNotes, "Original Max End Time:", originalMaxEndTime);
  };

  const handlePaste = () => {
    if (!clipboardNotes || clipboardNotes.notes.length === 0 || !noteData) return; // Adjusted condition

    // ADDED: Check against note limit
    const currentNoteCount = noteData?.tracks?.[0]?.notes?.length || 0;
    if (currentNoteCount + clipboardNotes.notes.length > NOTE_LIMIT) {
      alert(`Pasting these notes would exceed the project note limit of ${NOTE_LIMIT.toLocaleString()}.`);
      return;
    }

    const newGroupId = uuidv4();
    const newColor = getNextGroupColor();

    // Use the stored originalMaxEndTime from clipboardNotes for paste position
    const pasteStartTime = clipboardNotes.originalMaxEndTime; 

    const newNotes = clipboardNotes.notes.map(note => ({ // Adjusted access to notes
      ...note,
      id: uuidv4(),
      time: note.time + pasteStartTime 
    }));

    const currentData = JSON.parse(JSON.stringify(noteData));
    const newTracks = [...(currentData.tracks || [])];
    if (newTracks.length === 0) newTracks.push({ notes: [] });

    newTracks[0].notes = [...newTracks[0].notes, ...newNotes].sort((a, b) => a.time - b.time);

    const updatedGroups = new Map();
    newNotes.forEach(note => updatedGroups.set(note.id, newGroupId));

    const updatedColors = new Map(groupColors);
    updatedColors.set(newGroupId, newColor);

    const dataToUpdate = {
      ...currentData,
      tracks: newTracks,
      noteGroups: updatedGroups, // Set selection to only the pasted notes
      groupColors: updatedColors
    };

    handleEditorUpdate(dataToUpdate, true); // Add to history

    // Explicitly update local state for immediate UI consistency
    setNoteGroups(updatedGroups);
    setGroupColors(updatedColors);

    // Calculate the maximum end time of the notes just pasted
    const maxEndTimeOfCurrentPaste = Math.max(...newNotes.map(note => note.time + note.duration));

    // Update clipboardNotes to allow for sequential pasting
    setClipboardNotes(prevClipboard => ({
      ...prevClipboard, // Keep the original relative notes
      originalMaxEndTime: maxEndTimeOfCurrentPaste // Update the end time for the next paste
    }));

    console.log("Notes pasted starting at:", pasteStartTime, "New max end time for next paste:", maxEndTimeOfCurrentPaste);
  };

  const handleDelete = () => {
    if (!noteData || noteGroups.size === 0) return;

    const groupedNoteIds = new Set(Array.from(noteGroups.keys()));

    const currentData = JSON.parse(JSON.stringify(noteData));
    const newTracks = currentData.tracks.map(track => ({
      ...track,
      notes: track.notes.filter(note => !groupedNoteIds.has(note.id))
    }));

    const dataToUpdate = {
      ...currentData,
      tracks: newTracks,
      noteGroups: new Map(), // Clear groups after deletion
      groupColors: new Map()  // Clear colors
    };

    handleEditorUpdate(dataToUpdate, true); // Add to history

    // Explicitly update local state
    setNoteGroups(new Map());
    setGroupColors(new Map());

    console.log("Selected notes deleted");
  };

  //==============RENDER SECTION====================

  const hasSelection = noteGroups.size > 0;
  const canUndo = currentHistoryIndex > 0;
  const canRedo = currentHistoryIndex < history.length - 1;

  // Add handler for total bars change before the return statement
  const handleTotalBarsChange = useCallback((newTotalBars) => {
    setTotalBars(newTotalBars);
  }, []);

  // ADDED: Handler for manual cloud save button
  const handleManualCloudSave = async () => {
    if (!currentProject || !isDirty) return;
    if (isManuallySaving) return;

    setIsManuallySaving(true);
    setCloudSaveError(null);
    setShowSaveSuccessPopup(false);

    const currentState = {
      midiData: noteData,
      textAnnotations,
      backgroundImage, 
      customColors,
      timeSignature,
      bpm,
      name: currentProject.name
    };

    const projectToSave = {
      ...currentProject,
      midiData: convertMapToObject(noteData),
      bpm,
      timeSignature,
      textAnnotations,
      backgroundImage: backgroundImage, // FIX: Use the backgroundImage from state directly
      customColors,
      dateModified: new Date(),
      dateCreated: currentProject.dateCreated || new Date(),
    };
    console.log('[SaveThumbnailDebug] currentProject at start of save:', JSON.stringify(currentProject, null, 2));
    console.log('[SaveThumbnailDebug] projectToSave.backgroundImage that will be processed:', projectToSave.backgroundImage ? projectToSave.backgroundImage.substring(0, 100) + "..." : "null");

    try {
      const rollElement = document.getElementById('piano-roll-container');
      if (rollElement) {
        const bgContainer = rollElement.querySelector('.background-image-container');
        const originalBgContainerStyleOpacity = bgContainer ? bgContainer.style.opacity : '';
        const originalBgContainerStyleImage = bgContainer ? bgContainer.style.backgroundImage : ''; // Save original image style

        try {
          let bgToUseForCanvas = projectToSave.backgroundImage; // This is the URL (S3 or other) or a dataURL
          console.log('[SaveThumbnailDebug] Initial bgToUseForCanvas:', bgToUseForCanvas ? bgToUseForCanvas.substring(0,100) + '...' : 'null');

          if (bgToUseForCanvas && typeof bgToUseForCanvas === 'string' && bgToUseForCanvas.startsWith('http')) {
            console.log('[SaveThumbnailDebug] Background is HTTP URL, calling imageToDataURL to convert it.');
            const convertedDataUrl = await imageToDataURL(bgToUseForCanvas);
            if (convertedDataUrl) {
              bgToUseForCanvas = convertedDataUrl; // Use the successfully converted data URL
              console.log('[SaveThumbnailDebug] imageToDataURL successful. bgToUseForCanvas is now a dataURL.');
            } else {
              console.warn('[SaveThumbnailDebug] imageToDataURL returned null. Setting bgToUseForCanvas to null to avoid using stale S3 URL.');
              bgToUseForCanvas = null; // Explicitly set to null if conversion failed
            }
          } else if (bgToUseForCanvas) {
            console.log('[SaveThumbnailDebug] Background is already a data URL or not an HTTP link.');
          } else {
            console.log('[SaveThumbnailDebug] No background image specified (bgToUseForCanvas is null/undefined).');
          }

          // Apply the (now definitely data URL or null) bgToUseForCanvas to the DOM element's style
          if (bgContainer) {
            if (bgToUseForCanvas) {
              console.log('[SaveThumbnailDebug] Applying style to bgContainer.style.backgroundImage with:', bgToUseForCanvas.substring(0,100) + '...');
              bgContainer.style.backgroundImage = `url("${bgToUseForCanvas}")`;
            } else {
              // If no image, ensure it's cleared for capture
              console.log('[SaveThumbnailDebug] No bgToUseForCanvas; clearing bgContainer.style.backgroundImage.');
              bgContainer.style.backgroundImage = 'none';
            }
            // bgContainer.style.opacity = '1'; // Ensure opacity for capture
            // Short delay for the browser to apply the style change before canvas capture
            await new Promise(resolve => setTimeout(resolve, 250)); 
          } else {
            console.warn('[SaveThumbnailDebug] .background-image-container not found.');
          }
          
          console.log('[Thumbnail] Attempting html2canvas capture...');
          const canvas = await html2canvas(rollElement, {
            logging: true,
            useCORS: true, 
            scale: 0.5,
            backgroundColor: null, 
            ignoreElements: (element) => {
              return element.classList.contains('toolbar') ||
                     element.classList.contains('grid-container') ||
                     element.classList.contains('playback-controls-container') ||
                     element.classList.contains('zoom-controls');
            }
          });

          const thumbnailDataUrl = canvas.toDataURL('image/webp', 0.8);
          console.log(`[Thumbnail] Captured thumbnail. Size: ${(thumbnailDataUrl.length * 0.75 / 1024).toFixed(2)} KB`);
          projectToSave.thumbnailDataUrl = thumbnailDataUrl;

        } catch (error) {
          console.error('[Thumbnail] Error during thumbnail capture process (html2canvas or pre-processing):', error);
          projectToSave.thumbnailDataUrl = null; 
        } finally {
          // Restore original styles
          if (bgContainer) {
            console.log('[Thumbnail] Restoring original styles to .background-image-container.');
            bgContainer.style.opacity = originalBgContainerStyleOpacity;
            bgContainer.style.backgroundImage = originalBgContainerStyleImage; // Restore original image
          }
        }
      } else {
        console.warn('[Thumbnail] piano-roll-container (rollElement) not found for thumbnail capture.');
        projectToSave.thumbnailDataUrl = null;
      }

      const saveResult = await saveProjectToStorage(projectToSave);

      if (saveResult.success) {
        setShowSaveSuccessPopup(true);
        if (saveResult.project) {
          setCurrentProject(prev => ({...prev, ...saveResult.project, _id: saveResult.project.id || saveResult.project._id }));
        }
        setLastSavedState(currentState);
        setLastSaveTime(new Date());
        setIsDirty(false);
        setDirtyChanges([]);
      }
    } catch (error) {
      console.error('Error during manual cloud save process:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setCloudSaveError(errorMessage);
    } finally {
      setIsManuallySaving(false);
    }
  };

  // ADDED: Callback to clear the save success popup state
  const clearSaveSuccessPopup = useCallback(() => {
    setShowSaveSuccessPopup(false);
  }, []);

  // ADDED: Function to load projects from the cloud
  const loadProjectsFromCloud = useCallback(async () => {
    if (!currentUser || !currentUser.id) {
      console.log("No user, skipping cloud project load.");
      setProjects([]); 
      return;
    }
    console.log("Attempting to load projects from cloud...");
    setIsLoadingProjects(true);
    setLoadProjectsError(null);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/projects/load`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        console.log("Projects loaded successfully from cloud with URLs:", data.projects);
        
        const projectsWithDatesAndStructure = data.projects.map(p => ({
          ...p, 
          id: p.projectId, 
          dateCreated: p.dateCreated ? new Date(p.dateCreated) : new Date(),
          dateModified: p.dateModified ? new Date(p.dateModified) : new Date(),
        }));
        setProjects(projectsWithDatesAndStructure);
      } else {
        console.error('Error loading projects from cloud:', data.message || response.statusText);
        setLoadProjectsError(data.message || `Failed to load projects. Status: ${response.status}`);
        setProjects([]);
      }
    } catch (error) {
      console.error('Network or other error loading projects from cloud:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown network error occurred.';
      setLoadProjectsError(errorMessage);
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [currentUser]); // currentUser is a dependency here

  useEffect(() => {
    const checkPaymentSuccessAndLoad = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('session_id')) { // Stripe adds session_id for success
        console.log('[App.js] Detected return from Stripe payment. Forcing session refresh.');
        try {
          await forceSessionRefresh(); // Call the new refresh function
          // Optional: remove the query params from URL to prevent re-triggering on manual page refresh
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('[App.js] Session refresh attempted. Will now load projects.');
        } catch (e) {
          console.error('[App.js] Error during forced session refresh:', e);
        }
        // Add a small delay to allow NextAuth.js session to potentially update fully on server & client
        // before trying to load projects which depend on the `hasPaid` status.
        setTimeout(() => {
          loadProjectsFromCloud();
        }, 1500); // Delay of 1.5 seconds, adjust as needed
      } else {
        loadProjectsFromCloud(); // Load normally if not returning from payment
      }
    };
    checkPaymentSuccessAndLoad();
  }, [loadProjectsFromCloud, forceSessionRefresh]); // ADDED forceSessionRefresh to dependencies

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const pianoContainerRef = useRef(null);

  // ADDED: Effect to check for changes whenever relevant state changes
  useEffect(() => {
    if (!currentProject) {
      setIsDirty(false);
      setDirtyChanges([]);
      return;
    }

    const currentState = {
      midiData: noteData,
      textAnnotations,
      backgroundImage,
      customColors,
      timeSignature,
      bpm,
      name: currentProject.name
    };

    if (!lastSavedState) {
      setLastSavedState(currentState);
      return;
    }

    const changes = getChangeSummary(currentState, lastSavedState);
    if (changes.length > 0) {
      setIsDirty(true);
      setDirtyChanges(changes);
    } else {
      setIsDirty(false);
      setDirtyChanges([]);
    }
  }, [
    currentProject,
    noteData,
    textAnnotations,
    backgroundImage,
    customColors,
    timeSignature,
    bpm,
    lastSavedState
  ]);

  // ADDED: Function to toggle piano roll fullscreen
  const togglePianoFullscreen = () => {
    // Check if we're on mobile - if so, don't allow fullscreen toggle
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                          (window.innerWidth <= 768 && 'ontouchstart' in window);
    
    if (isMobileDevice) {
      // On mobile, piano should always be "fullscreen" - don't toggle
      setIsPianoFullscreen(true);
      return;
    }
    
    setIsPianoFullscreen(prev => !prev);
  };

  // Video Export Functions
  const handleVideoExport = async (preset = 'minimal') => {
    if (!noteData || isRecording) return;
    
    try {
      setIsRecording(true);
      setIsRecordingMode(true);
      setRecordingPreset(preset);
      setRecordingProgress(0);
      
      // Reset playback to beginning and ensure clean state
      handleRestart();
      
      // Wait for components to update and render
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the piano roll container
      const rollElement = document.getElementById('piano-roll-container');
      if (!rollElement) {
        throw new Error('Piano roll container not found');
      }
      
      // Check browser support for MediaRecorder
      if (!window.MediaRecorder) {
        alert('Video recording is not supported in this browser. Please try Chrome or Firefox.');
        return;
      }

      // Simple but effective approach: Use getDisplayMedia with optimized settings
      let stream;
      let mediaRecorder;
      
      try {
        console.log('Requesting screen capture permission...');
        // Request screen/tab capture with optimized settings
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            mediaSource: 'screen',
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 60 } // Lower ideal framerate for performance
          },
          audio: false
        });
        
        console.log('Screen capture permission granted, stream obtained:', stream.getVideoTracks()[0].getSettings());
        
        // Use a more compatible codec for better performance
        let mimeType = 'video/webm;codecs=vp8'; // vp8 is more performant than vp9
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          console.log(`${mimeType} not supported, falling back to video/webm`);
          mimeType = 'video/webm';
        }
        
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: 2500000 // 2.5 Mbps - lower bitrate for better performance
        });
        
        console.log('MediaRecorder initialized with settings:', {
          mimeType: mediaRecorder.mimeType,
          state: mediaRecorder.state,
          videoBitsPerSecond: mediaRecorder.videoBitsPerSecond
        });
        
        console.log('Using screen capture - select your browser tab for best results');
        
      } catch (error) {
        // Show detailed error information
        console.error('Screen capture error:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        let errorMessage = 'Screen recording requires permission. ';
        if (error.name === 'NotAllowedError') {
          errorMessage += 'You denied permission to record your screen.';
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'No screen sharing source was found.';
        } else if (error.name === 'NotReadableError') {
          errorMessage += 'Your screen could not be captured. Try closing other applications that might be using your camera or screen recording.';
        } else {
          errorMessage += `An error occurred: ${error.message}`;
        }
        
        alert(errorMessage);
        setIsRecording(false);
        setIsRecordingMode(false);
        setRecordingProgress(0);
        return;
      }
      
      const chunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject?.name || 'composition'}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        // Stop all tracks to free up resources
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        setIsRecording(false);
        setIsRecordingMode(false);
        setRecordingProgress(0);
        
        console.log('Video export completed!');
      };
      
      // Calculate song duration for progress tracking
      const songDurationMs = (songDuration || 10) * 1000;
      
      // Start recording
      mediaRecorder.start();
      
      // Start playback
      handlePlayPauseToggle();
      
      // Progress tracking
      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / songDurationMs) * 100, 100);
        setRecordingProgress(progress);
        
        // Stop when finished
        if (elapsed >= songDurationMs + 1000) {
          clearInterval(progressInterval);
          mediaRecorder.stop();
          if (isPlaying) {
            handlePlayPauseToggle(); // Stop playback
          }
          setRecordingProgress(100);
        }
      }, 100);
      
    } catch (error) {
      console.error('Video export failed:', error);
      alert('Video export failed: ' + error.message);
      setIsRecording(false);
      setIsRecordingMode(false);
      setRecordingProgress(0);
    }
  };

  const handleCancelRecording = () => {
    setIsRecording(false);
    setIsRecordingMode(false);
    setRecordingProgress(0);
    if (isPlaying) {
      handlePlayPauseToggle(); // Stop playback
    }
  };

  // Helper function to calculate average MIDI value from noteData object
  const calculateAverageMidi = (midiDataObject) => {
    if (!midiDataObject || !midiDataObject.tracks || midiDataObject.tracks.length === 0 || midiDataObject.tracks[0].notes.length === 0) {
      return null; // Or a default MIDI value like 60 (C4) if that makes more sense
    }
    const notes = midiDataObject.tracks[0].notes;
    const sumOfMidiValues = notes.reduce((sum, note) => sum + note.midi, 0);
    return sumOfMidiValues / notes.length;
  };

  // Add effect to handle double-tap for fullscreen on mobile
  useEffect(() => {
    let lastTapTime = 0;
    let tapCount = 0;
    
    const handleDoubleTap = (e) => {
      // Only on mobile devices
      if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        return;
      }
      
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTapTime;
      
      if (tapLength < 500 && tapLength > 0) {
        tapCount++;
        if (tapCount === 2) {
          // Double tap detected - toggle fullscreen
          e.preventDefault();
          
          if (!document.fullscreenElement &&
              !document.webkitFullscreenElement &&
              !document.mozFullScreenElement &&
              !document.msFullscreenElement) {
            // Enter fullscreen
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
              elem.requestFullscreen();
            } else if (elem.mozRequestFullScreen) {
              elem.mozRequestFullScreen();
            } else if (elem.webkitRequestFullscreen) {
              elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
              elem.msRequestFullscreen();
            }
          } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
              document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
              document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
              document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
              document.msExitFullscreen();
            }
          }
          
          tapCount = 0;
        }
      } else {
        tapCount = 1;
      }
      
      lastTapTime = currentTime;
    };
    
    document.addEventListener('touchend', handleDoubleTap);
    
    return () => {
      document.removeEventListener('touchend', handleDoubleTap);
    };
  }, []);

  return (
    <div className={`App ${theme}-mode`}>
      {isSavingOnExit && ( 
        <div className="modal-overlay" style={{ zIndex: 2000 }}> {/* Ensure it's on top */}
          <div className="modal" style={{ textAlign: 'center' }}>
            <h3>Saving Project...</h3>
            <div className="spinner"></div> {/* Add spinner element here */}
          </div>
        </div>
      )}
      {isReturningToProjects && ( 
        <div className="modal-overlay" style={{ zIndex: 2000 }}> {/* Ensure it's on top */}
          <div className="modal" style={{ textAlign: 'center' }}>
            <h3>Returning to Project List...</h3>
            <div className="spinner"></div> {/* Add spinner element here */}
          </div>
        </div>
      )}
      {isManuallySaving && ( 
        <div className="modal-overlay" style={{ zIndex: 2000 }}> {/* Ensure it's on top */}
          <div className="modal" style={{ textAlign: 'center' }}>
            <h3>Saving Project...</h3>
            <div className="spinner"></div> {/* Add spinner element here */}
          </div>
        </div>
      )}
      {cloudSaveError && (
        <div className="modal-overlay" style={{ zIndex: 2001 }}>
          <div className="modal" style={{ backgroundColor: '#ffdddd', border: '1px solid red', padding: '20px', borderRadius: '5px', textAlign: 'center' }}>
            <h4>Cloud Save Failed</h4>
            <p style={{ color: 'black', wordBreak: 'break-word' }}>{cloudSaveError}</p>
            <button onClick={dismissCloudSaveError} style={{ marginTop: '10px', padding: '8px 15px' }}>Close</button>
          </div>
        </div>
      )}
      {!currentUser ? (
        <Login />
      ) : !isEditorView || !hasPaid ? ( // MODIFIED: Add !hasPaid check here for the main view switch
        <ProjectList
          projects={projects}
          onNewProject={handleNewProject} // This will now have the payment check inside
          onProjectSelect={handleProjectSelect} // This will now have the payment check inside
          onMidiFileUpload={handleMidiFileUpload} // Consider if MIDI upload should also be restricted
          onAudioFileUpload={handleAudioFileUpload} // ADDED: Audio transcription handler
          onProjectNameChange={handleProjectNameChange}
          onProjectDelete={handleProjectDelete}
          onProjectDuplicate={handleProjectDuplicate}
          theme={theme}
          toggleTheme={toggleTheme} // Pass toggleTheme to ProjectList
          currentUser={currentUser}
          isLoadingProjects={isLoadingProjects} // Pass loading state
          loadError={loadProjectsError} // Pass error state
          isImportingMidi={isImportingMidi} // Pass down loading state
          isTranscribingAudio={isTranscribingAudio} // ADDED: Pass down audio transcription loading state
        />
      ) : (
        <main>
          <HeaderBar 
            onBackClick={handleBackToProjects}
            projectName={currentProject?.name || ''}
            onProjectNameChange={(newName) => handleProjectNameChange(currentProject.id, newName)}
            theme={theme}
            toggleTheme={toggleTheme}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onDelete={handleDelete}
            canUndo={currentHistoryIndex > 0}
            canRedo={currentHistoryIndex < history.length - 1}
            hasSelection={hasSelection}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            isSnapToGridActive={isSnapToGridActive}
            setIsSnapToGridActive={setIsSnapToGridActive}
            transpositionTargets={transpositionTargets}
            currentTransposeTargetId={currentTransposeTargetId}
            onTranspose={handleTranspose}
            timeSignature={timeSignature}
            onTimeSignatureChange={handleTimeSignatureChange}
            playbackSpeed={playbackSpeed}
            onSpeedChange={handleSpeedChange}
            totalBars={totalBars}
            noteCount={noteData.tracks[0].notes.length}
            isToolbarVisible={isToolbarVisible}
            setIsToolbarVisible={setIsToolbarVisible}
            isPianoFullscreen={isPianoFullscreen}
            togglePianoFullscreen={togglePianoFullscreen}
            onManualCloudSave={handleManualCloudSave}
            isManuallySaving={isManuallySaving}
            saveSuccess={showSaveSuccessPopup}
            clearSaveSuccess={() => setShowSaveSuccessPopup(false)}
            isDirty={isDirty}
            dirtyChanges={dirtyChanges}
            lastSaveTime={lastSaveTime}
            showScaleHighlight={showScaleHighlight} // Pass down
            setShowScaleHighlight={setShowScaleHighlight} // Pass down
            selectedScale={selectedScale} // Pass down
            setSelectedScale={setSelectedScale} // Pass down
            selectedKey={selectedKey} // Pass down
            setSelectedKey={setSelectedKey} // Pass down
            showNoteNames={showNoteNames} // Pass down
            setShowNoteNames={setShowNoteNames} // Pass down
            noteGlow={noteGlow}
            setNoteGlow={handleSetNoteGlow}
            noteRoundness={noteRoundness}
            setNoteRoundness={setNoteRoundness}
            noteBevel={noteBevel}
            setNoteBevel={setNoteBevel}
            noteOpacity={noteOpacity}
            setNoteOpacity={setNoteOpacity}
            onResetStyles={resetNoteStyles}
            // ADDED: Zoom props
            zoomLevel={zoomLevel}
            onZoomChange={handleZoomChange}
            onZoomReset={handleZoomReset}
            // ADDED: Video export props
            onVideoExport={handleVideoExport}
            isRecording={isRecording}
            recordingProgress={recordingProgress}
            onCancelRecording={handleCancelRecording}
            // ADDED: Minimal mode props
            isMinimalMode={isMinimalMode}
            setIsMinimalMode={setIsMinimalMode}
            // ADDED: Playback props for minimal mode
            isPlaying={isPlaying}
            onPlayPauseToggle={handlePlayPauseToggle}
          />
          
          <div className={`piano-roll-view ${isPianoFullscreen ? 'fullscreen-piano' : ''}`}>
            {/* ADDED: console.log for debugging */}
            {/* console.log('App.js: isPianoFullscreen before passing to Roll:', isPianoFullscreen) */}
            <Roll 
              midiData={noteData} 
              isPlaying={isPlaying} 
              bpm={bpm}
              onUpdateMidiData={handleEditorUpdate}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              synth={synth}
              onSave={handleSave}
              onPlayPauseToggle={handlePlayPauseToggle}
              isTextToolActive={isTextToolActive}
              setIsTextToolActive={setIsTextToolActive}
              isLooping={isLooping}
              setIsLooping={setIsLooping}
              playbackSpeed={playbackSpeed}
              onSpeedChange={handleSpeedChange}
              isAddChordToolActive={isAddChordToolActive}
              setIsAddChordToolActive={setIsAddChordToolActive}
              selectedChordType={selectedChordType}
              setSelectedChordType={setSelectedChordType}
              backgroundImage={backgroundImage}
              onBackgroundImageChange={handleBackgroundImageChange}
              customColors={customColors}
              onCustomColorsChange={handleCustomColorsChange}
              timeSignature={timeSignature}
              onTimeSignatureChange={handleTimeSignatureChange}
              transpositionTargets={transpositionTargets}
              currentTransposeTargetId={currentTransposeTargetId}
              onTranspose={handleTranspose}
              songPosition={currentPlaybackPosition}
              songDuration={songDuration}
              handlePositionChange={(e) => {
                const newPosition = Number(e.target.value);
                setCurrentPlaybackPosition(newPosition);
                scrollPositionRef.current = newPosition;
                Tone.Transport.seconds = newPosition / playbackSpeed;
                const rollComponent = document.querySelector('.notes-container');
                if (rollComponent) {
                  rollComponent.scrollLeft = newPosition * 100; 
                }
              }}
              onScrollPositionChange={(newPosition) => {
                setCurrentPlaybackPosition(newPosition);
              }}
              scrollPositionRef={scrollPositionRef}
              noteGroups={noteGroups}
              groupColors={groupColors}
              onNoteGroupsChange={setNoteGroups}
              onGroupColorsChange={setGroupColors}
              clipboardNotes={clipboardNotes}
              onCopy={handleCopy}
              onPaste={handlePaste}
              onDelete={handleDelete}
              showGrid={showGrid}
              setShowGrid={setShowGrid}
              isSnapToGridActive={isSnapToGridActive}
              setIsSnapToGridActive={setIsSnapToGridActive}
              hasSelection={hasSelection}
              onTotalBarsChange={handleTotalBarsChange}
              isToolbarVisible={isToolbarVisible}
              setIsToolbarVisible={setIsToolbarVisible} // Pass down setter to Roll
              textAnnotations={textAnnotations}
              setTextAnnotations={setTextAnnotations}
              isCursorInToolbar={isCursorInToolbar} // Pass down
              setIsCursorInToolbar={setIsCursorInToolbar} // Pass down
              isPianoFullscreen={isPianoFullscreen} // ADDED: Pass down isPianoFullscreen
              togglePianoFullscreen={togglePianoFullscreen} // Pass down function to Roll
              showScaleHighlight={showScaleHighlight} // Pass down
              selectedScale={selectedScale} // Pass down
              setSelectedScale={setSelectedScale} // Pass down setter to Roll
              selectedKey={selectedKey} // Pass down
              setSelectedKey={setSelectedKey} // Pass down setter to Roll
              setShowScaleHighlight={setShowScaleHighlight} // Pass down setter for scale highlight toggle
              noteCount={noteData.tracks[0].notes.length} // Pass down noteCount to Roll
              // ADDED: Pass Run Tool props to Roll
              runToolScale={runToolScale}
              onRunToolScaleChange={setRunToolScale}
              runToolKey={runToolKey}
              onRunToolKeyChange={setRunToolKey}
              showNoteNames={showNoteNames} // Pass down
              noteGlow={noteGlow} // Pass the noteGlow prop to Roll
              noteRoundness={noteRoundness}
              noteBevel={noteBevel}
              noteOpacity={noteOpacity}
              // ADDED: Zoom prop
              zoomLevel={zoomLevel}
              // ADDED: Recording mode props
              isRecordingMode={isRecordingMode}
              recordingPreset={recordingPreset}
              // ADDED: Minimal mode prop
              isMinimalMode={isMinimalMode}
              renderNote={(noteProps) => (
                <Note
                  {...noteProps}
                  noteGlow={noteGlow}
                />
              )}
            />
            
            {!isMinimalMode && (
              <PlaybackControls
                isPlaying={isPlaying}
                onPlayPauseToggle={handlePlayPauseToggle}
                onRestart={handleRestart}
                onSave={handleSave}
                playbackSpeed={playbackSpeed}
                onSpeedChange={handleSpeedChange}
                songPosition={currentPlaybackPosition}
                songDuration={songDuration}
                handlePositionChange={(e) => {
                  const newPosition = Number(e.target.value);
                  setCurrentPlaybackPosition(newPosition);
                  scrollPositionRef.current = newPosition;
                  Tone.Transport.seconds = newPosition / playbackSpeed;
                  const rollComponent = document.querySelector('.notes-container');
                  if (rollComponent) {
                    rollComponent.scrollLeft = newPosition * 100; 
                  }
                }}
                volume={volume}
                onVolumeChange={handleVolumeChange}
              />
            )}
          </div>
        </main>
      )}
      
      {showSaveDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Save MIDI File</h3>
            <input
              type="text"
              value={saveFileName}
              onChange={(e) => setSaveFileName(e.target.value)}
              placeholder="Enter filename"
              autoFocus
            />
            <div className="modal-buttons">
              <button onClick={handleSaveConfirm}>Save</button>
              <button onClick={() => setShowSaveDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};
export default App;

