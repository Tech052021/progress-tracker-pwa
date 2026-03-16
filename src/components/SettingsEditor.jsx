import React, { useEffect, useState } from 'react';

function uid() {
  try { return crypto.randomUUID(); } catch { return String(Math.random()).slice(2); }
}

function migrateCategories(data) {
  const s = data.settings || {};
  if (Array.isArray(s.categories) && s.categories.length) return JSON.parse(JSON.stringify(s.categories));

  const categories = [];

  // Health
  categories.push({
    id: uid(),
    name: 'Health',
    goals: [
      { id: uid(), name: 'Workout', target: Number(s.workoutsPerWeek || 5), period: 'week' },
      { id: uid(), name: 'Weight', target: s.targetWeight ? Number(s.targetWeight) : 0, period: 'target' }
    ]
  });

  // Learning
  categories.push({
    id: uid(),
    name: 'Learning',
    goals: [
      { id: uid(), name: 'LeetCode', target: Number(s.leetcodePerWeek || 4), period: 'week' }
    ]
  });

  // Practice / Sports
  categories.push({
    id: uid(),
    name: 'Practice',
    goals: [
      { id: uid(), name: 'Pool', target: Number(s.poolPracticePerWeek || 2), period: 'week' },
      { id: uid(), name: 'UVM', target: Number(s.uvmTopicsPerMonth || 2), period: 'month' }
    ]
  });

  return categories;
}

export default function SettingsEditor({ data, setData, onClose }) {
  const [draft, setDraft] = useState(() => ({ categories: migrateCategories(data) }));
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
    setDraft((d) => ({ categories: d.categories.map(c => c.id === catId ? { ...c, name } : c) }));
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
    setDraft((d) => ({ categories: [...d.categories, { id: newId, name, goals: [] }] }));
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
      return { categories: remaining };
    });
  };

  const addGoal = (catId) => {
    const newId = uid();
    setDraft((d) => ({ categories: d.categories.map(c => c.id === catId ? { ...c, goals: [...c.goals, { id: newId, name: 'New Goal', target: 0, period: 'week' }] } : c) }));
    setLastAddedGoalId(newId);
  };

  const removeGoal = (catId, goalId) => {
    if (!window.confirm('Delete this goal?')) return;
    setDraft((d) => ({ categories: d.categories.map(c => c.id === catId ? { ...c, goals: c.goals.filter(g => g.id !== goalId) } : c) }));
  };

  const updateGoal = (catId, goalId, patch) => {
    setDraft((d) => ({ categories: d.categories.map(c => c.id === catId ? { ...c, goals: c.goals.map(g => g.id === goalId ? { ...g, ...patch } : g) } : c) }));
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

    const workoutsPerWeek = findGoalTarget(draft.categories, 'workout');
    const leetcodePerWeek = findGoalTarget(draft.categories, 'leetcode');
    const poolPracticePerWeek = findGoalTarget(draft.categories, 'pool');
    const uvmTopicsPerMonth = findGoalTarget(draft.categories, 'uvm');
    const aiExperimentsPerMonth = findGoalTarget(draft.categories, 'ai');
    const targetWeight = findGoalTarget(draft.categories, 'weight');

    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        categories: draft.categories,
        workoutsPerWeek,
        leetcodePerWeek,
        poolPracticePerWeek,
        uvmTopicsPerMonth,
        aiExperimentsPerMonth,
        targetWeight: targetWeight || prev.settings.targetWeight || ''
      }
    }));
    alert('Settings applied');
    if (typeof onClose === 'function') onClose();
  };

  const cancel = () => {
    setDraft({ categories: migrateCategories(data) });
    if (typeof onClose === 'function') onClose();
  };

  const activeCat = draft.categories.find(c => c.id === activeCatId) || (draft.categories[0] || null);

  return (
    <div className="modal-backdrop" onClick={() => { if (typeof onClose === 'function') onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <section className="card stack-gap">
          <div className="card-head">
            <h2>Settings</h2>
            <p>Customize categories, goals and weekly/monthly targets.</p>
          </div>

          <div>
            {/* Tabs for categories */}
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

            {/* Show only the active category's form */}
            {activeCat ? (
              <div className="form-card" key={activeCat.id} style={{ marginBottom: 12 }}>
                <div className="category-header" style={{ marginBottom: 8 }}>
                  <input className="category-name" value={activeCat.name} onChange={(e) => updateCategoryName(activeCat.id, e.target.value)} />
                  <button className="secondary" onClick={() => removeCategory(activeCat.id)}>Delete category</button>
                </div>

                <div className="goals-list">
                  {activeCat.goals.map((g) => (
                    <div className="goal-row" key={g.id}>
                      <input className="goal-name" autoFocus={g.id === lastAddedGoalId} value={g.name} onChange={(e) => { updateGoal(activeCat.id, g.id, { name: e.target.value }); if (lastAddedGoalId === g.id) setLastAddedGoalId(null); }} />
                      <input className="goal-target" type="number" value={g.target} onChange={(e) => updateGoal(activeCat.id, g.id, { target: Number(e.target.value) })} />
                      <select className="goal-period" value={g.period} onChange={(e) => updateGoal(activeCat.id, g.id, { period: e.target.value })}>
                        <option value="week">/week</option>
                        <option value="month">/month</option>
                        <option value="target">target</option>
                      </select>
                      <button className="secondary" onClick={() => removeGoal(activeCat.id, g.id)}>Delete</button>
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

