import React, { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import './HeaderBar.css';
import { scaleNames, keys } from '../Data/scales'; // Import scales and keys

const HeaderBar = ({ 
  onBackClick, 
  projectName, 
  onProjectNameChange,
  theme,
  toggleTheme,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDelete,
  canUndo,
  canRedo,
  hasSelection,
  showGrid,
  setShowGrid,
  isSnapToGridActive,
  setIsSnapToGridActive,
  transpositionTargets,
  currentTransposeTargetId,
  onTranspose,
  timeSignature,
  onTimeSignatureChange,

  totalBars,
  noteCount,
  isToolbarVisible,
  setIsToolbarVisible,
  isPianoFullscreen,
  togglePianoFullscreen,
  onManualCloudSave,
  isManuallySaving,
  saveSuccess,
  clearSaveSuccess,
  isDirty,
  dirtyChanges,
  lastSaveTime,
  showScaleHighlight, 
  setShowScaleHighlight,
  selectedScale,
  setSelectedScale,
  selectedKey,
  setSelectedKey,
  showNoteNames,
  setShowNoteNames,
  noteGlow,
  setNoteGlow,
  noteRoundness,
  setNoteRoundness,
  noteBevel,
  setNoteBevel,
  noteOpacity,
  setNoteOpacity,
  noteGradient,
  setNoteGradient,
  noteMetallic,
  setNoteMetallic,
  noteNeon,
  setNoteNeon,
  notePulse,
  setNotePulse,
  noteGlass,
  setNoteGlass,
  noteHolographic,
  setNoteHolographic,
  noteIce,
  setNoteIce,
  onResetStyles,
  // ADDED: Zoom props
  zoomLevel,
  onZoomChange,
  onZoomReset,
  // ADDED: Video export props
  onVideoExport,
  isRecording,
  recordingProgress,
  onCancelRecording,
  // ADDED: Minimal mode props
  isMinimalMode,
  setIsMinimalMode,
  // ADDED: Playback props for minimal mode
  isPlaying,
  onPlayPauseToggle,
  // ADDED: Audio sound type props
  currentSoundType,
  setCurrentSoundType,
  // ADDED: Sheet music toggle
  showSheetMusic,
  onToggleSheetMusic,
  // ADDED: Side-by-side toggle
  showSideBySide,
  onToggleSideBySide,
  // ADDED: JSON view toggle
  showJsonView,
  onToggleJsonView,
  // ADDED: BPM control props
  bpm,
  onBpmChange,
  // ADDED: Save function props
  onSave,
  onSaveMusicXml,
  // ADDED: Duration scale props
  durationScale,
  onDurationScaleChange,
  onDurationScaleReset,
}) => {
  // Fixed zoom slider implementation - old zoom in/out functions removed
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(projectName);

  const [showBpmInput, setShowBpmInput] = useState(false);
  const [tempBpmInput, setTempBpmInput] = useState(bpm || 120);
  const [showTimeSignatureInput, setShowTimeSignatureInput] = useState(false);
  const [showTransposeInput, setShowTransposeInput] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  const [isTheoryDropdownOpen, setIsTheoryDropdownOpen] = useState(false);
  const theoryButtonRef = useRef(null);

  const bpmPopupRef = useRef(null);
  const transposePopupRef = useRef(null);
  const timeSignaturePopupRef = useRef(null);
  const viewButtonRef = useRef(null);

  // Force remount of popups on orientation/resize to keep them visible
  const [popupVersion, setPopupVersion] = useState(0);
  useEffect(() => {
    const handleReposition = () => {
      if (showBpmInput || showTransposeInput || showTimeSignatureInput) {
        setPopupVersion((v) => v + 1);
      }
    };
    window.addEventListener('orientationchange', handleReposition);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('orientationchange', handleReposition);
      window.removeEventListener('resize', handleReposition);
    };
  }, [showBpmInput, showTransposeInput, showTimeSignatureInput]);

  // Add state for custom time signature inputs
  const [customNumerator, setCustomNumerator] = useState(timeSignature.numerator);
  const [customDenominator, setCustomDenominator] = useState(timeSignature.denominator);
  const [timeSignatureError, setTimeSignatureError] = useState('');

  const commonTimeSignatures = [
    { numerator: 4, denominator: 4, name: "4/4" },
    { numerator: 3, denominator: 4, name: "3/4" },
    { numerator: 2, denominator: 4, name: "2/4" },
    { numerator: 6, denominator: 8, name: "6/8" },
    { numerator: 9, denominator: 8, name: "9/8" }
  ];
  const commonSpeedInputValues = [60, 80, 100, 120, 140, 160, 180];

  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const styleButtonRef = useRef(null);
  const styleDropdownRef = useRef(null);

  // ADDED: Audio dropdown state
  const [isAudioDropdownOpen, setIsAudioDropdownOpen] = useState(false);
  const [audioSearchTerm, setAudioSearchTerm] = useState('');

  // Function to check if an item should be shown based on search term
  const shouldShowItem = (itemName) => {
    if (!audioSearchTerm.trim()) return true;
    const searchTerm = audioSearchTerm.toLowerCase().trim();
    const itemNameLower = itemName.toLowerCase();
    return itemNameLower.includes(searchTerm);
  };

  // Function to check if a category should be shown based on search term
  const shouldShowCategory = (categoryName) => {
    if (!audioSearchTerm.trim()) return true;
    const searchTerm = audioSearchTerm.toLowerCase().trim();
    const categoryNameLower = categoryName.toLowerCase();
    return categoryNameLower.includes(searchTerm);
  };
  const audioButtonRef = useRef(null);
  const audioDropdownRef = useRef(null);

  // ADDED: Save dropdown state
  const [isSaveDropdownOpen, setIsSaveDropdownOpen] = useState(false);
  const saveButtonRef = useRef(null);
  const saveDropdownRef = useRef(null);

  // Video export states
  const [showVideoExportDialog, setShowVideoExportDialog] = useState(false);
  const videoExportButtonRef = useRef(null);


  
  // Browser fullscreen state
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  useEffect(() => {
    setEditedName(projectName);
  }, [projectName]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);



  useEffect(() => {
    setTempBpmInput(bpm || 120);
  }, [bpm]);

  useEffect(() => {
    if (saveSuccess) {
      setShowSuccessPopup(true);
      const timer = setTimeout(() => {
        setShowSuccessPopup(false);
        if (clearSaveSuccess) {
          clearSaveSuccess();
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess, clearSaveSuccess]);

  // ADDED: Keyboard shortcuts for zoom and other features
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if cursor is in a text input field
      const isInTextInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true';
      
      if (!isInTextInput) {
        // Save shortcut (Ctrl/Cmd + S)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (onManualCloudSave && !isManuallySaving && isDirty) {
            onManualCloudSave();
          }
        }
        
        // Toggle shortcuts for view features without modifiers
        if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          setShowGrid(!showGrid);
        }
        if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          setIsSnapToGridActive(!isSnapToGridActive);
        }
        if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          setShowScaleHighlight(!showScaleHighlight);
        }
        if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          setShowNoteNames(!showNoteNames);
        }
        if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          setIsToolbarVisible(!isToolbarVisible);
        }
        if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          togglePianoFullscreen();
        }
        if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          setIsMinimalMode(!isMinimalMode);
        }
        
        // Zoom shortcuts (Ctrl/Cmd + combinations)
        if ((e.ctrlKey || e.metaKey) && e.key === '0' && !e.shiftKey) {
          e.preventDefault();
          onZoomReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGrid, setShowGrid, isSnapToGridActive, setIsSnapToGridActive, 
      showScaleHighlight, setShowScaleHighlight, showNoteNames, setShowNoteNames, 
      isToolbarVisible, setIsToolbarVisible, togglePianoFullscreen,
      onZoomReset, isMinimalMode, setIsMinimalMode, onManualCloudSave, isManuallySaving, isDirty]);

  const handleNameSubmit = () => {
    if (editedName.trim() && editedName !== projectName) {
      onProjectNameChange(editedName.trim());
    }
    setIsEditing(false);
  };



  const handleBpmInputValueChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setTempBpmInput('');
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        setTempBpmInput(numValue);
      }
    }
  };

  const handleBpmInputSubmit = () => {
    const newBpm = Math.max(40, Math.min(300, tempBpmInput || 120));
    if (onBpmChange) {
      onBpmChange(newBpm);
    }
    setShowBpmInput(false);
  };

  const handleBpmInputFocus = (e) => {
    e.target.select();
  };

  const handleBpmInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleBpmInputSubmit();
      e.target.blur();
    }
    if (e.key === 'Escape') {
      setTempBpmInput(bpm || 120);
      setShowBpmInput(false);
    }
  };

  const currentTransposeTarget = transpositionTargets?.find(target => target.id === currentTransposeTargetId);
  const currentTransposeLabel = currentTransposeTarget?.label || 'Key';
  const currentTimeSignatureDisplay = `${timeSignature.numerator}/${timeSignature.denominator}`;

  const toggleTheoryDropdown = () => {
    const currentlyOpenPopup = showBpmInput || showTransposeInput || showTimeSignatureInput;
    const isOpeningNewDropdown = !isTheoryDropdownOpen && !currentlyOpenPopup;

    // Always close all popups first when the main Theory button is clicked
    setShowBpmInput(false);
    setShowTransposeInput(false);
    setShowTimeSignatureInput(false);

    // Then, toggle the dropdown state only if no popup was open, or if we intend to open it fresh.
    // If a popup WAS open, clicking "Theory" should just close it (done above) and not re-open the dropdown.
    if (isOpeningNewDropdown) {
      setIsTheoryDropdownOpen(true);
    } else {
      // If a popup was open, or if the dropdown was open, this click means close everything.
      setIsTheoryDropdownOpen(false);
    }
  };

  const handleTheoryControlToggle = (controlType) => {
    // Determine the current state of the popup we are about to toggle
    const isBpmCurrentlyOpen = showBpmInput;
    const isTransposeCurrentlyOpen = showTransposeInput;
    const isTimeSigCurrentlyOpen = showTimeSignatureInput;

    // Close all popups first
    setShowBpmInput(false);
    setShowTransposeInput(false);
    setShowTimeSignatureInput(false);
    // Keep the main dropdown open so popups can render properly

    // Now, open the intended one, but only if it wasn't the one already open
    // (if it was, the action of closing all above already handled it)
    if (controlType === 'bpm' && !isBpmCurrentlyOpen) {
      setShowBpmInput(true);
    } else if (controlType === 'transpose' && !isTransposeCurrentlyOpen) {
      setShowTransposeInput(true);
    } else if (controlType === 'timeSignature' && !isTimeSigCurrentlyOpen) {
      setShowTimeSignatureInput(true);
    }
    // If the control was already open, clicking its item in the dropdown now effectively closes it
    // because all were closed, and it won't be re-opened by the conditions above.
  };
  
  const validDenominators = [1, 2, 4, 8, 16];

  const handleCustomTimeSignatureSubmit = () => {
    const num = parseInt(customNumerator, 10);
    const den = parseInt(customDenominator, 10);

    if (isNaN(num) || num < 1 || num > 16) {
      setTimeSignatureError('Numerator must be between 1 and 16.');
      return;
    }
    if (isNaN(den) || !validDenominators.includes(den)) {
      setTimeSignatureError('Denominator must be 1, 2, 4, 8, or 16.');
      return;
    }

    setTimeSignatureError('');
    if (onTimeSignatureChange) {
      onTimeSignatureChange({ numerator: num, denominator: den });
    }
  };

  const formatLastSaveTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getSaveButtonTooltip = () => {
    if (isManuallySaving) return 'Saving...';
    if (!isDirty) return `Last saved at ${formatLastSaveTime(lastSaveTime)}`;
    return `Unsaved changes: ${dirtyChanges.join(', ')}`;
  };
  
  const toggleViewDropdown = () => {
    setIsViewDropdownOpen(!isViewDropdownOpen);
  };

  const handleViewItemClick = (actionCallback) => {
    if (typeof actionCallback === 'function') {
      actionCallback();
    }
    setIsViewDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close Theory Dropdown & Popups
      if (theoryButtonRef.current && !theoryButtonRef.current.contains(event.target)) {
        const isClickOutsideTheoryPopups = 
          (!transposePopupRef.current || !transposePopupRef.current.contains(event.target)) &&
          (!timeSignaturePopupRef.current || !timeSignaturePopupRef.current.contains(event.target));
        if (isClickOutsideTheoryPopups) {
          setIsTheoryDropdownOpen(false);
          setShowTransposeInput(false);
          setShowTimeSignatureInput(false);
        }
      }
      // Close View Dropdown
      if (viewButtonRef.current && !viewButtonRef.current.contains(event.target)) {
        setIsViewDropdownOpen(false);
      }
      // Close Style Dropdown
      if (styleButtonRef.current && !styleButtonRef.current.contains(event.target)) {
        setIsStyleDropdownOpen(false);
      }
      // Close Audio Dropdown
      if (audioButtonRef.current && !audioButtonRef.current.contains(event.target)) {
        setIsAudioDropdownOpen(false);
      }
      // Close Save Dropdown
      if (saveButtonRef.current && !saveButtonRef.current.contains(event.target)) {
        setIsSaveDropdownOpen(false);
      }
      
      // Individual theory popup outside click handling (if a popup is open and click is outside it, but not on theory button)
              if (showBpmInput && bpmPopupRef.current && !bpmPopupRef.current.contains(event.target) &&
            (!theoryButtonRef.current || !theoryButtonRef.current.contains(event.target))) {
          setShowBpmInput(false);
      }
      if (showTransposeInput && transposePopupRef.current && !transposePopupRef.current.contains(event.target) && 
          (!theoryButtonRef.current || !theoryButtonRef.current.contains(event.target))) {
        setShowTransposeInput(false);
      }
      if (showTimeSignatureInput && timeSignaturePopupRef.current && !timeSignaturePopupRef.current.contains(event.target) && 
          (!theoryButtonRef.current || !theoryButtonRef.current.contains(event.target))) {
        setShowTimeSignatureInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTransposeInput, showTimeSignatureInput]);

  const toggleStyleDropdown = () => {
    setIsStyleDropdownOpen(prev => !prev);
  };

  const handleGlowChange = (e) => {
    setNoteGlow(Number(e.target.value));
  };

  const handleRoundnessChange = (e) => {
    setNoteRoundness(Number(e.target.value));
  };

  const handleBevelChange = (e) => {
    setNoteBevel(Number(e.target.value));
  };

  const handleOpacityChange = (e) => {
    setNoteOpacity(Number(e.target.value));
  };

  const handleGradientChange = (e) => {
    setNoteGradient(Number(e.target.value));
  };

  const handleMetallicChange = (e) => {
    setNoteMetallic(Number(e.target.value));
  };

  const handleNeonChange = (e) => {
    setNoteNeon(Number(e.target.value));
  };

  const handlePulseChange = (e) => {
    setNotePulse(Number(e.target.value));
  };



  const handleHolographicChange = (e) => {
    setNoteHolographic(Number(e.target.value));
  };

  const handleIceChange = (e) => {
    setNoteIce(Number(e.target.value));
  };

  // Browser fullscreen toggle function
  const toggleBrowserFullscreen = () => {
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
  };

  // Video export functions
  const handleVideoExportClick = () => {
    setShowVideoExportDialog(true);
  };

  const handleVideoExportConfirm = (preset) => {
    setShowVideoExportDialog(false);
    onVideoExport(preset);
  };

  const toggleMinimalMode = () => {
    setIsMinimalMode(!isMinimalMode);
  };

  return (
    <div className={`header-bar ${isMinimalMode ? 'minimal-mode' : ''}`}>  
      {/* Rest of header content - hidden in minimal mode */}
      {!isMinimalMode && (
        <>
          {/* Logo on the left */}
          <div className="header-logo" onClick={onBackClick}>
            <img src="/logo.png" alt="KeyCraft" className="header-logo-img" />
          </div>
          
          {/* Title and buttons container */}
          <div className="header-content">
            <h2 
              className="project-title"
              onClick={() => projectName && setIsEditing(true)}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={handleNameSubmit}
                  maxLength={40}
                  onKeyDown={(e) => {
                    e.stopPropagation(); // Prevent shortcuts from activating
                    if (e.key === 'Enter' && editedName.trim()) {
                      handleNameSubmit();
                    }
                    if (e.key === 'Escape') {
                      setIsEditing(false);
                      setEditedName(projectName);
                    }
                  }}
                  autoFocus
                />
              ) : (projectName || 'Untitled Project')}
            </h2>

            {/* Buttons below title */}
            <div className="header-buttons">
            <div className="header-section theory-section" ref={theoryButtonRef}>
            <button 
              className={`section-toggle theory-dropdown-toggle ${isTheoryDropdownOpen ? 'active' : ''}`}
              onClick={toggleTheoryDropdown}
            >
              Theory
            </button>
            {isTheoryDropdownOpen && (
              <div className="theory-dropdown-menu">

                <div className="dropdown-item" onClick={() => handleTheoryControlToggle('bpm')}>
                  <i className="fas fa-tachometer-alt"></i>
                  <span>Tempo: {bpm || 120}</span>
                </div>
                <div className="dropdown-item" onClick={() => handleTheoryControlToggle('transpose')}>
                  <i className="fas fa-music"></i>
                  <span>Key: {currentTransposeLabel}</span>
                </div>
                <div className="dropdown-item" onClick={() => handleTheoryControlToggle('timeSignature')}>
                  <i className="fas fa-signature"></i>
                  <span>Time Sig: {currentTimeSignatureDisplay}</span>
                </div>
                <div className="dropdown-item non-clickable">
                  <i className="fas fa-ruler-horizontal"></i>
                  <span>{totalBars} bars • {noteCount || 0} notes</span>
                </div>
              </div>
            )}

            {showBpmInput && (
              <div className="control-popup bpm-popup" ref={bpmPopupRef} key={`bpm-${popupVersion}`}>
                <input 
                  type="number" 
                  min="40" 
                  max="300" 
                  value={tempBpmInput} 
                  onChange={handleBpmInputValueChange} 
                  onBlur={handleBpmInputSubmit} 
                  onFocus={handleBpmInputFocus} 
                  onKeyDown={handleBpmInputKeyPress}
                  className="control-input" 
                  title="Enter BPM"
                  autoFocus
                />
                <div className="control-presets">
                  {[60, 80, 100, 120, 140, 160, 180, 200].map(presetValue => {
                    console.log('Rendering preset button:', presetValue);
                    return (
                      <button 
                        key={presetValue} 
                        onClick={() => {
                          console.log('Preset clicked:', presetValue, 'Current BPM:', bpm);
                          setTempBpmInput(presetValue);
                          if (onBpmChange) {
                            console.log('Calling onBpmChange with:', presetValue);
                            onBpmChange(presetValue);
                          } else {
                            console.log('onBpmChange is not defined');
                          }
                          setShowBpmInput(false);
                        }} 
                        className={`control-preset-btn ${presetValue === (bpm || 120) ? 'active' : ''}`}
                      >
                        {presetValue}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {showTransposeInput && (
              <div className="control-popup transpose-popup" ref={transposePopupRef} key={`transpose-${popupVersion}`}>
                <div className="control-options">
                  {transpositionTargets?.map(target => (
                    <button
                      key={target.id}
                      onClick={() => {
                        onTranspose(target.id);
                        setShowTransposeInput(false);
                      }}
                      className={`control-option-btn ${target.id === currentTransposeTargetId ? 'active' : ''}`}
                    >
                      {target.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showTimeSignatureInput && (
              <div className="control-popup time-signature-popup" ref={timeSignaturePopupRef} key={`timesig-${popupVersion}`}>
                <div className="control-options">
                  {commonTimeSignatures.map(ts => (
                    <button 
                      key={`${ts.numerator}/${ts.denominator}`}
                      className={`control-option-btn ${timeSignature.numerator === ts.numerator && timeSignature.denominator === ts.denominator ? 'active' : ''}`}
                      onClick={() => {
                        if (onTimeSignatureChange) {
                          onTimeSignatureChange({ numerator: ts.numerator, denominator: ts.denominator });
                        }
                        setShowTimeSignatureInput(false);
                      }}
                    >
                      {ts.name}
                    </button>
                  ))}
                </div>
                <div className="custom-time-signature-input" style={{ marginTop: '10px', padding:'5px', borderTop: '1px solid #555' }}>
                  <h4 style={{margin: '5px 0', fontSize: '0.9em', color: '#fff'}}>Custom:</h4>
                  <input
                    type="number"
                    value={customNumerator}
                    onChange={(e) => setCustomNumerator(e.target.value)}
                    min="1"
                    max="16"
                    className="control-input"
                    style={{ width: '50px', marginRight: '5px', textAlign: 'center' }}
                  />
                  <span style={{ color: '#fff' }}>/</span>
                  <select
                    value={customDenominator}
                    onChange={(e) => setCustomDenominator(e.target.value)}
                    className="control-input"
                    style={{ width: '60px', marginLeft: '5px' }}
                  >
                    {validDenominators.map(den => (
                      <option key={den} value={den}>{den}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleCustomTimeSignatureSubmit} 
                    className="control-option-btn" 
                    style={{ marginLeft: '10px', padding: '5px 10px'}}
                  >
                    Set
                  </button>
                  {timeSignatureError && <p style={{ color: 'red', fontSize: '0.8em', marginTop: '5px', marginBottom: '0' }}>{timeSignatureError}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Style Section - New Addition */}
          <div className="header-section style-section" ref={styleButtonRef}>
            <button 
              className={`section-toggle style-dropdown-toggle ${isStyleDropdownOpen ? 'active' : ''}`}
              onClick={toggleStyleDropdown}
            >
              Style
            </button>
            {isStyleDropdownOpen && (
              <div className="style-dropdown-menu" ref={styleDropdownRef}>
                <div className="slider-item">
                  <span>Glow</span>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={noteGlow}
                    onChange={handleGlowChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{noteGlow}</span>
                </div>
                <div className="slider-item">
                  <span>Roundness</span>
                  <input
                    type="range"
                    min="0"
                    max="20" // Max roundness
                    value={noteRoundness}
                    onChange={handleRoundnessChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{noteRoundness}</span>
                </div>
                <div className="slider-item">
                  <span>Bevel</span>
                  <input
                    type="range"
                    min="0"
                    max="10" // Max bevel
                    value={noteBevel}
                    onChange={handleBevelChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{noteBevel}</span>
                </div>
                <div className="slider-item">
                  <span>Opacity</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={noteOpacity}
                    onChange={handleOpacityChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{noteOpacity.toFixed(2)}</span>
                </div>
                <div className="slider-item">
                  <span>Gradient</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={noteGradient}
                    onChange={handleGradientChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{noteGradient}</span>
                </div>
                <div className="slider-item">
                  <span>Metallic</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={noteMetallic}
                    onChange={handleMetallicChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{noteMetallic}</span>
                </div>
                <div className="slider-item">
                  <span>Neon</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={noteNeon}
                    onChange={handleNeonChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{noteNeon}</span>
                </div>
                <div className="slider-item">
                  <span>Pulse</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={notePulse}
                    onChange={handlePulseChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{notePulse}</span>
                </div>

                <div className="slider-item">
                  <span>Holographic</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={noteHolographic}
                    onChange={handleHolographicChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{noteHolographic}</span>
                </div>
                <div className="slider-item">
                  <span>Ice</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={noteIce}
                    onChange={handleIceChange}
                    className="style-slider"
                  />
                  <span className="slider-value">{noteIce}</span>
                </div>

                <div className="dropdown-separator"></div>
                <button className="reset-styles-btn" onClick={onResetStyles}>
                  Reset to Default
                </button>
              </div>
            )}
          </div>

          {/* Audio Section - New Addition */}
          <div className="header-section audio-section" ref={audioButtonRef}>
            <button 
              className={`section-toggle audio-dropdown-toggle ${isAudioDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsAudioDropdownOpen(!isAudioDropdownOpen)}
            >
              Audio
            </button>
            {isAudioDropdownOpen && (
              <div className="audio-dropdown-menu" ref={audioDropdownRef}>
                <div className="dropdown-search-container">
                  <input
                    type="text"
                    placeholder="Search instruments..."
                    className="dropdown-search-input"
                    value={audioSearchTerm}
                    onChange={(e) => setAudioSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyUp={(e) => e.stopPropagation()}
                    onKeyPress={(e) => e.stopPropagation()}
                  />
                </div>
                {/* PIANOS */}
                {shouldShowItem('Piano') && <div className="dropdown-category-header">Pianos</div>}
                {shouldShowItem('Piano') && (
                  <div className={`dropdown-item ${currentSoundType === 'piano' ? 'active' : ''}`} onClick={() => setCurrentSoundType('piano')}>
                    <i className="fas fa-music"></i> Piano
                </div>
                )}
                {shouldShowItem('Bright Acoustic Piano') && (
                  <div className={`dropdown-item ${currentSoundType === 'bright_acoustic_piano' ? 'active' : ''}`} onClick={() => setCurrentSoundType('bright_acoustic_piano')}>
                    <i className="fas fa-music"></i> Bright Acoustic Piano
                  </div>
                )}
                {shouldShowItem('Acoustic Grand Piano') && (
                  <div className={`dropdown-item ${currentSoundType === 'acoustic_grand_piano' ? 'active' : ''}`} onClick={() => setCurrentSoundType('acoustic_grand_piano')}>
                    <i className="fas fa-music"></i> Acoustic Grand Piano
                  </div>
                )}
                {shouldShowItem('Electric Grand Piano') && (
                  <div className={`dropdown-item ${currentSoundType === 'electric_grand_piano' ? 'active' : ''}`} onClick={() => setCurrentSoundType('electric_grand_piano')}>
                    <i className="fas fa-music"></i> Electric Grand Piano
                  </div>
                )}
                {shouldShowItem('Honkytonk Piano') && (
                  <div className={`dropdown-item ${currentSoundType === 'honkytonk_piano' ? 'active' : ''}`} onClick={() => setCurrentSoundType('honkytonk_piano')}>
                    <i className="fas fa-music"></i> Honkytonk Piano
                  </div>
                )}
                {shouldShowItem('Electric Piano') && (
                  <div className={`dropdown-item ${currentSoundType === 'e_piano' ? 'active' : ''}`} onClick={() => setCurrentSoundType('e_piano')}>
                    <i className="fas fa-music"></i> Electric Piano
                  </div>
                )}
                {shouldShowItem('Electric Piano 1') && (
                  <div className={`dropdown-item ${currentSoundType === 'electric_piano_1' ? 'active' : ''}`} onClick={() => setCurrentSoundType('electric_piano_1')}>
                    <i className="fas fa-music"></i> Electric Piano 1
                  </div>
                )}
                {shouldShowItem('Electric Piano 2') && (
                  <div className={`dropdown-item ${currentSoundType === 'electric_piano_2' ? 'active' : ''}`} onClick={() => setCurrentSoundType('electric_piano_2')}>
                    <i className="fas fa-music"></i> Electric Piano 2
                  </div>
                )}
                {shouldShowItem('Harpsichord') && (
                  <div className={`dropdown-item ${currentSoundType === 'harpsichord' ? 'active' : ''}`} onClick={() => setCurrentSoundType('harpsichord')}>
                    <i className="fas fa-music"></i> Harpsichord
                  </div>
                )}
                {shouldShowItem('Celesta') && (
                  <div className={`dropdown-item ${currentSoundType === 'celesta' ? 'active' : ''}`} onClick={() => setCurrentSoundType('celesta')}>
                    <i className="fas fa-music"></i> Celesta
                  </div>
                )}
                {shouldShowItem('Music Box') && (
                  <div className={`dropdown-item ${currentSoundType === 'music_box' ? 'active' : ''}`} onClick={() => setCurrentSoundType('music_box')}>
                    <i className="fas fa-music"></i> Music Box
                  </div>
                )}
                {shouldShowItem('Vibraphone') && (
                  <div className={`dropdown-item ${currentSoundType === 'vibraphone' ? 'active' : ''}`} onClick={() => setCurrentSoundType('vibraphone')}>
                    <i className="fas fa-music"></i> Vibraphone
                  </div>
                )}
                {shouldShowItem('Marimba') && (
                  <div className={`dropdown-item ${currentSoundType === 'marimba' ? 'active' : ''}`} onClick={() => setCurrentSoundType('marimba')}>
                    <i className="fas fa-music"></i> Marimba
                  </div>
                )}
                {shouldShowItem('Glockenspiel') && (
                  <div className={`dropdown-item ${currentSoundType === 'glockenspiel' ? 'active' : ''}`} onClick={() => setCurrentSoundType('glockenspiel')}>
                    <i className="fas fa-music"></i> Glockenspiel
                  </div>
                )}
                {shouldShowItem('Kalimba') && (
                  <div className={`dropdown-item ${currentSoundType === 'kalimba' ? 'active' : ''}`} onClick={() => setCurrentSoundType('kalimba')}>
                    <i className="fas fa-music"></i> Kalimba
                  </div>
                )}
                {shouldShowItem('Dulcimer') && (
                  <div className={`dropdown-item ${currentSoundType === 'dulcimer' ? 'active' : ''}`} onClick={() => setCurrentSoundType('dulcimer')}>
                    <i className="fas fa-music"></i> Dulcimer
                  </div>
                )}

                <div className="dropdown-separator"></div>

                {/* ORGANS */}
                {shouldShowCategory('Organs') && <div className="dropdown-category-header">Organs</div>}
                {shouldShowItem('Organ') && (
                  <div className={`dropdown-item ${currentSoundType === 'organ' ? 'active' : ''}`} onClick={() => setCurrentSoundType('organ')}>
                    <i className="fas fa-church"></i> Organ
                  </div>
                )}
                {shouldShowItem('Reed Organ') && (
                  <div className={`dropdown-item ${currentSoundType === 'reed_organ' ? 'active' : ''}`} onClick={() => setCurrentSoundType('reed_organ')}>
                    <i className="fas fa-music"></i> Reed Organ
                  </div>
                )}
                {shouldShowItem('Rock Organ') && (
                  <div className={`dropdown-item ${currentSoundType === 'rock_organ' ? 'active' : ''}`} onClick={() => setCurrentSoundType('rock_organ')}>
                    <i className="fas fa-music"></i> Rock Organ
                  </div>
                )}
                {shouldShowItem('Percussive Organ') && (
                  <div className={`dropdown-item ${currentSoundType === 'percussive_organ' ? 'active' : ''}`} onClick={() => setCurrentSoundType('percussive_organ')}>
                    <i className="fas fa-music"></i> Percussive Organ
                  </div>
                )}
                {shouldShowItem('Church Organ') && (
                  <div className={`dropdown-item ${currentSoundType === 'church_organ' ? 'active' : ''}`} onClick={() => setCurrentSoundType('church_organ')}>
                    <i className="fas fa-church"></i> Church Organ
                  </div>
                )}
                {shouldShowItem('Drawbar Organ') && (
                  <div className={`dropdown-item ${currentSoundType === 'drawbar_organ' ? 'active' : ''}`} onClick={() => setCurrentSoundType('drawbar_organ')}>
                    <i className="fas fa-music"></i> Drawbar Organ
                  </div>
                )}

                <div className="dropdown-separator"></div>

                {/* SYNTHS */}
                {shouldShowCategory('Synths') && <div className="dropdown-category-header">Synths</div>}
                {shouldShowItem('Synth') && (
                <div className="dropdown-item" onClick={() => setCurrentSoundType('synth')}>
                  <i className="fas fa-wave-square"></i> Synth {currentSoundType === 'synth' ? '(Active)' : ''}
                </div>
                )}
                {shouldShowItem('Synth 2') && (
                <div className="dropdown-item" onClick={() => setCurrentSoundType('synth2')}>
                  <i className="fas fa-wave-square"></i> Synth 2 {currentSoundType === 'synth2' ? '(Active)' : ''}
                </div>
                )}
                {shouldShowItem('Synth 3') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('synth3')}>
                    <i className="fas fa-wave-square"></i> Synth 3 {currentSoundType === 'synth3' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Synth 4') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('synth4')}>
                    <i className="fas fa-wave-square"></i> Synth 4 {currentSoundType === 'synth4' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Synth 5') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('synth5')}>
                    <i className="fas fa-wave-square"></i> Synth 5 {currentSoundType === 'synth5' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Synth Choir') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('synth_choir')}>
                    <i className="fas fa-wave-square"></i> Synth Choir {currentSoundType === 'synth_choir' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Synth Drum') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('synth_drum')}>
                    <i className="fas fa-drum"></i> Synth Drum {currentSoundType === 'synth_drum' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Synth Strings 1') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('synth_strings_1')}>
                    <i className="fas fa-wave-square"></i> Synth Strings 1 {currentSoundType === 'synth_strings_1' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Synth Strings 2') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('synth_strings_2')}>
                    <i className="fas fa-wave-square"></i> Synth Strings 2 {currentSoundType === 'synth_strings_2' ? '(Active)' : ''}
                  </div>
                )}

                {/* SYNTH LEADS */}
                {shouldShowCategory('Synth Leads') && <div className="dropdown-category-header">Synth Leads</div>}
                {shouldShowItem('Lead 1 Square') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('lead_1_square')}>
                    <i className="fas fa-wave-square"></i> Lead 1 Square {currentSoundType === 'lead_1_square' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Lead 2 Sawtooth') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('lead_2_sawtooth')}>
                    <i className="fas fa-wave-square"></i> Lead 2 Sawtooth {currentSoundType === 'lead_2_sawtooth' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Lead 3 Calliope') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('lead_3_calliope')}>
                    <i className="fas fa-wave-square"></i> Lead 3 Calliope {currentSoundType === 'lead_3_calliope' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Lead 4 Chiff') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('lead_4_chiff')}>
                    <i className="fas fa-wave-square"></i> Lead 4 Chiff {currentSoundType === 'lead_4_chiff' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Lead 5 Charang') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('lead_5_charang')}>
                    <i className="fas fa-wave-square"></i> Lead 5 Charang {currentSoundType === 'lead_5_charang' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Lead 6 Voice') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('lead_6_voice')}>
                    <i className="fas fa-wave-square"></i> Lead 6 Voice {currentSoundType === 'lead_6_voice' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Lead 7 Fifths') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('lead_7_fifths')}>
                    <i className="fas fa-wave-square"></i> Lead 7 Fifths {currentSoundType === 'lead_7_fifths' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Lead 8 Bass Lead') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('lead_8_bass_lead')}>
                    <i className="fas fa-wave-square"></i> Lead 8 Bass Lead {currentSoundType === 'lead_8_bass_lead' ? '(Active)' : ''}
                  </div>
                )}

                {/* SYNTH PADS */}
                {shouldShowCategory('Synth Pads') && <div className="dropdown-category-header">Synth Pads</div>}
                {shouldShowItem('Pad 1 New Age') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('pad_1_new_age')}>
                    <i className="fas fa-wave-square"></i> Pad 1 New Age {currentSoundType === 'pad_1_new_age' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Pad 2 Warm') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('pad_2_warm')}>
                    <i className="fas fa-wave-square"></i> Pad 2 Warm {currentSoundType === 'pad_2_warm' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Pad 3 Polysynth') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('pad_3_polysynth')}>
                    <i className="fas fa-wave-square"></i> Pad 3 Polysynth {currentSoundType === 'pad_3_polysynth' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Pad 4 Choir') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('pad_4_choir')}>
                    <i className="fas fa-wave-square"></i> Pad 4 Choir {currentSoundType === 'pad_4_choir' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Pad 5 Bowed') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('pad_5_bowed')}>
                    <i className="fas fa-wave-square"></i> Pad 5 Bowed {currentSoundType === 'pad_5_bowed' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Pad 6 Metallic') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('pad_6_metallic')}>
                    <i className="fas fa-wave-square"></i> Pad 6 Metallic {currentSoundType === 'pad_6_metallic' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Pad 7 Halo') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('pad_7_halo')}>
                    <i className="fas fa-wave-square"></i> Pad 7 Halo {currentSoundType === 'pad_7_halo' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Pad 8 Sweep') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('pad_8_sweep')}>
                    <i className="fas fa-wave-square"></i> Pad 8 Sweep {currentSoundType === 'pad_8_sweep' ? '(Active)' : ''}
                  </div>
                )}

                <div className="dropdown-separator"></div>

                {/* GUITARS */}
                {shouldShowCategory('Guitars') && <div className="dropdown-category-header">Guitars</div>}
                {shouldShowItem('Guitar') && (
                  <div className={`dropdown-item ${currentSoundType === 'guitar' ? 'active' : ''}`} onClick={() => setCurrentSoundType('guitar')}>
                    <i className="fas fa-guitar"></i> Guitar
                  </div>
                )}
                {shouldShowItem('Clean Electric Guitar') && (
                  <div className={`dropdown-item ${currentSoundType === 'clean_e_guitar' ? 'active' : ''}`} onClick={() => setCurrentSoundType('clean_e_guitar')}>
                    <i className="fas fa-guitar"></i> Clean Electric Guitar
                  </div>
                )}
                {shouldShowItem('Electric Guitar Clean') && (
                  <div className={`dropdown-item ${currentSoundType === 'electric_guitar_clean' ? 'active' : ''}`} onClick={() => setCurrentSoundType('electric_guitar_clean')}>
                    <i className="fas fa-guitar"></i> Electric Guitar Clean
                  </div>
                )}
                {shouldShowItem('Electric Guitar Jazz') && (
                  <div className={`dropdown-item ${currentSoundType === 'electric_guitar_jazz' ? 'active' : ''}`} onClick={() => setCurrentSoundType('electric_guitar_jazz')}>
                    <i className="fas fa-guitar"></i> Electric Guitar Jazz
                  </div>
                )}
                {shouldShowItem('Electric Guitar Muted') && (
                  <div className={`dropdown-item ${currentSoundType === 'electric_guitar_muted' ? 'active' : ''}`} onClick={() => setCurrentSoundType('electric_guitar_muted')}>
                    <i className="fas fa-guitar"></i> Electric Guitar Muted
                  </div>
                )}
                {shouldShowItem('Distortion Guitar') && (
                  <div className={`dropdown-item ${currentSoundType === 'distortion_guitar' ? 'active' : ''}`} onClick={() => setCurrentSoundType('distortion_guitar')}>
                    <i className="fas fa-guitar"></i> Distortion Guitar
                  </div>
                )}
                {shouldShowItem('Overdriven Guitar') && (
                  <div className={`dropdown-item ${currentSoundType === 'overdriven_guitar' ? 'active' : ''}`} onClick={() => setCurrentSoundType('overdriven_guitar')}>
                    <i className="fas fa-guitar"></i> Overdriven Guitar
                  </div>
                )}
                {shouldShowItem('Acoustic Guitar Nylon') && (
                  <div className={`dropdown-item ${currentSoundType === 'acoustic_guitar_nylon' ? 'active' : ''}`} onClick={() => setCurrentSoundType('acoustic_guitar_nylon')}>
                    <i className="fas fa-guitar"></i> Acoustic Guitar Nylon
                  </div>
                )}
                {shouldShowItem('Acoustic Guitar Steel') && (
                  <div className={`dropdown-item ${currentSoundType === 'acoustic_guitar_steel' ? 'active' : ''}`} onClick={() => setCurrentSoundType('acoustic_guitar_steel')}>
                    <i className="fas fa-guitar"></i> Acoustic Guitar Steel
                  </div>
                )}
                {shouldShowItem('Guitar Harmonics') && (
                  <div className={`dropdown-item ${currentSoundType === 'guitar_harmonics' ? 'active' : ''}`} onClick={() => setCurrentSoundType('guitar_harmonics')}>
                    <i className="fas fa-guitar"></i> Guitar Harmonics
                  </div>
                )}
                {shouldShowItem('Banjo') && (
                  <div className={`dropdown-item ${currentSoundType === 'banjo' ? 'active' : ''}`} onClick={() => setCurrentSoundType('banjo')}>
                    <i className="fas fa-guitar"></i> Banjo
                  </div>
                )}

                <div className="dropdown-separator"></div>

                {/* BASS */}
                <div className="dropdown-category-header">Bass</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('slap_bass_2')}>
                  <i className="fas fa-music"></i> Slap Bass 2 {currentSoundType === 'slap_bass_2' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('electric_bass_pick')}>
                  <i className="fas fa-music"></i> Electric Bass Pick {currentSoundType === 'electric_bass_pick' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('acoustic_bass')}>
                  <i className="fas fa-music"></i> Acoustic Bass {currentSoundType === 'acoustic_bass' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fretless_bass')}>
                  <i className="fas fa-music"></i> Fretless Bass {currentSoundType === 'fretless_bass' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* WOODWINDS */}
                <div className="dropdown-category-header">Woodwinds</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('flute')}>
                  <i className="fas fa-music"></i> Flute {currentSoundType === 'flute' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('alto_sax')}>
                  <i className="fas fa-music"></i> Alto Sax {currentSoundType === 'alto_sax' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('baritone_sax')}>
                  <i className="fas fa-music"></i> Baritone Sax {currentSoundType === 'baritone_sax' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('bassoon')}>
                  <i className="fas fa-music"></i> Bassoon {currentSoundType === 'bassoon' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('pan_flute')}>
                  <i className="fas fa-music"></i> Pan Flute {currentSoundType === 'pan_flute' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('ocarina')}>
                  <i className="fas fa-music"></i> Ocarina {currentSoundType === 'ocarina' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* BRASS */}
                {shouldShowCategory('Brass') && <div className="dropdown-category-header">Brass</div>}
                {shouldShowItem('Trumpet') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('trumpet')}>
                    <i className="fas fa-music"></i> Trumpet {currentSoundType === 'trumpet' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Muted Trumpet') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('muted_trumpet')}>
                    <i className="fas fa-music"></i> Muted Trumpet {currentSoundType === 'muted_trumpet' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('French Horn') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('french_horn')}>
                    <i className="fas fa-music"></i> French Horn {currentSoundType === 'french_horn' ? '(Active)' : ''}
                  </div>
                )}
                {shouldShowItem('Brass Section') && (
                  <div className="dropdown-item" onClick={() => setCurrentSoundType('brass_section')}>
                    <i className="fas fa-music"></i> Brass Section {currentSoundType === 'brass_section' ? '(Active)' : ''}
                  </div>
                )}

                <div className="dropdown-separator"></div>

                {/* STRINGS */}
                <div className="dropdown-category-header">Strings</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('violin')}>
                  <i className="fas fa-music"></i> Violin {currentSoundType === 'violin' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('harp')}>
                  <i className="fas fa-music"></i> Harp {currentSoundType === 'harp' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* PERCUSSION */}
                <div className="dropdown-category-header">Percussion</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('timpani')}>
                  <i className="fas fa-drum"></i> Timpani {currentSoundType === 'timpani' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('taiko_drum')}>
                  <i className="fas fa-drum"></i> Taiko Drum {currentSoundType === 'taiko_drum' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('tinkle_bell')}>
                  <i className="fas fa-bell"></i> Tinkle Bell {currentSoundType === 'tinkle_bell' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* WORLD/FOLK */}
                <div className="dropdown-category-header">World/Folk</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('shakuhachi')}>
                  <i className="fas fa-music"></i> Shakuhachi {currentSoundType === 'shakuhachi' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('shamisen')}>
                  <i className="fas fa-music"></i> Shamisen {currentSoundType === 'shamisen' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('shanai')}>
                  <i className="fas fa-music"></i> Shanai {currentSoundType === 'shanai' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('steel_drums')}>
                  <i className="fas fa-music"></i> Steel Drums {currentSoundType === 'steel_drums' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('tango_accordion')}>
                  <i className="fas fa-music"></i> Tango Accordion {currentSoundType === 'tango_accordion' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('accordion')}>
                  <i className="fas fa-music"></i> Accordion {currentSoundType === 'accordion' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('bagpipe')}>
                  <i className="fas fa-music"></i> Bagpipe {currentSoundType === 'bagpipe' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('koto')}>
                  <i className="fas fa-music"></i> Koto {currentSoundType === 'koto' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* CHOIR/VOCAL */}
                <div className="dropdown-category-header">Choir/Vocal</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('choir')}>
                  <i className="fas fa-users"></i> Choir {currentSoundType === 'choir' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('choir_aahs')}>
                  <i className="fas fa-users"></i> Choir Aahs {currentSoundType === 'choir_aahs' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('voice_oohs')}>
                  <i className="fas fa-microphone"></i> Voice Oohs {currentSoundType === 'voice_oohs' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* EFFECTS */}
                <div className="dropdown-category-header">Effects</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_1_rain')}>
                  <i className="fas fa-cloud-rain"></i> FX 1 Rain {currentSoundType === 'fx_1_rain' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_3_crystal')}>
                  <i className="fas fa-gem"></i> FX 3 Crystal {currentSoundType === 'fx_3_crystal' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_4_atmosphere')}>
                  <i className="fas fa-cloud"></i> FX 4 Atmosphere {currentSoundType === 'fx_4_atmosphere' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_5_brightness')}>
                  <i className="fas fa-sun"></i> FX 5 Brightness {currentSoundType === 'fx_5_brightness' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_6_goblins')}>
                  <i className="fas fa-ghost"></i> FX 6 Goblins {currentSoundType === 'fx_6_goblins' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_7_echoes')}>
                  <i className="fas fa-volume-up"></i> FX 7 Echoes {currentSoundType === 'fx_7_echoes' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_8_scifi')}>
                  <i className="fas fa-rocket"></i> FX 8 Sci-Fi {currentSoundType === 'fx_8_scifi' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('helicopter')}>
                  <i className="fas fa-helicopter"></i> Helicopter {currentSoundType === 'helicopter' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('orchestra_hit')}>
                  <i className="fas fa-music"></i> Orchestra Hit {currentSoundType === 'orchestra_hit' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('blown_bottle')}>
                  <i className="fas fa-wine-bottle"></i> Blown Bottle {currentSoundType === 'blown_bottle' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('breath_noise')}>
                  <i className="fas fa-wind"></i> Breath Noise {currentSoundType === 'breath_noise' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* FUN */}
                <div className="dropdown-category-header">Fun</div>

                <div className="dropdown-separator"></div>

                {/* STRINGS */}
                <div className="dropdown-category-header">Strings</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('violin')}>
                  <i className="fas fa-music"></i> Violin {currentSoundType === 'violin' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('harp')}>
                  <i className="fas fa-music"></i> Harp {currentSoundType === 'harp' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* PERCUSSION */}
                <div className="dropdown-category-header">Percussion</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('timpani')}>
                  <i className="fas fa-drum"></i> Timpani {currentSoundType === 'timpani' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('taiko_drum')}>
                  <i className="fas fa-drum"></i> Taiko Drum {currentSoundType === 'taiko_drum' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('tinkle_bell')}>
                  <i className="fas fa-bell"></i> Tinkle Bell {currentSoundType === 'tinkle_bell' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* WORLD/FOLK */}
                <div className="dropdown-category-header">World/Folk</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('shakuhachi')}>
                  <i className="fas fa-music"></i> Shakuhachi {currentSoundType === 'shakuhachi' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('shamisen')}>
                  <i className="fas fa-music"></i> Shamisen {currentSoundType === 'shamisen' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('shanai')}>
                  <i className="fas fa-music"></i> Shanai {currentSoundType === 'shanai' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('steel_drums')}>
                  <i className="fas fa-music"></i> Steel Drums {currentSoundType === 'steel_drums' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('tango_accordion')}>
                  <i className="fas fa-music"></i> Tango Accordion {currentSoundType === 'tango_accordion' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('accordion')}>
                  <i className="fas fa-music"></i> Accordion {currentSoundType === 'accordion' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('bagpipe')}>
                  <i className="fas fa-music"></i> Bagpipe {currentSoundType === 'bagpipe' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('koto')}>
                  <i className="fas fa-music"></i> Koto {currentSoundType === 'koto' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* CHOIR/VOCAL */}
                <div className="dropdown-category-header">Choir/Vocal</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('choir')}>
                  <i className="fas fa-users"></i> Choir {currentSoundType === 'choir' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('choir_aahs')}>
                  <i className="fas fa-users"></i> Choir Aahs {currentSoundType === 'choir_aahs' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('voice_oohs')}>
                  <i className="fas fa-microphone"></i> Voice Oohs {currentSoundType === 'voice_oohs' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* EFFECTS */}
                <div className="dropdown-category-header">Effects</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_1_rain')}>
                  <i className="fas fa-cloud-rain"></i> FX 1 Rain {currentSoundType === 'fx_1_rain' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_3_crystal')}>
                  <i className="fas fa-gem"></i> FX 3 Crystal {currentSoundType === 'fx_3_crystal' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_4_atmosphere')}>
                  <i className="fas fa-cloud"></i> FX 4 Atmosphere {currentSoundType === 'fx_4_atmosphere' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_5_brightness')}>
                  <i className="fas fa-sun"></i> FX 5 Brightness {currentSoundType === 'fx_5_brightness' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_6_goblins')}>
                  <i className="fas fa-ghost"></i> FX 6 Goblins {currentSoundType === 'fx_6_goblins' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_7_echoes')}>
                  <i className="fas fa-volume-up"></i> FX 7 Echoes {currentSoundType === 'fx_7_echoes' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fx_8_scifi')}>
                  <i className="fas fa-rocket"></i> FX 8 Sci-Fi {currentSoundType === 'fx_8_scifi' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('helicopter')}>
                  <i className="fas fa-helicopter"></i> Helicopter {currentSoundType === 'helicopter' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('orchestra_hit')}>
                  <i className="fas fa-music"></i> Orchestra Hit {currentSoundType === 'orchestra_hit' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('blown_bottle')}>
                  <i className="fas fa-wine-bottle"></i> Blown Bottle {currentSoundType === 'blown_bottle' ? '(Active)' : ''}
                </div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('breath_noise')}>
                  <i className="fas fa-wind"></i> Breath Noise {currentSoundType === 'breath_noise' ? '(Active)' : ''}
                </div>

                <div className="dropdown-separator"></div>

                {/* FUN */}
                <div className="dropdown-category-header">Fun</div>
                <div className="dropdown-item" onClick={() => setCurrentSoundType('fart_kit')}>
                  <i className="fas fa-poo"></i> Fart Kit {currentSoundType === 'fart_kit' ? '(Active)' : ''}
                </div>
              </div>
            )}
          </div>

          {/* View Section - Now a Dropdown */}
          <div className="header-section view-section" ref={viewButtonRef}>
            <button 
              className={`section-toggle view-dropdown-toggle ${isViewDropdownOpen ? 'active' : ''}`}
              onClick={toggleViewDropdown}
            >
              View
            </button>
            {isViewDropdownOpen && (
              <div className="view-dropdown-menu">
                <div className="dropdown-item" onClick={() => handleViewItemClick(() => setShowGrid(!showGrid))}>
                  <i className="fas fa-th-large"></i> Grid {showGrid ? '(On)' : '(Off)'}
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(() => setIsSnapToGridActive(!isSnapToGridActive))}>
                  <i className="fas fa-magnet"></i> Snap {isSnapToGridActive ? '(On)' : '(Off)'}
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(() => setIsToolbarVisible(!isToolbarVisible))}>
                  <i className={`fas ${isToolbarVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i> Toolbar {isToolbarVisible ? '(Visible)' : '(Hidden)'}
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(togglePianoFullscreen)}>
                  <i className={`fas ${isPianoFullscreen ? 'fa-compress-arrows-alt' : 'fa-expand-arrows-alt'}`}></i> Piano Fullscreen {isPianoFullscreen ? '(On)' : '(Off)'}
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(toggleBrowserFullscreen)}>
                  <i className={`fas ${isBrowserFullscreen ? 'fa-compress' : 'fa-expand'}`}></i> Browser Fullscreen {isBrowserFullscreen ? '(On)' : '(Off)'}
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(() => setShowScaleHighlight(!showScaleHighlight))}>
                  <i className="fas fa-highlighter"></i> Scale Highlight {showScaleHighlight ? '(On)' : '(Off)'}
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(() => setShowNoteNames(!showNoteNames))}>
                  <i className="fas fa-text-height"></i> Note Names {showNoteNames ? '(On)' : '(Off)'}
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(onToggleSheetMusic)}>
                  <i className="fas fa-file-alt"></i> Sheet Music {showSheetMusic ? '(On)' : '(Off)'}
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(onToggleSideBySide)}>
                  <i className="fas fa-columns"></i> Side by Side {showSideBySide ? '(On)' : '(Off)'}
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(onToggleJsonView)}>
                  <i className="fas fa-code"></i> JSON View {showJsonView ? '(On)' : '(Off)'}
                </div>
                <div className="dropdown-separator"></div>
                <div className="slider-item">
                  <i className="fas fa-search"></i>
                  <span>Zoom Level</span>
                  <input
                    type="range"
                    min="0.25"
                    max="2"
                    step="0.05"
                    value={zoomLevel}
                    onChange={(e) => onZoomChange(Number(e.target.value))}
                    className="style-slider"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="slider-value">{Math.round(zoomLevel * 100)}%</span>
                </div>
                <div className="dropdown-item" onClick={() => handleViewItemClick(onZoomReset)}>
                  <i className="fas fa-refresh"></i> Reset Zoom (100%)
                </div>
                <div className="dropdown-separator"></div>
                <div className="slider-item">
                  <i className="fas fa-clock"></i>
                  <span>Note Size</span>
                  <input
                    type="range"
                    min="0.2"
                    max="2"
                    step="0.05"
                    value={durationScale || 1}
                    onChange={(e) => onDurationScaleChange(Number(e.target.value))}
                    className="style-slider"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="slider-value">{durationScale ? (durationScale * 100).toFixed(0) + '%' : '100%'}</span>
                </div>
                {showScaleHighlight && (
                  <>
                    <div className="dropdown-item non-clickable">
                      <select 
                        value={selectedScale} 
                        onChange={(e) => setSelectedScale(e.target.value)} 
                        className="header-dropdown-select" 
                        title="Scale Type for Highlight"
                        onClick={(e) => e.stopPropagation()} // Prevent closing dropdown
                      >
                        {/* Assuming scaleNames is available or passed in; for now, using a common example */} 
                        {Object.entries(scaleNames || {}).map(([value, label]) => (
                           <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="dropdown-item non-clickable">
                      <select 
                        value={selectedKey} 
                        onChange={(e) => setSelectedKey(e.target.value)} 
                        className="header-dropdown-select" 
                        title="Key for Highlight" 
                        disabled={selectedScale === 'chromatic' || selectedScale?.endsWith('Arp')}
                        onClick={(e) => e.stopPropagation()} // Prevent closing dropdown
                      >
                        {/* Assuming keys is available or passed in; for now, using a common example */}
                        {Object.keys(keys || {}).map((key) => (
                          <option key={key} value={key}>{key}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Save Section - New Addition */}
          <div className="header-section save-section" ref={saveButtonRef}>
            <button 
              className={`section-toggle save-dropdown-toggle ${isSaveDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsSaveDropdownOpen(!isSaveDropdownOpen)}
            >
              Save
            </button>
            {isSaveDropdownOpen && (
              <div className="save-dropdown-menu" ref={saveDropdownRef}>
                <div className="dropdown-item" onClick={() => {
                  onSave();
                  setIsSaveDropdownOpen(false);
                }}>
                  <i className="fas fa-music"></i>
                  Save as MIDI
                </div>
                <div className="dropdown-item" onClick={() => {
                  onSaveMusicXml();
                  setIsSaveDropdownOpen(false);
                }}>
                  <i className="fas fa-file-alt"></i>
                  Save as MusicXML
                </div>
                <div className="dropdown-separator"></div>
                <div className="dropdown-item" onClick={() => {
                  handleVideoExportClick();
                  setIsSaveDropdownOpen(false);
                }}>
                  <i className="fas fa-video"></i>
                  Export as MP4 Video
                </div>
              </div>
            )}
          </div>


        </div>
      </div>

      {/* Big Save Button - Top Right */}
      <button 
        className={`big-save-btn ${isDirty ? 'dirty' : 'saved'} ${isManuallySaving ? 'saving' : ''}`}
        onClick={onManualCloudSave}
        disabled={isManuallySaving || !isDirty}
        title={getSaveButtonTooltip()}
      >
        {isManuallySaving ? 'Saving...' : (isDirty ? 'Save' : 'Saved')}
      </button>

          {showSuccessPopup && (
            <div className="success-popup">
              Project saved successfully!
            </div>
          )}

          {/* Video Export Dialog */}
          {showVideoExportDialog && (
            <div className="modal-overlay">
              <div className="modal video-export-modal">
                <h3>Export as MP4 Video</h3>
                <p>Choose your export preset:</p>
                <div className="video-preset-options">
                  <button 
                    className="preset-btn minimal"
                    onClick={() => handleVideoExportConfirm('minimal')}
                  >
                    <i className="fas fa-video"></i>
                    <div className="preset-info">
                      <strong>Minimal</strong>
                      <span>Clean notes + keyboard only</span>
                    </div>
                  </button>
                  <button 
                    className="preset-btn cinematic"
                    onClick={() => handleVideoExportConfirm('cinematic')}
                  >
                    <i className="fas fa-star"></i>
                    <div className="preset-info">
                      <strong>Cinematic</strong>
                      <span>With background & effects</span>
                    </div>
                  </button>
                </div>
                <div className="modal-buttons">
                  <button onClick={() => setShowVideoExportDialog(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Recording Progress Overlay */}
          {isRecording && (
            <div className="recording-overlay">
              <div className="recording-controls">
                <div className="recording-status">
                  <i className="fas fa-circle recording-indicator"></i>
                  <span>Recording Video... {Math.round(recordingProgress)}%</span>
                </div>
                <div className="recording-progress-bar">
                  <div 
                    className="recording-progress-fill"
                    style={{ width: `${recordingProgress}%` }}
                  ></div>
                </div>
                <button 
                  className="cancel-recording-btn"
                  onClick={onCancelRecording}
                >
                  Cancel Recording
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HeaderBar; 