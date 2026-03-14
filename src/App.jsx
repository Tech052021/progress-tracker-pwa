import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'progress_tracker_prod_v1';
const ISO_DATE = () => new Date().toISOString().slice(0, 10);

function getWeekId(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getMonthId(dateString = ISO_DATE()) {
  return dateString.slice(0, 7);
}

const defaultData = {
  profile: {
    appName: 'Progress Tracker',
    ownerName: '',
    longTermGoal: 'Director of AI',
    targetCompanies: 'NVIDIA, Google'
  },
  settings: {
    workoutsPerWeek: 5,
    leetcodePerWeek: 4,
    poolPracticePerWeek: 2,
    uvmTopicsPerMonth: 2,
    aiExperimentsPerMonth: 1,
    careerBlockMinutes: 45,
    targetWeight: '',
    currentWeight: ''
  },
  reminders: {
    todayMustWin: 'Workout + solid workday + 30 to 45 minute career block',
    preShotRoutine: 'Stand behind shot, visualize cue ball, commit, smooth stroke.'
  },
  entries: {
    workouts: [],
    weights: [],
    leetcode: [],
    uvm: [],
    ai: [],
    mentor: [],
    bugs: [],
    pool: [],
    weeklyNotes: []
  }
};

function useStoredData() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultData;
    } catch {
      return defaultData;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  return [data, setData];
}

function App() {
  const [data, setData] = useStoredData();
  const [tab, setTab] = useState('dashboard');
  const fileInputRef = useRef(null);

  const addEntry = (bucket, entry) => {
    setData((prev) => ({
      ...prev,
      entries: {
        ...prev.entries,
        [bucket]: [{ id: crypto.randomUUID(), ...entry }, ...prev.entries[bucket]]
      }
    }));
  };

  const removeEntry = (bucket, id) => {
    setData((prev) => ({
      ...prev,
      entries: {
        ...prev.entries,
        [bucket]: prev.entries[bucket].filter((item) => item.id !== id)
      }
    }));
  };

  const currentWeek = getWeekId(ISO_DATE());
  const currentMonth = getMonthId();

  const weekStats = {
    workouts: data.entries.workouts.filter((x) => getWeekId(x.date) === currentWeek).length,
    leetcode: data.entries.leetcode.filter((x) => getWeekId(x.date) === currentWeek).length,
    pool: data.entries.pool.filter((x) => getWeekId(x.date) === currentWeek).length
  };

  const monthStats = {
    uvm: data.entries.uvm.filter((x) => x.date.startsWith(currentMonth)).length,
    ai: data.entries.ai.filter((x) => x.date.startsWith(currentMonth)).length,
    bugs: data.entries.bugs.filter((x) => x.date.startsWith(currentMonth)).length,
    mentor: data.entries.mentor.filter((x) => x.date.startsWith(currentMonth)).length
  };

  const latestWeight = data.entries.weights[0]?.weight || data.settings.currentWeight || '-';

  const weightSeries = useMemo(() => {
    return [...data.entries.weights]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x) => ({ label: x.date.slice(5), value: Number(x.weight) }))
      .filter((x) => !Number.isNaN(x.value));
  }, [data.entries.weights]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `progress-tracker-backup-${ISO_DATE()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      setData(parsed);
      alert('Backup imported successfully.');
    } catch {
      alert('Could not import that file. Please use a valid backup JSON.');
    }
    event.target.value = '';
  };

  const resetAll = () => {
    if (!window.confirm('Reset all tracker data? This cannot be undone.')) return;
    setData(defaultData);
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Production-ready personal tracker</p>
          <h1>{data.profile.appName}</h1>
          <p className="hero-copy">
            Build momentum across career, health, learning, and practice — even when life is messy.
          </p>
          <div className="hero-badges">
            <span className="badge">Goal: {data.profile.longTermGoal}</span>
            <span className="badge">Targets: {data.profile.targetCompanies}</span>
            <span className="badge">{currentWeek}</span>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={exportData}>Export backup</button>
          <button className="secondary" onClick={() => fileInputRef.current?.click()}>Import backup</button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importData} />
        </div>
      </header>

      <section className="card-grid metrics-grid">
        <MetricCard title="Workouts this week" value={weekStats.workouts} subtitle={`Goal ${data.settings.workoutsPerWeek}`} />
        <MetricCard title="LeetCode this week" value={weekStats.leetcode} subtitle={`Goal ${data.settings.leetcodePerWeek}`} />
        <MetricCard title="Pool this week" value={weekStats.pool} subtitle={`Goal ${data.settings.poolPracticePerWeek}`} />
        <MetricCard title="UVM this month" value={monthStats.uvm} subtitle={`Goal ${data.settings.uvmTopicsPerMonth}`} />
        <MetricCard title="Weight" value={latestWeight} subtitle={data.settings.targetWeight ? `Target ${data.settings.targetWeight}` : 'Set target in Settings'} />
      </section>

      <nav className="tabs">
        {['dashboard', 'career', 'health', 'pool', 'settings'].map((item) => (
          <button key={item} className={tab === item ? 'tab active' : 'tab'} onClick={() => setTab(item)}>
            {capitalize(item)}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <>
          <section className="card-grid two-up">
            <section className="card">
              <div className="card-head">
                <h2>Goal progress</h2>
                <p>Weekly and monthly scoreboards</p>
              </div>
              <ProgressRow label="Workouts" value={weekStats.workouts} target={data.settings.workoutsPerWeek} />
              <ProgressRow label="LeetCode" value={weekStats.leetcode} target={data.settings.leetcodePerWeek} />
              <ProgressRow label="Pool" value={weekStats.pool} target={data.settings.poolPracticePerWeek} />
              <ProgressRow label="UVM" value={monthStats.uvm} target={data.settings.uvmTopicsPerMonth} />
              <ProgressRow label="AI" value={monthStats.ai} target={data.settings.aiExperimentsPerMonth} />
            </section>

            <section className="card">
              <div className="card-head">
                <h2>This month snapshot</h2>
                <p>Quick pulse on momentum</p>
              </div>
              <Snapshot label="Bug analyses" value={monthStats.bugs} />
              <Snapshot label="Mentor discussions" value={monthStats.mentor} />
              <Snapshot label="AI experiments" value={monthStats.ai} />
              <Snapshot label="UVM topics" value={monthStats.uvm} />
            </section>
          </section>

          <section className="card-grid two-up">
            <section className="card">
              <div className="card-head">
                <h2>Weight trend</h2>
                <p>Simple built-in chart</p>
              </div>
              <MiniLineChart data={weightSeries} />
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Daily reminder</h2>
                <p>Your minimum successful day</p>
              </div>
              <div className="note-box">{data.reminders.todayMustWin}</div>
              <div className="quick-actions-grid">
                <WorkoutForm onSave={(entry) => addEntry('workouts', entry)} compact />
                <WeightForm onSave={(entry) => addEntry('weights', entry)} compact />
                <LeetCodeForm onSave={(entry) => addEntry('leetcode', entry)} compact />
                <PoolForm onSave={(entry) => addEntry('pool', entry)} compact />
              </div>
            </section>
          </section>
        </>
      )}

      {tab === 'career' && (
        <section className="card-grid two-up">
          <section className="card stack-gap">
            <div className="card-head">
              <h2>Log career progress</h2>
              <p>Build the NVIDIA / Google path one entry at a time</p>
            </div>
            <UVMForm onSave={(entry) => addEntry('uvm', entry)} />
            <AIForm onSave={(entry) => addEntry('ai', entry)} />
            <BugForm onSave={(entry) => addEntry('bugs', entry)} />
            <MentorForm onSave={(entry) => addEntry('mentor', entry)} />
            <WeeklyNoteForm onSave={(entry) => addEntry('weeklyNotes', entry)} />
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Recent career entries</h2>
              <p>Newest first</p>
            </div>
            <EntryList
              items={mergeEntries([
                ['uvm', data.entries.uvm, 'UVM'],
                ['ai', data.entries.ai, 'AI'],
                ['bugs', data.entries.bugs, 'Bug'],
                ['mentor', data.entries.mentor, 'Mentor'],
                ['weeklyNotes', data.entries.weeklyNotes, 'Note']
              ])}
              onDelete={removeEntry}
            />
          </section>
        </section>
      )}

      {tab === 'health' && (
        <section className="card-grid two-up">
          <section className="card stack-gap">
            <div className="card-head">
              <h2>Health logs</h2>
              <p>Track movement and body trend</p>
            </div>
            <WorkoutForm onSave={(entry) => addEntry('workouts', entry)} />
            <WeightForm onSave={(entry) => addEntry('weights', entry)} />
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Recent health entries</h2>
              <p>Workouts and weight</p>
            </div>
            <EntryList
              items={mergeEntries([
                ['workouts', data.entries.workouts.map((x) => ({ ...x, title: `${x.kind} · ${x.duration} min`, details: x.notes || '' })), 'Workout'],
                ['weights', data.entries.weights.map((x) => ({ ...x, title: `${x.weight} lb`, details: '' })), 'Weight']
              ])}
              onDelete={removeEntry}
            />
          </section>
        </section>
      )}

      {tab === 'pool' && (
        <section className="card-grid two-up">
          <section className="card stack-gap">
            <div className="card-head">
              <h2>Pool tracking</h2>
              <p>Practice consistency beats random sessions</p>
            </div>
            <div className="note-box">{data.reminders.preShotRoutine}</div>
            <PoolForm onSave={(entry) => addEntry('pool', entry)} />
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Recent pool sessions</h2>
              <p>Practice and league notes</p>
            </div>
            <EntryList
              items={mergeEntries([
                ['pool', data.entries.pool.map((x) => ({ ...x, title: `${x.mode} · ${x.drill}`, details: `Success: ${x.success}${x.notes ? ` · ${x.notes}` : ''}` })), 'Pool']
              ])}
              onDelete={removeEntry}
            />
          </section>
        </section>
      )}

      {tab === 'settings' && (
        <section className="card stack-gap">
          <div className="card-head">
            <h2>Settings</h2>
            <p>Make the app work for other users and different goals too</p>
          </div>
          <div className="form-grid">
            <TextField label="App name" value={data.profile.appName} onChange={(value) => setData((prev) => ({ ...prev, profile: { ...prev.profile, appName: value } }))} />
            <TextField label="Your name" value={data.profile.ownerName} onChange={(value) => setData((prev) => ({ ...prev, profile: { ...prev.profile, ownerName: value } }))} />
            <TextField label="Long-term goal" value={data.profile.longTermGoal} onChange={(value) => setData((prev) => ({ ...prev, profile: { ...prev.profile, longTermGoal: value } }))} />
            <TextField label="Target companies / targets" value={data.profile.targetCompanies} onChange={(value) => setData((prev) => ({ ...prev, profile: { ...prev.profile, targetCompanies: value } }))} />
            <NumberField label="Workouts per week" value={data.settings.workoutsPerWeek} onChange={(value) => setData((prev) => ({ ...prev, settings: { ...prev.settings, workoutsPerWeek: value } }))} />
            <NumberField label="LeetCode per week" value={data.settings.leetcodePerWeek} onChange={(value) => setData((prev) => ({ ...prev, settings: { ...prev.settings, leetcodePerWeek: value } }))} />
            <NumberField label="Pool sessions per week" value={data.settings.poolPracticePerWeek} onChange={(value) => setData((prev) => ({ ...prev, settings: { ...prev.settings, poolPracticePerWeek: value } }))} />
            <NumberField label="UVM topics per month" value={data.settings.uvmTopicsPerMonth} onChange={(value) => setData((prev) => ({ ...prev, settings: { ...prev.settings, uvmTopicsPerMonth: value } }))} />
            <NumberField label="AI experiments per month" value={data.settings.aiExperimentsPerMonth} onChange={(value) => setData((prev) => ({ ...prev, settings: { ...prev.settings, aiExperimentsPerMonth: value } }))} />
            <NumberField label="Career block minutes" value={data.settings.careerBlockMinutes} onChange={(value) => setData((prev) => ({ ...prev, settings: { ...prev.settings, careerBlockMinutes: value } }))} />
            <TextField label="Target weight" value={data.settings.targetWeight} onChange={(value) => setData((prev) => ({ ...prev, settings: { ...prev.settings, targetWeight: value } }))} />
            <TextField label="Current weight" value={data.settings.currentWeight} onChange={(value) => setData((prev) => ({ ...prev, settings: { ...prev.settings, currentWeight: value } }))} />
          </div>
          <TextAreaField label="Daily reminder" value={data.reminders.todayMustWin} onChange={(value) => setData((prev) => ({ ...prev, reminders: { ...prev.reminders, todayMustWin: value } }))} />
          <TextAreaField label="Pool pre-shot routine" value={data.reminders.preShotRoutine} onChange={(value) => setData((prev) => ({ ...prev, reminders: { ...prev.reminders, preShotRoutine: value } }))} />
          <div className="settings-actions">
            <button className="secondary" onClick={resetAll}>Reset all data</button>
          </div>
        </section>
      )}
    </div>
  );
}

function mergeEntries(groups) {
  return groups
    .flatMap(([bucket, entries, label]) => entries.map((entry) => ({
      bucket,
      label,
      id: entry.id,
      date: entry.date,
      title: entry.title || entry.topic || entry.problem || entry.question || entry.summary || entry.label || `${label} entry`,
      details: entry.details || entry.notes || ''
    })))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function MetricCard({ title, value, subtitle }) {
  return (
    <section className="card metric-card">
      <p className="metric-label">{title}</p>
      <h3 className="metric-value">{value}</h3>
      <p className="metric-subtitle">{subtitle}</p>
    </section>
  );
}

function ProgressRow({ label, value, target }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="progress-row">
      <div className="progress-header">
        <span>{label}</span>
        <span>{value}/{target}</span>
      </div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Snapshot({ label, value }) {
  return (
    <div className="snapshot-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EntryList({ items, onDelete }) {
  if (!items.length) return <div className="empty-state">No entries yet.</div>;
  return (
    <div className="entry-list">
      {items.slice(0, 40).map((item) => (
        <article className="entry-card" key={`${item.bucket}-${item.id}`}>
          <div className="entry-top">
            <span className="chip">{item.label}</span>
            <span className="entry-date">{item.date}</span>
          </div>
          <h4>{item.title}</h4>
          {item.details ? <p>{item.details}</p> : null}
          <button className="link-danger" onClick={() => onDelete(item.bucket, item.id)}>Delete</button>
        </article>
      ))}
    </div>
  );
}

function MiniLineChart({ data }) {
  if (!data.length) return <div className="empty-state">Log a few weight entries to see the trend.</div>;
  const width = 480;
  const height = 220;
  const pad = 24;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = data.map((d, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(1, data.length - 1);
    const y = height - pad - ((d.value - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Weight trend chart">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="axis" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="axis" />
        <polyline points={points} className="trend-line" />
        {data.map((d, i) => {
          const x = pad + (i * (width - pad * 2)) / Math.max(1, data.length - 1);
          const y = height - pad - ((d.value - min) / span) * (height - pad * 2);
          return <circle key={`${d.label}-${i}`} cx={x} cy={y} r="4" className="trend-dot" />;
        })}
      </svg>
      <div className="chart-labels">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function BaseForm({ title, children, compact = false }) {
  return <div className={compact ? 'mini-form' : 'form-card'}><h3>{title}</h3>{children}</div>;
}

function WorkoutForm({ onSave, compact = false }) {
  const [date, setDate] = useState(ISO_DATE());
  const [kind, setKind] = useState('Strength');
  const [duration, setDuration] = useState(35);
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="Workout" compact={compact}>
      <DateField value={date} onChange={setDate} />
      <SelectField value={kind} onChange={setKind} options={['Strength', 'Cardio', 'Walk', 'Mobility']} />
      <NumberField label="Minutes" value={duration} onChange={setDuration} inline />
      {!compact && <TextAreaField label="Notes" value={notes} onChange={setNotes} />}
      <button className="primary" onClick={() => { onSave({ date, kind, duration, notes }); setNotes(''); }}>Save workout</button>
    </BaseForm>
  );
}

function WeightForm({ onSave, compact = false }) {
  const [date, setDate] = useState(ISO_DATE());
  const [weight, setWeight] = useState('');
  return (
    <BaseForm title="Weight" compact={compact}>
      <DateField value={date} onChange={setDate} />
      <TextField label="Weight" value={weight} onChange={setWeight} inline />
      <button className="primary" onClick={() => { if (!weight) return; onSave({ date, weight }); setWeight(''); }}>Save weight</button>
    </BaseForm>
  );
}

function LeetCodeForm({ onSave, compact = false }) {
  const [date, setDate] = useState(ISO_DATE());
  const [problem, setProblem] = useState('');
  const [topic, setTopic] = useState('Arrays');
  const [difficulty, setDifficulty] = useState('Easy');
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="LeetCode" compact={compact}>
      <DateField value={date} onChange={setDate} />
      <TextField label="Problem" value={problem} onChange={setProblem} inline={compact} />
      {!compact && <SelectField value={topic} onChange={setTopic} options={['Arrays', 'Graphs', 'Recursion', 'DP', 'Trees', 'Misc']} />}
      {!compact && <SelectField value={difficulty} onChange={setDifficulty} options={['Easy', 'Medium', 'Hard']} />}
      {!compact && <TextAreaField label="Notes" value={notes} onChange={setNotes} />}
      <button className="primary" onClick={() => { if (!problem) return; onSave({ date, problem, topic, difficulty, notes }); setProblem(''); setNotes(''); }}>Save coding log</button>
    </BaseForm>
  );
}

function UVMForm({ onSave }) {
  const [date, setDate] = useState(ISO_DATE());
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="UVM topic">
      <DateField value={date} onChange={setDate} />
      <TextField label="Topic" value={topic} onChange={setTopic} />
      <TextAreaField label="What did you learn?" value={notes} onChange={setNotes} />
      <button className="primary" onClick={() => { if (!topic) return; onSave({ date, topic, notes }); setTopic(''); setNotes(''); }}>Save UVM topic</button>
    </BaseForm>
  );
}

function AIForm({ onSave }) {
  const [date, setDate] = useState(ISO_DATE());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="AI experiment">
      <DateField value={date} onChange={setDate} />
      <TextField label="Experiment" value={title} onChange={setTitle} />
      <TextAreaField label="What did you try?" value={notes} onChange={setNotes} />
      <button className="primary" onClick={() => { if (!title) return; onSave({ date, title, notes }); setTitle(''); setNotes(''); }}>Save AI experiment</button>
    </BaseForm>
  );
}

function BugForm({ onSave }) {
  const [date, setDate] = useState(ISO_DATE());
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="Bug analysis">
      <DateField value={date} onChange={setDate} />
      <TextField label="Symptom or root cause" value={summary} onChange={setSummary} />
      <TextAreaField label="Detection point and prevention idea" value={notes} onChange={setNotes} />
      <button className="primary" onClick={() => { if (!summary) return; onSave({ date, summary, notes }); setSummary(''); setNotes(''); }}>Save bug analysis</button>
    </BaseForm>
  );
}

function MentorForm({ onSave }) {
  const [date, setDate] = useState(ISO_DATE());
  const [question, setQuestion] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="Mentor insight">
      <DateField value={date} onChange={setDate} />
      <TextField label="Question or insight" value={question} onChange={setQuestion} />
      <TextAreaField label="What did you learn?" value={notes} onChange={setNotes} />
      <button className="primary" onClick={() => { if (!question) return; onSave({ date, question, notes }); setQuestion(''); setNotes(''); }}>Save mentor insight</button>
    </BaseForm>
  );
}

function PoolForm({ onSave, compact = false }) {
  const [date, setDate] = useState(ISO_DATE());
  const [mode, setMode] = useState('Practice');
  const [drill, setDrill] = useState('');
  const [success, setSuccess] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="Pool session" compact={compact}>
      <DateField value={date} onChange={setDate} />
      <SelectField value={mode} onChange={setMode} options={['Practice', 'League', 'Match']} />
      <TextField label="Drill or session" value={drill} onChange={setDrill} inline={compact} />
      {!compact && <TextField label="Success rate" value={success} onChange={setSuccess} />}
      {!compact && <TextAreaField label="Notes" value={notes} onChange={setNotes} />}
      <button className="primary" onClick={() => { if (!drill) return; onSave({ date, mode, drill, success, notes }); setDrill(''); setSuccess(''); setNotes(''); }}>Save pool session</button>
    </BaseForm>
  );
}

function WeeklyNoteForm({ onSave }) {
  const [date, setDate] = useState(ISO_DATE());
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="Quick note">
      <DateField value={date} onChange={setDate} />
      <TextField label="Label" value={label} onChange={setLabel} />
      <TextAreaField label="Notes" value={notes} onChange={setNotes} />
      <button className="primary" onClick={() => { if (!label) return; onSave({ date, label, notes }); setLabel(''); setNotes(''); }}>Save note</button>
    </BaseForm>
  );
}

function DateField({ value, onChange }) {
  return (
    <label className="field">
      <span>Date</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextField({ label, value, onChange, inline = false }) {
  return (
    <label className={inline ? 'field inline-field' : 'field'}>
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange, inline = false }) {
  return (
    <label className={inline ? 'field inline-field' : 'field'}>
      <span>{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
  );
}

function TextAreaField({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows="3" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SelectField({ value, onChange, options }) {
  return (
    <label className="field">
      <span>Type</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default App;
