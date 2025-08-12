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
  playbackSpeed,
  onSpeedChange,
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
}) => {
  // Fixed zoom slider implementation - old zoom in/out functions removed
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(projectName);
  const [showSpeedInput, setShowSpeedInput] = useState(false);
  const [tempSpeedInput, setTempSpeedInput] = useState(Math.round((playbackSpeed || 1) * 120));
  const [showTimeSignatureInput, setShowTimeSignatureInput] = useState(false);
  const [showTransposeInput, setShowTransposeInput] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  const [isTheoryDropdownOpen, setIsTheoryDropdownOpen] = useState(false);
  const theoryButtonRef = useRef(null);
  const speedPopupRef = useRef(null);
  const transposePopupRef = useRef(null);
  const timeSignaturePopupRef = useRef(null);
  const viewButtonRef = useRef(null);

  // Add state for custom time signature inputs
  const [customNumerator, setCustomNumerator] = useState(timeSignature.numerator);
  const [customDenominator, setCustomDenominator] = useState(timeSignature.denominator);
  const [timeSignatureError, setTimeSignatureError] = useState('');

  const commonTimeSignatures = [
    { numerator: 2, denominator: 4 },
    { numerator: 3, denominator: 4 },
    { numerator: 4, denominator: 4 },
    { numerator: 5, denominator: 4 },
    { numerator: 6, denominator: 4 },
    { numerator: 7, denominator: 4 },
    { numerator: 2, denominator: 2 },
    { numerator: 3, denominator: 2 },
    { numerator: 4, denominator: 2 },
    { numerator: 3, denominator: 8 },
    { numerator: 5, denominator: 8 },
    { numerator: 6, denominator: 8 },
    { numerator: 7, denominator: 8 },
    { numerator: 9, denominator: 8 },
    { numerator: 12, denominator: 8 },
  ];
  const commonSpeedInputValues = [60, 80, 100, 120, 140, 160, 180];

  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const styleButtonRef = useRef(null);
  const styleDropdownRef = useRef(null);

  // Video export states
  const [showVideoExportDialog, setShowVideoExportDialog] = useState(false);
  const videoExportButtonRef = useRef(null);

  const [speedInputValue, setSpeedInputValue] = useState(playbackSpeed.toString());
  const [isEditingSpeed, setIsEditingSpeed] = useState(false);
  
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
    setTempSpeedInput(Math.round((playbackSpeed || 1) * 120));
  }, [playbackSpeed]);

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
      onZoomReset, isMinimalMode, setIsMinimalMode]);

  const handleNameSubmit = () => {
    if (editedName.trim() && editedName !== projectName) {
      onProjectNameChange(editedName.trim());
    }
    setIsEditing(false);
  };

  const handleSpeedInputValueChange = (e) => {
    setTempSpeedInput(parseInt(e.target.value, 10) || 120);
  };

  const handleSpeedInputSubmit = () => {
    const clampedRawValue = Math.min(Math.max(tempSpeedInput, 1), 300);
    const newSpeed = clampedRawValue / 120;
    if (onSpeedChange && newSpeed !== playbackSpeed) {
      onSpeedChange(newSpeed);
    }
  };

  const handleSpeedInputFocus = (e) => {
    e.target.select();
  };

  const handleSpeedInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSpeedInputSubmit();
      e.target.blur();
    }
    if (e.key === 'Escape') {
        setShowSpeedInput(false);
        setTempSpeedInput(Math.round((playbackSpeed || 1) * 120));
    }
  };

  const handleSpeedPresetClick = (presetRawValue) => {
    setTempSpeedInput(presetRawValue);
    const newSpeed = presetRawValue / 120;
    if (onSpeedChange) {
      onSpeedChange(newSpeed);
    }
  };

  const currentTransposeTarget = transpositionTargets?.find(target => target.id === currentTransposeTargetId);
  const currentTransposeLabel = currentTransposeTarget?.label || 'Key';
  const currentTimeSignatureDisplay = `${timeSignature.numerator}/${timeSignature.denominator}`;

  const toggleTheoryDropdown = () => {
    const currentlyOpenPopup = showSpeedInput || showTransposeInput || showTimeSignatureInput;
    const isOpeningNewDropdown = !isTheoryDropdownOpen && !currentlyOpenPopup;

    // Always close all popups first when the main Theory button is clicked
    setShowSpeedInput(false);
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
    const isSpeedCurrentlyOpen = showSpeedInput;
    const isTransposeCurrentlyOpen = showTransposeInput;
    const isTimeSigCurrentlyOpen = showTimeSignatureInput;

    // Close all popups first
    setShowSpeedInput(false);
    setShowTransposeInput(false);
    setShowTimeSignatureInput(false);
    setIsTheoryDropdownOpen(false); // Always close the main dropdown menu

    // Now, open the intended one, but only if it wasn't the one already open
    // (if it was, the action of closing all above already handled it)
    if (controlType === 'speed' && !isSpeedCurrentlyOpen) {
      setShowSpeedInput(true);
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
          (!speedPopupRef.current || !speedPopupRef.current.contains(event.target)) &&
          (!transposePopupRef.current || !transposePopupRef.current.contains(event.target)) &&
          (!timeSignaturePopupRef.current || !timeSignaturePopupRef.current.contains(event.target));
        if (isClickOutsideTheoryPopups) {
          setIsTheoryDropdownOpen(false);
          setShowSpeedInput(false);
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
      
      // Individual theory popup outside click handling (if a popup is open and click is outside it, but not on theory button)
      if (showSpeedInput && speedPopupRef.current && !speedPopupRef.current.contains(event.target) && 
          (!theoryButtonRef.current || !theoryButtonRef.current.contains(event.target))) {
        setShowSpeedInput(false);
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
  }, [showSpeedInput, showTransposeInput, showTimeSignatureInput]);

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
      {/* Minimal mode toggle button - always visible, but fixed only in minimal mode */}
      {isMinimalMode && (
        <button 
          onClick={toggleMinimalMode}
          className="minimal-mode-btn active"
          title="Minimal Mode (On) (M)"
        >
          <i className="fas fa-compress-arrows-alt"></i>
        </button>
      )}

      {/* Play/Pause button - visible only in minimal mode */}
      {isMinimalMode && (
        <button 
          onClick={onPlayPauseToggle}
          className="minimal-play-btn"
          title={`${isPlaying ? 'Pause' : 'Play'} (Space)`}
        >
          <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
        </button>
      )}

      {/* Rest of header content - hidden in minimal mode */}
      {!isMinimalMode && (
        <>
          <button onClick={onBackClick} className="header-bar-back-button">
            ← Back
          </button>
          
          <div className="header-section theory-section" ref={theoryButtonRef}>
            <button 
              className={`section-toggle theory-dropdown-toggle ${isTheoryDropdownOpen ? 'active' : ''}`}
              onClick={toggleTheoryDropdown}
            >
              Theory
            </button>
            {isTheoryDropdownOpen && (
              <div className="theory-dropdown-menu">
                <div className="dropdown-item" onClick={() => handleTheoryControlToggle('speed')}>
                  <i className="fas fa-tachometer-alt"></i>
                  <span>Tempo: {Math.round(playbackSpeed * 120)}</span>
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
            {showSpeedInput && (
              <div className="control-popup speed-popup" ref={speedPopupRef}>
                <input 
                  type="number" 
                  min="1" 
                  max="300" 
                  value={tempSpeedInput} 
                  onChange={handleSpeedInputValueChange} 
                  onBlur={handleSpeedInputSubmit} 
                  onFocus={handleSpeedInputFocus} 
                  onKeyDown={handleSpeedInputKeyPress}
                  className="control-input" 
                  title="Enter Tempo (BPM)"
                  autoFocus
                />
                <div className="control-presets">
                  {commonSpeedInputValues.map(presetValue => (
                    <button 
                      key={presetValue} 
                      onClick={() => handleSpeedPresetClick(presetValue)} 
                      className={`control-preset-btn ${(presetValue / 120) === playbackSpeed ? 'active' : ''}`}
                    >
                      {presetValue}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showTransposeInput && (
              <div className="control-popup transpose-popup" ref={transposePopupRef}>
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
              <div className="control-popup time-signature-popup" ref={timeSignaturePopupRef}>
                <div className="control-options">
                  {commonTimeSignatures.map(ts => (
                    <button 
                      key={`${ts.numerator}/${ts.denominator}`}
                      className={`control-option-btn ${timeSignature.numerator === ts.numerator && timeSignature.denominator === ts.denominator ? 'active' : ''}`}
                      onClick={() => {
                        if (onTimeSignatureChange) {
                          onTimeSignatureChange(ts);
                        }
                        setShowTimeSignatureInput(false);
                      }}
                    >
                      {ts.numerator}/{ts.denominator}
                    </button>
                  ))}
                </div>
                <div className="custom-time-signature-input" style={{ marginTop: '10px', padding:'5px', borderTop: '1px solid #555' }}>
                  <h4 style={{margin: '5px 0', fontSize: '0.9em'}}>Custom:</h4>
                  <input
                    type="number"
                    value={customNumerator}
                    onChange={(e) => setCustomNumerator(e.target.value)}
                    min="1"
                    max="16"
                    className="control-input"
                    style={{ width: '50px', marginRight: '5px', textAlign: 'center' }}
                  />
                  /
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
                <div className="dropdown-separator"></div>
                <button className="reset-styles-btn" onClick={onResetStyles}>
                  Reset to Default
                </button>
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

          {/* Edit Controls Section - Remains to the right */}
          <div className="header-section edit-controls-section">
            <div className="header-separator"></div>
            <div className="edit-controls">
              <button 
                onClick={onUndo} 
                disabled={!canUndo} 
                className="header-control-btn"
                title="Undo (Ctrl+Z)"
              >
                <i className="fas fa-undo"></i>
              </button>
              <button 
                onClick={onRedo} 
                disabled={!canRedo} 
                className="header-control-btn"
                title="Redo (Ctrl+Y)"
              >
                <i className="fas fa-redo"></i>
              </button>
              <button 
                onClick={onCopy} 
                disabled={!hasSelection} 
                className="header-control-btn"
                title="Copy (Ctrl+C)"
              >
                <i className="fas fa-copy"></i>
              </button>
              <button 
                onClick={onPaste} 
                className="header-control-btn"
                title="Paste (Ctrl+V)"
              >
                <i className="fas fa-paste"></i>
              </button>
              <button 
                onClick={onDelete} 
                disabled={!hasSelection} 
                className="header-control-btn"
                title="Delete (Del)"
              >
                <i className="fas fa-trash"></i>
              </button>
              <div className="header-separator"></div>
              <button 
                onClick={handleVideoExportClick}
                disabled={isRecording}
                className="header-control-btn video-export-btn"
                title="Export as MP4 Video"
              >
                <i className="fas fa-video"></i>
              </button>
              <button 
                onClick={toggleMinimalMode}
                className={`minimal-mode-btn headerbar-placement`}
                title={`Minimal Mode (Off) (M)`}
                style={{ position: 'static', marginLeft: 8 }}
              >
                <i className="fas fa-compress-arrows-alt"></i>
              </button>
              <button 
                className={`save-cloud-btn ${isDirty ? 'dirty' : 'saved'} ${isManuallySaving ? 'saving' : ''}`}
                onClick={onManualCloudSave}
                disabled={isManuallySaving || !isDirty}
                title={getSaveButtonTooltip()}
              >
                {isManuallySaving ? 'Saving...' : (isDirty ? 'Save' : 'Saved')}
              </button>
            </div>
          </div>

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