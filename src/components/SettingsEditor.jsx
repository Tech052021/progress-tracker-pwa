import React, { useEffect, useState } from 'react';

const LB_PER_KG = 2.20462;

function uid() {
  try { return crypto.randomUUID(); } catch { return String(Math.random()).slice(2); }
}

function inferGoalUnit(goalName, weightUnit = 'lb') {
  const n = String(goalName || '').toLowerCase();
  if (n.includes('weight')) return weightUnit;
  if (n.includes('workout') || n.includes('pool')) return 'sessions';
  if (n.includes('leetcode') || n.includes('problem')) return 'problems';
  if (n.includes('uvm') || n.includes('topic')) return 'topics';
  return 'count';
}

function migrateCategories(data) {
  const s = data.settings || {};
  const weightUnit = s.units?.weight || s.weightUnit || 'lb';
  if (Array.isArray(s.categories) && s.categories.length) {
    return s.categories.map((category) => ({
      ...category,
      goals: Array.isArray(category.goals)
        ? category.goals.map((goal) => ({ ...goal, unit: goal.unit || inferGoalUnit(goal.name, weightUnit) }))
        : []
    }));
  }

  const categories = [];

  // Health
  categories.push({
    id: uid(),
    name: 'Health',
    goals: [
      { id: uid(), name: 'Workout', target: Number(s.workoutsPerWeek || 5), period: 'week', unit: 'sessions' },
      { id: uid(), name: 'Weight', target: s.targetWeight ? Number(s.targetWeight) : 0, period: 'target', unit: weightUnit }
    ]
  });

  // Learning
  categories.push({
    id: uid(),
    name: 'Learning',
    goals: [
      { id: uid(), name: 'LeetCode', target: Number(s.leetcodePerWeek || 4), period: 'week', unit: 'problems' }
    ]
  });

  // Practice / Sports
  categories.push({
    id: uid(),
    name: 'Practice',
    goals: [
      { id: uid(), name: 'Pool', target: Number(s.poolPracticePerWeek || 2), period: 'week', unit: 'sessions' },
      { id: uid(), name: 'UVM', target: Number(s.uvmTopicsPerMonth || 2), period: 'month', unit: 'topics' }
    ]
  });

  return categories;
}

function migrateProfile(data) {
  const p = data.profile || {};
  return {
    longTermGoal: p.longTermGoal || '',
    targetDescriptor: p.targetDescriptor || p.targetCompanies || '',
    targetDate: p.targetDate || ''
  };
}

function migrateGoalPlan(data) {
  const incomingGoals = Array.isArray(data.goalPlan?.shortTermGoals) ? data.goalPlan.shortTermGoals : [];
  const incomingActions = Array.isArray(data.goalPlan?.actionItems) ? data.goalPlan.actionItems : [];

  return {
    shortTermGoals: incomingGoals.map((goal) => ({
      id: goal.id || uid(),
      title: goal.title || '',
      targetValue: Number(goal.targetValue) || 0,
      currentValue: Number(goal.currentValue) || 0,
      dueDate: goal.dueDate || ''
    })),
    actionItems: incomingActions.map((item) => ({
      id: item.id || uid(),
      title: item.title || '',
      goalId: item.goalId || '',
      dueDate: item.dueDate || '',
      status: item.status === 'done' ? 'done' : 'todo'
    }))
  };
}

function migrateUnits(data) {
  const s = data.settings || {};
  const units = s.units || {};
  return {
    weight: units.weight || s.weightUnit || 'lb',
    duration: units.duration || s.durationUnit || 'min'
  };
}

function convertWeightValue(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  const converted = fromUnit === 'lb' ? parsed / LB_PER_KG : parsed * LB_PER_KG;
  return Math.round(converted * 10) / 10;
}

function convertWeightGoals(categories, fromUnit, toUnit) {
  if (fromUnit === toUnit) return categories;
  return categories.map((category) => ({
    ...category,
    goals: category.goals.map((goal) => {
      const unitLower = String(goal.unit || '').toLowerCase();
      const isExplicitWeightUnit = unitLower === 'lb' || unitLower === 'kg';
      const isWeightGoal = (String(goal.name).toLowerCase().includes('weight') && goal.period === 'target') || isExplicitWeightUnit;
      if (!isWeightGoal) return goal;
      return { ...goal, target: convertWeightValue(goal.target, fromUnit, toUnit), unit: toUnit };
    })
  }));
}

export default function SettingsEditor({ data, setData, onClose }) {
  const sectionTabs = [
    { id: 'profile', label: 'Long-term goal' },
    { id: 'shortGoals', label: 'Short-term goals' },
    { id: 'actions', label: 'Action items' },
    { id: 'categories', label: 'Categories and goals' },
    { id: 'units', label: 'Units' }
  ];

  const [draft, setDraft] = useState(() => ({
    profile: migrateProfile(data),
    goalPlan: migrateGoalPlan(data),
    units: migrateUnits(data),
    categories: migrateCategories(data)
  }));
  const [activeSection, setActiveSection] = useState('profile');
  // Track last added goal so we can autofocus its name input
  const [lastAddedGoalId, setLastAddedGoalId] = useState(null);
  // Add-category dialog state (do not mutate categories until save)
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [pendingCategoryName, setPendingCategoryName] = useState('');
  // Active category shown in the editor (tabs)
  const [activeCatId, setActiveCatId] = useState(() => {
    const initial = migrateCategories(data);
    return initial && initial.length ? initial[0].id : null;
  });

  useEffect(() => {
    // Ensure activeCatId stays valid if categories change externally
    if (!draft.categories || !draft.categories.length) {
      setActiveCatId(null);
      return;
    }
    if (!draft.categories.find(c => c.id === activeCatId)) {
      setActiveCatId(draft.categories[0].id);
    }
  }, [draft.categories, activeCatId]);

  const updateCategoryName = (catId, name) => {
    setDraft((d) => ({ ...d, categories: d.categories.map(c => c.id === catId ? { ...c, name } : c) }));
  };

  const addCategory = () => {
    setPendingCategoryName('');
    setShowAddCategoryDialog(true);
  };

  const confirmAddCategory = () => {
    const name = pendingCategoryName.trim();
    if (!name) {
      alert('Category name cannot be blank');
      return;
    }
    if (draft.categories.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) {
      alert('A category with this name already exists');
      return;
    }

    const newId = uid();
    setDraft((d) => ({ ...d, categories: [...d.categories, { id: newId, name, goals: [] }] }));
    // Activate the newly added category so the user can edit goals immediately.
    setActiveCatId(newId);
    setShowAddCategoryDialog(false);
    setPendingCategoryName('');
  };

  const cancelAddCategory = () => {
    setShowAddCategoryDialog(false);
    setPendingCategoryName('');
  };

  const removeCategory = (catId) => {
    if (!window.confirm('Delete this category?')) return;
    setDraft((d) => {
      const remaining = d.categories.filter(c => c.id !== catId);
      // choose a sensible active category after deletion
      const nextActive = remaining.length ? remaining[0].id : null;
      setActiveCatId(nextActive);
      return { ...d, categories: remaining };
    });
  };

  const addGoal = (catId) => {
    const newId = uid();
    setDraft((d) => ({ ...d, categories: d.categories.map(c => c.id === catId ? { ...c, goals: [...c.goals, { id: newId, name: 'New Goal', target: 0, period: 'week', unit: 'count' }] } : c) }));
    setLastAddedGoalId(newId);
  };

  const removeGoal = (catId, goalId) => {
    if (!window.confirm('Delete this goal?')) return;
    setDraft((d) => ({ ...d, categories: d.categories.map(c => c.id === catId ? { ...c, goals: c.goals.filter(g => g.id !== goalId) } : c) }));
  };

  const updateGoal = (catId, goalId, patch) => {
    setDraft((d) => ({ ...d, categories: d.categories.map(c => c.id === catId ? { ...c, goals: c.goals.map(g => g.id === goalId ? { ...g, ...patch } : g) } : c) }));
  };

  const updateProfile = (patch) => {
    setDraft((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  };

  const updateUnits = (patch) => {
    setDraft((d) => {
      const nextUnits = { ...d.units, ...patch };
      let nextCategories = d.categories;

      if (patch.weight && patch.weight !== d.units.weight) {
        nextCategories = convertWeightGoals(d.categories, d.units.weight, patch.weight);
      }

      return { ...d, units: nextUnits, categories: nextCategories };
    });
  };

  const addShortTermGoal = () => {
    setDraft((d) => ({
      ...d,
      goalPlan: {
        ...d.goalPlan,
        shortTermGoals: [...d.goalPlan.shortTermGoals, { id: uid(), title: '', targetValue: 1, currentValue: 0, dueDate: '' }]
      }
    }));
  };

  const updateShortTermGoal = (goalId, patch) => {
    setDraft((d) => ({
      ...d,
      goalPlan: {
        ...d.goalPlan,
        shortTermGoals: d.goalPlan.shortTermGoals.map((goal) => goal.id === goalId ? { ...goal, ...patch } : goal)
      }
    }));
  };

  const removeShortTermGoal = (goalId) => {
    if (!window.confirm('Delete this short-term goal?')) return;
    setDraft((d) => ({
      ...d,
      goalPlan: {
        ...d.goalPlan,
        shortTermGoals: d.goalPlan.shortTermGoals.filter((goal) => goal.id !== goalId),
        actionItems: d.goalPlan.actionItems.map((item) => item.goalId === goalId ? { ...item, goalId: '' } : item)
      }
    }));
  };

  const addActionItem = () => {
    setDraft((d) => ({
      ...d,
      goalPlan: {
        ...d.goalPlan,
        actionItems: [...d.goalPlan.actionItems, { id: uid(), title: '', goalId: '', dueDate: '', status: 'todo' }]
      }
    }));
  };

  const updateActionItem = (itemId, patch) => {
    setDraft((d) => ({
      ...d,
      goalPlan: {
        ...d.goalPlan,
        actionItems: d.goalPlan.actionItems.map((item) => item.id === itemId ? { ...item, ...patch } : item)
      }
    }));
  };

  const removeActionItem = (itemId) => {
    if (!window.confirm('Delete this action item?')) return;
    setDraft((d) => ({
      ...d,
      goalPlan: {
        ...d.goalPlan,
        actionItems: d.goalPlan.actionItems.filter((item) => item.id !== itemId)
      }
    }));
  };

  function findGoalTarget(categories, nameMatcher) {
    for (const c of categories) {
      for (const g of c.goals) {
        if (g.name.toLowerCase().includes(nameMatcher)) return Number(g.target || 0);
      }
    }
    return 0;
  }

  const apply = () => {
    // basic validation
    for (const c of draft.categories) {
      if (!c.name.trim()) { alert('Category names cannot be blank'); return; }
      for (const g of c.goals) if (!g.name.trim()) { alert('Goal names cannot be blank'); return; }
    }
    if (!draft.profile.longTermGoal.trim()) {
      alert('Long-term goal cannot be blank');
      return;
    }
    for (const goal of draft.goalPlan.shortTermGoals) {
      if (!goal.title.trim()) { alert('Short-term goal title cannot be blank'); return; }
    }
    for (const item of draft.goalPlan.actionItems) {
      if (!item.title.trim()) { alert('Action item title cannot be blank'); return; }
    }

    const prevWeightUnit = data.settings?.units?.weight || 'lb';
    const nextWeightUnit = draft.units.weight;
    const categoriesToPersist = draft.categories;

    const workoutsPerWeek = findGoalTarget(categoriesToPersist, 'workout');
    const leetcodePerWeek = findGoalTarget(categoriesToPersist, 'leetcode');
    const poolPracticePerWeek = findGoalTarget(categoriesToPersist, 'pool');
    const uvmTopicsPerMonth = findGoalTarget(categoriesToPersist, 'uvm');
    const aiExperimentsPerMonth = findGoalTarget(categoriesToPersist, 'ai');
    const targetWeight = findGoalTarget(categoriesToPersist, 'weight');

    setData((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        longTermGoal: draft.profile.longTermGoal,
        targetDescriptor: draft.profile.targetDescriptor,
        targetDate: draft.profile.targetDate,
        targetCompanies: draft.profile.targetDescriptor
      },
      goalPlan: {
        shortTermGoals: draft.goalPlan.shortTermGoals,
        actionItems: draft.goalPlan.actionItems
      },
      settings: {
        ...prev.settings,
        categories: categoriesToPersist,
        workoutsPerWeek,
        leetcodePerWeek,
        poolPracticePerWeek,
        uvmTopicsPerMonth,
        aiExperimentsPerMonth,
        targetWeight: targetWeight || prev.settings.targetWeight || '',
        currentWeight: convertWeightValue(prev.settings.currentWeight, prevWeightUnit, nextWeightUnit),
        units: {
          weight: draft.units.weight,
          duration: draft.units.duration
        }
      },
      entries: {
        ...prev.entries,
        weights: prev.entries.weights.map((entry) => ({
          ...entry,
          weight: convertWeightValue(entry.weight, prevWeightUnit, nextWeightUnit)
        }))
      }
    }));
    alert('Settings applied');
    if (typeof onClose === 'function') onClose();
  };

  const cancel = () => {
    setDraft({
      profile: migrateProfile(data),
      goalPlan: migrateGoalPlan(data),
      units: migrateUnits(data),
      categories: migrateCategories(data)
    });
    if (typeof onClose === 'function') onClose();
  };

  const activeCat = draft.categories.find(c => c.id === activeCatId) || (draft.categories[0] || null);

  return (
    <div className="modal-backdrop" onClick={() => { if (typeof onClose === 'function') onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <section className="card stack-gap">
          <div className="card-head">
            <h2>Settings</h2>
            <p>Customize long-term goal, target date, short-term plan, and category goals.</p>
          </div>

          <div>
            <div className="settings-hint" style={{ marginBottom: 12 }}>
              <strong>How these settings affect tracking:</strong>
              <p>
                Long-term goal appears in the header. Short-term goals and action items appear in Dashboard Roadmap and drive progress percentages.
              </p>
            </div>

            <div className="settings-section-tabs">
              <p className="helper-text" style={{ marginTop: 0 }}>
                Use these tabs to edit everything: long-term plan, short-term milestones, action items, categories/goals, and units.
              </p>
              <div className="tabs" role="tablist" aria-label="Settings sections">
                {sectionTabs.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={`tab ${activeSection === section.id ? 'active' : ''}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>

            {activeSection === 'profile' && (
              <div className="form-card" style={{ marginBottom: 12 }}>
                <h3>Term goal details</h3>
                <div className="goal-planner-grid">
                  <label className="field">
                    <span>Target</span>
                    <input value={draft.profile.targetDescriptor} onChange={(e) => updateProfile({ targetDescriptor: e.target.value })} placeholder="Example: Director role at NVIDIA/Google" />
                  </label>
                  <label className="field goal-planner-full">
                    <span>Long-term goal</span>
                    <input value={draft.profile.longTermGoal} onChange={(e) => updateProfile({ longTermGoal: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Target date</span>
                    <input type="date" value={draft.profile.targetDate} onChange={(e) => updateProfile({ targetDate: e.target.value })} />
                  </label>
                </div>
              </div>
            )}

            {activeSection === 'units' && (
              <div className="form-card" style={{ marginBottom: 12 }}>
                <div className="card-head">
                  <h3>Units</h3>
                  <p>Choose how values are displayed and entered across the tracker.</p>
                </div>
                <div className="goal-planner-grid">
                  <label className="field">
                    <span>Weight unit</span>
                    <select value={draft.units.weight} onChange={(e) => updateUnits({ weight: e.target.value })}>
                      <option value="lb">lb (imperial)</option>
                      <option value="kg">kg (metric)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Workout duration unit</span>
                    <select value={draft.units.duration} onChange={(e) => updateUnits({ duration: e.target.value })}>
                      <option value="min">minutes</option>
                      <option value="hr">hours</option>
                    </select>
                  </label>
                </div>
                <p className="helper-text">When weight unit changes, existing weight logs and targets are auto-converted.</p>
              </div>
            )}

            {activeSection === 'shortGoals' && (
              <div className="form-card" style={{ marginBottom: 12 }}>
                <div className="card-head">
                  <h3>Short-term goals</h3>
                  <p>Define measurable milestones so progress can be tracked.</p>
                </div>
                <div className="planner-columns" aria-hidden="true">
                  <span>Milestone</span>
                  <span>Done</span>
                  <span>Target</span>
                  <span>Due date</span>
                  <span>Progress</span>
                  <span>Action</span>
                </div>
                {draft.goalPlan.shortTermGoals.map((goal) => {
                  const percent = goal.targetValue > 0 ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)) : 0;
                  return (
                    <div className="goal-planner-row" key={goal.id}>
                      <div className="mobile-field" data-label="Milestone">
                        <input
                          value={goal.title}
                          onChange={(e) => updateShortTermGoal(goal.id, { title: e.target.value })}
                          placeholder="Milestone title (example: Complete 30 C++ problems)"
                          aria-label="Short-term milestone title"
                        />
                      </div>
                      <div className="mobile-field" data-label="Done">
                        <input
                          type="number"
                          min="0"
                          value={goal.currentValue}
                          onChange={(e) => updateShortTermGoal(goal.id, { currentValue: Number(e.target.value) || 0 })}
                          placeholder="Done"
                          aria-label="Completed amount"
                        />
                      </div>
                      <div className="mobile-field" data-label="Target">
                        <input
                          type="number"
                          min="1"
                          value={goal.targetValue}
                          onChange={(e) => updateShortTermGoal(goal.id, { targetValue: Number(e.target.value) || 1 })}
                          placeholder="Target"
                          aria-label="Target amount"
                        />
                      </div>
                      <div className="mobile-field" data-label="Due date">
                        <input type="date" value={goal.dueDate} onChange={(e) => updateShortTermGoal(goal.id, { dueDate: e.target.value })} aria-label="Milestone due date" />
                      </div>
                      <div className="mobile-field" data-label="Progress">
                        <span className="goal-progress-chip">{percent}%</span>
                      </div>
                      <div className="mobile-field" data-label="Action">
                        <button className="secondary" onClick={() => removeShortTermGoal(goal.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
                <p className="helper-text">Example: Done `3`, Target `10` means you are 30% complete.</p>
                <button className="secondary" onClick={addShortTermGoal}>Add short-term goal</button>
              </div>
            )}

            {activeSection === 'actions' && (
              <div className="form-card" style={{ marginBottom: 12 }}>
                <div className="card-head">
                  <h3>Action items</h3>
                  <p>Break milestones into executable tasks and mark completion.</p>
                </div>
                <div className="planner-columns action-columns" aria-hidden="true">
                  <span>Action item</span>
                  <span>Linked milestone</span>
                  <span>Status</span>
                  <span>Due date</span>
                  <span>Action</span>
                </div>
                {draft.goalPlan.actionItems.map((item) => (
                  <div className="goal-planner-row action-row" key={item.id}>
                    <div className="mobile-field" data-label="Action item">
                      <input value={item.title} onChange={(e) => updateActionItem(item.id, { title: e.target.value })} placeholder="Action item" />
                    </div>
                    <div className="mobile-field" data-label="Linked milestone">
                      <select value={item.goalId} onChange={(e) => updateActionItem(item.id, { goalId: e.target.value })}>
                        <option value="">Link milestone</option>
                        {draft.goalPlan.shortTermGoals.map((goal) => (
                          <option key={goal.id} value={goal.id}>{goal.title || 'Untitled goal'}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mobile-field" data-label="Status">
                      <select value={item.status} onChange={(e) => updateActionItem(item.id, { status: e.target.value })}>
                        <option value="todo">To do</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div className="mobile-field" data-label="Due date">
                      <input type="date" value={item.dueDate} onChange={(e) => updateActionItem(item.id, { dueDate: e.target.value })} />
                    </div>
                    <div className="mobile-field" data-label="Action">
                      <button className="secondary" onClick={() => removeActionItem(item.id)}>Delete</button>
                    </div>
                  </div>
                ))}
                <button className="secondary" onClick={addActionItem}>Add action item</button>
              </div>
            )}

            {activeSection === 'categories' && (
              <>
                <div className="settings-tabs">
                  <div className="tabs" role="tablist">
                    {draft.categories.map((cat) => (
                      <button key={cat.id} type="button" className={`tab ${cat.id === activeCatId ? 'active' : ''}`} onClick={() => setActiveCatId(cat.id)}>{cat.name}</button>
                    ))}
                  </div>
                  <div style={{ marginLeft: 12 }}>
                    <button className="secondary" onClick={addCategory}>Add category</button>
                  </div>
                </div>

                {activeCat ? (
                  <div className="form-card" key={activeCat.id} style={{ marginBottom: 12 }}>
                    <div className="category-header" style={{ marginBottom: 8 }}>
                      <input className="category-name" value={activeCat.name} onChange={(e) => updateCategoryName(activeCat.id, e.target.value)} />
                      <button className="secondary" onClick={() => removeCategory(activeCat.id)}>Delete category</button>
                    </div>
                    <p className="helper-text" style={{ marginTop: 0 }}>Set the unit explicitly for each goal (examples: sessions, pages, kg, hours). Weight goals use {draft.units.weight} by default.</p>

                    <div className="planner-columns category-columns" aria-hidden="true">
                      <span>Goal name</span>
                      <span>Target number</span>
                      <span>Unit</span>
                      <span>Frequency</span>
                      <span>Action</span>
                    </div>

                    <div className="goals-list">
                      {activeCat.goals.map((g) => (
                        <div className="goal-row" key={g.id}>
                          <div className="mobile-field" data-label="Goal name">
                            <input className="goal-name" autoFocus={g.id === lastAddedGoalId} value={g.name} onChange={(e) => { updateGoal(activeCat.id, g.id, { name: e.target.value }); if (lastAddedGoalId === g.id) setLastAddedGoalId(null); }} placeholder="Goal name (example: Workout)" aria-label="Category goal name" />
                          </div>
                          <div className="mobile-field" data-label="Target number">
                            <input className="goal-target" type="number" value={g.target} onChange={(e) => updateGoal(activeCat.id, g.id, { target: Number(e.target.value) })} placeholder="Target" aria-label="Category goal target" />
                          </div>
                          <div className="mobile-field" data-label="Unit">
                            <input className="goal-unit" value={g.unit || ''} onChange={(e) => updateGoal(activeCat.id, g.id, { unit: e.target.value })} placeholder="sessions / kg / pages" aria-label="Category goal unit" />
                          </div>
                          <div className="mobile-field" data-label="Frequency">
                            <select className="goal-period" value={g.period} onChange={(e) => updateGoal(activeCat.id, g.id, { period: e.target.value })}>
                              <option value="week">/week</option>
                              <option value="month">/month</option>
                              <option value="target">target</option>
                            </select>
                          </div>
                          <div className="mobile-field" data-label="Action">
                            <button className="secondary" onClick={() => removeGoal(activeCat.id, g.id)}>Delete</button>
                          </div>
                        </div>
                      ))}

                      <div style={{ marginTop: 8 }}>
                        <button className="secondary" onClick={() => addGoal(activeCat.id)}>Add goal</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    No categories defined. Add one to get started.
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="secondary" onClick={cancel}>Cancel</button>
              <button className="primary" onClick={apply}>Apply</button>
            </div>
          </div>

          {showAddCategoryDialog && (
            <div className="submodal-backdrop" onClick={cancelAddCategory}>
              <div className="submodal-content" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: 8 }}>Add category</h3>
                <p style={{ marginBottom: 12, color: '#64748b' }}>
                  Create a category name. It will be added only after you click Save.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    confirmAddCategory();
                  }}
                >
                  <input
                    autoFocus
                    value={pendingCategoryName}
                    onChange={(e) => setPendingCategoryName(e.target.value)}
                    placeholder="Example: Career"
                  />
                  <div className="submodal-actions">
                    <button type="button" className="secondary" onClick={cancelAddCategory}>Cancel</button>
                    <button type="submit" className="primary">Save</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

