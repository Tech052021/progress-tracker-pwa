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

  const updateCategoryName = (catId, name) => {
    setDraft((d) => ({ categories: d.categories.map(c => c.id === catId ? { ...c, name } : c) }));
  };

  const addCategory = () => {
    setDraft((d) => ({ categories: [...d.categories, { id: uid(), name: 'New Category', goals: [] }] }));
  };

  const removeCategory = (catId) => {
    if (!window.confirm('Delete this category?')) return;
    setDraft((d) => ({ categories: d.categories.filter(c => c.id !== catId) }));
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
  return (
    <div className="modal-backdrop" onClick={() => { if (typeof onClose === 'function') onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <section className="card stack-gap">
          <div className="card-head">
            <h2>Settings</h2>
            <p>Customize categories, goals and weekly/monthly targets.</p>
          </div>

          <div>
            {draft.categories.map((cat) => (
              <div className="form-card" key={cat.id} style={{ marginBottom: 12 }}>
                <div className="category-header" style={{ marginBottom: 8 }}>
                  <input className="category-name" value={cat.name} onChange={(e) => updateCategoryName(cat.id, e.target.value)} />
                  <button className="secondary" onClick={() => removeCategory(cat.id)}>Delete category</button>
                </div>

                <div className="goals-list">
                  {cat.goals.map((g) => (
                    <div className="goal-row" key={g.id}>
                      <input className="goal-name" autoFocus={g.id === lastAddedGoalId} value={g.name} onChange={(e) => { updateGoal(cat.id, g.id, { name: e.target.value }); if (lastAddedGoalId === g.id) setLastAddedGoalId(null); }} />
                      <input className="goal-target" type="number" value={g.target} onChange={(e) => updateGoal(cat.id, g.id, { target: Number(e.target.value) })} />
                      <select className="goal-period" value={g.period} onChange={(e) => updateGoal(cat.id, g.id, { period: e.target.value })}>
                        <option value="week">/week</option>
                        <option value="month">/month</option>
                        <option value="target">target</option>
                      </select>
                      <button className="secondary" onClick={() => removeGoal(cat.id, g.id)}>Delete</button>
                    </div>
                  ))}

                  <div style={{ marginTop: 8 }}>
                    <button className="secondary" onClick={() => addGoal(cat.id)}>Add goal</button>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 8 }}>
              <button className="primary" onClick={addCategory}>Add category</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="secondary" onClick={cancel}>Cancel</button>
              <button className="primary" onClick={apply}>Apply</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
