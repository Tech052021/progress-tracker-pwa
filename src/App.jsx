import * as React from 'react';
// ensure `React` is available at runtime for any classic-jsx compiled code
try { window.React = React; } catch (e) { /* noop on non-browser */ }
const { useEffect, useMemo, useRef, useState } = React;
import SettingsEditor from './components/SettingsEditor';
import Clock from './components/Clock';

const STORAGE_KEY = 'progress_tracker_prod_v1';
const ISO_DATE = () => new Date().toISOString().slice(0, 10);

function inferGoalUnit(goalName, weightUnit = 'lb') {
  const n = String(goalName || '').toLowerCase();
  if (n.includes('weight')) return weightUnit;
  if (n.includes('workout') || n.includes('pool')) return 'sessions';
  if (n.includes('leetcode') || n.includes('problem')) return 'problems';
  if (n.includes('uvm') || n.includes('topic')) return 'topics';
  return 'count';
}

function normalizeCategories(categories, weightUnit = 'lb') {
  if (!Array.isArray(categories)) return [];
  return categories.map((category) => ({
    ...category,
    goals: Array.isArray(category.goals)
      ? category.goals.map((goal) => ({
        ...goal,
        unit: goal.unit || inferGoalUnit(goal.name, weightUnit)
      }))
      : []
  }));
}

function uid() {
  try { return crypto.randomUUID(); } catch { return String(Math.random()).slice(2); }
}

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

function createEntryTimestamp(dateString = ISO_DATE()) {
  const today = ISO_DATE();
  const normalizedDate = dateString || today;
  const timestampDate = new Date(`${normalizedDate}T00:00:00`);
  if (normalizedDate === today) {
    const now = new Date();
    timestampDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  } else {
    timestampDate.setHours(12, 0, 0, 0);
  }
  return timestampDate.toISOString();
}

function normalizeEntryList(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => {
    const next = { ...entry };
    if (!next.timestamp) {
      next.timestamp = createEntryTimestamp(next.date || ISO_DATE());
    }
    return next;
  });
}

function parseEntryTime(entry) {
  if (entry?.timestamp) {
    const parsed = new Date(entry.timestamp);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (entry?.date) {
    const parsed = new Date(`${entry.date}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function normalizeGoalPeriod(period) {
  const normalized = String(period || '').trim().toLowerCase().replace(/^\//, '');
  return normalized || 'week';
}

function isTargetGoalPeriod(period) {
  return normalizeGoalPeriod(period) === 'target';
}

const defaultData = {
  profile: {
    appName: 'Progress Tracker',
    ownerName: '',
    longTermGoal: 'Director of AI',
    targetDescriptor: 'NVIDIA, Google',
    targetDate: '',
    targetCompanies: 'NVIDIA, Google'
  },
  goalPlan: {
    shortTermGoals: [],
    actionItems: []
  },
  settings: {
    workoutsPerWeek: 5,
    leetcodePerWeek: 4,
    poolPracticePerWeek: 2,
    uvmTopicsPerMonth: 2,
    aiExperimentsPerMonth: 1,
    careerBlockMinutes: 45,
    targetWeight: '',
    currentWeight: '',
    units: {
      weight: 'lb',
      duration: 'min'
    }
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

function NextStrideLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nsOrbGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a183f" />
          <stop offset="100%" stopColor="#102b73" />
        </linearGradient>
        <linearGradient id="nsTrailGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#77ddff" />
          <stop offset="55%" stopColor="#2ec8f5" />
          <stop offset="100%" stopColor="#0d7fd3" />
        </linearGradient>
      </defs>
      <circle cx="72" cy="68" r="44" fill="url(#nsOrbGrad)" />
      <path
        d="M8 100 C 26 84 40 82 58 86 C 73 89 80 84 95 72"
        fill="none"
        stroke="url(#nsTrailGrad)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M36 75 C 50 73 61 68 72 61 C 80 56 86 50 95 41"
        fill="none"
        stroke="#f8fbff"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M44 56 C 57 54 66 50 75 44 C 81 40 86 35 90 31"
        fill="none"
        stroke="#f8fbff"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M53 40 C 64 38 73 34 80 27"
        fill="none"
        stroke="#f8fbff"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M84 34 L106 14 L102 40 Z"
        fill="url(#nsTrailGrad)"
      />
      <path
        d="M31 92 C 40 82 47 76 61 71"
        fill="none"
        stroke="url(#nsTrailGrad)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

function normalizeData(raw) {
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const profile = incoming.profile || {};
  const shortTermGoals = Array.isArray(incoming.goalPlan?.shortTermGoals)
    ? incoming.goalPlan.shortTermGoals.map((goal) => ({
      id: goal.id || uid(),
      title: goal.title || '',
      targetValue: Number(goal.targetValue) || 0,
      currentValue: Number(goal.currentValue) || 0,
      dueDate: goal.dueDate || ''
    }))
    : [];
  const actionItems = Array.isArray(incoming.goalPlan?.actionItems)
    ? incoming.goalPlan.actionItems.map((item) => ({
      id: item.id || uid(),
      title: item.title || '',
      goalId: item.goalId || '',
      dueDate: item.dueDate || '',
      status: item.status === 'done' ? 'done' : 'todo'
    }))
    : [];

  const incomingSettings = incoming.settings || {};
  const incomingUnits = incomingSettings.units || {};
  const normalizedWeightUnit = incomingUnits.weight || incomingSettings.weightUnit || defaultData.settings.units.weight;

  return {
    ...defaultData,
    ...incoming,
    profile: {
      ...defaultData.profile,
      ...profile,
      appName: defaultData.profile.appName,
      targetDescriptor: profile.targetDescriptor || profile.targetCompanies || defaultData.profile.targetDescriptor,
      targetDate: profile.targetDate || ''
    },
    goalPlan: {
      shortTermGoals,
      actionItems
    },
    settings: {
      ...defaultData.settings,
      ...incomingSettings,
      categories: Array.isArray(incomingSettings.categories)
        ? normalizeCategories(incomingSettings.categories, normalizedWeightUnit)
        : incomingSettings.categories,
      units: {
        ...defaultData.settings.units,
        ...incomingUnits,
        weight: normalizedWeightUnit,
        duration: incomingUnits.duration || incomingSettings.durationUnit || defaultData.settings.units.duration
      }
    },
    reminders: {
      ...defaultData.reminders,
      ...(incoming.reminders || {})
    },
    entries: {
      ...defaultData.entries,
      ...Object.fromEntries(
        Object.entries({ ...defaultData.entries, ...(incoming.entries || {}) }).map(([bucket, entries]) => [
          bucket,
          normalizeEntryList(entries)
        ])
      )
    }
  };
}

function useStoredData() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeData(JSON.parse(saved)) : defaultData;
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
  const [dashTab, setDashTab] = useState('overview');
  const [catTab, setCatTab] = useState('goals');
  const [dashLogOpen, setDashLogOpen] = useState(null);
  const [catLogOpen, setCatLogOpen] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { setCatTab('goals'); }, [tab]);
  useEffect(() => { setDashLogOpen(null); }, [dashTab]);
  useEffect(() => { setCatLogOpen(null); }, [tab, catTab]);

  const addEntry = (bucket, entry) => {
    const timestamp = entry.timestamp || createEntryTimestamp(entry.date);
    setData((prev) => ({
      ...prev,
      entries: {
        ...prev.entries,
        [bucket]: [{ id: crypto.randomUUID(), ...entry, timestamp }, ...prev.entries[bucket]]
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
  const currentYear = ISO_DATE().slice(0, 4);
  const nowMs = Date.now();
  const weightUnit = data.settings?.units?.weight || 'lb';
  const durationUnit = data.settings?.units?.duration || 'min';

  const formatGoalValue = (value, unit) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return '-';
    if (!unit || unit === 'count') return `${parsed}`;
    return `${parsed} ${unit}`;
  };

  const formatDurationValue = (minutes) => {
    const parsed = Number(minutes);
    if (Number.isNaN(parsed)) return `${minutes}`;
    if (durationUnit === 'hr') {
      const hours = Math.round((parsed / 60) * 10) / 10;
      return `${hours} hr`;
    }
    return `${Math.round(parsed)} min`;
  };

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

  const today = ISO_DATE();
  const dailyTarget = 3;
  const todayActivityCount = countEntriesOnDate(data.entries, today);
  const activityStreakDays = getActivityStreakDays(data.entries, today);
  const weeklyActivityCount = getRecentActivityCount(data.entries, today, 7);
  const todayProgressPct = Math.min(100, Math.round((todayActivityCount / dailyTarget) * 100));
  const remainingToday = Math.max(0, dailyTarget - todayActivityCount);
  const totalActivityCount = countAllEntries(data.entries);

  const shortTermGoals = data.goalPlan?.shortTermGoals || [];
  const actionItems = data.goalPlan?.actionItems || [];
  const completedActionItems = actionItems.filter((item) => item.status === 'done').length;

  const averageGoalProgress = shortTermGoals.length
    ? Math.round(shortTermGoals.reduce((sum, goal) => {
      if (!goal.targetValue) return sum;
      return sum + Math.min(1, goal.currentValue / goal.targetValue);
    }, 0) / shortTermGoals.length * 100)
    : 0;
  const experiencePoints = (totalActivityCount * 10) + (completedActionItems * 25) + (activityStreakDays * 5);
  const userLevel = Math.max(1, Math.floor(experiencePoints / 250) + 1);
  const levelProgress = experiencePoints % 250;
  const xpToNextLevel = 250 - levelProgress;

  const weightSeries = useMemo(() => {
    return [...data.entries.weights]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x) => ({ label: x.date.slice(5), value: Number(x.weight) }))
      .filter((x) => !Number.isNaN(x.value));
  }, [data.entries.weights]);

  // Helpers to derive categories and goals (fallback to legacy settings)
  const categories = useMemo(() => {
    const s = data.settings || {};
    if (Array.isArray(s.categories) && s.categories.length) return s.categories;

    // fallback: build categories from legacy fields
    return [
      {
        id: 'health',
        name: 'Health',
        goals: [
          { id: 'workout', name: 'Workout', target: Number(s.workoutsPerWeek || 5), period: 'week', unit: 'sessions' },
          { id: 'weight', name: 'Weight', target: s.targetWeight || '', period: 'target', unit: weightUnit }
        ]
      },
      {
        id: 'learning',
        name: 'Learning',
        goals: [{ id: 'leetcode', name: 'LeetCode', target: Number(s.leetcodePerWeek || 4), period: 'week', unit: 'problems' }]
      },
      {
        id: 'practice',
        name: 'Practice',
        goals: [
          { id: 'pool', name: 'Pool', target: Number(s.poolPracticePerWeek || 2), period: 'week', unit: 'sessions' },
          { id: 'uvm', name: 'UVM', target: Number(s.uvmTopicsPerMonth || 2), period: 'month', unit: 'topics' }
        ]
      }
    ];
  }, [data.settings, weightUnit]);

  const normalizedCategories = useMemo(() => normalizeCategories(categories, weightUnit), [categories, weightUnit]);

  const focusGoals = useMemo(() => {
    return normalizedCategories
      .flatMap((category) =>
        (category.goals || []).map((goal) => {
          const current = goalCount(goal);
          const target = Number(goal.target || 0);
          return {
            id: goal.id,
            name: goal.name,
            category: category.name,
            period: goal.period,
            unit: goal.unit,
            current,
            target,
            remaining: Math.max(0, target - current)
          };
        })
      )
      .filter((goal) => !isTargetGoalPeriod(goal.period) && goal.target > 0)
      .sort((a, b) => {
        const aDone = a.remaining <= 0 ? 1 : 0;
        const bDone = b.remaining <= 0 ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return a.remaining - b.remaining;
      })
      .slice(0, 3);
  }, [normalizedCategories, data.entries, currentWeek, currentMonth]);

  const momentumMessage = todayActivityCount >= dailyTarget
    ? 'You hit today\'s target. Keep the streak alive tomorrow.'
    : remainingToday === 1
      ? 'One more action and today is a win.'
      : `${remainingToday} actions left to complete today.`;

  const achievements = [
    { id: 'first-log', label: 'First Step', hint: 'Create your first log entry', unlocked: totalActivityCount >= 1 },
    { id: 'streak-3', label: '3-Day Streak', hint: 'Stay active for 3 days in a row', unlocked: activityStreakDays >= 3 },
    { id: 'streak-7', label: 'Consistency Pro', hint: 'Maintain a 7-day streak', unlocked: activityStreakDays >= 7 },
    { id: 'logs-100', label: '100 Logs Club', hint: 'Reach 100 total logged actions', unlocked: totalActivityCount >= 100 },
    { id: 'actions-10', label: 'Execution Engine', hint: 'Complete 10 action items', unlocked: completedActionItems >= 10 }
  ];
  const unlockedAchievements = achievements.filter((a) => a.unlocked).length;
  const dailyMessages = [
    'Small daily wins beat occasional big efforts.',
    'Your future self is built by what you do today.',
    'Consistency compounds faster than motivation.',
    'Focus on progress, not perfection.',
    'Do the next right action and momentum will follow.'
  ];
  const messageOfTheDay = dailyMessages[Math.abs(today.split('-').join('').split('').reduce((sum, n) => sum + Number(n), 0)) % dailyMessages.length];

  const formatGoalUnit = (goal) => {
    const unit = String(goal.unit || '').trim();
    if (!unit || unit === 'count') return '';
    return ` ${unit}`;
  };

  const formatGoalPeriodForCard = (period) => {
    const normalized = normalizeGoalPeriod(period);
    if (normalized === 'week') return ' this week';
    if (normalized === 'month') return ' this month';
    if (normalized === 'day') return ' today';
    if (normalized === 'hour') return ' last hour';
    if (normalized === 'minute') return ' last minute';
    if (normalized === 'year') return ' this year';
    if (normalized === 'target') return '';
    return ` per ${normalized}`;
  };

  const formatGoalWindowLabel = (period) => {
    const normalized = normalizeGoalPeriod(period);
    if (normalized === 'month') return 'This month';
    if (normalized === 'day') return 'Today';
    if (normalized === 'hour') return 'Last hour';
    if (normalized === 'minute') return 'Last minute';
    if (normalized === 'year') return 'This year';
    if (normalized === 'week') return 'This week';
    return 'Current period';
  };

  function mapGoalToBucket(goalName) {
    const n = String(goalName).toLowerCase();
    if (n.includes('workout')) return 'workouts';
    if (n.includes('weight')) return 'weights';
    if (n.includes('leetcode')) return 'leetcode';
    if (n.includes('uvm')) return 'uvm';
    if (n.includes('ai')) return 'ai';
    if (n.includes('bug') || n.includes('bugs')) return 'bugs';
    if (n.includes('mentor')) return 'mentor';
    if (n.includes('pool')) return 'pool';
    return null;
  }

  function goalCount(goal) {
    const bucket = mapGoalToBucket(goal.name);
    if (!bucket) return 0;
    const period = normalizeGoalPeriod(goal.period);
    return data.entries[bucket]?.filter((x) => {
      if (period === 'target') return false;
      if (period === 'month') return x.date.startsWith(currentMonth);
      if (period === 'year') return x.date.startsWith(currentYear);
      if (period === 'day') return x.date === today;
      if (period === 'hour') {
        const entryTime = parseEntryTime(x);
        if (!entryTime) return false;
        const diff = nowMs - entryTime.getTime();
        return diff >= 0 && diff < 60 * 60 * 1000;
      }
      if (period === 'minute') {
        const entryTime = parseEntryTime(x);
        if (!entryTime) return false;
        const diff = nowMs - entryTime.getTime();
        return diff >= 0 && diff < 60 * 1000;
      }
      return getWeekId(x.date) === currentWeek;
    }).length || 0;
  }

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
      setData(normalizeData(parsed));
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
          <div className="brand-lockup" aria-label="NextStride logo and wordmark">
            <NextStrideLogo />
            <span className="brand-wordmark">NextStride</span>
          </div>
          <h1>Progress Tracker</h1>
          <p className="hero-copy">
            Build momentum across career, health, learning, and practice — even when life is messy.
          </p>
          <div className="hero-badges">
            <span className="badge">Goal: {data.profile.longTermGoal}</span>
            <span className="badge">Target: {data.profile.targetDescriptor || 'Set in settings'}</span>
            <span className="badge">Target date: {data.profile.targetDate || 'Set in settings'}</span>
            <span className="badge">Streak: {activityStreakDays} day{activityStreakDays === 1 ? '' : 's'}</span>
            <span className="badge">{currentWeek}</span>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={exportData}>Export backup</button>
          <button className="secondary" onClick={() => fileInputRef.current?.click()}>Import backup</button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importData} />
          <Clock />
          <button className="secondary settings-btn" onClick={() => setShowSettings(s => !s)}>{showSettings ? 'Close settings' : 'Settings'}</button>
        </div>
      </header>

      <section className="card-grid metrics-grid">
        {/** render top goals from categories as metric cards */}
        {normalizedCategories.flatMap(c => c.goals).slice(0, 5).map((g) => (
          <MetricCard
            key={g.id}
            title={`${g.name}${formatGoalPeriodForCard(g.period)}`}
            value={isTargetGoalPeriod(g.period) ? formatGoalValue(g.target, g.unit) : goalCount(g)}
            subtitle={isTargetGoalPeriod(g.period) ? (g.target ? `Target ${formatGoalValue(g.target, g.unit)}` : 'Set target in Settings') : `Goal ${g.target}${formatGoalUnit(g)}`}
          />
        ))}
      </section>

      <nav className="tabs">
        {[ 'dashboard', ...normalizedCategories.map(c => c.name) ].map((item) => (
          <button key={item} className={tab === item ? 'tab active' : 'tab'} onClick={() => { setTab(item); setShowSettings(false); }}>
            {capitalize(item)}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <>
          <div className="dash-sub-tabs">
            {[['overview', 'Overview'], ['progress', 'Progress'], ['log', 'Log']].map(([id, label]) => (
              <button key={id} type="button" className={dashTab === id ? 'dash-sub-tab active' : 'dash-sub-tab'} onClick={() => setDashTab(id)}>{label}</button>
            ))}
          </div>

          {dashTab === 'overview' && (
            <section className="card-grid two-up">
              <section className="card momentum-card">
                <div className="card-head">
                  <h2>Today momentum</h2>
                  <p>Clear daily target and streak to keep you consistent.</p>
                </div>
                {todayActivityCount >= dailyTarget && (
                  <div className="momentum-burst" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                <div className="momentum-header">
                  <div>
                    <p className="momentum-kicker">Daily target</p>
                    <h3 className="momentum-value">{todayActivityCount}/{dailyTarget}</h3>
                  </div>
                  <span className={todayActivityCount >= dailyTarget ? 'streak-pill hot' : 'streak-pill'}>
                    {activityStreakDays} day streak
                  </span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${todayProgressPct}%` }} /></div>
                <p className="momentum-message">{momentumMessage}</p>
                <div className="snapshot-row"><span>Last 7 days activity</span><strong>{weeklyActivityCount} logs</strong></div>
                <button className="primary" onClick={() => setDashTab('log')}>Log now</button>
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Goal roadmap</h2>
                  <p>Break down the long-term goal into measurable short-term goals and action items.</p>
                </div>
                <ProgressRow label="Action items complete" value={completedActionItems} target={actionItems.length || 1} />
                <ProgressRow label="Average short-term goal progress" value={averageGoalProgress} target={100} />
                <div className="snapshot-row"><span>Short-term goals</span><strong>{shortTermGoals.length}</strong></div>
                <div className="snapshot-row"><span>Action items done</span><strong>{completedActionItems}/{actionItems.length}</strong></div>
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Upcoming milestones</h2>
                  <p>Next due goals and actions</p>
                </div>
                <RoadmapList goals={shortTermGoals} actions={actionItems} />
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Focus next</h2>
                  <p>Top priorities chosen from your active goals.</p>
                </div>
                {focusGoals.length ? (
                  <div className="entry-list">
                    {focusGoals.map((goal) => (
                      <article className="entry-card" key={goal.id}>
                        <div className="entry-top">
                          <span className="chip">{goal.category}</span>
                          <span className="entry-date">{formatGoalWindowLabel(goal.period)}</span>
                        </div>
                        <h4>{goal.name}</h4>
                        <p>
                          {goal.current}/{goal.target} {goal.unit && goal.unit !== 'count' ? goal.unit : ''}
                          {goal.remaining > 0 ? ` · ${goal.remaining} left` : ' · complete'}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">Add goals in Settings to get personalized priorities.</div>
                )}
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Progress game</h2>
                  <p>Level up through consistency and completed actions.</p>
                </div>
                <div className="snapshot-row"><span>Level</span><strong>{userLevel}</strong></div>
                <div className="snapshot-row"><span>XP</span><strong>{experiencePoints}</strong></div>
                <div className="snapshot-row"><span>Achievements</span><strong>{unlockedAchievements}/{achievements.length}</strong></div>
                <div style={{ marginTop: 10 }}>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round((levelProgress / 250) * 100)}%` }} /></div>
                  <p className="helper-text" style={{ marginBottom: 0 }}>{xpToNextLevel} XP to level {userLevel + 1}</p>
                </div>
                <div className="achievement-grid" style={{ marginTop: 10 }}>
                  {achievements.map((item) => (
                    <div key={item.id} className={item.unlocked ? 'achievement-chip unlocked' : 'achievement-chip'}>
                      <strong>{item.label}</strong>
                      <span>{item.hint}</span>
                    </div>
                  ))}
                </div>
                <div className="note-box" style={{ marginTop: 12 }}>{messageOfTheDay}</div>
              </section>
            </section>
          )}

          {dashTab === 'progress' && (
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
          )}

          {dashTab === 'log' && (
            <section className="card-grid two-up">
              <section className="card">
                <div className="card-head">
                  <h2>Weight trend</h2>
                  <p>Simple built-in chart ({weightUnit})</p>
                </div>
                <MiniLineChart data={weightSeries} />
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Daily reminder</h2>
                  <p>Your minimum successful day</p>
                </div>
                <div className="note-box">{data.reminders.todayMustWin}</div>
                {(() => {
                  const allNames = normalizedCategories.flatMap(c => c.goals.map(g => g.name.toLowerCase()));
                  const has = (kw) => allNames.some(n => n.includes(kw));
                  const close = () => setDashLogOpen(null);
                  const available = [
                    has('workout') && { key: 'workout', label: 'Workout', form: <WorkoutForm onSave={(e) => { addEntry('workouts', e); close(); }} durationUnit={durationUnit} /> },
                    has('weight')  && { key: 'weight',  label: 'Weight',  form: <WeightForm  onSave={(e) => { addEntry('weights', e);  close(); }} weightUnit={weightUnit} /> },
                    has('leetcode')&& { key: 'leetcode',label: 'LeetCode',form: <LeetCodeForm onSave={(e) => { addEntry('leetcode', e); close(); }} /> },
                    has('pool')    && { key: 'pool',    label: 'Pool',    form: <PoolForm    onSave={(e) => { addEntry('pool', e);     close(); }} /> },
                    has('uvm')     && { key: 'uvm',     label: 'UVM',     form: <UVMForm     onSave={(e) => { addEntry('uvm', e);      close(); }} /> },
                    has('ai')      && { key: 'ai',      label: 'AI',      form: <AIForm      onSave={(e) => { addEntry('ai', e);       close(); }} /> },
                    has('bug')     && { key: 'bug',     label: 'Bug',     form: <BugForm     onSave={(e) => { addEntry('bugs', e);     close(); }} /> },
                    has('mentor')  && { key: 'mentor',  label: 'Mentor',  form: <MentorForm  onSave={(e) => { addEntry('mentor', e);   close(); }} /> },
                  ].filter(Boolean);
                  if (available.length === 0) return <div className="empty-state">No goals configured. Add goals in Settings.</div>;
                  const openItem = available.find(a => a.key === dashLogOpen);
                  return (
                    <>
                      <div className="log-form-tabs">
                        {available.map(({ key, label }) => (
                          <button key={key} type="button"
                            className={dashLogOpen === key ? 'log-form-tab active' : 'log-form-tab'}
                            onClick={() => setDashLogOpen(dashLogOpen === key ? null : key)}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {openItem && <div className="log-form-body">{openItem.form}</div>}
                    </>
                  );
                })()}
              </section>
            </section>
          )}
        </>
      )}

      {/* Dynamic category view — works for any category, including user-added ones */}
      {tab !== 'dashboard' && !showSettings && (
        (() => {
          const cat = normalizedCategories.find(c => c.name === tab);
          if (!cat) return null;
          const gnames = cat.goals.map(g => g.name.toLowerCase());
          const has = (kw) => gnames.some(n => n.includes(kw));
          return (
            <>
              <div className="dash-sub-tabs">
                {[['goals', 'Goals'], ['log', 'Log'], ['history', 'History']].map(([id, label]) => (
                  <button key={id} type="button"
                    className={catTab === id ? 'dash-sub-tab active' : 'dash-sub-tab'}
                    onClick={() => setCatTab(id)}>
                    {label}
                  </button>
                ))}
              </div>

              {catTab === 'goals' && (
                <section className="card">
                  <div className="card-head">
                    <h2>{cat.name}</h2>
                    <p>Goal progress for {cat.name}</p>
                  </div>
                  {cat.goals.length ? cat.goals.map((g) => (
                    <div key={g.id} style={{ marginBottom: 12 }}>
                      <ProgressRow label={g.name} value={goalCount(g)} target={g.target} unit={g.unit} />
                    </div>
                  )) : <div className="empty-state">No goals set. Add goals in Settings.</div>}
                </section>
              )}

              {catTab === 'log' && (
                <section className="card stack-gap">
                  <div className="card-head">
                    <h2>Log entry</h2>
                    <p>Add a new {cat.name} entry</p>
                  </div>
                  {(() => {
                    const close = () => setCatLogOpen(null);
                    const available = [
                      has('workout') && { key: 'workout', label: 'Workout', form: <WorkoutForm onSave={(e) => { addEntry('workouts', e); close(); }} durationUnit={durationUnit} /> },
                      has('weight')  && { key: 'weight',  label: 'Weight',  form: <WeightForm  onSave={(e) => { addEntry('weights', e);  close(); }} weightUnit={weightUnit} /> },
                      has('leetcode')&& { key: 'leetcode',label: 'LeetCode',form: <LeetCodeForm onSave={(e) => { addEntry('leetcode', e); close(); }} /> },
                      has('pool')    && { key: 'pool',    label: 'Pool',    form: <PoolForm    onSave={(e) => { addEntry('pool', e);     close(); }} /> },
                      has('uvm')     && { key: 'uvm',     label: 'UVM',     form: <UVMForm     onSave={(e) => { addEntry('uvm', e);      close(); }} /> },
                      has('ai')      && { key: 'ai',      label: 'AI',      form: <AIForm      onSave={(e) => { addEntry('ai', e);       close(); }} /> },
                      has('bug')     && { key: 'bug',     label: 'Bug',     form: <BugForm     onSave={(e) => { addEntry('bugs', e);     close(); }} /> },
                      has('mentor')  && { key: 'mentor',  label: 'Mentor',  form: <MentorForm  onSave={(e) => { addEntry('mentor', e);   close(); }} /> },
                    ].filter(Boolean);
                    if (available.length === 0) {
                      return <div className="empty-state">No log templates match this category yet. Add mapped goals in Settings.</div>;
                    }
                    const openItem = available.find(a => a.key === catLogOpen);
                    return (
                      <>
                        <div className="log-form-tabs">
                          {available.map(({ key, label }) => (
                            <button key={key} type="button"
                              className={catLogOpen === key ? 'log-form-tab active' : 'log-form-tab'}
                              onClick={() => setCatLogOpen(catLogOpen === key ? null : key)}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {openItem?.key === 'pool' && <div className="note-box">{data.reminders.preShotRoutine}</div>}
                        {openItem && <div className="log-form-body">{openItem.form}</div>}
                      </>
                    );
                  })()}
                </section>
              )}

              {catTab === 'history' && (
                <section className="card">
                  <div className="card-head">
                    <h2>History</h2>
                    <p>Recent entries for {cat.name}</p>
                  </div>
                  <EntryList
                    items={mergeEntries(cat.goals.map((g) => {
                      const bucket = mapGoalToBucket(g.name);
                      return [bucket || 'unknown', data.entries[bucket] || [], g.name];
                    }))}
                    onDelete={removeEntry}
                  />
                </section>
              )}
            </>
          );
        })()
      )}

      {showSettings && (
        <SettingsEditor data={data} setData={setData} onClose={() => setShowSettings(false)} />
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
      timestamp: entry.timestamp,
      title: entry.title || entry.topic || entry.problem || entry.question || entry.summary || entry.label || `${label} entry`,
      details: entry.details || entry.notes || ''
    })))
    .sort((a, b) => {
      const aTime = parseEntryTime(a);
      const bTime = parseEntryTime(b);
      if (aTime && bTime) return bTime.getTime() - aTime.getTime();
      return b.date.localeCompare(a.date);
    });
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

function ProgressRow({ label, value, target, unit = 'count' }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const suffix = unit && unit !== 'count' ? ` ${unit}` : '';
  return (
    <div className="progress-row">
      <div className="progress-header">
        <span>{label}</span>
        <span>{value}{suffix}/{target}{suffix}</span>
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

function RoadmapList({ goals, actions }) {
  const upcomingGoals = [...goals]
    .filter((goal) => goal.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const openActions = [...actions]
    .filter((item) => item.status !== 'done')
    .sort((a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'))
    .slice(0, 4);

  if (!upcomingGoals.length && !openActions.length) {
    return <div className="empty-state">Add short-term goals and action items in Settings.</div>;
  }

  return (
    <div className="entry-list">
      {upcomingGoals.map((goal) => (
        <article className="entry-card" key={goal.id}>
          <div className="entry-top">
            <span className="chip">Short-term goal</span>
            <span className="entry-date">{goal.dueDate || 'No date'}</span>
          </div>
          <h4>{goal.title}</h4>
          <p>{goal.currentValue}/{goal.targetValue || 0} completed</p>
        </article>
      ))}
      {openActions.map((item) => (
        <article className="entry-card" key={item.id}>
          <div className="entry-top">
            <span className="chip">Action item</span>
            <span className="entry-date">{item.dueDate || 'No date'}</span>
          </div>
          <h4>{item.title}</h4>
        </article>
      ))}
    </div>
  );
}

function BaseForm({ title, children, compact = false }) {
  return <div className={compact ? 'mini-form' : 'form-card'}><h3>{title}</h3>{children}</div>;
}

function minutesToDurationDisplay(minutes, unit) {
  const parsed = Number(minutes);
  if (Number.isNaN(parsed)) return 0;
  if (unit === 'hr') return Math.round((parsed / 60) * 10) / 10;
  return Math.round(parsed);
}

function durationDisplayToMinutes(value, unit) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  if (unit === 'hr') return Math.round(parsed * 60);
  return Math.round(parsed);
}

function WorkoutForm({ onSave, compact = false, durationUnit = 'min' }) {
  const [date, setDate] = useState(ISO_DATE());
  const [kind, setKind] = useState('Strength');
  const [duration, setDuration] = useState(() => minutesToDurationDisplay(35, durationUnit));
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="Workout" compact={compact}>
      <DateField value={date} onChange={setDate} />
      <SelectField value={kind} onChange={setKind} options={['Strength', 'Cardio', 'Walk', 'Mobility']} />
      <NumberField label={`Duration (${durationUnit})`} value={duration} onChange={setDuration} inline min={0} step={durationUnit === 'hr' ? 0.1 : 1} />
      {!compact && <TextAreaField label="Notes" value={notes} onChange={setNotes} />}
      <button className="primary" onClick={() => { onSave({ date, kind, duration: durationDisplayToMinutes(duration, durationUnit), notes }); setNotes(''); }}>Save workout</button>
    </BaseForm>
  );
}

function WeightForm({ onSave, compact = false, weightUnit = 'lb' }) {
  const [date, setDate] = useState(ISO_DATE());
  const [weight, setWeight] = useState('');
  return (
    <BaseForm title="Weight" compact={compact}>
      <DateField value={date} onChange={setDate} />
      <TextField label={`Weight (${weightUnit})`} value={weight} onChange={setWeight} inline />
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

function NumberField({ label, value, onChange, inline = false, min, step }) {
  return (
    <label className={inline ? 'field inline-field' : 'field'}>
      <span>{label}</span>
      <input type="number" min={min} step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
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

function countEntriesOnDate(entriesByBucket, dateString) {
  if (!entriesByBucket) return 0;
  return Object.values(entriesByBucket).reduce((sum, list) => {
    if (!Array.isArray(list)) return sum;
    return sum + list.filter((item) => item?.date === dateString).length;
  }, 0);
}

function getRecentActivityCount(entriesByBucket, anchorDateString, days = 7) {
  if (!entriesByBucket) return 0;
  const anchor = new Date(`${anchorDateString}T00:00:00`);
  const dates = new Set();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    dates.add(d.toISOString().slice(0, 10));
  }
  return Object.values(entriesByBucket).reduce((sum, list) => {
    if (!Array.isArray(list)) return sum;
    return sum + list.filter((item) => item?.date && dates.has(item.date)).length;
  }, 0);
}

function countAllEntries(entriesByBucket) {
  if (!entriesByBucket) return 0;
  return Object.values(entriesByBucket).reduce((sum, list) => {
    if (!Array.isArray(list)) return sum;
    return sum + list.length;
  }, 0);
}

function getActivityStreakDays(entriesByBucket, anchorDateString = ISO_DATE()) {
  if (!entriesByBucket) return 0;
  const activeDates = new Set();
  Object.values(entriesByBucket).forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      if (item?.date) activeDates.add(item.date);
    });
  });

  let streak = 0;
  const cursor = new Date(`${anchorDateString}T00:00:00`);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!activeDates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default App;
