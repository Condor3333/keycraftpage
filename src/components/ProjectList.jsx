import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './ProjectList.css';
import SettingsDropdown from './Controls/SettingsDropdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMusic, faPlus, faFileUpload, faSignOutAlt, faMoon, faSun, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext'; // Corrected path
import { FaTrash, FaEdit, FaCopy, FaPlus, FaFileUpload, FaSignOutAlt, FaSun, FaMoon, FaSearch, FaSortAmountDown, FaSortAmountUp, FaThList, FaThLarge } from 'react-icons/fa';
import { signOut } from 'next-auth/react'; // For client-side logout trigger
import format from 'date-fns/format';

const ProjectList = ({ 
  projects, 
  onNewProject, 
  onProjectSelect, 
  onMidiFileUpload,
  onAudioFileUpload, // ADDED: Audio transcription handler
  onProjectNameChange,
  onProjectDelete,
  onProjectDuplicate,
  theme,
  toggleTheme,
  currentUser,
  isLoadingProjects, // New prop
  loadError, // New prop
  setProjects, // Added for potential project update
  isImportingMidi, // ADDED: Receive loading state
  isTranscribingAudio // ADDED: Audio transcription loading state
}) => {
  const { logout } = useAuth(); // Get logout function from context
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [sortCriteria, setSortCriteria] = useState('dateModified'); // 'dateModified' or 'name'
  const [sortOrder, setSortOrder] = useState('dateModified_desc'); // e.g., 'name_asc', 'dateCreated_desc'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [isDeletingProject, setIsDeletingProject] = useState(false); // ADDED: State for delete loading modal
  const [showTranscribeInfo, setShowTranscribeInfo] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState({ remaining: null, limit: 10, loading: false, error: null });
  const audioFileInputRef = useRef(null);

  // Fetch quota info when modal is shown
  useEffect(() => {
    if (showTranscribeInfo && currentUser) {
      setQuotaInfo(q => ({ ...q, loading: true, error: null }));
      const apiBase = process.env.REACT_APP_API_BASE_URL || '';
      fetch(`${apiBase}/api/video-to-midi/quota`, {
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => {
          setQuotaInfo({
            remaining: data.remaining,
            limit: data.limit,
            loading: false,
            error: null
          });
        })
        .catch(e => {
          setQuotaInfo(q => ({ ...q, loading: false, error: 'Could not fetch quota info.' }));
        });
    }
  }, [showTranscribeInfo, currentUser]);

  const handleTranscribeClick = (e) => {
    e.preventDefault();
    setShowTranscribeInfo(true);
  };

  const handleTranscribeInfoOk = () => {
    setShowTranscribeInfo(false);
    // Trigger the file input after user confirms
    if (audioFileInputRef.current) {
      audioFileInputRef.current.value = null; // Reset file input
      audioFileInputRef.current.click();
    }
  };

  // The useEffect for loading thumbnails via window.electronAPI or window.devThumbnailAPI has been removed.
  // Thumbnails are now expected to be provided via project.thumbnailUrl (pre-signed S3 URL).

  const handleLogout = async () => {
    // try {
    //   await auth.signOut();
    // } catch (error) {
    //   console.error('Error signing out:', error);
    // }
    console.log('Logout clicked - functionality to be replaced with AuthJS');
  };

  // Create a new project with default tool states
  const handleNewProject = () => {
    onNewProject({
      // Default tool states
      toolStates: {
        isTextToolActive: false,
        isAddNoteToolActive: false,
        isSpacerToolActive: false,
        isSelectionToolActive: false,
        heightFactor: 1,
        selectedDuration: 1,
        textFontSize: 14,
        showGrid: true,
        isLooping: false,
        backgroundImage: null,
        quantizeStrength: 1,
        quantizeDivision: 0.25,
      }
    });
  };

  const filteredProjects = projects
    .filter(project =>
      project && project.name && typeof project.name === 'string' &&
      project.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortCriteria === 'dateModified') {
        // Sort by dateModified descending (newest first)
        return new Date(b.dateModified) - new Date(a.dateModified);
      } else if (sortCriteria === 'name') {
        // Sort by name ascending (A-Z)
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  //Filter loops through each project in project array 
  //Returns a new array with only the projects that .includes the search term

  const handleNameEdit = (project) => {
    setEditingId(project.id);
    setEditingName(project.name);
  };
  
  const handleNameSave = (projectId) => {
    if (editingName.trim()) {
      onProjectNameChange(projectId, editingName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      setIsDeletingProject(true); // Show modal
      try {
        await onProjectDelete(projectId);
        // No need to setProjects here if App.js handles it after successful server delete
      } catch (error) {
        console.error("Error during project deletion in ProjectList:", error);
        // Optionally, show an error message to the user here
        alert("Failed to delete project. Please try again.");
      } finally {
        setIsDeletingProject(false); // Hide modal regardless of outcome
      }
    }
  };

  return (
    <div className="project-list">
      <header className="project-header">
        <div className="header-left">
          <h1>{currentUser ? `${currentUser.firstName || currentUser.name?.split(' ')[0] || currentUser.email}'s Piano Rolls` : 'My Piano Rolls'}</h1>
        </div>
        <div className="project-actions-and-settings">
          <div className="project-actions">
            <button onClick={handleNewProject}>New Project</button>
            <input
              type="file"
              accept=".mid,.midi"
              onChange={onMidiFileUpload}
              style={{ display: 'none' }}
              id="midi-file-input"
            />
            <label htmlFor="midi-file-input" className="button">
              Import MIDI
            </label>
            <input
              type="file"
              accept=".mp3"
              onChange={onAudioFileUpload}
              style={{ display: 'none' }}
              id="audio-file-input"
              ref={audioFileInputRef}
            />
            <label htmlFor="audio-file-input" className="button" disabled={isTranscribingAudio} onClick={handleTranscribeClick}>
              {isTranscribingAudio ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                  Transcribing...
                </>
              ) : (
                'AI Transcribe'
              )}
            </label>
          </div>
          <SettingsDropdown 
            currentUser={currentUser}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </div>
      </header>
      
      <div className="controls-bar">
        <div className="filter-sort-controls">
          <div className="control-group">
            <label htmlFor="sort-select">SORT BY</label>
            <select 
              id="sort-select" 
              className="control-select" 
              value={sortCriteria} 
              onChange={(e) => setSortCriteria(e.target.value)}
            >
              <option value="dateModified">Last Edited</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="projects-grid">
        {/* New Project Card - Placed first in the grid */}
        <div className="project-card new-project-card" onClick={handleNewProject}>
          <div className="new-project-card-content">
            <span className="new-project-icon">+</span>
            <span>New Project</span>
          </div>
        </div>

        {isLoadingProjects && (
          <div className="loading-projects-container">
            <FontAwesomeIcon icon={faSpinner} spin size="3x" />
            <p>Loading projects...</p>
          </div>
        )}

        {loadError && (
          <div className="load-error-container">
            <FontAwesomeIcon icon={faExclamationTriangle} size="3x" />
            <p>Error loading projects: {loadError}</p>
            {/* Optionally, add a retry button here */}
          </div>
        )}

        {!isLoadingProjects && !loadError && filteredProjects.length === 0 && (
          <div className="no-projects-message">
            <p>No projects found. Get started by creating a new one or uploading a MIDI file!</p>
          </div>
        )}

        {!isLoadingProjects && !loadError && filteredProjects.length > 0 && (
          filteredProjects.map(project => (
            <div 
              key={project.id} 
              className="project-card"
              // onClick={() => onProjectSelect(project)} // Allow clicking on text/thumbnail to open
            >
              <div className="project-thumbnail-placeholder" onClick={() => onProjectSelect(project)}>
                {project.thumbnailUrl ? (
                  <img src={project.thumbnailUrl} alt={`${project.name} thumbnail`} className="project-thumbnail-img" />
                ) : (
                  <div className="project-thumbnail-default">No Preview</div>
                )}
              </div>
              <div className="project-info">
                {editingId === project.id ? (
                  <input
                    className="project-name-input"
                    type="text"
                    value={editingName}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleNameSave(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNameSave(project.id);
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditingName('');
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <h3 onClick={() => onProjectSelect(project)}>{project.name}</h3>
                )}
                <p className="project-dates">Edited: {project.dateModified instanceof Date ? project.dateModified.toLocaleDateString() : new Date(project.dateModified).toLocaleDateString()}</p>
              </div>
              <div className="project-card-controls">
                <button 
                  className="control-btn duplicate-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Are you sure you want to duplicate project "${project.name}"?`)) {
                      onProjectDuplicate(project);
                    }
                  }}
                  title="Duplicate project"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="8" width="12" height="12" rx="2" ry="2"></rect>
                    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
                  </svg>
                </button>
                <button 
                  className="control-btn edit-name-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNameEdit(project);
                  }}
                  title="Edit name"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                </button>
                <button 
                  className="control-btn delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id);
                  }}
                  title="Delete project"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADDED: Deleting Project Modal */}
      {isDeletingProject && (
        <div className="modal-overlay simple-modal-overlay">
          <div className="modal simple-modal">
            <h3>Deleting Project...</h3>
            <div className="spinner"></div> 
          </div>
        </div>
      )}

      {/* ADDED: Importing MIDI Modal */}
      {isImportingMidi && (
        <div className="modal-overlay simple-modal-overlay">
          <div className="modal simple-modal">
            <h3>Importing MIDI...</h3>
            <div className="spinner"></div>
          </div>
        </div>
      )}

      {/* ADDED: Transcribing Audio Modal */}
      {isTranscribingAudio && (
        <div className="modal-overlay simple-modal-overlay">
          <div className="modal simple-modal">
            <h3>🎵 Transcribing Audio...</h3>
            <p>Converting your audio to MIDI using AI. Processing time varies by file length (up to 10 minutes).</p>
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <div className="progress-text">Processing...</div>
            </div>
          </div>
        </div>
      )}

      {showTranscribeInfo && (
        <div className="modal-overlay simple-modal-overlay">
          <div className="modal simple-modal">
            <h3>AI Transcribe (Audio to MIDI)</h3>
            {quotaInfo.loading ? (
              <p>Loading quota info...</p>
            ) : quotaInfo.error ? (
              <p style={{ color: 'red' }}>{quotaInfo.error}</p>
            ) : (
              <>
                <p>You have <b>{quotaInfo.remaining !== null ? quotaInfo.remaining : '...'}</b> out of <b>{quotaInfo.limit}</b> monthly AI transcriptions left.</p>
                <p style={{ color: '#e67e22', fontWeight: 'bold' }}>This feature is <u>ONLY</u> for solo piano MP3s. Other instruments or formats will not work.</p>
              </>
            )}
            <div style={{ marginTop: 16 }}>
              <button onClick={handleTranscribeInfoOk} disabled={quotaInfo.loading} style={{ padding: '8px 20px', fontWeight: 'bold' }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectList; 