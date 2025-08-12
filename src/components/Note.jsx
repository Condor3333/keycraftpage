import React, { useState, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import './Note.css';
//useRef persists across renders
//Drag and Resize use useRef 
//useRef has .current property that holds mutable value between renders
//Initial note value and mouse position are stored in .current in order to calculate deltaX and deltaY
//Fixed reference point that should not change during dragging animation, that is why we use useRef


//Manipulate Hex with three basic colors R, G and B
//parseInt converts hex string to decimal
//R, G and B are decimal values between 0 and 255
//percent is the amount to adjust the color by
//R, G and B are adjusted by the percent and then clamped to be within 0-255
//RR, GG and BB are converted back to hex
//return "#RRGGBB"
const shadeColor = (color, percent) => {
  if (!color) return null;

  // 1. Take hex color (like '#ff0000') and split into R,G,B components
  let R = parseInt(color.substring(1,3),16);
  let G = parseInt(color.substring(3,5),16);
  let B = parseInt(color.substring(5,7),16);


  // 2. Adjust each component by the percentage
  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);

  // 3. Make sure values stay between 0-255
  R = (R<255)?R:255;  
  G = (G<255)?G:255;  
  B = (B<255)?B:255;  

  // 4. Convert back to hex, ensuring 2 digits
  const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
  const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
  const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

  // 5. Combine back into hex color
  return "#"+RR+GG+BB;
};

const getShade = (isBlack, groupColor, isLeftHand, customColors) => {
  if (groupColor) {
    // Make grouped notes darker
    return isBlack ? 
      shadeColor(groupColor, -40) : // 40% darker for black keys
      shadeColor(groupColor, -25);  // 25% darker for white keys
  }
  
  // Use custom colors if available, otherwise use darker default colors
  //  optional chaining ?. checks if customColors is defined before accessing leftHand and rightHand
  //  if customColors is not defined, returns null, and the || operator returns the second value
  const leftHandColor = customColors?.leftHand || '#b91c1c';  // Darker red
  const rightHandColor = customColors?.rightHand || '#1e40af'; // Darker blue
  
  return isBlack ? 
    (isLeftHand ? '#8b1515' : '#153175') : 
    (isLeftHand ? leftHandColor : rightHandColor); // Darker base colors for white keys
};

const Note = ({ 
  note, 
  isLeftHand, 
  isBlack, 
  x, 
  y, 
  width, 
  height,
  onClick,
  onDragStart,
  onDrag,
  onDragEnd,
  containerHeight,
  onDoubleClick,
  groupId,
  groupColor,
  synth,
  midiData,
  noteGroups,
  customColors,
  heightFactor,
  onResize,
  PIXELS_PER_SECOND,
  showNoteNames,
  noteGlow = 0,
  noteRoundness = 4,
  noteBevel = 0,
  noteOpacity = 1,
  // Grid snapping props
  isSnapToGridActive,
  selectedDuration,
  songPosition,
  scrollPositionRef,
  calculateSnappedVisualPosition,
  // Recording mode props
  isRecordingMode = false,
}) => {
  // Debug log to check if noteGlow is being received (only log occasionally to avoid spam)
  if (noteGlow > 0 && Math.random() < 0.01) { // Log 1% of the time when glow > 0
    // Debug log removed
  }

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);


  // Local visual state for smooth animations
  const [currentVisualX, setCurrentVisualX] = useState(Math.floor(x));
  const [currentVisualY, setCurrentVisualY] = useState(Math.floor(y));
  const [currentVisualHeight, setCurrentVisualHeight] = useState(Math.floor(height));

  // Ref to store initial state at the start of an interaction (drag or resize)
  const interactionStartRef = useRef(null);

  const getBaseColor = () => {
    if (customColors) {
      return isLeftHand ? customColors.leftHand : customColors.rightHand;
    }
    return isLeftHand ? '#ff5555' : '#4499ff'; // Made colors brighter
  };

  const baseColor = getBaseColor();
  // If the note is in a group (selected), make it very light but keep its color identity
  const noteColor = groupId ? 
    (isBlack ? shadeColor(baseColor, 150) : shadeColor(baseColor, 180)) : // Much lighter version of original color
    (isBlack ? shadeColor(baseColor, -10) : baseColor); // Made black keys less dark (-20 to -10)

  const playNote = () => {
    if (!synth || !note.midi) return;

    if (groupId && midiData?.tracks?.[0]?.notes) {
      // Find all notes in the same group
      const groupNotes = midiData.tracks[0].notes.filter(n => 
        noteGroups.get(n.id) === groupId
      );
      
      //1. Group playback 
      if (groupNotes.length > 0) {
        // Sort notes by their time
        const sortedNotes = [...groupNotes].sort((a, b) => a.time - b.time);
        const startTime = sortedNotes[0].time;
        
        // Schedule each note to play with correct timing
        sortedNotes.forEach(groupNote => {
          if (groupNote.midi && groupNote.duration) {
            try {
              const noteName = Tone.Frequency(groupNote.midi, "midi").toNote();
              const timeOffset = groupNote.time - startTime;
              
              synth.triggerAttackRelease(
                noteName,
                groupNote.duration,
                Tone.now() + timeOffset,
                groupNote.velocity || 0.8
              );
            } catch (error) {
              console.warn(`Failed to play note: ${error.message}`);
            }
          }
        });
      }
    } else {
      // 2. Single Note Playback
      try {
        const noteName = Tone.Frequency(note.midi, "midi").toNote();
        synth.triggerAttackRelease(noteName, "8n", Tone.now(), note.velocity || 0.8);
      } catch (error) {
        console.warn(`Failed to play note: ${error.message}`);
      }
    }
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();

    playNote();

    if (!isResizing && !groupId && onClick) {
       onClick(note); // Call onClick to handle selection if passed
    }

    if (!isResizing) { // Only start dragging if not resizing
      setIsDragging(true);
      interactionStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        initialVisualX: currentVisualX,
        initialVisualY: currentVisualY,
        initialVisualHeight: currentVisualHeight, // Store height too for consistency
      };
      
      const dragStartEvent = new CustomEvent('note-drag-start', {
        detail: {
          noteId: note.midi,
          isLeftHand: isLeftHand
        }
      });
      window.dispatchEvent(dragStartEvent);
      
      onDragStart?.(note);
    }
  };

  // Touch event handlers for mobile support
  const handleTouchStart = (e) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent default touch behavior

    playNote();

    if (!isResizing && !groupId && onClick) {
       onClick(note); // Call onClick to handle selection if passed
    }

    if (!isResizing) { // Only start dragging if not resizing
      const touch = e.touches[0];
      setIsDragging(true);
      interactionStartRef.current = {
        mouseX: touch.clientX,
        mouseY: touch.clientY,
        initialVisualX: currentVisualX,
        initialVisualY: currentVisualY,
        initialVisualHeight: currentVisualHeight,
      };
      
      const dragStartEvent = new CustomEvent('note-drag-start', {
        detail: {
          noteId: note.midi,
          isLeftHand: isLeftHand
        }
      });
      window.dispatchEvent(dragStartEvent);
      
      onDragStart?.(note);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !interactionStartRef.current) return;
    
    const deltaX = e.clientX - interactionStartRef.current.mouseX;
    const deltaY = e.clientY - interactionStartRef.current.mouseY;
    
    const newVisualX = Math.floor(interactionStartRef.current.initialVisualX + deltaX);
    const newVisualY = Math.floor(interactionStartRef.current.initialVisualY + deltaY);

    setCurrentVisualX(newVisualX);
    setCurrentVisualY(newVisualY);
    
    const updatedNoteVisuals = { // Pass visual state to onDrag
      ...note, // Include original note data
      id: note.id,
      x: newVisualX, // Current visual X
      y: newVisualY, // Current visual Y
      height: currentVisualHeight, // Current visual height
      isDragging: true,
      isLeftHand: isLeftHand,
    };

    const dragUpdateEvent = new CustomEvent('note-drag-update', {
      detail: {
        noteId: note.midi,
        isLeftHand: isLeftHand
      }
    });
    window.dispatchEvent(dragUpdateEvent);

    // onDrag in Roll.jsx is responsible for musical position updates & snapping
    // It can return a snapped position to update the visuals further if needed
    const snappedPosition = onDrag?.(updatedNoteVisuals, e); 
    
    if (snappedPosition) {
      setCurrentVisualX(Math.floor(snappedPosition.x));
      setCurrentVisualY(Math.floor(snappedPosition.y));
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      interactionStartRef.current = null; // Clear interaction ref
      
      const dragEndEvent = new CustomEvent('note-drag-end');
      window.dispatchEvent(dragEndEvent);
      
      // onDragEnd can finalize the musical position based on the last visual state
      onDragEnd?.({ ...note, x: currentVisualX, y: currentVisualY, height: currentVisualHeight, isDragging: false });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !interactionStartRef.current) return;
    e.preventDefault(); // Prevent scrolling while dragging

    const touch = e.touches[0];
    const deltaX = touch.clientX - interactionStartRef.current.mouseX;
    const deltaY = touch.clientY - interactionStartRef.current.mouseY;
    
    const newVisualX = Math.floor(interactionStartRef.current.initialVisualX + deltaX);
    const newVisualY = Math.floor(interactionStartRef.current.initialVisualY + deltaY);

    setCurrentVisualX(newVisualX);
    setCurrentVisualY(newVisualY);
    
    const updatedNoteVisuals = {
      ...note,
      id: note.id,
      x: newVisualX,
      y: newVisualY,
      height: currentVisualHeight,
      isDragging: true,
      isLeftHand: isLeftHand,
    };

    const dragUpdateEvent = new CustomEvent('note-drag-update', {
      detail: {
        noteId: note.midi,
        isLeftHand: isLeftHand
      }
    });
    window.dispatchEvent(dragUpdateEvent);

    const snappedPosition = onDrag?.(updatedNoteVisuals, e); 
    
    if (snappedPosition) {
      setCurrentVisualX(Math.floor(snappedPosition.x));
      setCurrentVisualY(Math.floor(snappedPosition.y));
    }
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      interactionStartRef.current = null;
      
      const dragEndEvent = new CustomEvent('note-drag-end');
      window.dispatchEvent(dragEndEvent);
      
      onDragEnd?.({ ...note, x: currentVisualX, y: currentVisualY, height: currentVisualHeight, isDragging: false });
    }
  };

  const handleMouseEnter = (e) => {
    // This logic was for a removed tool.
  };

  const handleResizeStart = (e, direction) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    interactionStartRef.current = {
      mouseY: e.clientY,
      initialVisualY: currentVisualY,
      initialVisualHeight: currentVisualHeight,
      initialVisualBottomY: currentVisualY + currentVisualHeight,
    };
  };

  const handleResizeMove = (e) => {
    if (!isResizing || !interactionStartRef.current) return;

    const deltaY = e.clientY - interactionStartRef.current.mouseY;
    let newVisualY = interactionStartRef.current.initialVisualY; // Keep as float for calculation
    let newVisualHeight = interactionStartRef.current.initialVisualHeight; // Keep as float

    if (resizeDirection === 'top') {
      // Dragging top handle: top edge moves, visual bottom edge stays fixed
      newVisualY = interactionStartRef.current.initialVisualY + deltaY;
      newVisualHeight = interactionStartRef.current.initialVisualBottomY - newVisualY;
    } else { // 'bottom'
      // Dragging bottom handle: visual top edge stays fixed, height changes
      // newVisualY remains interactionStartRef.current.initialVisualY (already set)
      newVisualHeight = interactionStartRef.current.initialVisualHeight + deltaY;
    }

    // Ensure minimum height (e.g., 10 pixels visually)
    const minPixelHeight = Math.max(1, 10 / heightFactor); // Can be fractional

    if (newVisualHeight < minPixelHeight) {
      if (resizeDirection === 'top') {
        newVisualY = interactionStartRef.current.initialVisualBottomY - minPixelHeight;
      }
      newVisualHeight = minPixelHeight;
    }

    // Apply grid snapping to visual preview if snap to grid is active
    let finalVisualY = newVisualY;
    let finalVisualHeight = newVisualHeight;
    
    if (isSnapToGridActive && calculateSnappedVisualPosition) {
      const snapped = calculateSnappedVisualPosition(newVisualY, newVisualHeight, resizeDirection);
      finalVisualY = snapped.visualY;
      finalVisualHeight = snapped.visualHeight;
    }
    
    // Update local state for immediate visual feedback
    setCurrentVisualY(Math.floor(finalVisualY)); // Floor Y for CSS positioning consistency
    setCurrentVisualHeight(finalVisualHeight);   // Keep height fractional in state to ensure updates

    // Calculate musical duration from the new (potentially fractional) visual height for precision
    const newMusicalDuration = finalVisualHeight / (PIXELS_PER_SECOND * heightFactor); 
    
    // The visualTopY_px sent to Roll should be the floored Y that Note.jsx is rendering at its top edge.
    const visualTopYForCallback = Math.floor(finalVisualY); 
    
    onResize?.(note, newMusicalDuration, visualTopYForCallback, resizeDirection);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeDirection(null);
    interactionStartRef.current = null; // Clear interaction ref
    
    // onResize in Roll.jsx handles the final update to musical data and forces visual recalculation
  };

  useEffect(() => {
    if (isDragging) {
      // Add event listener to the window so when mouse/touch leaves note, it still triggers the move event
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchEnd);
      return () => {
        //Removes event listeners when dragging ends
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [isDragging]);

  useEffect(() => {
    if (isResizing) {
      //Add event listeners to window when resizing starts
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        //Removes event listeners when resizing ends
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing]);

  useEffect(() => {
    // Sync with props when we're not actively interacting
    // Roll.jsx now handles immediate visual recalculation after resize, preventing jumps
    if (!isDragging && !isResizing) {
      setCurrentVisualX(Math.floor(x));
      setCurrentVisualY(Math.floor(y));
      setCurrentVisualHeight(Math.floor(height));
    }
  }, [x, y, height, isDragging, isResizing]);

  const getGlowStyle = () => {
    if (noteGlow === 0) return {};
    
    // Scale the glow value. A max of 10px should be good for a border-like glow.
    const glowValue = noteGlow / 2; 

    const baseColor = getBaseColor();
    
    return {
      // Apply a drop-shadow for a crisp "border glow" and slightly increase brightness.
      filter: `drop-shadow(0 0 ${glowValue}px ${baseColor}) brightness(115%)`,
      // We don't need a separate box-shadow for this effect.
      boxShadow: 'none'
    };
  };

  // Calculate render values
  const renderX = Math.floor(isDragging ? currentVisualX : x);
  const renderY = Math.floor((isDragging || isResizing) ? currentVisualY : y);
  const renderWidth = Math.floor(width);
  const renderHeight = Math.floor((isDragging || isResizing) ? currentVisualHeight : height);

  const isSelected = !!groupId;
  // Combine all classes including glow class
  const noteClasses = `note note-component ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${noteGlow > 0 ? 'glowing' : ''}`;

  const getNoteName = () => {
    if (!note || typeof note.midi === 'undefined') return '';
    try {
      const fullNoteName = Tone.Frequency(note.midi, "midi").toNote();
      // Extract only the note letter part (e.g., C, F#, Bb)
      return fullNoteName.replace(/[0-9]/g, ''); // Removes all numbers (octaves)
    } catch (error) {
      console.warn(`Error getting note name for MIDI: ${note.midi}`, error);
      return '';
    }
  };

  // Create style object
  const noteStyle = {
    position: 'absolute',
    left: `${renderX}px`,
    top: `${renderY}px`,
    width: `${renderWidth}px`,
    height: `${renderHeight}px`,
    backgroundColor: noteColor,
    cursor: isDragging ? 'grabbing' : 'grab',
    borderRadius: `${noteRoundness}px`,
    opacity: noteOpacity,
  };

  // Apply bevel using inset box-shadow
  if (noteBevel > 0) {
    const bevelValue = noteBevel / 10;
    const highlight = `rgba(255, 255, 255, ${bevelValue * 0.5})`;
    const shadow = `rgba(0, 0, 0, ${bevelValue})`;
    noteStyle.boxShadow = `inset ${bevelValue}px ${bevelValue}px ${bevelValue * 2}px ${highlight}, inset -${bevelValue}px -${bevelValue}px ${bevelValue * 2}px ${shadow}`;
  }

  // Apply glow style (drop-shadow filter) if noteGlow > 0
  if (noteGlow > 0) {
    const { filter: glowFilter } = getGlowStyle();
    noteStyle.filter = glowFilter;
  }

  return (
    <>
      <div
        className={noteClasses}
        style={noteStyle}
        data-note-id={note.id}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onTouchStart={handleTouchStart}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (onDoubleClick) onDoubleClick();
        }}
      >
        {isSelected && !isRecordingMode && (
          <>
            <div
              className="resize-handle top"
              onMouseDown={(e) => handleResizeStart(e, 'top')}
            />
            <div
              className="resize-handle bottom"
              onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            />
          </>
        )}
        {showNoteNames && <span className="note-name-display">{getNoteName()}</span>}
        {/* ... rest of the note content ... */}
      </div>
      
      {/* Horizontal Guide Line when dragging or resizing */}
      {!isRecordingMode && (isDragging || isResizing) && (
        <div 
          className="interaction-guide-line"
          style={{
            position: 'absolute', // Position relative to the note's container (the roll)
            top: `${renderY + renderHeight}px`, // Bottom edge of the current note position
            left: '0', // Span full width of the roll
            width: '100%', 
            height: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.4)', // Slightly more subtle for existing notes
            zIndex: 5, // Same z-index as preview guide
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
};

export default React.memo(Note); 