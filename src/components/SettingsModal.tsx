/**
 * Settings modal for basic configuration (backup and appearance).
 */

import React, { useState } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import { backend } from '../utils/api';
import '../styles/SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
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
          <div className="settings-section">
            <h3>📦 Backup</h3>
            <p className="settings-description">
              Download a ZIP file containing all your prompts, variable sets, and metadata.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleBackupAllData}
              disabled={isBackingUp}
            >
              <FiDownload size={18} />
              {isBackingUp ? 'Creating Backup...' : 'Download Backup'}
            </button>
            {error && <div className="error-message">{error}</div>}
            {progress && <p className="progress-message">{progress}</p>}
          </div>

          <div className="settings-section">
            <h3>🎨 Appearance</h3>
            <p className="settings-description">
              Choose your preferred color scheme.
            </p>
            <div className="theme-toggle">
              <button
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={onThemeToggle}
                title="Toggle light/dark mode"
              >
                {theme === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </button>
            </div>
          </div>

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
