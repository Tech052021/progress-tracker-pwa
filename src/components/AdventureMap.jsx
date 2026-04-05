import { useState } from 'react';

// ─── Theme definitions ─────────────────────────────────────────────────────────
const THEMES = {
  wilderness: {
    bg: 'linear-gradient(175deg,#0f1f0f 0%,#1a2e1a 20%,#2d4a2d 55%,#4a7040 80%,#5a8a50 100%)',
    accent: '#7ec850',
    pathColor: '#a8e063',
    starField: false,
    icon: '🏕️',
    label: 'Wilderness Adventure',
    stopIcons: ['🌲', '⛺', '🏔️', '🦅', '🌟', '⛰️', '🌿'],
  },
  ocean: {
    bg: 'linear-gradient(175deg,#020c1b 0%,#041d35 20%,#062d55 55%,#0a4a80 80%,#1260a8 100%)',
    accent: '#26c6da',
    pathColor: '#80deea',
    starField: false,
    icon: '🌊',
    label: 'Ocean Explorer',
    stopIcons: ['🐚', '🐡', '⚓', '🐙', '💎', '🦑', '🪸'],
  },
  space: {
    bg: 'linear-gradient(175deg,#020812 0%,#050d20 20%,#0d1437 55%,#1a1b50 80%,#2d1b69 100%)',
    accent: '#9c6fff',
    pathColor: '#ce93d8',
    starField: true,
    icon: '🚀',
    label: 'Space Odyssey',
    stopIcons: ['🚀', '⭐', '🪐', '🌙', '🌟', '🛸', '💫'],
  },
  kingdom: {
    bg: 'linear-gradient(175deg,#0d0a1a 0%,#1a0f2e 20%,#2d1b47 55%,#4a2d6b 80%,#7c4d9a 100%)',
    accent: '#ffd700',
    pathColor: '#ffe082',
    starField: true,
    icon: '👑',
    label: 'Kingdom Quest',
    stopIcons: ['🏰', '⚔️', '👑', '🗺️', '💰', '🛡️', '🧙'],
  },
};

const THEME_KEYS = Object.keys(THEMES);

function genId() {
  try { return crypto.randomUUID(); } catch { return String(Math.random()).slice(2); }
}

function calcPct(ms) {
  const tasks = ms.tasks || [];
  const total = tasks.reduce((s, t) => s + Math.max(0, Number(t.target) || 0), 0);
  const logged = tasks.reduce((s, t) => s + Math.max(0, Number(t.logged) || 0), 0);
  return total > 0 ? Math.min(100, Math.round((logged / total) * 100)) : 0;
}

function emptyMilestone(index) {
  return {
    id: genId(),
    label: `Milestone ${index + 1}`,
    targetDate: '',
    tasks: [{ id: genId(), text: '', target: 1, logged: 0, unit: '' }],
    notes: '',
  };
}

// ─── MilestonePanel ────────────────────────────────────────────────────────────
function MilestonePanel({ milestone, status, accent, stopIcon, onClose, onUpdate, onLogTask, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => ({
    ...milestone,
    tasks: (milestone.tasks || []).map(t => ({ ...t })),
  }));

  function handleTaskLog(taskId, delta) {
    const updated = {
      ...milestone,
      tasks: (milestone.tasks || []).map(t =>
        t.id === taskId
          ? { ...t, logged: Math.max(0, Math.min(Number(t.target) || 0, (Number(t.logged) || 0) + delta)) }
          : t
      ),
    };
    onLogTask(updated);
  }

  function handleSaveDraft() {
    const cleanedTasks = (draft.tasks || []).filter(t => String(t.text || '').trim());
    onUpdate({ ...draft, tasks: cleanedTasks.length ? cleanedTasks : (draft.tasks || []) });
    setEditing(false);
  }

  function cancelEdit() {
    setDraft({ ...milestone, tasks: (milestone.tasks || []).map(t => ({ ...t })) });
    setEditing(false);
  }

  function addDraftTask() {
    setDraft(d => ({ ...d, tasks: [...(d.tasks || []), { id: genId(), text: '', target: 1, logged: 0, unit: '' }] }));
  }

  function removeDraftTask(taskId) {
    setDraft(d => ({ ...d, tasks: (d.tasks || []).filter(t => t.id !== taskId) }));
  }

  function updateDraftTask(taskId, field, value) {
    setDraft(d => ({
      ...d,
      tasks: (d.tasks || []).map(t => t.id === taskId ? { ...t, [field]: value } : t),
    }));
  }

  const pct = calcPct(milestone);
  const tasks = milestone.tasks || [];

  const badgeLabel = status === 'past'
    ? (pct >= 100 ? '✓ Completed' : `${pct}% — Past`)
    : status === 'current' ? '⚡ In Progress'
    : '🔭 Planned';

  return (
    <div className="am-panel" role="dialog" aria-modal="true" aria-label={`Milestone: ${milestone.label}`}>
      <div className="am-panel-inner">
        <div className="am-panel-handle" />

        {/* Header */}
        <div className="am-panel-header">
          <span className="am-panel-stop-icon" aria-hidden="true">{stopIcon}</span>
          <div className="am-panel-title-group">
            <h3 className="am-panel-title">{milestone.label || 'Untitled milestone'}</h3>
            {milestone.targetDate && (
              <span className="am-panel-date">By {milestone.targetDate}</span>
            )}
          </div>
          <span className={`am-panel-badge am-panel-badge--${status}`}>{badgeLabel}</span>
          <button className="am-panel-close" onClick={onClose} aria-label="Close panel">✕</button>
        </div>

        {/* Progress bar */}
        <div className="am-panel-progress">
          <div className="am-panel-progress-track">
            <div className="am-panel-progress-fill" style={{ width: `${pct}%`, background: accent }} />
          </div>
          <span className="am-panel-pct" style={{ color: accent }}>{pct}%</span>
        </div>

        {/* Tasks section */}
        <div className="am-panel-tasks">
          <div className="am-panel-tasks-head">
            <span>Tasks</span>
            {status !== 'past' && !editing && (
              <button className="am-panel-edit-btn" onClick={() => setEditing(true)}>Edit plan</button>
            )}
          </div>

          {!editing ? (
            tasks.length > 0 ? tasks.map(task => {
              const taskTarget = Number(task.target) || 0;
              const taskLogged = Number(task.logged) || 0;
              const taskPct = taskTarget > 0 ? Math.min(100, Math.round((taskLogged / taskTarget) * 100)) : 0;
              return (
                <div className="am-task-row" key={task.id}>
                  <div className="am-task-info">
                    <span className="am-task-text">{task.text || 'Untitled task'}</span>
                    <span className="am-task-count">
                      {taskLogged}/{taskTarget}{task.unit ? ` ${task.unit}` : ''}
                    </span>
                  </div>
                  <div className="am-task-bar-wrap">
                    <div className="am-task-bar">
                      <div className="am-task-fill" style={{ width: `${taskPct}%`, background: accent }} />
                    </div>
                    <span className="am-task-pct">{taskPct}%</span>
                  </div>
                  {status === 'current' && (
                    <div className="am-task-log-btns">
                      <button
                        onClick={() => handleTaskLog(task.id, -1)}
                        aria-label={`Decrease ${task.text}`}
                        disabled={taskLogged <= 0}
                      >−</button>
                      <button
                        onClick={() => handleTaskLog(task.id, 1)}
                        aria-label={`Increase ${task.text}`}
                        disabled={taskLogged >= taskTarget}
                      >+</button>
                    </div>
                  )}
                  {status === 'past' && (
                    <span className={`am-task-done-badge${taskPct >= 100 ? ' full' : ''}`}>
                      {taskPct >= 100 ? '✓' : `${taskPct}%`}
                    </span>
                  )}
                </div>
              );
            }) : (
              <p className="am-panel-empty">No tasks planned yet.{status !== 'past' ? ' Click "Edit plan" to add some.' : ''}</p>
            )
          ) : (
            /* Edit mode */
            <div className="am-edit-form">
              <div className="am-edit-field">
                <label>Milestone name</label>
                <input
                  value={draft.label}
                  onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                  placeholder="e.g. Month 1 Foundation"
                />
              </div>
              <div className="am-edit-field">
                <label>Target date</label>
                <input
                  type="date"
                  value={draft.targetDate}
                  onChange={e => setDraft(d => ({ ...d, targetDate: e.target.value }))}
                />
              </div>
              <div className="am-edit-tasks-head">Tasks <span className="am-edit-tasks-hint">(description · target · unit)</span></div>
              {(draft.tasks || []).map(task => (
                <div className="am-edit-task-row" key={task.id}>
                  <input
                    className="am-edit-task-text"
                    value={task.text}
                    onChange={e => updateDraftTask(task.id, 'text', e.target.value)}
                    placeholder="e.g. Exercise sessions"
                  />
                  <input
                    className="am-edit-task-num"
                    type="number"
                    min="1"
                    value={task.target}
                    onChange={e => updateDraftTask(task.id, 'target', Math.max(1, Number(e.target.value) || 1))}
                  />
                  <input
                    className="am-edit-task-unit"
                    value={task.unit}
                    onChange={e => updateDraftTask(task.id, 'unit', e.target.value)}
                    placeholder="unit"
                  />
                  <button className="am-edit-task-remove" onClick={() => removeDraftTask(task.id)} aria-label="Remove task">✕</button>
                </div>
              ))}
              <button className="am-edit-add-task" onClick={addDraftTask}>+ Add task</button>

              <div className="am-edit-field" style={{ marginTop: 14 }}>
                <label>Notes (optional)</label>
                <textarea
                  value={draft.notes}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Anything useful to remember for this milestone..."
                  rows={2}
                />
              </div>
              <div className="am-edit-actions">
                <button className="secondary" onClick={cancelEdit}>Cancel</button>
                <button className="primary" onClick={handleSaveDraft}>Save milestone</button>
              </div>
            </div>
          )}

          {status === 'past' && (
            <p className="am-panel-history-note">
              📜 Past milestones are read-only — they're part of your journey history.
            </p>
          )}

          {milestone.notes && !editing && (
            <div className="am-panel-notes">
              <strong>Notes:</strong> {milestone.notes}
            </div>
          )}

          {status !== 'past' && !editing && (
            <button className="am-panel-delete-btn" onClick={onDelete}>
              Remove this milestone
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AdventureMap ──────────────────────────────────────────────────────────────
export default function AdventureMap({ goal, onClose, onUpdateMilestones, onUpdateTheme }) {
  const today = new Date().toISOString().slice(0, 10);
  const [activeIdx, setActiveIdx] = useState(null);

  const themeKey = THEME_KEYS.includes(goal.theme) ? goal.theme : 'wilderness';
  const theme = THEMES[themeKey];
  const milestones = goal.milestones || [];

  // Enrich milestones with computed status
  const enriched = milestones.map((ms, i) => ({
    ...ms,
    pct: calcPct(ms),
    isPast: ms.targetDate ? ms.targetDate < today : false,
    index: i,
  }));

  const currentIdx = enriched.findIndex(ms => !ms.isPast && ms.pct < 100);

  function getStatus(ms, idx) {
    if (ms.isPast || ms.pct >= 100) return 'past';
    if (idx === currentIdx) return 'current';
    return 'future';
  }

  const overallPct = enriched.length > 0
    ? Math.round(enriched.reduce((s, ms) => s + ms.pct, 0) / enriched.length)
    : 0;

  function handleUpdateMilestone(idx, updated) {
    onUpdateMilestones(milestones.map((ms, i) => i === idx ? { ...ms, ...updated } : ms));
  }

  function handleLogTask(idx, updatedMilestone) {
    onUpdateMilestones(milestones.map((ms, i) => i === idx ? updatedMilestone : ms));
  }

  function handleDeleteMilestone(idx) {
    onUpdateMilestones(milestones.filter((_, i) => i !== idx));
    setActiveIdx(null);
  }

  function handleAddMilestone() {
    const next = [...milestones, emptyMilestone(milestones.length)];
    onUpdateMilestones(next);
    setActiveIdx(next.length - 1);
  }

  const activeMilestone = activeIdx !== null ? enriched[activeIdx] : null;
  const activeStatus = activeMilestone ? getStatus(activeMilestone, activeIdx) : null;

  return (
    <div className="am-overlay" role="dialog" aria-modal="true" aria-label={`Journey map: ${goal.name}`}>
      <div className="am-modal">

        {/* ── Header ── */}
        <div className="am-header">
          <div className="am-header-left">
            <span className="am-goal-icon" aria-hidden="true">{theme.icon}</span>
            <div>
              <div className="am-goal-name">{goal.name}</div>
              <div className="am-theme-label">{theme.label}</div>
            </div>
          </div>
          <div className="am-theme-switcher" role="group" aria-label="Choose theme">
            {THEME_KEYS.map(k => (
              <button
                key={k}
                className={`am-theme-btn${k === themeKey ? ' active' : ''}`}
                onClick={() => onUpdateTheme(k)}
                title={THEMES[k].label}
                aria-label={`${THEMES[k].label} theme`}
                aria-pressed={k === themeKey}
              >
                {THEMES[k].icon}
              </button>
            ))}
          </div>
          <button className="am-close-btn" onClick={onClose} aria-label="Close journey map">✕</button>
        </div>

        {/* ── Scene ── */}
        <div className="am-scene" style={{ background: theme.bg }}>

          {/* Star field (space / kingdom) */}
          {theme.starField && (
            <div className="am-stars" aria-hidden="true">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className="am-star"
                  style={{
                    left: `${(i * 137.5) % 100}%`,
                    top: `${(i * 97.3) % 88}%`,
                    animationDelay: `${(i * 0.7) % 3}s`,
                    fontSize: i % 3 === 0 ? '10px' : '6px',
                  }}
                >✦</span>
              ))}
            </div>
          )}

          {/* Journey stops */}
          <div className="am-journey">
            {enriched.length === 0 ? (
              <div className="am-empty-state">
                <div className="am-empty-icon">🗺️</div>
                <p>No checkpoints yet.</p>
                <p>Add your first milestone to begin the journey.</p>
              </div>
            ) : enriched.map((ms, i) => {
              const status = getStatus(ms, i);
              const stopIcon = theme.stopIcons[i % theme.stopIcons.length];
              const isCurrent = status === 'current';
              const circumference = 2 * Math.PI * 17; // r=17

              return (
                <div key={ms.id} className={`am-stop am-stop--${status}${activeIdx === i ? ' am-stop--active' : ''}`}>
                  {/* Dashed connector from previous stop */}
                  {i > 0 && (
                    <div className="am-connector" style={{ '--path-color': theme.pathColor }} aria-hidden="true" />
                  )}

                  <button
                    className="am-stop-btn"
                    onClick={() => setActiveIdx(activeIdx === i ? null : i)}
                    aria-label={`${ms.label} — ${ms.pct}% complete — tap to ${activeIdx === i ? 'close' : 'open'}`}
                    aria-expanded={activeIdx === i}
                  >
                    {/* Circle node with SVG progress ring */}
                    <div className="am-stop-node" style={{ '--accent': theme.accent }}>
                      <span className="am-stop-num">{i + 1}</span>
                      <span className="am-stop-icon" aria-hidden="true">{stopIcon}</span>
                      <svg className="am-ring" viewBox="0 0 40 40" aria-hidden="true">
                        <circle className="am-ring-bg" cx="20" cy="20" r="17" />
                        <circle
                          className="am-ring-fill"
                          cx="20" cy="20" r="17"
                          style={{
                            stroke: theme.accent,
                            strokeDasharray: `${(ms.pct / 100) * circumference} ${circumference}`,
                          }}
                        />
                      </svg>
                      {isCurrent && <span className="am-current-dot" aria-hidden="true" />}
                    </div>

                    {/* Text info */}
                    <div className="am-stop-info">
                      <span className="am-stop-label">{ms.label}</span>
                      <div className="am-stop-bar-wrap">
                        <div className="am-stop-bar">
                          <div
                            className="am-stop-fill"
                            style={{ width: `${ms.pct}%`, background: theme.accent }}
                          />
                        </div>
                        <span className="am-stop-pct">{ms.pct}%</span>
                      </div>
                      {ms.targetDate && (
                        <span className="am-stop-date">By {ms.targetDate}</span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}

            {/* Add milestone */}
            <div className="am-add-stop-wrap">
              {enriched.length > 0 && <div className="am-connector am-connector--dashed" style={{ '--path-color': theme.pathColor }} aria-hidden="true" />}
              <button
                className="am-add-stop"
                onClick={handleAddMilestone}
                style={{ '--accent': theme.accent }}
              >
                + Add milestone
              </button>
            </div>
          </div>

          {/* Overall progress footer */}
          {enriched.length > 0 && (
            <div className="am-footer">
              <div className="am-overall" style={{ color: theme.accent }}>
                {overallPct}% Complete
              </div>
              <div className="am-path-dots" role="tablist" aria-label="Milestone navigation">
                {enriched.map((ms, i) => (
                  <button
                    key={ms.id}
                    className={`am-path-dot am-path-dot--${getStatus(ms, i)}${activeIdx === i ? ' am-path-dot--active' : ''}`}
                    style={getStatus(ms, i) === 'current' ? { background: theme.accent, borderColor: theme.accent } : {}}
                    onClick={() => setActiveIdx(i === activeIdx ? null : i)}
                    aria-label={`${ms.label} (${ms.pct}%)`}
                    title={ms.label}
                    role="tab"
                    aria-selected={activeIdx === i}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Milestone Panel (slide-up) ── */}
        {activeMilestone && (
          <MilestonePanel
            key={activeIdx}
            milestone={activeMilestone}
            status={activeStatus}
            accent={theme.accent}
            stopIcon={theme.stopIcons[activeIdx % theme.stopIcons.length]}
            onClose={() => setActiveIdx(null)}
            onUpdate={updated => handleUpdateMilestone(activeIdx, updated)}
            onLogTask={updated => handleLogTask(activeIdx, updated)}
            onDelete={() => handleDeleteMilestone(activeIdx)}
          />
        )}
      </div>
    </div>
  );
}
