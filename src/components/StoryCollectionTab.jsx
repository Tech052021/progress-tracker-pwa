import React, { useMemo, useState } from 'react';
import { ENVIRONMENTS, KEEPSAKE_TYPES } from '../data/questMilestones';
import { getUnlockedKeepsakes, getUnlockedEnvironments } from '../services/questService';

export default function StoryCollectionTab({ questData, streakDays, totalLogs }) {
  const [activeView, setActiveView] = useState('tale'); // 'tale', 'keepsakes', 'environments'
  const [expandedChapterIndex, setExpandedChapterIndex] = useState(null);

  const chapters = questData?.chapters || [];
  const unlockedKeepsakes = useMemo(
    () => getUnlockedKeepsakes(questData),
    [questData]
  );

  const unlockedEnvironments = useMemo(
    () => getUnlockedEnvironments(questData),
    [questData]
  );

  const chapterNumber = chapters.length;

  // Build locked keepsakes for display
  const allKeepsakes = useMemo(() => {
    return KEEPSAKE_TYPES.map((keepsake) => ({
      ...keepsake,
      unlocked: unlockedKeepsakes.some((k) => k.id === keepsake.id)
    }));
  }, [unlockedKeepsakes]);

  // Build locked environments
  const allEnvironments = useMemo(() => {
    return ENVIRONMENTS.map((env) => ({
      ...env,
      unlocked: unlockedEnvironments.some((e) => e.id === env.id)
    }));
  }, [unlockedEnvironments]);

  return (
    <div className="story-collection-view">
      {/* Hero Section */}
      <div className="card story-hero">
        <div className="story-hero-inner">
          <div className="story-hero-text">
            <div className="story-hero-eyebrow">Your Quest</div>
            <h2 className="story-hero-title">Chapter {chapterNumber}</h2>
            <p className="story-hero-subtitle">
              {chapterNumber === 0
                ? 'Your story awaits. Log your first activity to begin.'
                : `You have written ${chapterNumber} chapter${chapterNumber !== 1 ? 's' : ''} so far.`}
            </p>
            {unlockedEnvironments.length > 0 && (
              <p className="story-hero-location">
                🏛️ You have unlocked {unlockedEnvironments.length} location{unlockedEnvironments.length !== 1 ? 's' : ''}.
              </p>
            )}
          </div>
          <div className="story-hero-emoji">
            {unlockedEnvironments.length > 0
              ? unlockedEnvironments[unlockedEnvironments.length - 1].emoji
              : '📖'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="story-tabs">
        <button
          className={`story-tab ${activeView === 'tale' ? 'active' : ''}`}
          onClick={() => setActiveView('tale')}
        >
          📖 Tale ({chapters.length})
        </button>
        <button
          className={`story-tab ${activeView === 'keepsakes' ? 'active' : ''}`}
          onClick={() => setActiveView('keepsakes')}
        >
          🎁 Keepsakes ({unlockedKeepsakes.length})
        </button>
        <button
          className={`story-tab ${activeView === 'environments' ? 'active' : ''}`}
          onClick={() => setActiveView('environments')}
        >
          🗺️ Locations ({unlockedEnvironments.length})
        </button>
      </div>

      {/* Tale Timeline */}
      {activeView === 'tale' && (
        <div className="story-tale-view">
          {chapters.length === 0 ? (
            <div className="story-empty-state">
              <p>Your tale hasn't begun yet. Log an activity to write your first chapter.</p>
            </div>
          ) : (
            <div className="story-timeline">
              {chapters.map((chapter, idx) => (
                <div
                  key={chapter.id}
                  className={`story-entry ${expandedChapterIndex === idx ? 'expanded' : ''}`}
                >
                  <div
                    className="story-entry-header"
                    onClick={() =>
                      setExpandedChapterIndex(
                        expandedChapterIndex === idx ? null : idx
                      )
                    }
                  >
                    <div className="story-entry-dot" />
                    <div className="story-entry-metadata">
                      <div className="story-entry-chapter">Chapter {idx + 1}</div>
                      <div className="story-entry-time">
                        {new Date(chapter.timestamp).toLocaleDateString()}{' '}
                        {new Date(chapter.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="story-entry-arrow">
                      {expandedChapterIndex === idx ? '▼' : '▶'}
                    </div>
                  </div>

                  <div className="story-entry-content">
                    <h4 className="story-entry-title">{chapter.title}</h4>
                    <p className="story-entry-narrative">{chapter.story}</p>
                    <div className="story-entry-stats">
                      <span className="story-stat">+{chapter.coins} coins</span>
                      {chapter.categoryName && (
                        <span className="story-stat">
                          📌 {chapter.categoryName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Keepsakes Grid */}
      {activeView === 'keepsakes' && (
        <div className="story-keepsakes-view">
          <div className="keepsakes-grid">
            {allKeepsakes.map((keepsake) => (
              <div
                key={keepsake.id}
                className={`keepsake-badge ${keepsake.unlocked ? 'unlocked' : 'locked'}`}
                style={keepsake.unlocked ? { color: keepsake.color } : {}}
                title={keepsake.description}
              >
                <div className="keepsake-emoji">{keepsake.emoji}</div>
                <div className="keepsake-name">{keepsake.name}</div>
                {!keepsake.unlocked && <div className="keepsake-lock">🔒</div>}
              </div>
            ))}
          </div>
          {unlockedKeepsakes.length > 0 && (
            <p className="story-collection-count">
              You have collected {unlockedKeepsakes.length} of {allKeepsakes.length} keepsakes.
            </p>
          )}
        </div>
      )}

      {/* Environments Carousel */}
      {activeView === 'environments' && (
        <div className="story-environments-view">
          <div className="environments-carousel">
            {allEnvironments.map((env) => (
              <div
                key={env.id}
                className={`environment-card ${env.unlocked ? 'unlocked' : 'locked'}`}
                style={env.unlocked ? { background: env.color } : {}}
              >
                {env.unlocked ? (
                  <>
                    <div className="environment-emoji">{env.emoji}</div>
                    <h4 className="environment-name">{env.name}</h4>
                    <p className="environment-description">{env.description}</p>
                    <p className="environment-narrative">{env.narrative}</p>
                  </>
                ) : (
                  <>
                    <div className="environment-emoji-locked">🔒</div>
                    <h4 className="environment-name">{env.name}</h4>
                    <p className="environment-locked-hint">
                      Keep going to unlock this location.
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
          {unlockedEnvironments.length > 0 && (
            <p className="story-collection-count">
              You have discovered {unlockedEnvironments.length} of {allEnvironments.length} locations.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
