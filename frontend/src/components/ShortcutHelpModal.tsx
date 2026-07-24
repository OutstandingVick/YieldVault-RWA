import React from 'react';
import { useKeyboardShortcutContext } from '../context/KeyboardShortcutContext';
import { useTranslation } from '../i18n';
import { Modal } from './Modal';

const ShortcutHelpModal: React.FC = () => {
  const { shortcuts, isHelpModalOpen, closeHelpModal, formatShortcut } = useKeyboardShortcutContext();
  const { t } = useTranslation();

  const groupedShortcuts = shortcuts.reduce<Record<string, typeof shortcuts>>((acc, shortcut) => {
    const scope = shortcut.scope || 'General';
    if (!acc[scope]) acc[scope] = [];
    acc[scope].push(shortcut);
    return acc;
  }, {});

  return (
    <Modal
      isOpen={isHelpModalOpen}
      onClose={closeHelpModal}
      title={t('shortcuts.title')}
      size="md"
      aria-labelledby="shortcut-help-title"
    >
      <div style={{ marginTop: '16px' }}>
        {Object.entries(groupedShortcuts).map(([scope, scopeShortcuts]) => (
          <div key={scope} style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px'
            }}>
              {scope}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {scopeShortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--bg-card)',
                    borderRadius: '8px'
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>
                    {shortcut.description}
                  </span>
                  <kbd style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'monospace',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '4px',
                    color: 'var(--accent-cyan)',
                    minWidth: '24px',
                    textAlign: 'center'
                  }}>
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginTop: '16px',
          marginBottom: 0
        }}>
          {t('shortcuts.hint')}
        </p>
      </div>
    </Modal>
  );
};

export default ShortcutHelpModal;
