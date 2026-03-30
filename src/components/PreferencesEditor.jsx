import React, { useState } from 'react';

function migrateUnits(data) {
  const settings = data.settings || {};
  const units = settings.units || {};
  return {
    weight: units.weight || settings.weightUnit || 'lb',
    duration: units.duration || settings.durationUnit || 'min'
  };
}

export default function PreferencesEditor({ data, setData, onClose }) {
  const [units, setUnits] = useState(() => migrateUnits(data));

  const apply = () => {
    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        units: {
          ...prev.settings.units,
          weight: units.weight,
          duration: units.duration
        }
      }
    }));
    if (typeof onClose === 'function') onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <section className="card stack-gap">
          <div className="card-head">
            <h2>Settings</h2>
            <p>Adjust tracking preferences without changing your goals or planning structure.</p>
          </div>

          <div className="form-card">
            <h3>Tracking preferences</h3>
            <div className="goal-planner-grid">
              <label className="field">
                <span>Weight unit</span>
                <select value={units.weight} onChange={(e) => setUnits((prev) => ({ ...prev, weight: e.target.value }))}>
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                </select>
              </label>
              <label className="field">
                <span>Duration unit</span>
                <select value={units.duration} onChange={(e) => setUnits((prev) => ({ ...prev, duration: e.target.value }))}>
                  <option value="min">min</option>
                  <option value="hr">hr</option>
                </select>
              </label>
            </div>
            <p className="helper-text" style={{ marginBottom: 0 }}>
              Goal editing and planning now live in the Goals workspace. Backup import/export remains available in the header.
            </p>
          </div>

          <div className="settings-actions settings-actions-sticky" style={{ marginTop: 16 }}>
            <button className="secondary" onClick={onClose}>Cancel</button>
            <button className="primary" onClick={apply}>Apply</button>
          </div>
        </section>
      </div>
    </div>
  );
}
