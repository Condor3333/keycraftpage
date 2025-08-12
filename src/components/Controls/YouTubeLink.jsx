import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const YouTubeLink = ({ onMidiDataReceived }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);


  //for await to work, function must be declared async
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    //await response from backend before resuming function
    try {
      const response = await fetch('http://localhost:5000/process-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ youtube_url: url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process YouTube video');
      }

      const midiData = await response.json();
      
      // The backend already returns data in the correct format:
      // { tracks: [{ name: string, notes: [...] }] }
      // Just add IDs to the notes
      const transformedData = {
        tracks: midiData.tracks.map(track => ({
          ...track,
          notes: track.notes.map(note => ({
            ...note,
            id: uuidv4(),
          }))
        }))
      };

      onMidiDataReceived(transformedData);
      setUrl('');
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  //1. ^ logic section, behind the scenes state, effect, functions
  // 2. Render return section, what is rendered to the screen
  return (
    <div className="youtube-link-container">
      <form onSubmit={handleSubmit} className="youtube-form">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter YouTube URL"
          disabled={isLoading}
          className="youtube-input"
        />
        <button type="submit" disabled={isLoading} className="youtube-button">
          {isLoading ? 'Processing...' : 'Convert to MIDI'}
        </button>
      </form>
      {error && <div className="youtube-error">{error}</div>}
    </div>
  );
};

export default YouTubeLink; 