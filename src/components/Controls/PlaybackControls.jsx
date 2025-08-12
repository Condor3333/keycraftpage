import React, { useState } from 'react';
import './PlaybackControls.css';

const PlaybackControls = ({
  isPlaying = false,
  onPlayPauseToggle = () => {},
  onSave = () => {},
  playbackSpeed = 1,
  onSpeedChange = () => {},
  songPosition = 0,
  songDuration = 0,
  handlePositionChange = () => {},
  volume = 1,
  onVolumeChange = () => {}
}) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Cap the position at song duration
  const displayPosition = Math.min(songPosition, songDuration);

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="playback-controls">
      <div className="left-controls">
        <button 
          className="play-pause-btn"
          onClick={onPlayPauseToggle}
        >
          {isPlaying ? 
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" fill="white"/>
              <rect x="14" y="4" width="4" height="16" fill="white"/>
            </svg> : 
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" fill="white"/>
            </svg>
          }
        </button>
        
        <div className="volume-control">
          <button 
            className="volume-btn"
            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="white"/>
            </svg>
          </button>
          {showVolumeSlider && (
            <div className="volume-slider-container">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="volume-slider"
                style={{ '--vol': `${volume * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="position-control">
        <span className="position-time">{formatTime(displayPosition)}</span>
        <input
          type="range"
          min="0"
          max={songDuration || 100}
          step="0.001"
          value={Math.min(displayPosition, songDuration) || 0}
          onInput={handlePositionChange}
          className="position-slider"
          style={{ 
            width: '150px',
            '--progress': `${(displayPosition / (songDuration || 100)) * 100}%`
          }}
        />
        <span className="position-time">{formatTime(songDuration)}</span>
      </div>
      
      <div className="right-controls">
        <div className="speed-control">
          <select 
            value={playbackSpeed} 
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            title="Playback Speed"
          >
            {speedOptions.map(speed => (
              <option key={speed} value={speed}>{speed}x</option>
            ))}
            {!speedOptions.includes(parseFloat(playbackSpeed)) && 
             typeof parseFloat(playbackSpeed) === 'number' && 
             !isNaN(parseFloat(playbackSpeed)) && (
              <option key="custom" value={parseFloat(playbackSpeed)} disabled>
                {parseFloat(playbackSpeed).toFixed(2)}x
              </option>
            )}
          </select>
        </div>
        
        <button 
          onClick={onSave}
          className="save-button"
          title="Save MIDI File"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" fill="white"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default PlaybackControls; 