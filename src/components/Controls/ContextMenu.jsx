import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';
import { scaleNames, keys } from '../Data/scales'; // Corrected import path

const ContextMenu = ({
  x,
  y,
  isVisible,
  onClose,
  // View Tool Props
  showGrid,
  setShowGrid,
  isSnapToGridActive,
  setIsSnapToGridActive,
  isToolbarVisible,
  setIsToolbarVisible,
  isPianoFullscreen,
  togglePianoFullscreen,
  showScaleHighlight,
  setShowScaleHighlight,
  selectedScale,
  setSelectedScale,
  selectedKey,
  setSelectedKey,
  // Theory Tool Props (subset for context menu)
  timeSignature,
  onTimeSignatureChange,
  commonTimeSignatures,
  playbackSpeed,
  totalBars,
  noteCount,
  transpositionTargets,
  currentTransposeTargetId,
  onTranspose
}) => {
  const menuRef = useRef(null);

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

  const currentKeyLabel = transpositionTargets?.find(t => t.id === currentTransposeTargetId)?.label || 'N/A';

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ position: 'fixed', top: y, left: x }}
      onClick={(e) => e.stopPropagation()} // Prevent menu close on item click
    >
      {/* View Section */}
      <div className="context-menu-section-header">View</div>
      <div className="context-menu-item">
        <label htmlFor="showGridToggle">Grid Lines</label>
        <input
          type="checkbox"
          id="showGridToggle"
          checked={showGrid}
          onChange={() => setShowGrid(!showGrid)}
        />
      </div>
      <div className="context-menu-item">
        <label htmlFor="snapToGridToggle">Snap to Grid</label>
        <input
          type="checkbox"
          id="snapToGridToggle"
          checked={isSnapToGridActive}
          onChange={() => setIsSnapToGridActive(!isSnapToGridActive)}
        />
      </div>
      <div className="context-menu-item">
        <label htmlFor="toolbarToggle">Toolbar</label>
        <input
          type="checkbox"
          id="toolbarToggle"
          checked={isToolbarVisible}
          onChange={() => setIsToolbarVisible(!isToolbarVisible)}
        />
      </div>
      <div className="context-menu-item">
        <label htmlFor="fullscreenToggle">Fullscreen</label>
        <input
          type="checkbox"
          id="fullscreenToggle"
          checked={isPianoFullscreen}
          onChange={togglePianoFullscreen}
        />
      </div>
      <div className="context-menu-item">
        <label htmlFor="scaleHighlightToggle">Scale Highlight</label>
        <input
          type="checkbox"
          id="scaleHighlightToggle"
          checked={showScaleHighlight}
          onChange={() => setShowScaleHighlight(!showScaleHighlight)}
        />
      </div>
      {showScaleHighlight && (
        <>
          <div className="context-menu-item sub-item">
            <label htmlFor="scaleSelect">Scale:</label>
            <select
              id="scaleSelect"
              value={selectedScale}
              onChange={(e) => setSelectedScale(e.target.value)}
              className="context-menu-select"
            >
              {Object.entries(scaleNames).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="context-menu-item sub-item">
            <label htmlFor="keySelect">Key:</label>
            <select
              id="keySelect"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="context-menu-select"
              disabled={selectedScale === 'chromatic' || selectedScale?.endsWith('Arp')}
            >
              {Object.keys(keys).map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Theory Section */}
      <div className="context-menu-section-header">Theory</div>
      <div className="context-menu-item time-sig-item">
        <label>Time Signature</label>
        <div className="time-signature-buttons">
          {(commonTimeSignatures || [
            { numerator: 4, denominator: 4 }, { numerator: 3, denominator: 4 }, { numerator: 6, denominator: 8 }
          ]).map(ts => (
            <button 
              key={`${ts.numerator}/${ts.denominator}`}
              className={`time-sig-button ${
                timeSignature.numerator === ts.numerator && 
                timeSignature.denominator === ts.denominator ? 'active' : ''
              }`}
              onClick={() => onTimeSignatureChange(ts)}
            >
              {ts.numerator}/{ts.denominator}
            </button>
          ))}
        </div>
      </div>
      <div className="context-menu-item sub-item">
        <label htmlFor="keyTransposeSelect">Transpose Key:</label>
        <select
          id="keyTransposeSelect"
          value={currentTransposeTargetId}
          onChange={(e) => onTranspose(e.target.value)}
          className="context-menu-select"
        >
          {transpositionTargets?.map(target => (
            <option key={target.id} value={target.id}>{target.label}</option>
          ))}
        </select>
      </div>
      <div className="context-menu-item-static">
        <span>Tempo: {Math.round(playbackSpeed * 120)} BPM</span>
      </div>
      <div className="context-menu-item-static">
        <span>{totalBars} bars • {noteCount || 0} notes</span>
      </div>
    </div>
  );
};

export default ContextMenu; 