import React, { useEffect, useState } from 'react';

export default function UnlockModal({ unlock = null, onDismiss = () => {} }) {
  const [isVisible, setIsVisible] = useState(!!unlock);

  useEffect(() => {
    setIsVisible(!!unlock);
    if (unlock) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss();
      }, 3500); // Auto-dismiss after 3.5 seconds
      return () => clearTimeout(timer);
    }
  }, [unlock, onDismiss]);

  if (!isVisible || !unlock) return null;

  return (
    <div className="unlock-modal-overlay">
      <div className="unlock-modal">
        <div className="unlock-animation">
          <div className="unlock-glow" />
          <div className="unlock-icon">
            {unlock.keepsake?.emoji || '🎁'}
          </div>
        </div>

        <div className="unlock-content">
          <h2 className="unlock-title">🗝️ Milestone Unlocked!</h2>
          <h3 className="unlock-subtitle">{unlock.title}</h3>
          <p className="unlock-description">{unlock.description}</p>

          {unlock.keepsake && (
            <div className="unlock-keepsake">
              <div className="unlock-keepsake-emoji">{unlock.keepsake.emoji}</div>
              <div className="unlock-keepsake-info">
                <div className="unlock-keepsake-name">{unlock.keepsake.name}</div>
                <div className="unlock-keepsake-rarity">{unlock.keepsake.rarity}</div>
              </div>
            </div>
          )}

          {unlock.environment && (
            <div className="unlock-environment">
              <div className="unlock-environment-emoji">{unlock.environment.emoji}</div>
              <div className="unlock-environment-info">
                <div className="unlock-environment-name">{unlock.environment.name}</div>
                <div className="unlock-environment-narrative">
                  {unlock.environment.narrative}
                </div>
              </div>
            </div>
          )}

          <p className="unlock-coins">+50 coins</p>
        </div>

        <button
          className="unlock-collect-button"
          onClick={() => {
            setIsVisible(false);
            onDismiss();
          }}
        >
          Collect
        </button>
      </div>
    </div>
  );
}
