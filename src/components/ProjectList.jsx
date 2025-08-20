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
  const [showPremiumTooltip, setShowPremiumTooltip] = useState(false);
  const [showMidiDropdown, setShowMidiDropdown] = useState(false);
  const [showNewProjectDropdown, setShowNewProjectDropdown] = useState(false);
  const [showMidiInfo, setShowMidiInfo] = useState(false);
  const midiInfoTimeoutRef = useRef(null);
  const audioFileInputRef = useRef(null);
  const tooltipTimeoutRef = useRef(null);
  const midiDropdownRef = useRef(null);
  const newProjectDropdownRef = useRef(null);

  // Debug logging
  console.log('[ProjectList] currentUser:', currentUser);
  console.log('[ProjectList] currentUser?.hasPaid:', currentUser?.hasPaid);
  console.log('[ProjectList] isPremiumLocked:', !currentUser?.hasPaid);

  // Fetch quota info when modal is shown
  useEffect(() => {
    if (showTranscribeInfo && currentUser) {
      setQuotaInfo(q => ({ ...q, loading: true, error: null }));
      const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://keycraft.org:3000';
      fetch(`${apiBase}/api/video-to-midi/quota`, {
        credentials: 'include',
      })
        .then(res => {
          if (!res.ok) {
            return res.json().then(data => {
              if (data.code === 'PAYMENT_REQUIRED') {
                throw new Error('AI Transcription is a premium feature. Please upgrade your account.');
              }
              throw new Error(data.message || 'Failed to fetch quota info.');
            });
          }
          return res.json();
        })
        .then(data => {
          setQuotaInfo({
            remaining: data.remaining,
            limit: data.limit,
            loading: false,
            error: null
          });
        })
        .catch(e => {
          setQuotaInfo(q => ({ ...q, loading: false, error: e.message }));
        });
    }
  }, [showTranscribeInfo, currentUser]);

  // Handle clicking outside MIDI dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (midiDropdownRef.current && !midiDropdownRef.current.contains(event.target)) {
        setShowMidiDropdown(false);
      }
      if (newProjectDropdownRef.current && !newProjectDropdownRef.current.contains(event.target)) {
        setShowNewProjectDropdown(false);
      }
    };

    if (showMidiDropdown || showNewProjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMidiDropdown, showNewProjectDropdown]);

  const handleTranscribeClick = (e) => {
    e.preventDefault();
    
    // MODIFIED: Check tier-based access for AI transcription
    const getTranscriptionLimit = () => {
      if (!currentUser?.hasPaid) return 0; // Free tier: no transcriptions
      if (currentUser?.activePlans?.includes('tier1')) return 5; // Tier 1: 5 transcriptions/month
      if (currentUser?.activePlans?.includes('tier2')) return 20; // Tier 2: 20 transcriptions/month
      return 0; // Default to no access if no plans found
    };

    const transcriptionLimit = getTranscriptionLimit();
    
    if (transcriptionLimit === 0) {
      alert('AI Transcription is a premium feature. Please upgrade your account to use this feature.');
      return;
    }
    
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

  const handlePremiumButtonMouseEnter = () => {
    const getTranscriptionLimit = () => {
      if (!currentUser?.hasPaid) return 0; // Free tier: no transcriptions
      if (currentUser?.activePlans?.includes('tier1')) return 5; // Tier 1: 5 transcriptions/month
      if (currentUser?.activePlans?.includes('tier2')) return 20; // Tier 2: 20 transcriptions/month
      return 0; // Default to no access if no plans found
    };
    const transcriptionLimit = getTranscriptionLimit();
    const hasTranscriptionAccess = transcriptionLimit > 0;
    
    if (!hasTranscriptionAccess) {
      // Clear any existing timeout
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      setShowPremiumTooltip(true);
    }
  };

  const handlePremiumButtonMouseLeave = () => {
    // Add a small delay before hiding the tooltip
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowPremiumTooltip(false);
    }, 200);
  };

  const handleTooltipMouseEnter = () => {
    // Clear the timeout when entering the tooltip
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
  };

  const handleTooltipMouseLeave = () => {
    setShowPremiumTooltip(false);
  };

  const handleSampleMidiSelect = async (filename) => {
    setShowMidiDropdown(false);
    
    try {
      // Fetch the MIDI file from the public directory
      const response = await fetch(`/midis/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${filename}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Create a File object that mimics the file input
      const file = new File([arrayBuffer], filename, { type: 'audio/midi' });
      
      // Create a synthetic event object
      const syntheticEvent = {
        target: {
          files: [file]
        }
      };
      
      // Call the existing MIDI upload handler
      onMidiFileUpload(syntheticEvent);
      
    } catch (error) {
      console.error('Error loading sample MIDI:', error);
      alert(`Error loading ${filename}: ${error.message}`);
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
    // MODIFIED: Implement tier-based project limits
    const getProjectLimit = () => {
      if (!currentUser?.hasPaid) return 1; // Free tier: 1 project
      if (currentUser?.activePlans?.includes('tier1')) return 20; // Tier 1: 20 projects
      if (currentUser?.activePlans?.includes('tier2')) return Infinity; // Tier 2: unlimited
      return 1; // Default to free tier if no plans found
    };

    const projectLimit = getProjectLimit();
    
    if (projects.length >= projectLimit) {
      let message = '';
      if (projectLimit === 1) {
        message = "Free users can only have 1 project at a time. Please delete an existing project first, or upgrade your account for more projects.";
      } else if (projectLimit === 20) {
        message = "Tier 1 users can only have 20 projects. Please delete an existing project first, or upgrade to Tier 2 for unlimited projects.";
      } else {
        message = "You have reached your project limit. Please delete an existing project first, or upgrade your account for more projects.";
      }
      alert(message);
      return;
    }
    
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
      {/* KeyCraft Logo - Top Left */}
      <div className="project-list-logo">
        <img src="/logo.png" alt="KeyCraft" className="project-list-logo-img" />
      </div>
      
      <header className="project-header">
        <div className="header-left">
          <h1>{currentUser ? `${currentUser.firstName || currentUser.name?.split(' ')[0] || currentUser.email}'s Piano Rolls` : 'My Piano Rolls'}</h1>
        </div>
        
        {/* Premium Label for Tier 2 Users */}
        {currentUser?.activePlans?.includes('tier2') && (
          <div className="premium-label">
            <span className="premium-crown">👑</span>
            <div className="premium-text-stacked">
              <span>KeyCraft</span>
              <span>Premium</span>
            </div>
          </div>
        )}
        
        <div className="project-actions-and-settings">
          <div className="project-actions">
            {(() => {
              const getProjectLimit = () => {
                if (!currentUser?.hasPaid) return 1;
                if (currentUser?.activePlans?.includes('tier1')) return 20;
                if (currentUser?.activePlans?.includes('tier2')) return Infinity;
                return 1;
              };
              const projectLimit = getProjectLimit();
              const isAtLimit = projects.length >= projectLimit;
              
              return (
                <>

                  <div className="midi-import-dropdown" ref={midiDropdownRef}>
                    <button
                      className={`button dropdown-toggle ${isAtLimit ? 'premium-feature' : ''}`}
                      onClick={() => setShowMidiDropdown(!showMidiDropdown)}
                      disabled={isAtLimit}
                      title={isAtLimit ? 
                        (projectLimit === 1 ? "Free users can only have 1 project. Upgrade for more projects." :
                         projectLimit === 20 ? "Tier 1 users can only have 20 projects. Upgrade to Tier 2 for unlimited projects." :
                         "You have reached your project limit. Upgrade for more projects.") : 
                        "Import MIDI file"
                      }
                    >
                      New Project
                      {isAtLimit && <span className="premium-icon" title="Project Limit Reached">👑</span>}
                      <span className="dropdown-arrow">▼</span>
                    </button>
                    {showMidiDropdown && (
                      <div className="midi-dropdown-menu">
                        <div className="midi-dropdown-section">
                          <div className="midi-dropdown-header">Blank Project</div>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => {
                              setShowMidiDropdown(false);
                              handleNewProject();
                            }}
                            disabled={isAtLimit}
                          >
                            New Project
                            {isAtLimit && <span className="premium-icon" title="Project Limit Reached">👑</span>}
                          </button>
                        </div>
                        <div className="midi-dropdown-section">
                          <div className="midi-dropdown-header">
                            IMPORT MIDI
                            <span 
                              className="info-icon" 
                              title="Hover for more information"
                              onMouseEnter={() => {
                                if (midiInfoTimeoutRef.current) {
                                  clearTimeout(midiInfoTimeoutRef.current);
                                }
                                midiInfoTimeoutRef.current = setTimeout(() => setShowMidiInfo(true), 200);
                              }}
                              onMouseLeave={() => {
                                if (midiInfoTimeoutRef.current) {
                                  clearTimeout(midiInfoTimeoutRef.current);
                                }
                                midiInfoTimeoutRef.current = setTimeout(() => setShowMidiInfo(false), 300);
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" fill="#4287f5"/>
                                <path d="M12 16v-4M12 8h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                            </span>
                          </div>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => document.getElementById('midi-file-input').click()}
                          >
                            Choose File...
                          </button>
                          <input
                            type="file"
                            accept=".mid,.midi"
                            onChange={onMidiFileUpload}
                            style={{ display: 'none' }}
                            id="midi-file-input"
                            disabled={isAtLimit}
                          />
                          <div className={`midi-info-popup ${showMidiInfo ? 'show' : ''}`}>
                              <div className="midi-info-content">
                                <h4>What is MIDI?</h4>
                                <p>Digital format containing musical data (notes, timing, velocity)</p>
                                
                                <h4>How to get MIDI files:</h4>
                                <ul>
                                  <li><strong>Download:</strong> Search for free piano MIDI sites</li>
                                  <li><strong>Create:</strong> Use KeyCraft to compose your own</li>
                                  <li><strong>Convert:</strong> Use KeyCraft's AI transcription</li>
               
                                </ul>
                                
                                <p><strong>Tip:</strong> Look for .mid or .midi files!</p>
                              </div>
                            </div>
                        </div>
                        <div className="midi-dropdown-section">
                          <div className="midi-dropdown-header">Library MIDI</div>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('Fur Elise.mid')}
                          >
                            Fur Elise
                          </button>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('Claire de Lune.mid')}
                          >
                            Claire de Lune
                          </button>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('Fantaisie_Impromptu_Rag_transcription.mid')}
                          >
                            Fantaisie Impromptu
                          </button>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('Gymnopedie No. 1.mid')}
                          >
                            Gymnopedie No. 1
                          </button>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('Liebestraum No.3.mid')}
                          >
                            Liebestraum No.3
                          </button>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('Nocturne Op.9 No.2.mid')}
                          >
                            Nocturne Op.9 No.2
                          </button>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('Prelude in C.mid')}
                          >
                            Prelude in C
                          </button>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('Rondo AlLa Turca.mid')}
                          >
                            Rondo Alla Turca
                          </button>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('Solfeggietto.mid')}
                          >
                            Solfeggietto
                          </button>
                          <button
                            className="midi-dropdown-item"
                            onClick={() => handleSampleMidiSelect('The Entertainer.mid')}
                          >
                            The Entertainer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
            <input
              type="file"
              accept=".mp3"
              onChange={onAudioFileUpload}
              style={{ display: 'none' }}
              id="audio-file-input"
              ref={audioFileInputRef}
            />
            <div className="premium-button-container">
              {(() => {
                const getTranscriptionLimit = () => {
                  if (!currentUser?.hasPaid) return 0; // Free tier: no transcriptions
                  if (currentUser?.activePlans?.includes('tier1')) return 5; // Tier 1: 5 transcriptions/month
                  if (currentUser?.activePlans?.includes('tier2')) return 20; // Tier 2: 20 transcriptions/month
                  return 0; // Default to no access if no plans found
                };
                const transcriptionLimit = getTranscriptionLimit();
                const hasTranscriptionAccess = transcriptionLimit > 0;
                
                return (
                  <>
                    <label 
                      htmlFor="audio-file-input" 
                      className={`button ${!hasTranscriptionAccess ? 'premium-feature' : ''}`} 
                      disabled={isTranscribingAudio || !hasTranscriptionAccess} 
                      onClick={handleTranscribeClick}
                      onMouseEnter={handlePremiumButtonMouseEnter}
                      onMouseLeave={handlePremiumButtonMouseLeave}
                    >
                      {isTranscribingAudio ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                          Transcribing...
                        </>
                      ) : (
                        <>
                          AI Transcribe
                          {!hasTranscriptionAccess && (
                            <span className="premium-icon" title="Premium Feature">👑</span>
                          )}
                        </>
                      )}
                    </label>
                    {showPremiumTooltip && !hasTranscriptionAccess && (
                      <div 
                        className="premium-tooltip"
                        onMouseEnter={handleTooltipMouseEnter}
                        onMouseLeave={handleTooltipMouseLeave}
                      >
                        <div className="tooltip-content">
                          <div className="tooltip-header">
                            <span className="tooltip-icon">👑</span>
                            <span className="tooltip-title">Premium Feature</span>
                          </div>
                          <p>Upgrade your account to unlock AI Transcription and other premium features.</p>
                          <button 
                            className="tooltip-upgrade-btn"
                            onClick={() => window.open('http://keycraft.org:3000/#membership', '_blank')}
                          >
                            Upgrade Now
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
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
        <div 
          className={`project-card new-project-card ${(() => {
            const getProjectLimit = () => {
              if (!currentUser?.hasPaid) return 1;
              if (currentUser?.activePlans?.includes('tier1')) return 20;
              if (currentUser?.activePlans?.includes('tier2')) return Infinity;
              return 1;
            };
            return projects.length >= getProjectLimit() ? 'premium-locked' : '';
          })()}`} 
          onClick={() => {
            console.log('New Project card clicked, current state:', showNewProjectDropdown);
            setShowNewProjectDropdown(!showNewProjectDropdown);
          }}
          ref={newProjectDropdownRef}
        >
          {!showNewProjectDropdown ? (
            <div className="new-project-card-content">
              <span className="new-project-icon">+</span>
              <span>New Project</span>
              <span className="dropdown-arrow">▼</span>
              {(() => {
                const getProjectLimit = () => {
                  if (!currentUser?.hasPaid) return 1;
                  if (currentUser?.activePlans?.includes('tier1')) return 20;
                  if (currentUser?.activePlans?.includes('tier2')) return Infinity;
                  return 1;
                };
                const projectLimit = getProjectLimit();
                return projects.length >= projectLimit ? (
                  <div className="new-project-premium-notice">
                    <span className="premium-icon">👑</span>
                    <span className="premium-text">
                      {projectLimit === 1 ? "Upgrade for more projects" : 
                       projectLimit === 20 ? "Upgrade to Tier 2 for unlimited projects" : 
                       "Upgrade for more projects"}
                    </span>
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <div className="new-project-options">
              <div className="new-project-options-content">
                <div className="options-section">
                  <div className="options-section-header">Blank Project</div>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNewProjectDropdown(false);
                      handleNewProject();
                    }}
                    disabled={(() => {
                      const getProjectLimit = () => {
                        if (!currentUser?.hasPaid) return 1;
                        if (currentUser?.activePlans?.includes('tier1')) return 20;
                        if (currentUser?.activePlans?.includes('tier2')) return Infinity;
                        return 1;
                      };
                      return projects.length >= getProjectLimit();
                    })()}
                  >
                    New Project
                    {(() => {
                      const getProjectLimit = () => {
                        if (!currentUser?.hasPaid) return 1;
                        if (currentUser?.activePlans?.includes('tier1')) return 20;
                        if (currentUser?.activePlans?.includes('tier2')) return Infinity;
                        return 1;
                      };
                      return projects.length >= getProjectLimit() ? (
                        <span className="premium-icon" title="Project Limit Reached">👑</span>
                      ) : null;
                    })()}
                  </button>
                </div>
                <div className="options-section">
                  <div className="options-section-header">
                    IMPORT MIDI
                    <span 
                      className="info-icon" 
                      title="Hover for more information"
                      onMouseEnter={() => {
                        if (midiInfoTimeoutRef.current) {
                          clearTimeout(midiInfoTimeoutRef.current);
                        }
                        midiInfoTimeoutRef.current = setTimeout(() => setShowMidiInfo(true), 200);
                      }}
                      onMouseLeave={() => {
                        if (midiInfoTimeoutRef.current) {
                          clearTimeout(midiInfoTimeoutRef.current);
                        }
                        midiInfoTimeoutRef.current = setTimeout(() => setShowMidiInfo(false), 300);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="#4287f5"/>
                        <path d="M12 16v-4M12 8h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                  </div>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('midi-file-input').click();
                    }}
                  >
                    Choose File...
                  </button>
                  <input
                    type="file"
                    accept=".mid,.midi"
                    onChange={onMidiFileUpload}
                    style={{ display: 'none' }}
                    id="midi-file-input"
                    disabled={(() => {
                      const getProjectLimit = () => {
                        if (!currentUser?.hasPaid) return 1;
                        if (currentUser?.activePlans?.includes('tier1')) return 20;
                        if (currentUser?.activePlans?.includes('tier2')) return Infinity;
                        return 1;
                      };
                      return projects.length >= getProjectLimit();
                    })()}
                  />
                  <div className={`midi-info-popup ${showMidiInfo ? 'show' : ''}`}>
                      <div className="midi-info-content">
                        <h4>What is MIDI?</h4>
                        <p>Digital format containing musical data (notes, timing, velocity)</p>
                        
                        <h4>How to get MIDI files:</h4>
                        <ul>
                          <li><strong>Download:</strong> Search for free piano MIDI sites</li>
                          <li><strong>Create:</strong> Use KeyCraft to compose your own</li>
                          <li><strong>Convert:</strong> Use KeyCraft's AI transcription</li>
                        </ul>
                        
                        <p><strong>Tip:</strong> Look for .mid or .midi files!</p>
                      </div>
                    </div>
                </div>
                <div className="options-section">
                  <div className="options-section-header">Library MIDI</div>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('Fur Elise.mid');
                    }}
                  >
                    Fur Elise
                  </button>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('Claire de Lune.mid');
                    }}
                  >
                    Claire de Lune
                  </button>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('Fantaisie_Impromptu_Rag_transcription.mid');
                    }}
                  >
                    Fantaisie Impromptu
                  </button>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('Gymnopedie No. 1.mid');
                    }}
                  >
                    Gymnopedie No. 1
                  </button>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('Liebestraum No.3.mid');
                    }}
                  >
                    Liebestraum No.3
                  </button>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('Nocturne Op.9 No.2.mid');
                    }}
                  >
                    Nocturne Op.9 No.2
                  </button>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('Prelude in C.mid');
                    }}
                  >
                    Prelude in C
                  </button>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('Rondo AlLa Turca.mid');
                    }}
                  >
                    Rondo Alla Turca
                  </button>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('Solfeggietto.mid');
                    }}
                  >
                    Solfeggietto
                  </button>
                  <button
                    className="option-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSampleMidiSelect('The Entertainer.mid');
                    }}
                  >
                    The Entertainer
                  </button>
                </div>
              </div>
            </div>
          )}
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
            {!currentUser?.hasPaid ? (
              <div className="free-user-welcome">
                <h3>Welcome to KeyCraft! 🎹</h3>
                <p>As a free user, you can create and work with <strong>one project at a time</strong>.</p>
                <p>Get started by creating your first project!</p>
              </div>
            ) : currentUser?.activePlans?.includes('tier1') ? (
              <div className="free-user-welcome">
                <h3>Welcome to KeyCraft! 🎹</h3>
                <p>As a Tier 1 user, you can create and work with <strong>up to 20 projects</strong>.</p>
                <p>Get started by creating your first project!</p>
              </div>
            ) : (
              <p>No projects found. Get started by creating a new one or uploading a MIDI file!</p>
            )}
          </div>
        )}

        {!isLoadingProjects && !loadError && filteredProjects.length > 0 && (
          filteredProjects.map(project => {
            // Only show premium locked for projects that are actually locked (when user downgrades)
            // Free users can access their existing projects, so no premium overlay needed
            const isPremiumLocked = false; // Free users can access all their existing projects
            console.log(`[ProjectList] Project ${project.name} - isPremiumLocked:`, isPremiumLocked);
            
            return (
              <div 
                key={project.id} 
                className={`project-card ${isPremiumLocked ? 'premium-locked' : ''}`}
                onClick={() => onProjectSelect(project)} // Allow access to existing projects
              >
                <div className="project-thumbnail-placeholder" onClick={() => onProjectSelect(project)}>
                  {project.thumbnailUrl ? (
                    <img src={project.thumbnailUrl} alt={`${project.name} thumbnail`} className="project-thumbnail-img" />
                  ) : (
                    <div className="project-thumbnail-default">No Preview</div>
                  )}
                  {isPremiumLocked && (
                    <div className="premium-overlay">
                      <div className="premium-overlay-content">
                        <span className="premium-icon-large">👑</span>
                        <span className="premium-text">Premium</span>
                      </div>
                    </div>
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
                      if (isPremiumLocked) {
                        alert('Upgrade your account to duplicate projects. Free users can have 1 project at a time.');
                        return;
                      }
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
                      if (isPremiumLocked) {
                        alert('Upgrade your account to edit project names. Free users can have 1 project at a time.');
                        return;
                      }
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
                {/* Mobile premium overlay - covers entire card */}
                {isPremiumLocked && (
                  <div className="mobile-premium-overlay">
                    <div className="premium-overlay-content">
                      <span className="premium-icon-large">👑</span>
                      <span className="premium-text">Premium</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
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
                <div className="progress-fill animated"></div>
              </div>
              <div className="progress-text">
                <span className="loading-dots">Processing</span>
                <div className="spinner-small"></div>
              </div>
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