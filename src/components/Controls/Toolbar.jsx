import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Toolbar.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { v4 as uuidv4 } from 'uuid';
import { SketchPicker } from 'react-color';
import { chordTypes } from '../Data/chords';
import { scaleNames, keys, getScaleKeyName } from '../Data/scales';
import imageCompression from 'browser-image-compression';

const Toolbar = ({ 
  onQuantize,
  heightFactor,
  setHeightFactor,
  onUpdateMidiData,
  selectedDuration,
  setSelectedDuration,
  spacerDuration,
  setSpacerDuration,
  isSelectionToolActive,
  setIsSelectionToolActive,
  isAddNoteToolActive,
  setIsAddNoteToolActive,
  isSpacerToolActive,
  setIsSpacerToolActive,
  isAddChordToolActive,
  setIsAddChordToolActive,
  selectedChordType,
  setSelectedChordType,
  onSyncChords,
  isRunToolActive,
  setIsRunToolActive,
  runScale,
  onRunScaleChange,
  runKey,
  onRunKeyChange,
  customColors,
  onCustomColorsChange,
  isTextToolActive,
  setIsTextToolActive,
  backgroundImage,
  onBackgroundImageChange,
  hasSelection,
  setIsCursorInToolbar,
  onApplyHandColorToSelection,
  // ADDED: Edit control props
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDelete,
  canUndo,
  canRedo
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeHand, setActiveHand] = useState(null);
  const [tempColor, setTempColor] = useState(null);
  const colorPickerRef = useRef(null);

  // ADDED: State for background image options popup
  const [showBgImageOptions, setShowBgImageOptions] = useState(false);
  const bgImageOptionsPopupRef = useRef(null);

  // ADDED: Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                           (window.innerWidth <= 768 && 'ontouchstart' in window);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToolToggle = (toolSetterToActivate, currentToolState) => {
    const shouldActivateTool = !currentToolState;
    
    console.log('Tool toggle called:', { shouldActivateTool, currentToolState });

    if (shouldActivateTool) {
      // Deactivate all other tools first
      setIsSelectionToolActive(false);
      setIsAddNoteToolActive(false);
      setIsSpacerToolActive(false);
      setIsTextToolActive(false);
      setIsAddChordToolActive(false);
      setIsRunToolActive(false);
      
      // Then activate the selected tool
      toolSetterToActivate(true);
    } else {
      // Just deactivate the current tool
      toolSetterToActivate(false);
    }
  };

  const durations = [
    { value: 0.25, label: '1/16' },
    { value: 0.5, label: '1/8' },
    { value: 1, label: '1/4' },
    { value: 2, label: '1/2' },
    { value: 4, label: 'Whole' }
  ];

  const spacerDurations = [
    { value: 1, label: 'Whole' },
    { value: 0.5, label: '1/2' },
    { value: 0.25, label: '1/4' },
    { value: 0.125, label: '1/8' },
    { value: 0.0625, label: '1/16' },
    { value: -0.0625, label: '-1/16' },
    { value: -0.125, label: '-1/8' },
    { value: -0.25, label: '-1/4' },
    { value: -0.5, label: '-1/2' },
    { value: -1, label: '-Whole' }
  ];

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log(`[ImageUpload Toolbar] Original file: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)} MB, type: ${file.type}`);

      // Prevent re-upload if the selected file is the same as the current background (if backgroundImage is a File object or has a name)
      // This check is simplistic and might need adjustment if backgroundImage holds a URL.
      if (backgroundImage && typeof backgroundImage === 'object' && backgroundImage.name === file.name && backgroundImage.size === file.size) {
        console.log("[ImageUpload Toolbar] Selected file is the same as current background. Skipping upload.");
        e.target.value = null; // Clear the file input
        return;
      }

      const options = {
        maxSizeMB: 1,         
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp', 
        initialQuality: 0.8,    
        alwaysKeepResolution: false,
      };

      try {
        console.log("[ImageUpload Toolbar] Attempting to compress image...");
        const compressedFileBlob = await imageCompression(file, options);
        console.log(`[ImageUpload Toolbar] Compressed file size: ${(compressedFileBlob.size / 1024 / 1024).toFixed(2)} MB, type: ${compressedFileBlob.type}`);

        const reader = new FileReader();
        reader.onloadend = () => {
          onBackgroundImageChange(reader.result); // Pass base64 string to App.js
        };
        reader.readAsDataURL(compressedFileBlob);

      } catch (error) {
        console.error("[ImageUpload Toolbar] Error compressing image:", error);
        // Fallback: alert user and use original file directly if compression fails? 
        // For now, we prevent upload on error to avoid large files unknowingly.
        alert(`Error compressing image: ${error.message}. Please try a different image or a smaller one.`);
      }
      e.target.value = null; // Clear the file input after processing
    }
  };

  const handleColorPickerOpen = (hand) => {
    if (hasSelection) {
      // If notes are selected, apply the hand color directly
      // This will require a new prop or a modification to an existing one
      // For now, let's assume a new prop: onApplyHandColorToSelection(hand);
      if (onApplyHandColorToSelection) {
        onApplyHandColorToSelection(hand);
      }
    } else {
      // If no notes are selected, open the color picker for configuration
      setActiveHand(hand);
      setTempColor(hand === 'left' ? (customColors?.leftHand || '#ef4444') : (customColors?.rightHand || '#4287f5'));
      setShowColorPicker(true);
    }
  };

  // This function handles live color updates while picking but doesn't save to Firebase
  const handleColorChange = useCallback((colorResult) => {
    setTempColor(colorResult.hex);
  }, []);

  // This function explicitly saves the color when the user clicks Apply
  const handleApplyColor = useCallback(() => {
    if (!tempColor || !activeHand) return;
    
    const newColors = {
      ...(customColors || {}),
      leftHand: customColors?.leftHand || '#ef4444',
      rightHand: customColors?.rightHand || '#4287f5',
      [activeHand === 'left' ? 'leftHand' : 'rightHand']: tempColor
    };
    
    // Only call onCustomColorsChange once when user explicitly applies the color
    onCustomColorsChange(newColors);
    setShowColorPicker(false);
  }, [tempColor, activeHand, customColors, onCustomColorsChange]);



  // ADDED: Click handler for the main background image button
  const handleBgImageButtonClick = () => {
    if (backgroundImage) {
      setShowBgImageOptions(true);
    } else {
      document.getElementById('background-image-input').click();
    }
  };
  
  // ADDED: Effect to handle clicks outside the bg image options popup
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bgImageOptionsPopupRef.current && !bgImageOptionsPopupRef.current.contains(event.target)) {
        setShowBgImageOptions(false);
      }
    };
    if (showBgImageOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBgImageOptions]);

  return (
    <>
      <div 
        className="toolbar"
        onMouseEnter={() => setIsCursorInToolbar(true)}
        onMouseLeave={() => setIsCursorInToolbar(false)}
      >
        {/* Creation Tools */}
        <div className="toolbar-group">
          <button onClick={() => handleToolToggle(setIsAddNoteToolActive, isAddNoteToolActive)} className={`toolbar-button ${isAddNoteToolActive ? 'active' : ''}`} title="Add Note Tool (A)">
            Note
          </button>
          {isAddNoteToolActive && (
            <select value={selectedDuration} onChange={(e) => setSelectedDuration(parseFloat(e.target.value))} className="toolbar-select" title="Note Duration">
              {durations.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          )}
          
          <button onClick={() => handleToolToggle(setIsAddChordToolActive, isAddChordToolActive)} className={`toolbar-button ${isAddChordToolActive ? 'active' : ''}`} title="Add Chord Tool (C)">
            Chord
          </button>
          {isAddChordToolActive && (
            <>
              <select value={selectedChordType} onChange={(e) => setSelectedChordType(e.target.value)} className="toolbar-select" title="Chord Type">
                {chordTypes.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select value={selectedDuration} onChange={(e) => setSelectedDuration(parseFloat(e.target.value))} className="toolbar-select" title="Chord Note Duration">
                {durations.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </>
          )}
          
          <button onClick={() => handleToolToggle(setIsRunToolActive, isRunToolActive)} className={`toolbar-button ${isRunToolActive ? 'active' : ''}`} title="Run Tool (R)">
            Run
          </button>
          {isRunToolActive && (
            <>
              <select 
                value={runScale}
                onChange={(e) => onRunScaleChange(e.target.value)}
                className="toolbar-select" 
                title="Scale Type for Run"
              >
                {Object.entries(scaleNames).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {runScale !== 'chromatic' && !(runScale && runScale.endsWith('Arp')) && (
                <select 
                  value={runKey}
                  onChange={(e) => onRunKeyChange(e.target.value)}
                  className="toolbar-select" 
                  title="Key for Run"
                >
                  {Object.keys(keys).map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              )}
              <select value={selectedDuration} onChange={(e) => setSelectedDuration(parseFloat(e.target.value))} className="toolbar-select" title="Note Duration for Run">
                {durations.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </>
          )}
        </div>



        {/* Editing Tools */}
        <div className="toolbar-group">
          <button onClick={() => handleToolToggle(setIsSpacerToolActive, isSpacerToolActive)} className={`toolbar-button ${isSpacerToolActive ? 'active' : ''}`} title="Spacer Tool (P)">
            Space
          </button>
          {isSpacerToolActive && (
            <select value={spacerDuration} onChange={(e) => setSpacerDuration(parseFloat(e.target.value))} className="toolbar-select" title="Spacer Amount">
              {spacerDurations.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          )}

          <button onClick={() => handleToolToggle(setIsTextToolActive, isTextToolActive)} className={`toolbar-button ${isTextToolActive ? 'active' : ''}`} title="Text Tool (T)">
            Text
          </button>
          
          {/* Selection Tool - Mobile Only */}
          {isMobile && (
            <button onClick={() => handleToolToggle(setIsSelectionToolActive, isSelectionToolActive)} className={`toolbar-button ${isSelectionToolActive ? 'active' : ''}`} title="Selection Tool (S)">
              Box Select
            </button>
          )}
        </div>

        {/* Style Tools */}
        <div className="toolbar-group">
          <button 
            onClick={handleBgImageButtonClick} 
            title={backgroundImage ? "Manage Background Image" : "Upload Background Image"}
            className="toolbar-button"
          >
            Background
          </button>
          <input 
            id="background-image-input" 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload} 
            style={{ display: 'none' }}
          />
          
          <button
            onClick={() => handleColorPickerOpen('left')}
            className="toolbar-button"
            title="Left Hand Color"
          >
            Left
            <div 
              className="color-indicator"
              style={{ backgroundColor: customColors?.leftHand || '#ef4444' }}
            ></div>
          </button>

          <button
            onClick={() => handleColorPickerOpen('right')}
            className="toolbar-button"
            title="Right Hand Color"
          >
            Right
            <div 
              className="color-indicator"
              style={{ backgroundColor: customColors?.rightHand || '#4287f5' }}
            ></div>
          </button>
        </div>

        <div className="toolbar-group">
          <label className="toolbar-section-label">Grid & View</label>
          {/* Scale Highlight UI Removed */}
        </div>

        {/* Edit Controls - Moved to Right Side */}
        <div className="toolbar-group">
          <button 
            onClick={onUndo} 
            disabled={!canUndo} 
            className="toolbar-button"
            title="Undo (Ctrl+Z)"
          >
            <i className="fas fa-undo"></i>
          </button>
          <button 
            onClick={onRedo} 
            disabled={!canRedo} 
            className="toolbar-button"
            title="Redo (Ctrl+Y)"
          >
            <i className="fas fa-redo"></i>
          </button>
          <button 
            onClick={onCopy} 
            disabled={!hasSelection} 
            className="toolbar-button"
            title="Copy (Ctrl+C)"
          >
            <i className="fas fa-copy"></i>
          </button>
          <button 
            onClick={onPaste} 
            className="toolbar-button"
            title="Paste (Ctrl+V)"
          >
            <i className="fas fa-paste"></i>
          </button>
          <button 
            onClick={onDelete} 
            disabled={!hasSelection} 
            className="toolbar-button"
            title="Delete (Del)"
          >
            <i className="fas fa-trash"></i>
          </button>
        </div>
      </div>

      {/* Color Picker popup - moved outside the toolbar */}
      {showColorPicker && (
        <>
          <div className="color-picker-cover" onClick={() => {
            // Simply close without saving
            setShowColorPicker(false);
            // Reset tempColor to original
            setTempColor(activeHand === 'left' ? (customColors?.leftHand || '#ef4444') : (customColors?.rightHand || '#4287f5'));
          }} />
          <div className="color-picker-popup">
            <h4 style={{ color: 'white', margin: '0 0 8px 0', textAlign: 'center' }}>
              {activeHand === 'left' ? 'Left Hand Color' : 'Right Hand Color'}
            </h4>
            <SketchPicker
              color={tempColor || (activeHand === 'left' ? (customColors?.leftHand || '#ef4444') : (customColors?.rightHand || '#4287f5'))}
              onChange={handleColorChange}
              disableAlpha={true}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => {
                  const defaultColor = activeHand === 'left' ? '#ef4444' : '#4287f5';
                  setTempColor(defaultColor);
                }}
                className="toolbar-button"
                style={{ flex: 1 }}
                title="Reset to Default"
              >
                <i className="fas fa-undo"></i> Reset
              </button>
              <button
                onClick={() => {
                  handleApplyColor();
                }}
                className="toolbar-button"
                style={{ flex: 1, backgroundColor: '#4a90e2', color: 'white' }}
                title="Apply Color"
              >
                <i className="fas fa-check"></i> Apply
              </button>
            </div>
          </div>
        </>
      )}

      {/* Background Image Options Popup */}
      {showBgImageOptions && (
        <>
          <div className="popup-cover" onClick={() => setShowBgImageOptions(false)} />
          <div className="bg-image-options-popup" ref={bgImageOptionsPopupRef}>
            <h4 style={{ color: 'white', margin: '0 0 10px 0', textAlign: 'center' }}>Background Image</h4>
            <button
              onClick={() => {
                document.getElementById('background-image-input').click();
                setShowBgImageOptions(false);
              }}
              className="toolbar-button popup-option-button"
            >
              <i className="fas fa-sync-alt"></i> Change Image
            </button>
            <button
              onClick={() => {
                onBackgroundImageChange(null);
                setShowBgImageOptions(false);
              }}
              className="toolbar-button popup-option-button remove-button"
            >
              <i className="fas fa-trash-alt"></i> Remove Image
            </button>
            <button
              onClick={() => setShowBgImageOptions(false)}
              className="toolbar-button popup-option-button cancel-button"
              style={{marginTop: '5px'}}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default Toolbar;