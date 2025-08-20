import React, { useEffect, useRef, useState } from 'react';
import './SheetMusicView.css';

const loadOsmd = async () => {
  try {
    const mod = await import('opensheetmusicdisplay');
    return mod.OpenSheetMusicDisplay || mod.default;
  } catch (e) {
    // Fallback to CDN if module not available
    if (!window.__osmdLoading) {
      window.__osmdLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.9.0/build/opensheetmusicdisplay.min.js';
        script.async = true;
        script.onload = () => resolve(window.opensheetmusicdisplay?.OpenSheetMusicDisplay);
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
    return await window.__osmdLoading;
  }
};

const SheetMusicView = ({ musicXml, zoomLevel = 1, noteData, isPlaying, playbackSpeed = 1, title, onPlayPauseToggle, onRefreshNotation }) => {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const [error, setError] = useState(null);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const timeoutsRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const OSMD = await loadOsmd();
        if (cancelled) return;
        if (!osmdRef.current) {
          osmdRef.current = new OSMD(containerRef.current, {
            backend: 'svg',
            autoResize: true,
            drawTitle: true, // Enable title drawing
            drawPartNames: true,
            drawMeasureNumbers: true,
            pageBackgroundColor: '#ffffff', // Always white background
            renderSingleHorizontalStaffline: false,
            coloringEnabled: false,
            engravingRules: {
              RenderSubtitle: false,
              RenderComposer: false,
              RenderLyricist: false,
              RenderCopyright: false,
            },
          });
        }
        await osmdRef.current.load(musicXml);
        osmdRef.current.zoom = Math.max(0.5, Math.min(2.5, zoomLevel));
        await osmdRef.current.render();
        setError(null);
      } catch (e) {
        setError(e?.message || 'Failed to render sheet music');
      }
    })();
    return () => { cancelled = true; };
  }, [musicXml, zoomLevel, title]);

  // Cursor follow based on MIDI onsets from noteData
  useEffect(() => {
    // Clear any previous schedules
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];

    const osmd = osmdRef.current;
    if (!osmd || !noteData || !noteData.tracks || !noteData.tracks[0]) return;

    const notes = (noteData.tracks[0].notes || []).slice().sort((a,b) => a.time - b.time);
    const uniqueOnsets = [];
    let last = -1;
    for (const n of notes) {
      const t = Math.max(0, n.time);
      if (last < 0 || Math.abs(t - last) > 1e-3) {
        uniqueOnsets.push(t);
        last = t;
      }
    }

    if (isPlaying) {
      try {
        osmd.cursor.reset();
        osmd.cursor.show();
      } catch {}
      const start = performance.now();
      uniqueOnsets.forEach((onset) => {
        const ms = (onset / playbackSpeed) * 1000;
        const handle = setTimeout(() => {
          try { osmd.cursor.next(); } catch {}
        }, ms);
        timeoutsRef.current.push(handle);
      });
    } else {
      try { osmd.cursor.hide(); } catch {}
    }

    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, [isPlaying, noteData, playbackSpeed]);

  return (
    <div className="sheet-music-root light" style={{ position: 'relative' }}>
      {error && <div className="sheet-music-error">{error}</div>}
      <div className="sheet-music-container" ref={containerRef} />
      
            {/* Info icon positioned relative to sheet music container */}
      <div 
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: '#4a90e2',
          color: 'white',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
        onMouseEnter={() => setShowInfoPopup(true)}
        onMouseLeave={() => setShowInfoPopup(false)}
      >
        <i className="fas fa-info-circle" style={{ fontSize: '12px' }}></i>
        
        {/* Styled popup that appears on hover */}
        {showInfoPopup && (
          <div style={{
            position: 'absolute',
            top: '30px',
            right: '0px',
            backgroundColor: '#4a90e2',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            width: '400px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 1001,
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
                         <div style={{ display: 'flex', alignItems: 'flex-start' }}>
               <div style={{ flex: '1' }}>
                 <div style={{ marginBottom: '6px', fontWeight: '500' }}>
                   For best results, ensure all notes are snapped to the grid
                 </div>
                 <div style={{ fontSize: '11px', opacity: '0.9', lineHeight: '1.4' }}>
                   <strong>Note:</strong> This sheet music is generated from your piano roll. The roll is the source of truth - this is just a preview. No direct editing available.
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>
      
      {/* Play and Refresh buttons positioned at top of sheet music */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        display: 'flex',
        gap: '8px',
        zIndex: 1000
      }}>
        <button 
          onClick={onPlayPauseToggle}
          style={{
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title={`${isPlaying ? 'Pause' : 'Play'} (Space)`}
        >
          <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} style={{ fontSize: '12px' }}></i>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        
        <button 
          onClick={onRefreshNotation}
          style={{
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Refresh Notation"
        >
          <i className="fas fa-sync-alt" style={{ fontSize: '12px' }}></i>
          Refresh Notation
        </button>
      </div>
    </div>
  );
};

export default SheetMusicView;


