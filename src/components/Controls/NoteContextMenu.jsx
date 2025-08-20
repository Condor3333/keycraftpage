import React, { useEffect, useRef, useState } from 'react';
import './ContextMenu.css';

const NoteContextMenu = ({
  x,
  y,
  isVisible,
  onClose,
  onUpdateVelocity,
  noteId,
  noteGroups,
  hasSelection,
  currentVelocity
}) => {
  const menuRef = useRef(null);
  const [sliderValue, setSliderValue] = useState(100);
  const [isUpdating, setIsUpdating] = useState(false);

  // Update slider value when currentVelocity changes
  useEffect(() => {
    if (currentVelocity !== undefined) {
      setSliderValue(Math.round(currentVelocity * 127));
    }
  }, [currentVelocity]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isVisible, onClose]);

  if (!isVisible) {
    return null;
  }

  const isGroupSelection = hasSelection && noteGroups && noteGroups.size > 0;
  const currentVelocityDisplay = currentVelocity !== undefined ? Math.round(currentVelocity * 127) : 100;
  const title = isGroupSelection ? `Velocity (${noteGroups.size} notes) - ${currentVelocityDisplay}` : `Velocity - ${currentVelocityDisplay}`;

  const velocityOptions = [
    { label: 'Very Soft (pp)', value: 0.2 },
    { label: 'Soft (p)', value: 0.4 },
    { label: 'Medium Soft (mp)', value: 0.6 },
    { label: 'Medium (m)', value: 0.7 },
    { label: 'Medium Loud (mf)', value: 0.8 },
    { label: 'Loud (f)', value: 0.9 },
    { label: 'Very Loud (ff)', value: 1.0 }
  ];

  return (
    <div
      ref={menuRef}
      className="context-menu note-context-menu"
      style={{ position: 'fixed', top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()} // Prevent Roll's onMouseDown from firing
    >
      <div className="context-menu-section-header">
        {title}
        {isUpdating && <span style={{ color: '#8ab4f8', marginLeft: '8px' }}>Updating...</span>}
      </div>
      
      {velocityOptions.map((option) => (
        <div 
          key={option.value}
          className="context-menu-item velocity-item"
          onClick={(e) => {
            e.stopPropagation();
            setIsUpdating(true);
            onUpdateVelocity(option.value);
            setTimeout(() => setIsUpdating(false), 100); // Brief visual feedback
          }}
        >
          <span>{option.label}</span>
          <span className="velocity-value">({Math.round(option.value * 127)})</span>
        </div>
      ))}
      
      <div className="context-menu-divider"></div>
      
      <div className="context-menu-item">
        <label htmlFor="customVelocity">Custom Velocity:</label>
        <input
          type="range"
          id="customVelocity"
          min="0"
          max="127"
          value={sliderValue}
          className="velocity-slider"
          onChange={(e) => {
            e.stopPropagation();
            const newValue = parseInt(e.target.value);
            setSliderValue(newValue);
            const velocity = newValue / 127;
            setIsUpdating(true);
            onUpdateVelocity(velocity);
            setTimeout(() => setIsUpdating(false), 100); // Brief visual feedback
          }}
          onInput={(e) => {
            e.stopPropagation();
            const newValue = parseInt(e.target.value);
            setSliderValue(newValue);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="velocity-display" id="velocityDisplay">{sliderValue}</span>
      </div>
    </div>
  );
};

export default NoteContextMenu; 