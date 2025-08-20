import React, { useEffect } from 'react';
import './InputMidi.css';
import * as Tone from 'tone';

function InputMidi({ onFileUpload, isPlaying, onPlayPauseToggle, onRestart, isReady }) {
  useEffect(() => {
    const initTone = async () => {
      await Tone.start();
      await Tone.context.resume();
    };
    initTone();
  }, []);

  return (
    <div className="file-upload">
      <input
        type="file"
        accept=".midi,.mid"
        onChange={onFileUpload}
        disabled={!isReady}
      />
      <button 
        className="play-pause-btn"
        onClick={onPlayPauseToggle}
        disabled={!onFileUpload || !isReady}
      >
        {!isReady ? '🎹 Loading...' : isPlaying ? '⏸️ Pause' : '▶️ Play'}
      </button>
      <button 
        className="restart-btn"
        onClick={onRestart}
        disabled={!onFileUpload || !isReady}
      >
        🔄 Restart
      </button>
    </div>
  );
}

export default InputMidi;
