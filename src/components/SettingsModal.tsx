/**
 * Settings modal for basic configuration (backup and appearance).
 */

import React, { useState } from 'react';
import { FiX, FiDownload, FiSun, FiMoon, FiGithub } from 'react-icons/fi';
import { backend, BackendCapabilities } from '../utils/api';
import '../styles/SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  backendCapabilities?: BackendCapabilities;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme = 'light',
  onThemeToggle,
}) => {
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleBackupAllData = async () => {
    setIsBackingUp(true);
    try {
      setProgress('Creating backup...');
      const blob = await backend.backupAllData();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prompt-assemble-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="quick-items-section">
            <button
              className="quick-item-btn"
              onClick={onThemeToggle}
              title="Toggle dark/light mode"
              style={{ background: '#3b82f6', borderColor: '#2563eb', color: 'white' }}
            >
              {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
            </button>

            <button
              className="quick-item-btn download-btn"
              onClick={handleBackupAllData}
              disabled={isBackingUp}
              title="Download backup"
            >
              <FiDownload size={20} />
            </button>

            <a
              href="https://github.com/HominemAI/prompt-assemble-ui"
              target="_blank"
              rel="noopener noreferrer"
              className="quick-item-btn"
              title="View on GitHub"
            >
              <FiGithub size={20} />
            </a>
          </div>

          {error && <div className="error-message">{error}</div>}
          {progress && <p className="progress-message">{progress}</p>}


          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
