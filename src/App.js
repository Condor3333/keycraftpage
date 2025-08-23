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
import SheetMusicView from './components/SheetMusicView';
import ToastContainer from './components/ui/ToastContainer';

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

    // ADDED: Effect to manage body class for minimal mode
    useEffect(() => {
      if (isMinimalMode) {
        document.body.classList.add('minimal-mode');
        // Request fullscreen when entering minimal mode
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(err => {
            
          });
        }
        // Turn on piano fullscreen when entering minimal mode
        setIsPianoFullscreen(true);
      } else {
        document.body.classList.remove('minimal-mode');
        // Exit fullscreen when leaving minimal mode
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(err => {
            
          });
        }
        // Turn off piano fullscreen when leaving minimal mode
        setIsPianoFullscreen(false);
      }
    }, [isMinimalMode]);
  
    // ADDED: State for note styling
  const [noteGlow, setNoteGlow] = useState(0);
  const [noteRoundness, setNoteRoundness] = useState(4);
  const [noteBevel, setNoteBevel] = useState(0);
  const [noteOpacity, setNoteOpacity] = useState(1);
  const [noteGradient, setNoteGradient] = useState(0);
  const [noteMetallic, setNoteMetallic] = useState(0);
  const [noteNeon, setNoteNeon] = useState(0);
  const [notePulse, setNotePulse] = useState(0);

  const [noteHolographic, setNoteHolographic] = useState(0);
  const [noteIce, setNoteIce] = useState(0);

  // ADDED: State for audio sound type
  const [currentSoundType, setCurrentSoundType] = useState('piano');
  // ADDED: Keyboard selection state
  const [currentKeyboard, setCurrentKeyboard] = useState('keyboard3');

  // States for video recording
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [recordingPreset, setRecordingPreset] = useState('minimal');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [showVideoExportDialog, setShowVideoExportDialog] = useState(false);

  // ADDED: Zoom state
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 0.5 = 50%, 2 = 200%, etc.
  
  // ADDED: Duration scale state
  const [durationScale, setDurationScale] = useState(1); // 1 = 100%, 0.5 = 50%, 2 = 200%, etc.
  const [originalNoteData, setOriginalNoteData] = useState(null); // Store original data for scaling

  // ADDED: Note limit constant
  const NOTE_LIMIT = 20000;

  // ADDED: State to track current transposition offset in semitones
  const [transpositionOffset, setTranspositionOffset] = useState(0);

  // Sheet music view state
  const [showSheetMusic, setShowSheetMusic] = useState(false);
  const [showSideBySide, setShowSideBySide] = useState(false);
  const [showJsonView, setShowJsonView] = useState(false);
  const [isConvertingToXml, setIsConvertingToXml] = useState(false);
  const [lastMusicXml, setLastMusicXml] = useState(null);
  const [xmlError, setXmlError] = useState(null);


  const handleSetNoteGlow = (value) => {
    setNoteGlow(value);
  };

  const handleSetNoteGradient = (value) => {
    setNoteGradient(value);
  };

  const handleSetNoteMetallic = (value) => {
    setNoteMetallic(value);
  };

  const handleSetNoteNeon = (value) => {
    setNoteNeon(value);
  };

  const handleSetNotePulse = (value) => {
    setNotePulse(value);
  };



  const handleSetNoteHolographic = (value) => {
    setNoteHolographic(value);
  };

  const handleSetNoteIce = (value) => {
    setNoteIce(value);
  };

  const resetNoteStyles = () => {
    setNoteGlow(0);
    setNoteRoundness(4);
    setNoteBevel(0);
    setNoteOpacity(1);
    setNoteGradient(0);
    setNoteMetallic(0);
    setNoteNeon(0);
    setNotePulse(0);

    setNoteHolographic(0);
    setNoteIce(0);
    setCurrentKeyboard('keyboard3'); // Reset to Grand keyboard style
  };

  // ADDED: Zoom handler functions
  const handleZoomChange = (newZoomLevel) => {
    setZoomLevel(Math.max(0.25, Math.min(newZoomLevel, 2))); // Clamp between 25% and 200%
  };

  const handleZoomReset = () => {
    setZoomLevel(1); // Reset to 100%
  };
  
  // ADDED: Duration scale handler functions - now modifies actual MIDI data
  const handleDurationScaleChange = (newDurationScale) => {
    const clampedScale = Math.max(0.2, Math.min(newDurationScale, 2)); // Clamp between 20% and 200%
    
    // Use original data if available, otherwise use current data as original
    const baseData = originalNoteData || noteData;
    if (!baseData || !baseData.tracks || baseData.tracks.length === 0) return;
    
    // Create a deep copy of the original note data with scaling applied
    const newNoteData = {
      ...baseData,
      tracks: baseData.tracks.map(track => ({
        ...track,
        notes: track.notes.map(note => ({
          ...note,
          time: note.time * clampedScale,
          duration: note.duration * clampedScale
        }))
      }))
    };
    
    // Update the note data
    setNoteData(newNoteData);
    setDurationScale(clampedScale);
    
    // Store original data if not already stored
    if (!originalNoteData) {
      setOriginalNoteData(noteData);
    }
    
    // Mark as dirty since we modified the data
    setIsDirty(true);
    setDirtyChanges(prev => [...prev, 'Duration scale applied']);
  };

  const handleDurationScaleReset = () => {
    // Reset to 100% - this would require reloading the original data
    // For now, we'll just set the scale back to 1
    setDurationScale(1);
  };

  // ADDED: Helper function to fetch an image and convert it to a data URL
  const imageToDataURL = (url) => {
    
    return fetch(url, { mode: 'cors' }) // Explicitly set mode: 'cors' for the fetch
      .then(response => {
        
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
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            
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
    
    //  // Removed Electron logging

    // Setup devThumbnailAPI for thumbnail mocks
    // This part is preserved but no longer inside an Electron-specific conditional
    if (isDev) { // Keep the isDev check if you want these only in development
      
      window.devThumbnailAPI = {
        saveThumbnail: async (projectId, thumbnailDataUrl) => {
          
          localStorage.setItem(`thumbnail_${projectId}`, thumbnailDataUrl);
          return true;
        },
        loadThumbnail: async (projectId) => {
          
          return localStorage.getItem(`thumbnail_${projectId}`);
        },
        deleteThumbnail: async (projectId) => {
          
          localStorage.removeItem(`thumbnail_${projectId}`);
          return true;
        }
      };

      // Setup devBackgroundImageAPI for background image mocks
      
      window.devBackgroundImageAPI = {
        saveBackgroundImage: async (projectId, imageDataUrl) => {
          
          try {
            localStorage.setItem(`bg_image_${projectId}`, imageDataUrl);
            return true;
          } catch (e) {
            console.error('Dev Background Image API: Error saving to localStorage (image might be too large for localStorage):', e);
            return false;
          }
        },
        loadBackgroundImage: async (projectId) => {
          
          return localStorage.getItem(`bg_image_${projectId}`);
        },
        deleteBackgroundImage: async (projectId) => {
          
          localStorage.removeItem(`bg_image_${projectId}`);
          return true;
        }
      };
      //  // Removed
      
      
    }
  }, [isDev]);
  // ALL ABOVE is a mock API using browser storage for development purposes. 

  // Add this useEffect to test Firebase connection
  useEffect(() => {
    // User-related useEffect - currentUser will be managed by AuthJS
  }, [currentUser]);

  //==============SYNTH INITIALIZATION====================
  // Creates different synth types based on currentSoundType
  useEffect(() => {
    let newSynth;
    
    switch (currentSoundType) {
      case 'piano':
        newSynth = new Tone.Sampler({
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
        });
        break;
        
      case 'organ':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/church_organ-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'synth':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/synth_brass_1-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'guitar':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_guitar_steel-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'clean_e_guitar':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_guitar_clean-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'harp':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/orchestral_harp-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'harpsichord':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.6,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/harpsichord-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'e_piano':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_piano_1-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'vibraphone':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/vibraphone-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'choir':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/choir_aahs-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'fart_kit':
        newSynth = new Tone.Sampler({
          urls: {
            C3: '/sfx/fart1.mp3',
            G3: '/sfx/fart2.mp3',
            C4: '/sfx/fart3.mp3',
          },
          release: 0.4,
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'synth2':
        newSynth = new Tone.PolySynth(Tone.Synth);
        setPianoReady(true);
        break;
        
      case 'synth3':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/synth_bass_2-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'synth4':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/synth_bass_1-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'synth5':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/synth_strings_2-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'violin':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/violin-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'trumpet':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/trumpet-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        
      case 'reed_organ':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/reed_organ-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'rock_organ':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/rock_organ-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'shakuhachi':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/shakuhachi-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'shamisen':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/shamisen-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'shanai':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/shanai-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'slap_bass_2':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/slap_bass_2-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        
      case 'steel_drums':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/steel_drums-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'timpani':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/timpani-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'tinkle_bell':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/tinkle_bell-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'voice_oohs':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/voice_oohs-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'synth_choir':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/synth_choir-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'synth_drum':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/synth_drum-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'synth_strings_1':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/synth_strings_1-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'synth_strings_2':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/synth_strings_2-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'taiko_drum':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/taiko_drum-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'tango_accordion':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/tango_accordion-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'muted_trumpet':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.1,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/muted_trumpet-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        
      case 'ocarina':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/ocarina-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'orchestra_hit':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/orchestra_hit-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'overdriven_guitar':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/overdriven_guitar-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'pad_1_new_age':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/pad_1_new_age-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'pad_2_warm':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/pad_2_warm-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'pad_3_polysynth':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/pad_3_polysynth-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'pad_4_choir':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/pad_4_choir-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'pad_5_bowed':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.3,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/pad_5_bowed-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'pad_6_metallic':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/pad_6_metallic-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'pad_7_halo':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 3.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/pad_7_halo-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'pad_8_sweep':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.1,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/pad_8_sweep-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'pan_flute':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.6,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/pan_flute-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'percussive_organ':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.4,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/percussive_organ-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'helicopter':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/helicopter-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'honkytonk_piano':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/honkytonk_piano-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'kalimba':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/kalimba-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'koto':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/koto-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_1_square':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_1_square-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_2_sawtooth':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_2_sawtooth-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_3_calliope':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_3_calliope-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_4_chiff':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.6,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_4_chiff-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_5_charang':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_5_charang-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_6_voice':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_6_voice-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_7_fifths':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.9,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_7_fifths-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_8_bass_lead':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_8_bass_lead-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'marimba':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/marimba-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'melodic_tom':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/melodic_tom-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'music_box':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/music_box-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'percussive_organ':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.4,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/percussive_organ-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'helicopter':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/helicopter-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'honkytonk_piano':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/honkytonk_piano-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'kalimba':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/kalimba-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'koto':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/koto-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_1_square':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_1_square-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_2_sawtooth':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_2_sawtooth-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_3_calliope':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_3_calliope-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_4_chiff':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.6,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_4_chiff-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_5_charang':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_5_charang-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_6_voice':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_6_voice-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_7_fifths':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.9,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_7_fifths-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'lead_8_bass_lead':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/lead_8_bass_lead-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'marimba':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/marimba-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'melodic_tom':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/melodic_tom-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'music_box':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/music_box-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'flute':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/flute-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'french_horn':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/french_horn-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'fretless_bass':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/fretless_bass-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'fx_1_rain':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 3.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/fx_1_rain-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        
      case 'fx_3_crystal':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/fx_3_crystal-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'fx_4_atmosphere':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 3.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/fx_4_atmosphere-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'fx_5_brightness':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/fx_5_brightness-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'fx_6_goblins':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/fx_6_goblins-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'fx_7_echoes':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/fx_7_echoes-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'fx_8_scifi':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/fx_8_scifi-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'glockenspiel':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/glockenspiel-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'guitar_fret_noise':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/guitar_fret_noise-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'guitar_harmonics':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/guitar_harmonics-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'gunshot':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/gunshot-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'harmonica':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/harmonica-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        
      case 'distortion_guitar':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/distortion_guitar-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'drawbar_organ':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/drawbar_organ-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'dulcimer':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/dulcimer-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        
      case 'electric_bass_pick':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_bass_pick-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'electric_grand_piano':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_grand_piano-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'electric_guitar_clean':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_guitar_clean-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'electric_guitar_jazz':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.4,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_guitar_jazz-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'electric_guitar_muted':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 0.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_guitar_muted-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'electric_piano_1':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.6,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_piano_1-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'electric_piano_2':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_piano_2-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        

        
      case 'alto_sax':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/alto_sax-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        
      case 'bagpipe':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/bagpipe-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'banjo':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/banjo-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'baritone_sax':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/baritone_sax-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'bassoon':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/bassoon-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        
      case 'blown_bottle':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/blown_bottle-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'brass_section':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/brass_section-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'breath_noise':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.2,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/breath_noise-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'bright_acoustic_piano':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/bright_acoustic_piano-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'celesta':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.0,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/celesta-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        

        
      case 'choir_aahs':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/choir_aahs-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'church_organ':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 2.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/church_organ-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'accordion':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.6,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/accordion-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'acoustic_bass':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.4,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_bass-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'acoustic_grand_piano':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.5,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_grand_piano-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'acoustic_guitar_nylon':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.8,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_guitar_nylon-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      case 'acoustic_guitar_steel':
        newSynth = new Tone.Sampler({
          urls: {
            C2: 'C2.mp3',
            D2: 'D2.mp3',
            E2: 'E2.mp3',
            F2: 'F2.mp3',
            G2: 'G2.mp3',
            A2: 'A2.mp3',
            B2: 'B2.mp3',
            C3: 'C3.mp3',
            D3: 'D3.mp3',
            E3: 'E3.mp3',
            F3: 'F3.mp3',
            G3: 'G3.mp3',
            A3: 'A3.mp3',
            B3: 'B3.mp3',
            C4: 'C4.mp3',
            D4: 'D4.mp3',
            E4: 'E4.mp3',
            F4: 'F4.mp3',
            G4: 'G4.mp3',
            A4: 'A4.mp3',
            B4: 'B4.mp3',
            C5: 'C5.mp3',
            D5: 'D5.mp3',
            E5: 'E5.mp3',
          },
          release: 1.6,
          baseUrl: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_guitar_steel-mp3/',
          onload: () => setPianoReady(true),
        });
        break;
        
      default:
        newSynth = new Tone.PolySynth(Tone.Synth);
        setPianoReady(true);
        break;
    }

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
    newSynth.chain(eq, multiband, masterLimiter);
    setSynth(newSynth);

    //Runs when 
    return () => {
      if (currentPart) {
        currentPart.dispose();
      }
      newSynth.dispose();
      masterLimiter.dispose();
      multiband.dispose();
      eq.dispose();
    };
  }, [currentSoundType]);

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

    Tone.Transport.bpm.value = bpm;

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

    // Debug velocity values in the incoming data
    if (updatedNoteData?.tracks?.[0]?.notes) {
      const velocityDebug = updatedNoteData.tracks[0].notes.map(note => ({
        id: note.id,
        velocity: note.velocity,
        midi: note.midi
      }));
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
      }
    }

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
    // MODIFIED: Implement tier-based project limits
    const getProjectLimit = () => {
      if (!hasPaid) return 1; // Free tier: 1 project
      if (currentUser?.activePlans?.includes('tier1')) return 20; // Tier 1: 20 projects
      if (currentUser?.activePlans?.includes('tier2')) return Infinity; // Tier 2: unlimited
      return 1; // Default to free tier if no plans found
    };

    const projectLimit = getProjectLimit();
    
    if (projects.length >= projectLimit) {
      let message = '';
      if (projectLimit === 1) {
        message = "Free users can only have 1 project at a time. Please delete an existing project first, or upgrade your account for more projects.";
      } else if (projectLimit === 20) {
        message = "Tier 1 users can only have 20 projects. Please delete an existing project first, or upgrade to Tier 2 for unlimited projects.";
      } else {
        message = "You have reached your project limit. Please delete an existing project first, or upgrade your account for more projects.";
      }
      window.showToast(message);
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
    // MODIFIED: Allow free users to access their existing projects
    // No payment check needed - free users can access their projects

    try {
      if (currentPart) {
        currentPart.dispose();
        setCurrentPart(null);
      }
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      Tone.Transport.seconds = 0;
      Tone.Transport.cancel();
      if (synth && typeof synth.releaseAll === 'function') {
        synth.releaseAll();
      }
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

      
      console.log("[HPS LOG 2.1] Project Metadata:", JSON.stringify(projectMetadata));

      let fetchedMidiData = null;
      let fetchedTextAnnotations = null;
      let finalBackgroundImageForState = null; // Will hold dataURL or null

      // Attempt to convert S3 URL to data URL for background image
      if (backgroundImageUrl) {
        
        try {
          finalBackgroundImageForState = await imageToDataURL(backgroundImageUrl);
          if (finalBackgroundImageForState) {
            
          } else {
            console.warn("[HPS LOG 2.7] Failed to convert backgroundImageUrl to dataURL. Background will be null.");
          }
        } catch (e) {
          console.error("[HPS Error] Error in imageToDataURL during project select:", e);
          finalBackgroundImageForState = null; // Ensure it's null on error
        }
      } else {
        
      }

      // NEW: Check for bundled data first (more efficient - single HTTP request)
      if (bundledDataUrl) {
        try {
          
          const bundledResponse = await fetch(bundledDataUrl);
          
          if (!bundledResponse.ok) {
            const errorText = await bundledResponse.text();
            console.error("[HPS Error] Failed to fetch bundled data. Status:", bundledResponse.status, "Text:", errorText);
            window.showToast(`Error loading project's data. Server Response: ${bundledResponse.statusText} - ${errorText}`);
            return;
          }
          const rawBundledText = await bundledResponse.text();
          
          const bundledData = JSON.parse(rawBundledText);
          console.log("[HPS LOG 6] Parsed Bundled Data:", JSON.stringify(bundledData));
          
          // Extract midiData and textAnnotations from bundled data
          fetchedMidiData = bundledData.midiData;
          fetchedTextAnnotations = bundledData.textAnnotations || [];
          
          if (!fetchedMidiData || !Array.isArray(fetchedMidiData.tracks)) {
            console.error("[HPS Error] Bundled MIDI data is not in the expected format (missing tracks array). Data:", fetchedMidiData);
            window.showToast("Error loading project's MIDI data: The data format is incorrect.");
            return;
          }
          
        } catch (e) {
          console.error("[HPS Error] Error fetching or parsing bundled data from S3 URL:", bundledDataUrl, e);
          window.showToast("Error loading project's data. Check console and S3.", "error");
          return;
        }
      } else {
        // Fallback to separate files (existing logic for older projects)
        

      if (midiDataUrl) {
        try {
          
          const midiResponse = await fetch(midiDataUrl);
          
          if (!midiResponse.ok) {
            const errorText = await midiResponse.text();
            console.error("[HPS Error] Failed to fetch MIDI data. Status:", midiResponse.status, "Text:", errorText);
            window.showToast(`Error loading project's MIDI data. Server Response: ${midiResponse.statusText} - ${errorText}`, "error");
            return;
          }
          const rawMidiText = await midiResponse.text(); // Get raw text first for logging
          
          fetchedMidiData = JSON.parse(rawMidiText); // Then parse
          console.log("[HPS LOG 6] Parsed MIDI Data:", JSON.stringify(fetchedMidiData));
          if (!fetchedMidiData || !Array.isArray(fetchedMidiData.tracks)) {
            console.error("[HPS Error] Fetched MIDI data is not in the expected format (missing tracks array). Data:", fetchedMidiData);
            window.showToast("Error loading project's MIDI data: The data format is incorrect.", "error");
            return;
          }
        } catch (e) {
          console.error("[HPS Error] Error fetching or parsing MIDI data from S3 URL:", midiDataUrl, e);
          window.showToast("Error loading project's MIDI data. Check console and S3.", "error");
          return;
        }
      } else {
        console.warn("[HPS LOG 7] No midiDataUrl provided. Using default empty MIDI data.");
        fetchedMidiData = { tracks: [{ notes: [] }] }; 
      }

      if (textAnnotationsUrl) {
        try {
          
          const annotationsResponse = await fetch(textAnnotationsUrl);
          
          if (!annotationsResponse.ok) {
            const errorText = await annotationsResponse.text();
            console.error("[HPS Error] Failed to fetch Annotation data. Status:", annotationsResponse.status, "Text:", errorText);
            window.showToast(`Warning: Failed to load text annotations. Server Response: ${annotationsResponse.statusText} - ${errorText}`, "warning");
            fetchedTextAnnotations = [];
          } else {
            const rawAnnotationsText = await annotationsResponse.text(); // Get raw text first
            
            fetchedTextAnnotations = JSON.parse(rawAnnotationsText); // Then parse
            console.log("[HPS LOG 11] Parsed Annotations Data:", JSON.stringify(fetchedTextAnnotations));
            if (!Array.isArray(fetchedTextAnnotations)){
              console.error("[HPS Error] Fetched annotation data is not an array. Data:", fetchedTextAnnotations);
              window.showToast("Warning: Text annotations for this project are in an incorrect format.");
              fetchedTextAnnotations = [];
            }
          }
        } catch (e) {
          console.error("[HPS Error] Error fetching or parsing text annotations from S3 URL:", textAnnotationsUrl, e);
          window.showToast("Warning: Could not load text annotations.");
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
      

      setCurrentProject(fullProjectForState);
      console.log("[HPS LOG 14] setCurrentProject called with fullProjectForState. CurrentProject (after set attempt) might not be updated yet due to async nature of setState.");

      console.log("[HPS CRITICAL] About to set note data. fetchedMidiData:", JSON.stringify(fetchedMidiData));
      console.log("[HPS CRITICAL] fullProjectForState.midiData:", JSON.stringify(fullProjectForState.midiData));
      

      setNoteData(fullProjectForState.midiData);    
      console.log("[HPS LOG 15] setNoteData called with:", JSON.stringify(fullProjectForState.midiData));
      
      // Store original data for duration scaling
      setOriginalNoteData(fullProjectForState.midiData);
      setDurationScale(1); // Reset duration scale when loading new project
      
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
      window.showToast('Error loading project. Please try again.');
    }
  };

  //==============MIDI FILE UPLOAD====================
  const handleMidiFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // ADDED: Check tier-based project limits before importing
    const getProjectLimit = () => {
      if (!hasPaid) return 1; // Free tier: 1 project
      if (currentUser?.activePlans?.includes('tier1')) return 20; // Tier 1: 20 projects
      if (currentUser?.activePlans?.includes('tier2')) return Infinity; // Tier 2: unlimited
      return 1; // Default to free tier if no plans found
    };

    const projectLimit = getProjectLimit();
    
    if (projects.length >= projectLimit) {
      let message = '';
      if (projectLimit === 1) {
        message = "Free users can only have 1 project at a time. Please delete an existing project first, or upgrade your account for more projects.";
      } else if (projectLimit === 20) {
        message = "Tier 1 users can only have 20 projects. Please delete an existing project first, or upgrade to Tier 2 for unlimited projects.";
      } else {
        message = "You have reached your project limit. Please delete an existing project first, or upgrade your account for more projects.";
      }
      window.showToast(message);
      event.target.value = null; // Reset file input
      return;
    }

    // ADDED: File size check for a better user experience before reading
    const MAX_FILE_SIZE_MB = 5;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
              window.showToast(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please import a file smaller than ${MAX_FILE_SIZE_MB}MB.`, "warning");
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
          window.showToast(`This MIDI file contains approximately ${allNotes.length.toLocaleString()} notes, which exceeds the project limit of ${NOTE_LIMIT.toLocaleString()}. Please import a smaller file.`, "warning");
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
            window.showToast(`Error saving project: ${saveResult.error}`);
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
          
          // Store original data for duration scaling
          setOriginalNoteData(midiNoteData);
          setDurationScale(1); // Reset duration scale when loading new project
        } catch (error) {
          console.error('Error in saveProjectToStorage call:', error);
          window.showToast('Error saving project. The MIDI file might be too large.');
          return;
        }

        handleRestart();
      } catch (error) {
        console.error('Error parsing MIDI file:', error);
        window.showToast('Error loading MIDI file. Please try another file.');
      } finally {
        setIsImportingMidi(false); // Unset loading state
      }
    };

    reader.onerror = () => {
      console.error("FileReader failed to read the file.");
      window.showToast("There was an error reading the file. Please try again.");
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

    // Debug logging for file details
    console.log('Audio file upload attempt:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: file.lastModified
    });

    // File size check
    const MAX_FILE_SIZE_MB = 50; // Audio files can be larger than MIDI
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
              window.showToast(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please select a file smaller than ${MAX_FILE_SIZE_MB}MB.`, "warning");
      event.target.value = null;
      return;
    }

    // Audio duration check
    const MAX_DURATION_MINUTES = 12; // Maximum 8 minutes to ensure processing completes
    try {
      const duration = await getAudioDuration(file);
      const durationMinutes = duration / 60;
      
      if (durationMinutes > MAX_DURATION_MINUTES) {
        window.showToast(`Audio file is too long (${durationMinutes.toFixed(1)} minutes). Please select a file shorter than ${MAX_DURATION_MINUTES} minutes to ensure successful transcription.`);
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
           // Debug logging
          
          if (errorData.code === 'PAYMENT_REQUIRED') {
            errorMsg = 'AI Transcription is a premium feature. Please upgrade your account to use this feature.';
          } else if (errorData.code === 'QUOTA_EXCEEDED') {
            errorMsg = errorData.message || 'You have reached your monthly transcription limit.';
          } else if (errorData.error) {
            // Handle validation errors with more detail
            if (errorData.details && Array.isArray(errorData.details)) {
              const validationErrors = errorData.details.map(detail => detail.message).join(', ');
              errorMsg = `Validation error: ${validationErrors}`;
            } else {
              errorMsg = errorData.error;
            }
          } else if (errorData.message) {
            errorMsg = errorData.message;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMsg = `HTTP error! status: ${response.status}`;
        }
        window.showToast(errorMsg);
        return;
      }

      // Async job pattern: get jobId and poll for status
      const { jobId } = await response.json();
      if (!jobId) {
        window.showToast('Failed to start transcription job.', "error");
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
        window.showToast('Transcription timed out. Please try again later.');
        return;
      }
      if (jobStatus === 'error') {
        window.showToast(`Transcription failed: ${pollError}`, "error");
        return;
      }
      if (!midiUrl) {
        window.showToast('Transcription completed but no MIDI result was returned.');
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
        window.showToast(`The transcribed audio contains approximately ${allNotes.length.toLocaleString()} notes, which exceeds the project limit of ${NOTE_LIMIT.toLocaleString()}.`, "warning");
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
        name: file.name.replace(/\.(mp3|wav|m4a|flac|ogg)$/i, ''),
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
        window.showToast(`Error saving transcribed project: ${saveResult.error}`);
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
      
      // Store original data for duration scaling
      setOriginalNoteData(midiNoteData);
      setDurationScale(1); // Reset duration scale when loading new project
      handleRestart();

      // Show success message
              window.showToast(`🎵 Audio transcription completed! Found ${uniqueNotes.length} notes.`, "success");

    } catch (error) {
      console.error('Error transcribing audio:', error);
      window.showToast(`Error transcribing audio: ${error.message}`);
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
    // Check if user has paid access for MIDI export
    if (!hasPaid) {
              window.showToast("MIDI export is a premium feature. Please upgrade your account to export your projects as MIDI files.", "warning");
      return;
    }
    setShowSaveDialog(true);
    setSaveFileName(currentProject?.name ? `${currentProject.name}.mid` : 'my-piano-roll.mid');
  };

  const handleSaveMusicXml = async () => {
    // Check if user has paid access for MusicXML export
    if (!hasPaid) {
              window.showToast("MusicXML export is a premium feature. Please upgrade your account to export your projects as MusicXML files.", "warning");
      return;
    }

    try {
      // Show loading state
      setIsConvertingToXml(true);
      setXmlError(null);

      // Create JSON data with isLeftHand properties preserved
      const jsonData = {
        bpm: bpm || 120,
        timeSignature: timeSignature || { numerator: 4, denominator: 4 },
        totalNotes: noteData.tracks[0].notes.length,
        title: currentProject?.name || 'Piano Composition',
        notes: noteData.tracks[0].notes.map(note => ({
          id: note.id,
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity || 0.8,
          name: note.name,
          isLeftHand: note.isLeftHand || false
        }))
      };

      // Create FormData for the request
      const formData = new FormData();
      formData.append('json_data', JSON.stringify(jsonData));
      
      // Add metadata
      if (bpm) formData.append('bpm', bpm.toString());
      if (timeSignature) {
        formData.append('timeSignature', JSON.stringify(timeSignature));
      }
      if (selectedKey) formData.append('key', selectedKey);

      // Convert to MusicXML - Use the exact same approach as the working sheet music conversion
      const apiBase = process.env.REACT_APP_API_BASE_URL || '';
      const response = await fetch(`${apiBase}/api/notation/convert`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      
      

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MusicXML conversion failed:', errorText);
        throw new Error(`Conversion failed: ${errorText}`);
      }

      const musicXml = await response.text();
      
      console.log('MusicXML first 200 chars:', musicXml.substring(0, 200));

      // Create and download the MusicXML file
      const blob = new Blob([musicXml], { type: 'application/vnd.recordare.musicxml+xml' });
      
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      
      const filename = currentProject?.name ? `${currentProject.name}.musicxml` : 'my-piano-roll.musicxml';
      
      
      link.download = filename;
      link.click();
      
      
      
      // Cleanup
      URL.revokeObjectURL(link.href);
      
    } catch (error) {
      console.error('MusicXML export failed:', error);
      setXmlError(error.message);
    } finally {
      setIsConvertingToXml(false);
    }
  };

  const handleSaveConfirm = () => {
    // Create a new MIDI file
    const midi = new Midi();
    
    // Separate notes by hand assignment
    const leftHandNotes = [];
    const rightHandNotes = [];
    
    noteData.tracks[0].notes.forEach(note => {
      if (note.isLeftHand) {
        leftHandNotes.push(note);
      } else {
        rightHandNotes.push(note);
      }
    });
    
    // Create left hand track if there are left hand notes
    if (leftHandNotes.length > 0) {
      const leftTrack = midi.addTrack();
      leftTrack.name = 'Piano LH';
      leftHandNotes.forEach(note => {
        leftTrack.addNote({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity || 0.8
      });
    });
    }
    
    // Create right hand track if there are right hand notes
    if (rightHandNotes.length > 0) {
      const rightTrack = midi.addTrack();
      rightTrack.name = 'Piano RH';
      rightHandNotes.forEach(note => {
        rightTrack.addNote({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity || 0.8
        });
      });
    }

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

  // Helper: Build MIDI bytes from current noteData (similar to handleSaveConfirm logic)
  const buildMidiBytesFromState = () => {
    const midi = new Midi();
    // Embed tempo and time signature so the notation service can interpret rhythm correctly
    try {
      if (bpm) {
        midi.header.setTempo(bpm);
      }
      if (timeSignature && timeSignature.numerator && timeSignature.denominator) {
        midi.header.timeSignatures = [
          { ticks: 0, timeSignature: [timeSignature.numerator, timeSignature.denominator], measures: 0 }
        ];
      }
    } catch (e) {
      // Safe fallback if the MIDI header API changes
    }
    
    // Separate notes by hand assignment
    const leftHandNotes = [];
    const rightHandNotes = [];
    
    noteData.tracks[0].notes.forEach(note => {
      if (note.isLeftHand) {
        leftHandNotes.push(note);
      } else {
        rightHandNotes.push(note);
      }
    });
    
    // Create left hand track if there are left hand notes
    if (leftHandNotes.length > 0) {
      const leftTrack = midi.addTrack();
      leftTrack.name = 'Piano LH';
      leftHandNotes.forEach(note => {
        leftTrack.addNote({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity || 0.8
        });
      });
    }
    
    // Create right hand track if there are right hand notes
    if (rightHandNotes.length > 0) {
      const rightTrack = midi.addTrack();
      rightTrack.name = 'Piano RH';
      rightHandNotes.forEach(note => {
        rightTrack.addNote({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity || 0.8
        });
      });
    }
    
    return midi.toArray();
  };

  const requestMusicXmlFromServer = async () => {
    setIsConvertingToXml(true);
    setXmlError(null);
    try {
      // Create JSON data with isLeftHand properties preserved
      const jsonData = {
        bpm: bpm || 120,
        timeSignature: timeSignature || { numerator: 4, denominator: 4 },
        totalNotes: noteData.tracks[0].notes.length,
        title: currentProject?.name || 'Piano Composition',
        notes: noteData.tracks[0].notes.map(note => ({
          id: note.id,
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity || 0.8,
          name: note.name,
          isLeftHand: note.isLeftHand || false
        }))
      };

      const form = new FormData();
      form.append('json_data', JSON.stringify(jsonData));
      form.append('bpm', String(bpm || 120));
      form.append('timeSignature', JSON.stringify(timeSignature || { numerator: 4, denominator: 4 }));
      form.append('key', selectedKey || 'C');

      const apiBase = process.env.REACT_APP_API_BASE_URL || '';
      const res = await fetch(`${apiBase}/api/notation/convert`, {
        method: 'POST',
        body: form,
        credentials: 'include'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const xml = await res.text();
      setLastMusicXml(xml);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error converting to MusicXML';
      setXmlError(message);
    } finally {
      setIsConvertingToXml(false);
    }
  };

  const handleToggleSheetMusic = async () => {
    const next = !showSheetMusic;
    setShowSheetMusic(next);
    setShowSideBySide(false); // Ensure side-by-side is off when switching to sheet music only
    if (next) {
      // On first open or when dirty, refresh conversion
      if (!lastMusicXml || isDirty) {
        await requestMusicXmlFromServer();
      }
    }
  };

  const handleToggleSideBySide = async () => {
    const next = !showSideBySide;
    setShowSideBySide(next);
    setShowSheetMusic(false); // Ensure sheet music only is off when switching to side-by-side
    setShowJsonView(false); // Ensure JSON view is off
    if (next) {
      // On first open or when dirty, refresh conversion
      if (!lastMusicXml || isDirty) {
        await requestMusicXmlFromServer();
      }
    }
  };

  const handleToggleJsonView = () => {
    const next = !showJsonView;
    setShowJsonView(next);
    setShowSheetMusic(false); // Ensure sheet music only is off
    setShowSideBySide(false); // Ensure side-by-side is off
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
    
    
    setIsReturningToProjects(true); // Show "Returning to Project List..." modal
    
    if (isDirty) {
      
      setIsSavingOnExit(true); // Show "Saving..." modal
      setCloudSaveError(null); // Clear previous errors
      // handleManualCloudSave calls saveProjectToStorage, which now correctly calls loadProjectsFromCloud on success.
      await handleManualCloudSave(); 
      setIsSavingOnExit(false); // Hide "Saving..." modal after operation completes
    } else {
      
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
      // window.showToast('Failed to update project name. Please try again.'); // Alerting might be too disruptive now
    }
  };

  //==============PROJECT DELETE====================
  const handleProjectDelete = async (projectId) => {
    if (!currentUser || !currentUser.id) {
              window.showToast('You must be logged in to delete projects.', "error");
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
         // Corrected "MongoDB" to "server"
        
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
        window.showToast(`Error deleting project: ${responseData.message || 'Please try again.'}`, "error");
      }
    } catch (error) {
      console.error('Network or other error deleting project:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown network error occurred.';
              window.showToast(`Error deleting project: ${errorMessage}`, "error");
    }
  };

  //==============PROJECT DUPLICATE====================
  const handleProjectDuplicate = async (projectToDuplicate) => {
    try {
      

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
      // window.showToast('Error duplicating project. Please try again.');
    }
  };

  //==============SAVE, LOAD, DELETE STORAGE====================
  // Modify saveProjectToStorage to use Firestore
  const saveProjectToStorage = async (projectToSave) => {
    console.log("[saveProjectToStorage] About to save project with noteData:", JSON.stringify(noteData));
    
    console.log("[saveProjectToStorage] projectToSave.midiData:", JSON.stringify(projectToSave.midiData));
    
    
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

    
    // 
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
             // Log the header
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
    //     
    //     const localBgDataUrl = await window.devBackgroundImageAPI.loadBackgroundImage(storedProjectIdForBg);
    //     if (localBgDataUrl) {
    //       loadedBackgroundImage = localBgDataUrl; // Replace identifier with actual Data URL
    //       
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
        
        return JSON.parse(JSON.stringify(project)); // Return a copy
    }
    
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
  }, [isPlaying, playbackSpeed]); // Added playbackSpeed back since it affects audio timing

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
      
      // 
      // saveProjectToStorage(updatedProject).catch(error => {
      //   console.error('Error saving project with background:', error);
      // });
    }
  }, [currentProject?.id, backgroundImage, customColors, timeSignature, bpm]); // Added bpm and currentProject.id for safety

  // Add console log to track background image changes
  useEffect(() => {
    
    
  }, [backgroundImage]);

  // Add effect to sync background image with current project
  useEffect(() => {
    const s3Key = currentProject?.appearance?.backgroundImageS3Key;
    if (!s3Key) { // If there's no S3 key (either no current project, or project has no key)
      if (backgroundImage !== null) { // And the current UI state is not already null
        // 
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
    
    // Calculate the new playback speed to match the BPM
    // We want 60 BPM to play at 60 beats per minute in real time
    // So if BPM is 60, we want playbackSpeed = 0.25 (quarter speed to make 60 beats take 60 seconds)
    // If BPM is 120, we want playbackSpeed = 0.5 (half speed to make 60 beats take 30 seconds)
    // If BPM is 30, we want playbackSpeed = 0.125 (eighth speed to make 60 beats take 120 seconds)
    const newPlaybackSpeed = newBpm / 240;
    
    setPlaybackSpeed(newPlaybackSpeed);
    
    if (isPlaying) {
      // If playing, update the Transport BPM immediately
      Tone.Transport.bpm.value = newBpm;
      // Restart playback with new BPM
      setupAndStartPlayback(Tone.Transport.seconds, true);
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
    
  };

  const handlePaste = () => {
    if (!clipboardNotes || clipboardNotes.notes.length === 0 || !noteData) return; // Adjusted condition

    // ADDED: Check against note limit
    const currentNoteCount = noteData?.tracks?.[0]?.notes?.length || 0;
    if (currentNoteCount + clipboardNotes.notes.length > NOTE_LIMIT) {
      window.showToast(`Pasting these notes would exceed the project note limit of ${NOTE_LIMIT.toLocaleString()}.`);
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
            
            const convertedDataUrl = await imageToDataURL(bgToUseForCanvas);
            if (convertedDataUrl) {
              bgToUseForCanvas = convertedDataUrl; // Use the successfully converted data URL
              
            } else {
              console.warn('[SaveThumbnailDebug] imageToDataURL returned null. Setting bgToUseForCanvas to null to avoid using stale S3 URL.');
              bgToUseForCanvas = null; // Explicitly set to null if conversion failed
            }
          } else if (bgToUseForCanvas) {
            
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
              
              bgContainer.style.backgroundImage = 'none';
            }
            // bgContainer.style.opacity = '1'; // Ensure opacity for capture
            // Short delay for the browser to apply the style change before canvas capture
            await new Promise(resolve => setTimeout(resolve, 250)); 
          } else {
            console.warn('[SaveThumbnailDebug] .background-image-container not found.');
          }
          
          
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
      
      setProjects([]); 
      return;
    }
    
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
        try {
          await forceSessionRefresh(); // Call the new refresh function
          // Optional: remove the query params from URL to prevent re-triggering on manual page refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
          // Error during forced session refresh
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
        window.showToast('Video recording is not supported in this browser. Please try Chrome or Firefox.', "warning");
        return;
      }

      // Simple but effective approach: Use getDisplayMedia with optimized settings
      let stream;
      let mediaRecorder;
      
      try {
        
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
        
        window.showToast(errorMessage);
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
              window.showToast('Video export failed: ' + error.message, "error");
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
      ) : !isEditorView ? ( // REMOVED: !hasPaid check - free users can access editor
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
            noteGradient={noteGradient}
            setNoteGradient={handleSetNoteGradient}
            noteMetallic={noteMetallic}
            setNoteMetallic={handleSetNoteMetallic}
            noteNeon={noteNeon}
            setNoteNeon={handleSetNoteNeon}
            notePulse={notePulse}
            setNotePulse={handleSetNotePulse}

            noteHolographic={noteHolographic}
            setNoteHolographic={handleSetNoteHolographic}
            noteIce={noteIce}
            setNoteIce={handleSetNoteIce}
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
            // ADDED: Audio sound type props
            currentSoundType={currentSoundType}
            setCurrentSoundType={setCurrentSoundType}
            // ADDED: Keyboard selection props
            currentKeyboard={currentKeyboard}
            setCurrentKeyboard={setCurrentKeyboard}
            showSheetMusic={showSheetMusic}
            onToggleSheetMusic={handleToggleSheetMusic}
            showSideBySide={showSideBySide}
            onToggleSideBySide={handleToggleSideBySide}
            showJsonView={showJsonView}
            onToggleJsonView={handleToggleJsonView}
            // ADDED: BPM control props
            bpm={bpm}
            onBpmChange={handleBpmChange}
            // ADDED: Save function props
            onSave={handleSave}
            onSaveMusicXml={handleSaveMusicXml}
            // ADDED: Duration scale props
            durationScale={durationScale}
            onDurationScaleChange={handleDurationScaleChange}
            onDurationScaleReset={handleDurationScaleReset}
          />
          
          <div className={`piano-roll-view ${isPianoFullscreen ? 'fullscreen-piano' : ''}`}>
            {showSideBySide ? (
              // Side-by-side view with MIDI data viewer
              <div style={{ display: 'flex', height: '100%', width: '100%' }}>
                {/* Left side - Piano Roll */}
                <div style={{ flex: '1', borderRight: '1px solid #444' }}>
              <Roll 
              midiData={noteData} 
              isPlaying={isPlaying} 
              bpm={bpm}
              durationScale={durationScale}
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
                    setIsToolbarVisible={setIsToolbarVisible}
              textAnnotations={textAnnotations}
              setTextAnnotations={setTextAnnotations}
                    isCursorInToolbar={isCursorInToolbar}
                    setIsCursorInToolbar={setIsCursorInToolbar}
                    isPianoFullscreen={isPianoFullscreen}
                    togglePianoFullscreen={togglePianoFullscreen}
                    showScaleHighlight={showScaleHighlight}
                    selectedScale={selectedScale}
                    setSelectedScale={setSelectedScale}
                    selectedKey={selectedKey}
                    setSelectedKey={setSelectedKey}
                    setShowScaleHighlight={setShowScaleHighlight}
                    noteCount={noteData.tracks[0].notes.length}
              runToolScale={runToolScale}
              onRunToolScaleChange={setRunToolScale}
              runToolKey={runToolKey}
              onRunToolKeyChange={setRunToolKey}
                    showNoteNames={showNoteNames}
                    noteGlow={noteGlow}
              noteRoundness={noteRoundness}
              noteBevel={noteBevel}
              noteOpacity={noteOpacity}
              noteGradient={noteGradient}
              noteMetallic={noteMetallic}
              noteNeon={noteNeon}
              notePulse={notePulse}
              noteHolographic={noteHolographic}
              noteIce={noteIce}
              zoomLevel={zoomLevel}
              isRecordingMode={isRecordingMode}
              recordingPreset={recordingPreset}
                    isMinimalMode={isMinimalMode}
                    renderNote={(noteProps) => (
                      <Note
                        {...noteProps}
                        noteGlow={noteGlow}
                        noteGradient={noteGradient}
                        noteMetallic={noteMetallic}
                        noteNeon={noteNeon}
                        notePulse={notePulse}
                        noteHolographic={noteHolographic}
                        noteIce={noteIce}
                      />
                    )}
                  />
                </div>
                {/* Right side - Sheet Music and MIDI Data */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
                  

                  
                  {isConvertingToXml && (
                    <div className="modal-overlay" style={{ zIndex: 1500 }}>
                      <div className="modal" style={{ textAlign: 'center' }}>
                        <h3>Generating Sheet Music…</h3>
                        <div className="spinner"></div>
                      </div>
                    </div>
                  )}
                  {xmlError && (
                    <div className="modal-overlay" style={{ zIndex: 1500 }}>
                      <div className="modal" style={{ backgroundColor: '#ffdddd', border: '1px solid red', padding: '20px', borderRadius: '5px', textAlign: 'center' }}>
                        <h4>Conversion Failed</h4>
                        <p style={{ color: 'black', wordBreak: 'break-word' }}>{xmlError}</p>
                        <button onClick={requestMusicXmlFromServer} style={{ marginTop: '10px', padding: '8px 15px' }}>Retry</button>
                      </div>
                    </div>
                  )}
                  {lastMusicXml && !isConvertingToXml && (
                    <SheetMusicView
                      musicXml={lastMusicXml}
                      zoomLevel={zoomLevel}
                      noteData={noteData}
                      isPlaying={isPlaying}
                      playbackSpeed={playbackSpeed}
                      onPlayPauseToggle={handlePlayPauseToggle}
                      onRefreshNotation={requestMusicXmlFromServer}
                    />
                  )}
                </div>
              </div>
            ) : showJsonView ? (
              // JSON view - Piano Roll and JSON data only
              <div style={{ display: 'flex', height: '100%', width: '100%' }}>
                {/* Left side - Piano Roll */}
                <div style={{ flex: '1', borderRight: '1px solid #444' }}>
                  <Roll 
                    midiData={noteData} 
                    isPlaying={isPlaying} 
                    bpm={bpm}
                    durationScale={durationScale}
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
                    setIsToolbarVisible={setIsToolbarVisible}
                    textAnnotations={textAnnotations}
                    setTextAnnotations={setTextAnnotations}
                    isCursorInToolbar={isCursorInToolbar}
                    setIsCursorInToolbar={setIsCursorInToolbar}
                    isPianoFullscreen={isPianoFullscreen}
                    togglePianoFullscreen={togglePianoFullscreen}
                    showScaleHighlight={showScaleHighlight}
                    selectedScale={selectedScale}
                    setSelectedScale={setSelectedScale}
                    selectedKey={selectedKey}
                    setSelectedKey={setSelectedKey}
                    setShowScaleHighlight={setShowScaleHighlight}
                    noteCount={noteData.tracks[0].notes.length}
                    runToolScale={runToolScale}
                    onRunToolScaleChange={setRunToolScale}
                    runToolKey={runToolKey}
                    onRunToolKeyChange={setRunToolKey}
                    showNoteNames={showNoteNames}
                    noteGlow={noteGlow}
                    noteRoundness={noteRoundness}
                    noteBevel={noteBevel}
                    noteOpacity={noteOpacity}
                    noteGradient={noteGradient}
                    noteMetallic={noteMetallic}
                    noteNeon={noteNeon}
                    notePulse={notePulse}
                    noteHolographic={noteHolographic}
                    noteIce={noteIce}
                    zoomLevel={zoomLevel}
                    isRecordingMode={isRecordingMode}
                    recordingPreset={recordingPreset}
                    isMinimalMode={isMinimalMode}
                    renderNote={(noteProps) => (
                      <Note
                        {...noteProps}
                        noteGlow={noteGlow}
                        noteGradient={noteGradient}
                        noteMetallic={noteMetallic}
                        noteNeon={noteNeon}
                        notePulse={notePulse}
                        noteHolographic={noteHolographic}
                        noteIce={noteIce}
                      />
                    )}
                  />
                </div>
                {/* Right side - JSON Data Only */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
                  
                  {/* JSON Data Viewer */}
                  <div style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#1a1a1a',
                    height: '100%',
                    overflow: 'auto'
                  }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#fff' }}>JSON Data Structure</h4>
                    <div style={{ 
                      backgroundColor: '#000', 
                      padding: '8px', 
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#00ff00',
                      height: 'calc(100% - 40px)',
                      overflow: 'auto'
                    }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify({
                          title: currentProject?.name || 'Piano Composition',
                          bpm: bpm,
                          timeSignature: timeSignature,
                          totalNotes: noteData.tracks[0].notes.length,
                          notes: noteData.tracks[0].notes.map(note => ({
                            id: note.id,
                            midi: note.midi,
                            time: note.time,
                            duration: note.duration,
                            velocity: note.velocity,
                            name: note.name,
                            isLeftHand: note.isLeftHand
                          }))
                        }, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : showSheetMusic ? (
              // Sheet music only view
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {isConvertingToXml && (
                  <div className="modal-overlay" style={{ zIndex: 1500 }}>
                    <div className="modal" style={{ textAlign: 'center' }}>
                      <h3>Generating Sheet Music…</h3>
                      <div className="spinner"></div>
                    </div>
                  </div>
                )}
                {xmlError && (
                  <div className="modal-overlay" style={{ zIndex: 1500 }}>
                    <div className="modal" style={{ backgroundColor: '#ffdddd', border: '1px solid red', padding: '20px', borderRadius: '5px', textAlign: 'center' }}>
                      <h4>Conversion Failed</h4>
                      <p style={{ color: 'black', wordBreak: 'break-word' }}>{xmlError}</p>
                      <button onClick={requestMusicXmlFromServer} style={{ marginTop: '10px', padding: '8px 15px' }}>Retry</button>
                    </div>
                  </div>
                )}
                {lastMusicXml && !isConvertingToXml && (
                  <SheetMusicView
                    musicXml={lastMusicXml}
                    zoomLevel={zoomLevel}
                    noteData={noteData}
                    isPlaying={isPlaying}
                    playbackSpeed={playbackSpeed}
                    onPlayPauseToggle={handlePlayPauseToggle}
                    onRefreshNotation={requestMusicXmlFromServer}
                  />
                )}
              </div>
            ) : (
              // Piano roll only view
              <Roll 
                midiData={noteData} 
                isPlaying={isPlaying} 
                bpm={bpm}
                durationScale={durationScale}
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
                setIsToolbarVisible={setIsToolbarVisible}
                textAnnotations={textAnnotations}
                setTextAnnotations={setTextAnnotations}
                isCursorInToolbar={isCursorInToolbar}
                setIsCursorInToolbar={setIsCursorInToolbar}
                isPianoFullscreen={isPianoFullscreen}
                togglePianoFullscreen={togglePianoFullscreen}
                showScaleHighlight={showScaleHighlight}
                selectedScale={selectedScale}
                setSelectedScale={setSelectedScale}
                selectedKey={selectedKey}
                setSelectedKey={setSelectedKey}
                setShowScaleHighlight={setShowScaleHighlight}
                noteCount={noteData.tracks[0].notes.length}
                runToolScale={runToolScale}
                onRunToolScaleChange={setRunToolScale}
                runToolKey={runToolKey}
                onRunToolKeyChange={setRunToolKey}
                showNoteNames={showNoteNames}
                noteGlow={noteGlow}
                noteRoundness={noteRoundness}
                noteBevel={noteBevel}
                noteOpacity={noteOpacity}
                noteGradient={noteGradient}
                noteMetallic={noteMetallic}
                noteNeon={noteNeon}
                notePulse={notePulse}
                noteHolographic={noteHolographic}
                noteIce={noteIce}
                zoomLevel={zoomLevel}
                isRecordingMode={isRecordingMode}
                recordingPreset={recordingPreset}
              isMinimalMode={isMinimalMode}
              renderNote={(noteProps) => (
                <Note
                  {...noteProps}
                  noteGlow={noteGlow}
                  noteGradient={noteGradient}
                  noteMetallic={noteMetallic}
                  noteNeon={noteNeon}
                  notePulse={notePulse}
                  noteHolographic={noteHolographic}
                  noteIce={noteIce}
                />
              )}
            />
            )}
            
            {!isMinimalMode && (
              <PlaybackControls
                isPlaying={isPlaying}
                onPlayPauseToggle={handlePlayPauseToggle}
                onRestart={handleRestart}
                onSave={handleSave}
                onSaveMusicXml={handleSaveMusicXml}
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
                currentUser={currentUser}
                // ADDED: Audio sound type props
                currentSoundType={currentSoundType}
                // ADDED: Minimal mode props
                isMinimalMode={isMinimalMode}
                toggleMinimalMode={() => setIsMinimalMode(!isMinimalMode)}
              />
            )}

            {/* Minimal Mode Controls - Top Right Corner */}
            {isMinimalMode && (
              <>
                <button 
                  onClick={() => setIsMinimalMode(false)}
                  className="minimal-mode-btn-top-right active"
                  title="Exit Minimal Mode (M)"
                >
                  <i className="fas fa-compress-arrows-alt"></i>
                </button>
                <button 
                  onClick={handlePlayPauseToggle}
                  className="minimal-play-btn-top-right"
                  title={`${isPlaying ? 'Pause' : 'Play'} (Space)`}
                >
                  <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                </button>
              </>
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
      <ToastContainer />
    </AuthProvider>
  );
};

export default App;
