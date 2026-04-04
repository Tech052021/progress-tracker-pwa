import * as React from 'react';
// ensure `React` is available at runtime for any classic-jsx compiled code
try { window.React = React; } catch (e) { /* noop on non-browser */ }
const { useEffect, useMemo, useState, useRef } = React;
import SettingsEditor from './components/SettingsEditor';
import Clock from './components/Clock';
import WeeklyPlanView from './components/WeeklyPlanView';
import { useTheme } from './useTheme';
import { buildSuggestedPlannerTasks, createSeedPlannerEntry } from './services/plannerService';
import { buildWeeklySchedule, buildAccountabilityMessage, getWeekIdFromDate, calculateDeadlineShift, updateTaskStatus } from './services/weeklyScheduleService';
import { loadJSON, saveJSON, createBackupAndPrune, enqueueMutation } from './services/storageAdapter';

const STORAGE_KEY = 'progress_tracker_prod_v1';
const DATA_VERSION = 2;
const BACKUP_KEY_PREFIX = `${STORAGE_KEY}_backup_`;
const ISO_DATE = () => new Date().toISOString().slice(0, 10);
const EVENTS_KEY = 'nextstride_events';
const MAX_EVENTS = 500;
const SIGNUP_QUIZ_SESSION_KEY = 'nextstride_signup_quiz_pending';

function trackEvent(name, props = {}) {
  const event = { name, ts: new Date().toISOString(), ...props };
  try {
    const existing = loadJSON(EVENTS_KEY, []);
    existing.unshift(event);
    if (existing.length > MAX_EVENTS) existing.length = MAX_EVENTS;
    saveJSON(EVENTS_KEY, existing);
  } catch { /* storage full — silently skip */ }
}

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
        categoryId: goal.categoryId || category.id,
        categoryName: goal.categoryName || category.name,
        unit: goal.unit || inferGoalUnit(goal.name, weightUnit),
        sessionPlan: normalizeSessionPlan(goal.sessionPlan)
      }))
      : []
  }));
}

function normalizeSessionPlan(sessionPlan) {
  const next = sessionPlan && typeof sessionPlan === 'object' ? sessionPlan : {};
  return {
    days: Array.isArray(next.days) ? next.days.filter(Boolean) : [],
    focus: String(next.focus || ''),
    instructions: String(next.instructions || ''),
    resourceUrl: String(next.resourceUrl || ''),
    imageUrl: String(next.imageUrl || ''),
  };
}

function isSessionPlanningGoal(goal) {
  const name = String(goal?.name || '').toLowerCase();
  const unit = String(goal?.unit || '').toLowerCase();
  return unit.includes('session') || /(cardio|strength|workout|pool|practice|training)/.test(name);
}

function createDefaultCategories() {
  return [
    { id: 'health', name: 'Health', goals: [] },
    { id: 'career', name: 'Career', goals: [] },
    { id: 'hobby', name: 'Hobby', goals: [] }
  ];
}

function deriveCategories(incomingCategories, weightUnit) {
  if (Array.isArray(incomingCategories) && incomingCategories.length > 0) {
    return normalizeCategories(incomingCategories, weightUnit);
  }
  // Preserve existing stored categories if incoming is empty/missing
  try {
    const stored = loadJSON(STORAGE_KEY, {});
    if (Array.isArray(stored?.settings?.categories) && stored.settings.categories.length > 0) {
      return normalizeCategories(stored.settings.categories, weightUnit);
    }
  } catch { /* ignore */ }
  return createDefaultCategories();
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

function getWeekDateOptions(dateString = ISO_DATE()) {
  const toOrdinal = (day) => {
    const mod100 = day % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
    const mod10 = day % 10;
    if (mod10 === 1) return `${day}st`;
    if (mod10 === 2) return `${day}nd`;
    if (mod10 === 3) return `${day}rd`;
    return `${day}th`;
  };

  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return labels.map((label, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    return {
      label,
      iso: d.toISOString().slice(0, 10),
      day: String(d.getDate()),
      compactLabel: `${toOrdinal(d.getDate())}/${label}`
    };
  });
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
  dataVersion: DATA_VERSION,
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
    actionItems: [],
    coachNotes: []
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
    categories: createDefaultCategories(),
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
    journal: [],
    mentor: [],
    bugs: [],
    pool: [],
    goalUpdates: [],
    weeklyNotes: []
  },
  baseline: { entries: [] },
  weeklyCheckIns: { entries: [] },
  dailyPlanner: { byDate: {} },
  weeklySchedules: {},
  goalDeadlineLog: []
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

function getGreeting(name) {
  const h = new Date().getHours();
  const prefix = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = name ? name.trim().split(/\s+/)[0] : '';
  return first ? `${prefix}, ${first}` : prefix;
}

function normalizeData(raw) {
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const profile = incoming.profile || {};
  const shortTermGoals = Array.isArray(incoming.goalPlan?.shortTermGoals)
    ? incoming.goalPlan.shortTermGoals.map((goal) => ({
      ...goal,
      id: goal.id || uid(),
      title: goal.title || '',
      targetValue: Number(goal.targetValue) || 0,
      currentValue: Number(goal.currentValue) || 0,
      dueDate: goal.dueDate || ''
    }))
    : [];
  const actionItems = Array.isArray(incoming.goalPlan?.actionItems)
    ? incoming.goalPlan.actionItems.map((item) => ({
      ...item,
      id: item.id || uid(),
      title: item.title || '',
      goalId: item.goalId || '',
      dueDate: item.dueDate || '',
      status: item.status === 'done' ? 'done' : 'todo'
    }))
    : [];
  const coachNotes = Array.isArray(incoming.goalPlan?.coachNotes)
    ? incoming.goalPlan.coachNotes.map((note) => ({
      ...note,
      id: note.id || uid(),
      createdAt: note.createdAt || new Date().toISOString(),
      categoryName: note.categoryName || '',
      goalText: note.goalText || '',
      strategy: {
        longTerm: note.strategy?.longTerm || '',
        shortTerm: Array.isArray(note.strategy?.shortTerm) ? note.strategy.shortTerm : []
      },
      execution: {
        daily: Array.isArray(note.execution?.daily) ? note.execution.daily : [],
        weekly: Array.isArray(note.execution?.weekly) ? note.execution.weekly : [],
        yearly: Array.isArray(note.execution?.yearly) ? note.execution.yearly : []
      },
      nextBestAction: note.nextBestAction || '',
      riskFlags: Array.isArray(note.riskFlags) ? note.riskFlags : [],
      coachMessage: note.coachMessage || ''
    }))
    : [];

  const incomingSettings = incoming.settings || {};
  const incomingUnits = incomingSettings.units || {};
  const normalizedWeightUnit = incomingUnits.weight || incomingSettings.weightUnit || defaultData.settings.units.weight;

  return {
    ...defaultData,
    ...incoming,
    dataVersion: DATA_VERSION,
    profile: {
      ...defaultData.profile,
      ...profile,
      appName: defaultData.profile.appName,
      targetDescriptor: profile.targetDescriptor || profile.targetCompanies || defaultData.profile.targetDescriptor,
      targetDate: profile.targetDate || ''
    },
    goalPlan: {
      shortTermGoals,
      actionItems,
      coachNotes
    },
    settings: {
      ...defaultData.settings,
      ...incomingSettings,
      categories: deriveCategories(incomingSettings.categories, normalizedWeightUnit),
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
    },
    baseline: {
      entries: Array.isArray(incoming.baseline?.entries) ? incoming.baseline.entries : []
    },
    weeklyCheckIns: {
      entries: Array.isArray(incoming.weeklyCheckIns?.entries) ? incoming.weeklyCheckIns.entries : []
    },
    dailyPlanner: {
      byDate: incoming.dailyPlanner?.byDate && typeof incoming.dailyPlanner.byDate === 'object'
        ? incoming.dailyPlanner.byDate
        : {}
    },
    weeklySchedules: incoming.weeklySchedules && typeof incoming.weeklySchedules === 'object'
      ? incoming.weeklySchedules
      : {},
    goalDeadlineLog: Array.isArray(incoming.goalDeadlineLog) ? incoming.goalDeadlineLog : []
  };
}

function useStoredData() {
  const [data, setData] = useState(() => {
    try {
      const parsed = loadJSON(STORAGE_KEY, null);
      if (!parsed) return defaultData;
      const normalized = normalizeData(parsed);
      const rawJson = JSON.stringify(parsed);
      const normalizedJson = JSON.stringify(normalized);

      if (rawJson !== normalizedJson) {
        createBackupAndPrune({ keyPrefix: BACKUP_KEY_PREFIX, rawJson, maxBackups: 5 });
      }

      return normalized;
    } catch {
      return defaultData;
    }
  });

  useEffect(() => {
    try {
      saveJSON(STORAGE_KEY, data);
    } catch (e) {
      console.warn('NextStride: Could not save data to localStorage.', e?.message);
    }
  }, [data]);

  return [data, setData];
}

function App() {
  const [data, setData] = useStoredData();
  const [tab, setTab] = useState('dashboard');
  const [dashLogOpen, setDashLogOpen] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLaunchIntent, setSettingsLaunchIntent] = useState(null);
  const [goalQuizDeferredTab, setGoalQuizDeferredTab] = useState(null);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const navMenuRef = useRef(null);
  useEffect(() => {
    if (!showNavMenu) return;
    function handleOutside(e) {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target)) setShowNavMenu(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showNavMenu]);
  const { activeTheme, setActiveTheme, themes: themeMap } = useTheme();
  const [activeGoalCategoryId, setActiveGoalCategoryId] = useState(null);
  const [goalsView, setGoalsView] = useState('details'); // 'details' or 'schedule'
  const [roadmapView, setRoadmapView] = useState('roadmap');
  const [progressView, setProgressView] = useState('goals');
  const [logView, setLogView] = useState('capture');
  const [goalUpdateDrafts, setGoalUpdateDrafts] = useState({});
  const [expandedSections, setExpandedSections] = useState({ today: true, week: false, goals: false, checkin: false });
  const [skippedGoalIds, setSkippedGoalIds] = useState([]);
  const [checkinDraft, setCheckinDraft] = useState({ rating: 0, wentWell: '', toImprove: '' });
  const [checkinPopup, setCheckinPopup] = useState(null); // { goalId, goalName, dateIso, isUncheck }
  const [checkinInputMode, setCheckinInputMode] = useState('text');
  const [checkinNote, setCheckinNote] = useState('');
  const [checkinRecording, setCheckinRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [checkinAudioUrl, setCheckinAudioUrl] = useState(null);
  const [newPlannerTaskText, setNewPlannerTaskText] = useState('');
  const [showWelcome, setShowWelcome] = useState(() => {
    const stored = localStorage.getItem('nextstride_welcome');
    if (!stored) return true;
    const { date, hasNewWork } = JSON.parse(stored);
    if (date !== ISO_DATE()) return true;
    if (hasNewWork) return true;
    return false;
  });

  const [showQuote, setShowQuote] = useState(() => !showWelcome);

  const triggerGoalQuiz = (source = 'no-goals') => {
    setShowWelcome(false);
    setShowQuote(false);
    setShowSettings(true);
    setSettingsLaunchIntent({ mode: 'append', source, focusOnly: true, token: Date.now() });
    trackEvent('quick_start_opened', { source });
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('nextstride_welcome', JSON.stringify({
      date: ISO_DATE(),
      hasNewWork: false,
    }));
  };

  useEffect(() => { setDashLogOpen(null); }, [tab]);

  // Track encouragement popups on mount
  useEffect(() => {
    if (showWelcome) trackEvent('encouragement_shown', { popupType: 'welcome' });
    else if (showQuote) trackEvent('encouragement_shown', { popupType: 'quote' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addEntry = (bucket, entry) => {
    const timestamp = entry.timestamp || createEntryTimestamp(entry.date);
    const entryId = crypto.randomUUID();
    setData((prev) => ({
      ...prev,
      entries: {
        ...prev.entries,
        [bucket]: [{ id: entryId, ...entry, timestamp }, ...prev.entries[bucket]]
      }
    }));
    enqueueMutation('entry_added', { bucket, entryId, entry: { ...entry, timestamp } });
    trackEvent('log_added', { bucket, goalId: entry.goalId || null, date: entry.date });
    // Show welcome popup again after new work is logged
    const stored = localStorage.getItem('nextstride_welcome');
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.hasNewWork = true;
      localStorage.setItem('nextstride_welcome', JSON.stringify(parsed));
    }
  };

  const removeEntry = (bucket, id) => {
    setData((prev) => ({
      ...prev,
      entries: {
        ...prev.entries,
        [bucket]: prev.entries[bucket].filter((item) => item.id !== id)
      }
    }));
    enqueueMutation('entry_removed', { bucket, id });
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
    journal: (data.entries.journal || data.entries.ai || []).filter((x) => x.date.startsWith(currentMonth)).length,
    bugs: data.entries.bugs.filter((x) => x.date.startsWith(currentMonth)).length,
    mentor: data.entries.mentor.filter((x) => x.date.startsWith(currentMonth)).length
  };

  const today = ISO_DATE();
  const weekDateOptions = useMemo(() => getWeekDateOptions(today), [today]);
  const dailyTarget = 3;
  const todayActivityCount = countEntriesOnDate(data.entries, today);
  const activityStreakDays = getActivityStreakDays(data.entries, today);
  const prevStreakRef = useRef(activityStreakDays);
  useEffect(() => {
    if (activityStreakDays !== prevStreakRef.current) {
      trackEvent('streak_updated', { previous: prevStreakRef.current, current: activityStreakDays });
      prevStreakRef.current = activityStreakDays;
    }
  }, [activityStreakDays]);
  const weeklyActivityCount = getRecentActivityCount(data.entries, today, 7);
  const todayProgressPct = Math.min(100, Math.round((todayActivityCount / dailyTarget) * 100));
  const remainingToday = Math.max(0, dailyTarget - todayActivityCount);
  const totalActivityCount = countAllEntries(data.entries);

  const shortTermGoals = data.goalPlan?.shortTermGoals || [];
  const actionItems = data.goalPlan?.actionItems || [];
  const coachNotes = data.goalPlan?.coachNotes || [];
  const totalConfiguredGoals = (Array.isArray(data.settings?.categories) ? data.settings.categories : []).reduce(
    (sum, category) => sum + ((category.goals || []).length),
    0
  );
  const hasNoGoals = totalConfiguredGoals === 0 && shortTermGoals.length === 0 && actionItems.length === 0;
  const latestCoachNote = coachNotes.length
    ? [...coachNotes].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0]
    : null;
  const completedActionItems = actionItems.filter((item) => item.status === 'done').length;

  useEffect(() => {
    if (!hasNoGoals) {
      setGoalQuizDeferredTab(null);
      return;
    }
    if (showSettings) return;
    if (goalQuizDeferredTab === tab) return;
    triggerGoalQuiz('no-goals');
  }, [hasNoGoals, goalQuizDeferredTab, showSettings, tab]);

  useEffect(() => {
    let shouldOpenSignupQuiz = false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('signupQuiz') === '1') {
        shouldOpenSignupQuiz = true;
      } else if (sessionStorage.getItem(SIGNUP_QUIZ_SESSION_KEY) === '1') {
        shouldOpenSignupQuiz = true;
        sessionStorage.removeItem(SIGNUP_QUIZ_SESSION_KEY);
      }
    } catch {
      /* ignore signup trigger read issues */
    }
    if (shouldOpenSignupQuiz) {
      triggerGoalQuiz('signup');
    }
  }, []);

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

  // Categories source-of-truth: settings.categories
  const categories = useMemo(() => {
    const s = data.settings || {};
    return Array.isArray(s.categories) ? s.categories : [];
  }, [data.settings]);

  const normalizedCategories = useMemo(() => normalizeCategories(categories, weightUnit), [categories, weightUnit]);

  useEffect(() => {
    if (!normalizedCategories.length) {
      setActiveGoalCategoryId(null);
      return;
    }
    if (!normalizedCategories.some((category) => category.id === activeGoalCategoryId)) {
      setActiveGoalCategoryId(normalizedCategories[0].id);
    }
  }, [normalizedCategories, activeGoalCategoryId]);

  const activeGoalCategory = normalizedCategories.find((category) => category.id === activeGoalCategoryId) || normalizedCategories[0] || null;

  const categoryKeywordMap = useMemo(() => {
    const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'goal', 'goals', 'item', 'items', 'short', 'term', 'next', 'first']);
    const tokenize = (value) => String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [];

    return normalizedCategories.map((category) => {
      const keywordSet = new Set(tokenize(category.name));
      (category.goals || []).forEach((goal) => tokenize(goal.name).forEach((token) => {
        if (!stopWords.has(token) && token.length > 2) keywordSet.add(token);
      }));
      return { categoryId: category.id, categoryName: category.name, keywords: keywordSet };
    });
  }, [normalizedCategories]);

  const inferCategoryIdFromText = (value) => {
    const tokens = String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    let bestCategoryId = null;
    let bestScore = 0;
    categoryKeywordMap.forEach((entry) => {
      const score = tokens.reduce((sum, token) => sum + (entry.keywords.has(token) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestCategoryId = entry.categoryId;
      }
    });
    return bestCategoryId;
  };

  const shortTermGoalCategoryIdByGoalId = useMemo(() => {
    const resolved = {};
    shortTermGoals.forEach((goal) => {
      const explicitId = goal.categoryId && normalizedCategories.some((category) => category.id === goal.categoryId)
        ? goal.categoryId
        : null;

      const explicitByName = goal.categoryName
        ? normalizedCategories.find((category) => category.name.trim().toLowerCase() === String(goal.categoryName).trim().toLowerCase())?.id
        : null;

      const inferred = inferCategoryIdFromText(goal.title || goal.name || '');
      resolved[goal.id] = explicitId || explicitByName || inferred || null;
    });
    return resolved;
  }, [shortTermGoals, normalizedCategories, categoryKeywordMap]);

  const filteredRoadmapGoals = useMemo(() => {
    if (!activeGoalCategory) return shortTermGoals;
    return shortTermGoals.filter((goal) => shortTermGoalCategoryIdByGoalId[goal.id] === activeGoalCategory.id);
  }, [shortTermGoals, activeGoalCategory, shortTermGoalCategoryIdByGoalId]);

  const filteredRoadmapActions = useMemo(() => {
    if (!activeGoalCategory) return actionItems;

    return actionItems.filter((item) => {
      const explicitId = item.categoryId && normalizedCategories.some((category) => category.id === item.categoryId)
        ? item.categoryId
        : null;
      const explicitByName = item.categoryName
        ? normalizedCategories.find((category) => category.name.trim().toLowerCase() === String(item.categoryName).trim().toLowerCase())?.id
        : null;
      const inferredFromGoal = item.goalId ? shortTermGoalCategoryIdByGoalId[item.goalId] : null;
      const inferredFromText = inferCategoryIdFromText(item.title || '');
      const resolvedCategoryId = explicitId || explicitByName || inferredFromGoal || inferredFromText || null;
      return resolvedCategoryId === activeGoalCategory.id;
    });
  }, [actionItems, activeGoalCategory, normalizedCategories, shortTermGoalCategoryIdByGoalId, categoryKeywordMap]);

  const activeCategoryCompletedActions = useMemo(
    () => filteredRoadmapActions.filter((item) => item.status === 'done').length,
    [filteredRoadmapActions]
  );

  const activeCategoryAverageGoalProgress = useMemo(() => {
    if (!filteredRoadmapGoals.length) return 0;
    const total = filteredRoadmapGoals.reduce((sum, goal) => {
      const target = Math.max(1, Number(goal.targetValue) || 0);
      const current = Number(goal.currentValue) || 0;
      return sum + Math.min(100, Math.round((current / target) * 100));
    }, 0);
    return Math.round(total / filteredRoadmapGoals.length);
  }, [filteredRoadmapGoals]);

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

  const greeting = getGreeting(data.profile?.ownerName);

  const categoryRings = useMemo(() => {
    const colors = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
    return normalizedCategories.map((category, i) => {
      const trackable = (category.goals || []).filter((g) => !isTargetGoalPeriod(g.period) && Number(g.target || 0) > 0);
      const completed = trackable.filter((g) => goalCount(g) >= Number(g.target || 0)).length;
      const pct = trackable.length ? Math.round((completed / trackable.length) * 100) : 0;
      return { id: category.id, name: category.name, completed, total: trackable.length, pct, color: colors[i % colors.length] };
    });
  }, [normalizedCategories, data.entries, currentWeek, currentMonth]);

  const nextBestAction = useMemo(() => {
    const candidates = normalizedCategories.flatMap((category) =>
      (category.goals || [])
        .filter((g) => !isTargetGoalPeriod(g.period) && Number(g.target || 0) > 0)
        .map((g) => {
          const current = goalCount(g);
          const target = Number(g.target || 0);
          return { id: g.id, name: g.name, category: category.name, unit: g.unit, current, target, remaining: Math.max(0, target - current) };
        })
    ).filter((g) => g.remaining > 0 && !skippedGoalIds.includes(g.id));
    if (!candidates.length) return null;
    return candidates.sort((a, b) => (b.current / Math.max(1, b.target)) - (a.current / Math.max(1, a.target)))[0];
  }, [normalizedCategories, data.entries, currentWeek, currentMonth, skippedGoalIds]);

  const plannerDate = today;
  const plannerEntry = data.dailyPlanner?.byDate?.[plannerDate] || null;

  const plannerSuggestedTasks = useMemo(() => {
    return buildSuggestedPlannerTasks({
      normalizedCategories,
      goalCount,
      isTargetGoalPeriod,
      normalizeGoalPeriod,
      actionItems,
      plannerDate,
      weekDateOptions,
      currentYear,
      uid
    });
  }, [normalizedCategories, data.entries, actionItems, currentWeek, currentMonth, plannerDate, weekDateOptions, currentYear]);

  const seedPlannerForToday = useMemo(() => {
    return createSeedPlannerEntry(plannerSuggestedTasks, data.reminders?.todayMustWin || '');
  }, [plannerSuggestedTasks, data.reminders?.todayMustWin]);

  useEffect(() => {
    if (plannerEntry) return;
    setData((prev) => ({
      ...prev,
      dailyPlanner: {
        ...(prev.dailyPlanner || {}),
        byDate: {
          ...(prev.dailyPlanner?.byDate || {}),
          [plannerDate]: seedPlannerForToday
        }
      }
    }));
  }, [plannerEntry, plannerDate, seedPlannerForToday, setData]);

  // Generate weekly schedules when new coach notes are created
  useEffect(() => {
    const coachNotes = data.goalPlan?.coachNotes || [];
    if (!coachNotes.length) return;

    setData((prev) => {
      let changed = false;
      const nextWeeklySchedules = { ...(prev.weeklySchedules || {}) };
      const nextDeadlineLog = [...(prev.goalDeadlineLog || [])];

      // For each coach note, generate a weekly schedule if not already present
      coachNotes.forEach((coachNote) => {
        const weekId = getWeekIdFromDate(today);
        const scheduleKey = `${weekId}_${coachNote.id}`;

        if (!nextWeeklySchedules[scheduleKey] && coachNote.scheduleGuide?.weeklyTemplate?.length > 0) {
          // Find the corresponding goal
          const goalCategory = normalizedCategories.find((cat) =>
            cat.name.toLowerCase() === String(coachNote.categoryName || '').toLowerCase()
          );
          const category = goalCategory || normalizedCategories[0];

          if (category) {
            const weeklyGoals = (category.goals || []).filter((g) => {
              const period = normalizeGoalPeriod(g.period);
              return period === 'week' && Number(g.target || 0) > 0;
            });

            if (weeklyGoals.length > 0) {
              const schedule = buildWeeklySchedule({
                weekId,
                isoDateToday: today,
                goals: weeklyGoals,
                goalName: coachNote.goalText,
                goalId: coachNote.id,
                categoryId: category.id,
                categoryName: category.name,
                coachNote,
                intake: {} // TODO: pass actual intake
              });

              nextWeeklySchedules[scheduleKey] = schedule;
              changed = true;

              // Initialize deadline tracking if not present
              const victoryDate = coachNote.victoryDate || toISODateAfter(84);
              const existingLog = nextDeadlineLog.find((log) => log.goalId === coachNote.id && log.weekId === weekId);
              if (!existingLog) {
                nextDeadlineLog.push({
                  goalId: coachNote.id,
                  goalText: coachNote.goalText,
                  weekId,
                  originalDeadline: victoryDate,
                  currentDeadline: victoryDate,
                  daysShifted: 0,
                  reason: 'Plan initialized',
                  timestamp: new Date().toISOString(),
                  missedTasks: [],
                  priorShifts: []
                });
              }
            }
          }
        }
      });

      if (!changed) return prev;
      return {
        ...prev,
        weeklySchedules: nextWeeklySchedules,
        goalDeadlineLog: nextDeadlineLog
      };
    });
  }, [data.goalPlan?.coachNotes, normalizedCategories, today]);

  const toISODateAfter = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };


  const updatePlanner = (updater) => {
    setData((prev) => {
      const existing = prev.dailyPlanner?.byDate?.[plannerDate] || seedPlannerForToday;
      const nextEntry = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
      enqueueMutation('planner_updated', { date: plannerDate, planner: nextEntry });
      return {
        ...prev,
        dailyPlanner: {
          ...(prev.dailyPlanner || {}),
          byDate: {
            ...(prev.dailyPlanner?.byDate || {}),
            [plannerDate]: nextEntry
          }
        }
      };
    });
  };

  const planner = plannerEntry || seedPlannerForToday;

  const togglePlannerTask = (taskId) => {
    updatePlanner((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).map((task) => task.id === taskId ? { ...task, done: !task.done } : task)
    }));
  };

  const addPlannerTask = () => {
    const text = newPlannerTaskText.trim();
    if (!text) return;
    updatePlanner((prev) => ({
      ...prev,
      tasks: [...(prev.tasks || []), { id: uid(), text, done: false, suggested: false, hint: '' }]
    }));
    setNewPlannerTaskText('');
  };

  const regeneratePlannerTasks = () => {
    updatePlanner((prev) => {
      const manualTasks = (prev.tasks || []).filter((task) => !task.suggested);
      return {
        ...prev,
        tasks: [...plannerSuggestedTasks, ...manualTasks].slice(0, 10),
        priorities: plannerSuggestedTasks.slice(0, 3).map((task, i) => task.text || prev.priorities?.[i] || '')
      };
    });
  };

  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasCheckedInThisWeek = (data.weeklyCheckIns?.entries || []).some((e) => e.weekId === currentWeek);
  const lastCheckIn = (data.weeklyCheckIns?.entries || [])[0] || null;

  const saveWeeklyCheckIn = () => {
    if (!checkinDraft.rating) return;
    const entry = {
      id: crypto.randomUUID(),
      weekId: currentWeek,
      date: ISO_DATE(),
      rating: checkinDraft.rating,
      wentWell: checkinDraft.wentWell.trim(),
      toImprove: checkinDraft.toImprove.trim(),
      stats: {
        weeklyLogs: weeklyActivityCount,
        streak: activityStreakDays,
        goalsOnPace: completedPeriodGoals,
        totalGoals: periodTrackableGoals.length
      }
    };
    setData((prev) => ({
      ...prev,
      weeklyCheckIns: {
        entries: [entry, ...(prev.weeklyCheckIns?.entries || [])]
      }
    }));
    enqueueMutation('weekly_checkin_saved', { entry });
    setCheckinDraft({ rating: 0, wentWell: '', toImprove: '' });
    setExpandedSections((prev) => ({ ...prev, checkin: false }));
  };

  const achievements = [
    { id: 'first-log', label: 'First Step', hint: 'Create your first log entry', unlocked: totalActivityCount >= 1 },
    { id: 'streak-3', label: '3-Day Streak', hint: 'Stay active for 3 days in a row', unlocked: activityStreakDays >= 3 },
    { id: 'streak-7', label: 'Consistency Pro', hint: 'Maintain a 7-day streak', unlocked: activityStreakDays >= 7 },
    { id: 'logs-100', label: '100 Logs Club', hint: 'Reach 100 total logged actions', unlocked: totalActivityCount >= 100 },
    { id: 'actions-10', label: 'Execution Engine', hint: 'Complete 10 action items', unlocked: completedActionItems >= 10 }
  ];
  const unlockedAchievements = achievements.filter((a) => a.unlocked).length;
  const dailyMessages = [
    // Stoics & Ancient Philosophers
    { text: 'We suffer more in imagination than in reality.', author: 'Seneca' },
    { text: 'The impediment to action advances action. What stands in the way becomes the way.', author: 'Marcus Aurelius' },
    { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
    { text: 'It is not that we have a short time to live, but that we waste a great deal of it.', author: 'Seneca' },
    { text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
    { text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus' },
    { text: 'The happiness of your life depends upon the quality of your thoughts.', author: 'Marcus Aurelius' },
    { text: 'Luck is what happens when preparation meets opportunity.', author: 'Seneca' },
    { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle' },
    { text: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle' },
    // Eastern Wisdom
    { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
    { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
    { text: 'The mind is everything. What you think you become.', author: 'Buddha' },
    { text: 'An unexamined life is not worth living.', author: 'Socrates' },
    { text: 'Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.', author: 'Buddha' },
    { text: 'When you realize nothing is lacking, the whole world belongs to you.', author: 'Lao Tzu' },
    { text: 'Our greatest glory is not in never falling, but in rising every time we fall.', author: 'Confucius' },
    // Modern Leaders & Thinkers
    { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
    { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
    { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
    { text: 'Be the change that you wish to see in the world.', author: 'Mahatma Gandhi' },
    { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { text: 'Everything you can imagine is real.', author: 'Pablo Picasso' },
    { text: 'What you get by achieving your goals is not as important as what you become by achieving your goals.', author: 'Zig Ziglar' },
    { text: 'Strive not to be a success, but rather to be of value.', author: 'Albert Einstein' },
    { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
    { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
    { text: 'Your time is limited. Don\'t waste it living someone else\'s life.', author: 'Steve Jobs' },
    { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
    { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    { text: 'Hard choices, easy life. Easy choices, hard life.', author: 'Jerzy Gregorek' },
    // Growth & Resilience
    { text: 'A person who never made a mistake never tried anything new.', author: 'Albert Einstein' },
    { text: 'Fall seven times, stand up eight.', author: 'Japanese Proverb' },
    { text: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins' },
    { text: 'Don\'t count the days. Make the days count.', author: 'Muhammad Ali' },
    { text: 'You miss 100% of the shots you don\'t take.', author: 'Wayne Gretzky' },
    { text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson' },
    { text: 'The man who moves a mountain begins by carrying away small stones.', author: 'Confucius' },
    { text: 'Whether you think you can or you think you can\'t, you\'re right.', author: 'Henry Ford' },
    { text: 'Belief creates the actual fact.', author: 'William James' },
    { text: 'If you want to lift yourself up, lift up someone else.', author: 'Booker T. Washington' },
    // Progress & Consistency
    { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Robin Sharma' },
    { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
    { text: 'The only person you are destined to become is the person you decide to be.', author: 'Ralph Waldo Emerson' },
    { text: 'Champions keep playing until they get it right.', author: 'Billie Jean King' },
    { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
    { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
    { text: 'The difference between ordinary and extraordinary is that little extra.', author: 'Jimmy Johnson' },
    { text: 'Courage is not the absence of fear, but the triumph over it.', author: 'Nelson Mandela' },
    { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
    { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
  ];
  const [messageOfTheDay] = useState(() => dailyMessages[Math.floor(Math.random() * dailyMessages.length)]);

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
    if (n.includes('journal') || n.includes('journey') || n.includes('ai')) return 'journal';
    if (n.includes('bug') || n.includes('bugs')) return 'bugs';
    if (n.includes('mentor')) return 'mentor';
    if (n.includes('pool')) return 'pool';
    return null;
  }

  function isEntryInGoalPeriod(entry, period) {
    if (!entry) return false;
    if (period === 'target') return false;
    if (period === 'month') return String(entry.date || '').startsWith(currentMonth);
    if (period === 'year') return String(entry.date || '').startsWith(currentYear);
    if (period === 'day') return entry.date === today;
    if (period === 'hour') {
      const entryTime = parseEntryTime(entry);
      if (!entryTime) return false;
      const diff = nowMs - entryTime.getTime();
      return diff >= 0 && diff < 60 * 60 * 1000;
    }
    if (period === 'minute') {
      const entryTime = parseEntryTime(entry);
      if (!entryTime) return false;
      const diff = nowMs - entryTime.getTime();
      return diff >= 0 && diff < 60 * 1000;
    }
    return getWeekId(entry.date) === currentWeek;
  }

  function goalCount(goal) {
    const usesLegacyBucketTracking = goal?.trackSource === 'bucket';
    const bucket = usesLegacyBucketTracking ? mapGoalToBucket(goal.name) : null;
    const period = normalizeGoalPeriod(goal.period);
    const doesEntryMatchGoal = (entry) => {
      if (!entry) return false;
      if (goal?.id) return entry.goalId === goal.id;
      return false;
    };

    const bucketCount = bucket
      ? (data.entries[bucket]?.filter((entry) => isEntryInGoalPeriod(entry, period)).length || 0)
      : 0;

    const manualCount = data.entries.goalUpdates?.filter((entry) => {
      return doesEntryMatchGoal(entry) && isEntryInGoalPeriod(entry, period);
    }).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0) || 0;

    return bucketCount + manualCount;
  }

  const recordGoalProgress = (goal, rawAmount) => {
    const parsed = Number(rawAmount);
    const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    if (!amount) return;

    addEntry('goalUpdates', {
      date: today,
      goalId: goal.id,
      goalName: goal.name,
      categoryId: goal.categoryId,
      categoryName: goal.categoryName,
      amount,
      unit: goal.unit || 'count'
    });

    setGoalUpdateDrafts((prev) => ({ ...prev, [goal.id]: '1' }));
  };

  const isWeeklyGoalChecked = (goal, dateIso) => {
    return (data.entries.goalUpdates || []).some((entry) =>
      entry.date === dateIso
      && entry.source === 'weekly-check'
      && entry.goalId === goal.id
    );
  };

  const getChecklistAmountForGoal = (goal) => {
    const period = normalizeGoalPeriod(goal?.period);
    if (period === 'day') {
      const target = Number(goal?.target || 0);
      return target > 0 ? target : 1;
    }
    return 1;
  };

  const toggleWeeklyGoalCheck = (goal, dateIso) => {
    const existing = (data.entries.goalUpdates || []).find((entry) =>
      entry.date === dateIso
      && entry.source === 'weekly-check'
      && entry.goalId === goal.id
    );

    if (existing) {
      removeEntry('goalUpdates', existing.id);
      return;
    }

    // Open check-in popup for new entries
    setCheckinPopup({ goalId: goal.id, goalName: goal.name, dateIso, goal });
    setCheckinInputMode('text');
    setCheckinNote('');
    setCheckinAudioUrl(null);
    setCheckinRecording(false);
  };

  const submitCheckinPopup = () => {
    if (!checkinPopup) return;
    const { goal, dateIso } = checkinPopup;
    addEntry('goalUpdates', {
      date: dateIso,
      goalId: goal.id,
      goalName: goal.name,
      categoryId: goal.categoryId,
      categoryName: goal.categoryName,
      amount: getChecklistAmountForGoal(goal),
      unit: goal.unit || 'count',
      source: 'weekly-check',
      note: checkinNote.trim() || undefined,
      audioUrl: checkinAudioUrl || undefined
    });
    setCheckinPopup(null);
    setCheckinNote('');
    setCheckinAudioUrl(null);
    setCheckinRecording(false);
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setCheckinAudioUrl(url);
        // Transcribe via Web Speech API
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = 'en-US';
          // Re-use the recorded audio by replaying and recognizing live
          // (Web Speech API requires live mic — the transcript was captured during recording via a parallel recognition below)
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setCheckinRecording(true);

      // Start live speech recognition in parallel with recording
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
          const transcript = Array.from(event.results).map((r) => r[0].transcript).join(' ');
          setCheckinNote((prev) => (prev ? prev + ' ' : '') + transcript);
        };
        recognition.onerror = () => {};
        recognition.start();
        mediaRecorderRef.current._recognition = recognition;
      }
    } catch {
      alert('Microphone access is needed for audio check-ins.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current._recognition) {
        try { mediaRecorderRef.current._recognition.stop(); } catch {}
      }
    }
    setCheckinRecording(false);
  };

  const handleTaskStatusChange = (scheduleKey, taskId, newStatus) => {
    const schedules = data.weeklySchedules || {};
    const schedule = schedules[scheduleKey];
    if (!schedule) return;

    const result = updateTaskStatus({
      schedule,
      taskId,
      newStatus,
      completedAt: newStatus === 'completed' ? ISO_DATE() : null
    });

    if (!result.statusChanged) return;

    // Update the schedule with the new task status
    const updatedSchedules = {
      ...schedules,
      [scheduleKey]: {
        ...schedule,
        completionStatus: result.schedule?.completionStatus || schedule.completionStatus
      }
    };

    // If task was marked as missed, calculate deadline impact
    if (newStatus === 'missed' && result.deadlineImpact) {
      const goalId = schedule.goalId;
      const deadlineLog = data.goalDeadlineLog || [];
      const currentLogEntry = deadlineLog.find((log) => log.weekId === schedule.weekId && log.goalId === goalId);

      if (currentLogEntry) {
        const deadlineResult = calculateDeadlineShift({
          originalDeadline: currentLogEntry.originalDeadline,
          missedTasksThisWeek: result.missedCount,
          weekId: schedule.weekId,
          priorShifts: currentLogEntry.priorShifts
        });

        if (deadlineResult.shifted) {
          const updatedDeadlineLog = deadlineLog.map((log) =>
            log.weekId === schedule.weekId && log.goalId === goalId
              ? {
                  ...log,
                  currentDeadline: deadlineResult.newDeadline,
                  daysShifted: deadlineResult.shift,
                  reason: deadlineResult.reason,
                  timestamp: new Date().toISOString(),
                  priorShifts: deadlineResult.priorShifts
                }
              : log
          );

          setData((prevData) => ({
            ...prevData,
            weeklySchedules: updatedSchedules,
            goalDeadlineLog: updatedDeadlineLog
          }));

          return;
        }
      }
    }

    setData((prevData) => ({
      ...prevData,
      weeklySchedules: updatedSchedules
    }));
  };

  const handleAlarmToggle = (scheduleKey, taskId, newAlarmState) => {
    const schedules = data.weeklySchedules || {};
    const schedule = schedules[scheduleKey];
    if (!schedule) return;

    const updatedSchedules = {
      ...schedules,
      [scheduleKey]: {
        ...schedule,
        scheduledTasks: (schedule.scheduledTasks || []).map((task) =>
          task.id === taskId
            ? { ...task, alarmEnabled: newAlarmState }
            : task
        ),
        carryoverTasks: (schedule.carryoverTasks || []).map((task) =>
          task.id === taskId
            ? { ...task, alarmEnabled: newAlarmState }
            : task
        )
      }
    };

    setData((prevData) => ({
      ...prevData,
      weeklySchedules: updatedSchedules
    }));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `progress-tracker-backup-${ISO_DATE()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    trackEvent('export_used', { date: ISO_DATE(), categoriesCount: normalizedCategories.length });
  };

  const importData = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      setData(normalizeData(parsed));
      trackEvent('import_used', { date: ISO_DATE(), success: true });
      alert('Backup imported successfully.');
    } catch {
      trackEvent('import_used', { date: ISO_DATE(), success: false });
      alert('Could not import that file. Please use a valid backup JSON.');
    }
    event.target.value = '';
  };

  const resetAll = () => {
    if (!window.confirm('Reset all tracker data? This cannot be undone.')) return;
    setData(defaultData);
  };

  const allTrackedGoals = normalizedCategories.flatMap((category) => category.goals || []);
  const periodTrackableGoals = allTrackedGoals.filter((goal) => !isTargetGoalPeriod(goal.period) && Number(goal.target || 0) > 0);
  const completedPeriodGoals = periodTrackableGoals.filter((goal) => goalCount(goal) >= Number(goal.target || 0)).length;
  const openPeriodGoals = Math.max(0, periodTrackableGoals.length - completedPeriodGoals);

  // ── Encouragement Engine ──────────────────────────────────
  const encouragement = useMemo(() => {
    const msgs = [];

    // Streak milestones
    if (activityStreakDays >= 30) msgs.push({ icon: '🏆', text: `${activityStreakDays}-day streak. That's world-class consistency.`, priority: 10 });
    else if (activityStreakDays >= 14) msgs.push({ icon: '🔥', text: `${activityStreakDays} days in a row. You're building something real.`, priority: 9 });
    else if (activityStreakDays >= 7) msgs.push({ icon: '🔥', text: `7+ day streak! Consistency is your superpower.`, priority: 8 });
    else if (activityStreakDays >= 3) msgs.push({ icon: '⚡', text: `${activityStreakDays}-day streak going. Keep it alive.`, priority: 6 });
    else if (activityStreakDays === 0 && totalActivityCount > 0) msgs.push({ icon: '🌅', text: 'New day, fresh start. One action is all it takes.', priority: 5 });

    // Today's progress
    if (todayActivityCount >= dailyTarget) msgs.push({ icon: '🎯', text: 'Daily target hit! Everything beyond is bonus.', priority: 7 });
    else if (remainingToday === 1) msgs.push({ icon: '💪', text: 'One more action and today is a win.', priority: 8 });
    else if (todayActivityCount > 0 && remainingToday > 1) msgs.push({ icon: '📈', text: `${todayActivityCount} done, ${remainingToday} to go. You've got this.`, priority: 4 });

    // Goal proximity — almost there
    if (focusGoals.length) {
      const almostDone = focusGoals.find((g) => g.remaining > 0 && g.remaining <= 2 && g.current > 0);
      if (almostDone) msgs.push({ icon: '🏁', text: `Almost there on "${almostDone.name}" — just ${almostDone.remaining} more.`, priority: 7 });
    }

    // All period goals completed
    if (periodTrackableGoals.length > 0 && completedPeriodGoals >= periodTrackableGoals.length) {
      msgs.push({ icon: '🌟', text: 'All goals on pace this period. Outstanding work.', priority: 9 });
    } else if (periodTrackableGoals.length > 2 && completedPeriodGoals >= Math.ceil(periodTrackableGoals.length * 0.75)) {
      msgs.push({ icon: '📊', text: `${completedPeriodGoals} of ${periodTrackableGoals.length} goals on pace. Strong momentum.`, priority: 5 });
    }

    // Category completion celebration
    const completedCategory = categoryRings.find((r) => r.total > 0 && r.completed >= r.total);
    if (completedCategory) msgs.push({ icon: '✅', text: `"${completedCategory.name}" — all goals met this period!`, priority: 8 });

    // Weekly check-in sentiment
    if (lastCheckIn && lastCheckIn.weekId === currentWeek) {
      if (lastCheckIn.rating >= 4) msgs.push({ icon: '😊', text: 'Great week so far. Keep that energy going.', priority: 3 });
      else if (lastCheckIn.rating === 3) msgs.push({ icon: '🙂', text: 'Steady week. Small wins still count.', priority: 2 });
      else if (lastCheckIn.rating <= 2) msgs.push({ icon: '🤝', text: 'Tough week — but showing up is what matters most.', priority: 6 });
    }

    // Weekly improvement — compare with previous check-in
    const checkIns = data.weeklyCheckIns?.entries || [];
    if (checkIns.length >= 2) {
      const curr = checkIns[0];
      const prev = checkIns[1];
      if (curr.stats && prev.stats && curr.stats.weeklyLogs > prev.stats.weeklyLogs) {
        msgs.push({ icon: '📈', text: `More logs this week than last. The trend is up.`, priority: 4 });
      }
    }

    // Milestone counts
    if (totalActivityCount >= 100 && totalActivityCount < 110) msgs.push({ icon: '💯', text: '100+ entries logged. That\'s serious commitment.', priority: 7 });
    else if (totalActivityCount >= 50 && totalActivityCount < 55) msgs.push({ icon: '🎉', text: '50 entries milestone! Halfway to the century.', priority: 6 });

    // No goals set — onboarding nudge
    if (periodTrackableGoals.length === 0) msgs.push({ icon: '🌱', text: 'Every start counts. Let\'s add one goal and build from there.', priority: 3 });

    // Default fallback
    if (!msgs.length) msgs.push({ icon: '💡', text: 'Every small step counts. Progress is progress.', priority: 1 });

    // Return highest priority message
    msgs.sort((a, b) => b.priority - a.priority);
    return msgs[0];
  }, [activityStreakDays, todayActivityCount, remainingToday, totalActivityCount, focusGoals, periodTrackableGoals, completedPeriodGoals, categoryRings, lastCheckIn, currentWeek, data.weeklyCheckIns?.entries, dailyTarget]);

  const prevEncRef = useRef(null);
  useEffect(() => {
    if (encouragement && encouragement.text !== prevEncRef.current) {
      trackEvent('encouragement_shown', { type: 'card', message: encouragement.text });
      prevEncRef.current = encouragement.text;
    }
  }, [encouragement]);

  const activeAreaGoals = activeGoalCategory?.goals || [];
  const activeAreaTrackableGoals = activeAreaGoals.filter((goal) => !isTargetGoalPeriod(goal.period) && Number(goal.target || 0) > 0);
  const activeAreaCompleted = activeAreaTrackableGoals.filter((goal) => goalCount(goal) >= Number(goal.target || 0)).length;
  const activeAreaOverAchieved = activeAreaTrackableGoals.filter((goal) => goalCount(goal) > Number(goal.target || 0)).length;
  const activeAreaCompletionRate = activeAreaTrackableGoals.length
    ? Math.round((activeAreaCompleted / activeAreaTrackableGoals.length) * 100)
    : 0;
  const activeAreaPaceStatus = activeAreaTrackableGoals.length === 0
    ? 'No target'
    : activeAreaCompleted >= activeAreaTrackableGoals.length
      ? activeAreaOverAchieved > 0 ? 'Over achieved' : 'Achieved'
      : 'In progress';

  let tabBadges = [];
  if (tab === 'goals') {
    tabBadges = [
      `Focus areas: ${normalizedCategories.length}`,
      `Active area: ${activeGoalCategory?.name || 'None'}`,
      `Goals in area: ${activeAreaGoals.length}`,
      `Completed in area: ${activeAreaCompleted}/${activeAreaTrackableGoals.length || 0}`
    ];
  } else if (tab === 'roadmap') {
    tabBadges = [
      `Short-term goals: ${shortTermGoals.length}`,
      `Action items: ${actionItems.length}`,
      `Completed actions: ${completedActionItems}`,
      `Active area: ${activeGoalCategory?.name || 'None'}`
    ];
  } else if (tab === 'progress') {
    const hitRate = periodTrackableGoals.length
      ? Math.round((completedPeriodGoals / periodTrackableGoals.length) * 100)
      : 0;
    tabBadges = [
      `Tracked goals: ${allTrackedGoals.length}`,
      `Completed this period: ${completedPeriodGoals}`,
      `Open this period: ${openPeriodGoals}`,
      `Hit rate: ${hitRate}%`
    ];
  } else if (tab === 'log') {
    tabBadges = [
      `Tracked goals: ${allTrackedGoals.length}`,
      `Ready to log: ${periodTrackableGoals.length}`,
      `Completed this period: ${completedPeriodGoals}`,
      `Open this period: ${openPeriodGoals}`
    ];
  } else {
    tabBadges = [
      `Tracked goals: ${allTrackedGoals.length}`,
      `Completed this period: ${completedPeriodGoals}`,
      `Open this period: ${openPeriodGoals}`,
      `Current week: ${currentWeek}`
    ];
  }

  const tabLabelMap = {
    dashboard: 'Today',
    goals: 'Plan',
    roadmap: 'Coach',
    progress: 'Review',
    log: 'Journal'
  };
  const currentTabLabel = tabLabelMap[tab] || 'Today';

  const openQuickStartPlanner = () => triggerGoalQuiz('welcome');

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="nav-menu-wrap hero-menu-anchor" ref={navMenuRef}>
          <button
            className="nav-menu-btn"
            onClick={() => setShowNavMenu(s => !s)}
            aria-label="Open navigation"
            aria-expanded={showNavMenu}
          >
            {tab !== 'dashboard' && (
              <span className="nav-current-label">
                {currentTabLabel}
              </span>
            )}
            <span>···</span>
          </button>
          {showNavMenu && (
            <div className="nav-menu-dropdown" role="menu">
              {[
                ['dashboard', '🏠', 'Today'],
                ['goals',     '🎯', 'Plan'],
                ['roadmap',   '🧠', 'Coach'],
                ['progress',  '📈', 'Review'],
                ['log',       '✍️', 'Journal'],
              ].map(([id, emoji, label]) => (
                <button
                  key={id}
                  className={`nav-menu-item${tab === id ? ' active' : ''}`}
                  onClick={() => { setTab(id); setShowSettings(false); setShowNavMenu(false); }}
                  role="menuitem"
                >
                  <span>{emoji}</span> {label}
                </button>
              ))}
              <div className="nav-menu-divider" />
              <button
                className="nav-menu-item"
                onClick={() => { setShowSettings(s => !s); setShowNavMenu(false); }}
                role="menuitem"
              >
                <span>⚙️</span> Settings
              </button>
            </div>
          )}
        </div>
        <div className="hero-brand-group">
          <div className="brand-lockup" aria-label="NextStride logo and wordmark">
            <NextStrideLogo />
            <span className="brand-wordmark">NextStride</span>
          </div>
          <p className="hero-copy hero-copy-compact">
            Build momentum across career, health, learning, and habit; even when going gets tough.
          </p>
          <p className="hero-inline-quote">
            “{messageOfTheDay.text}” <span>— {messageOfTheDay.author}</span>
          </p>
        </div>
        <div className="hero-actions">
          <Clock />
        </div>
      </header>

      {/* ── MOTIVATIONAL QUOTE SPLASH ────────────────── */}
      {showQuote && !showWelcome && (
        <div className="quote-overlay" onClick={() => setShowQuote(false)}>
          <div className="quote-popup">
            <p className="quote-text">“{messageOfTheDay.text}”</p>
            <span className="quote-author">— {messageOfTheDay.author}</span>
            <button className="primary quote-dismiss" onClick={() => setShowQuote(false)}>Let’s go →</button>
          </div>
        </div>
      )}

      {/* ── WELCOME SPLASH POPUP ───────────────────────── */}
      {showWelcome && (
        <div className="welcome-overlay" onClick={() => dismissWelcome()}>
          <div className="welcome-popup" onClick={(e) => e.stopPropagation()}>
            <div className="welcome-streak-ring">
              <span className="welcome-streak-num">{activityStreakDays}</span>
              <span className="welcome-streak-label">day streak</span>
            </div>
            <h2 className="welcome-greeting">{greeting}</h2>
            <div className="welcome-stats">
              <div className="welcome-stat">
                <strong>{todayActivityCount}/{dailyTarget}</strong>
                <span>done today</span>
              </div>
              <div className="welcome-stat">
                <strong>{weeklyActivityCount}</strong>
                <span>this week</span>
              </div>
              <div className="welcome-stat">
                <strong>{completedPeriodGoals}/{periodTrackableGoals.length}</strong>
                <span>goals on pace</span>
              </div>
            </div>
            <p className="welcome-motd">"Small daily wins build unstoppable momentum."</p>
            <div className="welcome-actions">
              {hasNoGoals && (
                <button className="primary welcome-dismiss" onClick={openQuickStartPlanner}>Set up my goals →</button>
              )}
              <button className={hasNoGoals ? 'secondary welcome-secondary' : 'primary welcome-dismiss'} onClick={() => dismissWelcome()}>
                {hasNoGoals ? 'Skip for now' : 'Let\'s go →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'dashboard' && (
        <section className="daily-planner-wrap">
          <section className="daily-planner-top card">
            <div className="daily-planner-headline">
              <h2>Daily Planner</h2>
              <span>{new Date(`${plannerDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="daily-planner-meta-row">
              <div className="daily-mood-strip" role="group" aria-label="Mood">
                <strong>Mood</strong>
                {[1, 2, 3, 4, 5].map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    className={`planner-icon-btn${planner.mood === mood ? ' active' : ''}`}
                    onClick={() => updatePlanner({ mood })}
                  >
                    {['😓', '😕', '😌', '🙂', '😄'][mood - 1]}
                  </button>
                ))}
              </div>
              <div className="daily-weather-strip" role="group" aria-label="Weather">
                {[
                  ['sunny', '☀️'],
                  ['partly', '🌤️'],
                  ['cloudy', '☁️'],
                  ['rainy', '🌧️']
                ].map(([code, emoji]) => (
                  <button
                    key={code}
                    type="button"
                    className={`planner-icon-btn${planner.weather === code ? ' active' : ''}`}
                    onClick={() => updatePlanner({ weather: code })}
                    title={code}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

          </section>

          {latestCoachNote && (
            <section className="card ai-coach-card" aria-label="Coach guidance">
              <h3>Coach</h3>
              <p className="ai-coach-message">{latestCoachNote.coachMessage || 'You are building momentum one step at a time.'}</p>
              <p className="ai-coach-next"><strong>Next best action:</strong> {latestCoachNote.nextBestAction}</p>
              {!!latestCoachNote.execution?.daily?.length && (
                <p className="ai-coach-meta"><strong>Today:</strong> {latestCoachNote.execution.daily.slice(0, 2).join(' | ')}</p>
              )}
              {!!latestCoachNote.execution?.weekly?.length && (
                <p className="ai-coach-meta"><strong>This week:</strong> {latestCoachNote.execution.weekly.slice(0, 2).join(' | ')}</p>
              )}
            </section>
          )}

          <section className="daily-planner-grid planner-board-grid">
            <article className="card planner-card planner-todo">
              <h3>To Do List</h3>
              <div className="planner-list">
                {(planner.tasks || []).map((task) => (
                  <label key={task.id} className={task.done ? 'planner-task done' : 'planner-task'}>
                    <input type="checkbox" checked={!!task.done} onChange={() => togglePlannerTask(task.id)} />
                    <span className="planner-task-text">{task.text}</span>
                    <span className="planner-task-hint">{task.hint || ''}</span>
                  </label>
                ))}
              </div>
              <div className="planner-add-row">
                <input
                  type="text"
                  value={newPlannerTaskText}
                  onChange={(e) => setNewPlannerTaskText(e.target.value)}
                  placeholder="Add task"
                />
                <button type="button" className="secondary" onClick={addPlannerTask}>Add</button>
              </div>
              <button type="button" className="link-btn planner-refresh-btn" onClick={regeneratePlannerTasks}>Regenerate from goals</button>
            </article>

            <article className="card planner-card planner-priority">
              <h3>Priorities</h3>
              {[0, 1, 2].map((index) => (
                <div key={index} className="planner-line-input-row">
                  <span>{index + 1}.</span>
                  <input
                    type="text"
                    value={planner.priorities?.[index] || ''}
                    onChange={(e) => updatePlanner((prev) => {
                      const next = [...(prev.priorities || ['', '', ''])];
                      next[index] = e.target.value;
                      return { ...prev, priorities: next };
                    })}
                    placeholder="Top priority"
                  />
                </div>
              ))}
            </article>

            <article className="card planner-card planner-reminder">
              <h3>Reminder To</h3>
              <textarea
                rows={2}
                value={planner.reminder || ''}
                onChange={(e) => updatePlanner({ reminder: e.target.value })}
                placeholder="One important reminder for today"
              />
            </article>

            <article className="card planner-card planner-meals">
              <h3>Meal Tracker</h3>
              {['breakfast', 'lunch', 'dinner', 'snacks'].map((meal) => (
                <label key={meal} className="planner-check-row">
                  <span>{meal.charAt(0).toUpperCase() + meal.slice(1)}</span>
                  <input
                    type="checkbox"
                    checked={!!planner.meals?.[meal]}
                    onChange={(e) => updatePlanner((prev) => ({
                      ...prev,
                      meals: { ...(prev.meals || {}), [meal]: e.target.checked }
                    }))}
                  />
                </label>
              ))}
            </article>

            <article className="card planner-card planner-water">
              <h3>Water</h3>
              <div className="planner-cup-row">
                {Array.from({ length: 8 }).map((_, i) => {
                  const cup = i + 1;
                  const filled = cup <= (planner.waterCups || 0);
                  return (
                    <button
                      key={cup}
                      type="button"
                      className={filled ? 'planner-cup active' : 'planner-cup'}
                      onClick={() => updatePlanner({ waterCups: cup })}
                    >
                      🥤
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="card planner-card planner-exercise">
              <h3>Exercise</h3>
              <div className="planner-two-metrics">
                <label>
                  <span>Minutes</span>
                  <input
                    type="number"
                    min="0"
                    value={planner.exerciseMinutes || 0}
                    onChange={(e) => updatePlanner({ exerciseMinutes: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </label>
                <label>
                  <span>Steps</span>
                  <input
                    type="number"
                    min="0"
                    value={planner.exerciseSteps || 0}
                    onChange={(e) => updatePlanner({ exerciseSteps: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </label>
              </div>
            </article>

            <article className="card planner-card planner-gratitude">
              <h3>Today I Am Grateful For</h3>
              <textarea
                rows={3}
                value={planner.gratitude || ''}
                onChange={(e) => updatePlanner({ gratitude: e.target.value })}
                placeholder="Capture one thing that gave you energy today"
              />
            </article>

            <article className="card planner-card planner-notes">
              <h3>Notes</h3>
              <textarea
                rows={3}
                value={planner.notes || ''}
                onChange={(e) => updatePlanner({ notes: e.target.value })}
                placeholder="Notes"
              />
            </article>

            <article className="card planner-card planner-tomorrow">
              <h3>For Tomorrow</h3>
              <textarea
                rows={3}
                value={planner.tomorrow || ''}
                onChange={(e) => updatePlanner({ tomorrow: e.target.value })}
                placeholder="Write one clear next step for tomorrow"
              />
            </article>
          </section>
        </section>
      )}

      {tab === 'goals' && (
        <section className="card-grid">
          <section className="card goals-touch-panel">
            <div className="goals-touch-top">
              <div className="goal-category-strip" role="tablist" aria-label="Goal categories">
                {normalizedCategories.map((category) => {
                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={activeGoalCategory?.id === category.id ? 'goal-category-pill active' : 'goal-category-pill'}
                      onClick={() => setActiveGoalCategoryId(category.id)}
                    >
                      <span>{category.name}</span>
                    </button>
                  );
                })}
              </div>
              <button className="secondary goal-editor-btn" onClick={() => setShowSettings(true)}>Edit goals</button>
            </div>

            {activeGoalCategory ? (
              <>
                <div className="goal-focus-banner compact">
                  <h3>{activeGoalCategory.name}</h3>
                  <div className="goal-focus-summary-row" role="status" aria-label="Active category summary">
                    <span className="goal-focus-summary-item">Goals: <strong>{activeAreaGoals.length}</strong></span>
                    <span className="goal-focus-summary-item">On pace: <strong>{activeAreaPaceStatus}</strong> ({activeAreaCompleted}/{activeAreaTrackableGoals.length || 0})</span>
                    <span className="goal-focus-summary-item">Rate: <strong>{activeAreaCompletionRate}%</strong></span>
                    <span className="goal-focus-summary-item">Actions: <strong>{actionItems.length}</strong></span>
                    <span className="goal-focus-summary-item">Done: <strong>{completedActionItems}</strong></span>
                  </div>
                </div>

                <div className="dash-sub-tabs at-top" role="tablist" aria-label="Goal views">
                  <button
                    type="button"
                    className={goalsView === 'details' ? 'dash-sub-tab active' : 'dash-sub-tab'}
                    onClick={() => setGoalsView('details')}
                  >
                    Goals
                  </button>
                  <button
                    type="button"
                    className={goalsView === 'schedule' ? 'dash-sub-tab active' : 'dash-sub-tab'}
                    onClick={() => setGoalsView('schedule')}
                  >
                    Weekly Schedule
                  </button>
                </div>

                {goalsView === 'details' ? (
                  activeAreaGoals.length ? (
                    <div className="goal-detail-list">
                      {activeAreaGoals.map((goal) => {
                        const goalPeriod = normalizeGoalPeriod(goal.period);
                        const isMilestoneGoal = isTargetGoalPeriod(goalPeriod);
                        const usesChecklist = goalPeriod === 'week' || goalPeriod === 'day';
                        const currentValue = isMilestoneGoal ? 0 : goalCount(goal);
                        const targetValue = Number(goal.target || 0);
                        const isComplete = !isMilestoneGoal && targetValue > 0 && currentValue >= targetValue;
                        const remaining = Math.max(0, targetValue - currentValue);
                        const progressPct = targetValue > 0 ? Math.min(100, Math.round((currentValue / targetValue) * 100)) : 0;
                        const unitSuffix = goal.unit && goal.unit !== 'count' ? ` ${goal.unit}` : '';
                        const sessionPlan = normalizeSessionPlan(goal.sessionPlan);
                        const showSessionPlan = isSessionPlanningGoal(goal) && (sessionPlan.days.length || sessionPlan.focus || sessionPlan.instructions || sessionPlan.resourceUrl || sessionPlan.imageUrl);

                        return (
                          <article className="goal-detail-card" key={goal.id}>
                            <div className={isMilestoneGoal ? 'goal-inline-progress-row milestone' : 'goal-inline-progress-row'}>
                              <h4>{goal.name}</h4>
                              {isMilestoneGoal ? (
                                <div className="goal-inline-milestone-meta">{goal.victoryDate ? `Victory ${goal.victoryDate}` : 'Victory date not set'}</div>
                              ) : (
                                <div className="goal-inline-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={targetValue || 0} aria-valuenow={currentValue} aria-label={`${goal.name} progress`}>
                                  <div className="goal-inline-progress-fill" style={{ width: `${progressPct}%` }} />
                                </div>
                              )}
                              <span className="goal-inline-progress-value">
                                {isMilestoneGoal ? `Target ${targetValue || 'Not set'}${targetValue ? unitSuffix : ''}` : `${currentValue}/${targetValue}${unitSuffix}`}
                              </span>
                              <span className={isComplete ? 'goal-status-pill done' : 'goal-status-pill'}>
                                {isMilestoneGoal ? 'Milestone' : isComplete ? 'On pace' : `${remaining} left`}
                              </span>
                            </div>

                            {isMilestoneGoal ? (
                              <>
                                <div className="goal-outcome-grid">
                                  <div className="goal-outcome-cell">
                                    <span>Target</span>
                                    <strong>{targetValue || 'Not set'} {goal.unit && goal.unit !== 'count' ? goal.unit : ''}</strong>
                                  </div>
                                  <div className="goal-outcome-cell">
                                    <span>Victory</span>
                                    <strong>{goal.victoryDate || 'Not set'}</strong>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {showSessionPlan && (
                                  <div className="goal-session-plan">
                                    <div className="weekly-calendar-label">Session plan</div>
                                    {!!sessionPlan.days.length && (
                                      <div className="goal-session-days-display">
                                        {sessionPlan.days.map((day) => <span key={`${goal.id}-${day}`} className="goal-session-chip">{day}</span>)}
                                      </div>
                                    )}
                                    {sessionPlan.focus && <p className="goal-session-copy"><strong>Focus:</strong> {sessionPlan.focus}</p>}
                                    {sessionPlan.instructions && <p className="goal-session-copy"><strong>Plan:</strong> {sessionPlan.instructions}</p>}
                                    {sessionPlan.resourceUrl && <a className="goal-session-link" href={sessionPlan.resourceUrl} target="_blank" rel="noreferrer">Open exercise guide</a>}
                                    {sessionPlan.imageUrl && (
                                      <div className="goal-session-image">
                                        <img src={sessionPlan.imageUrl} alt={`${goal.name} reference`} />
                                      </div>
                                    )}
                                  </div>
                                )}
                                {usesChecklist ? (
                                  <div className="weekly-calendar">
                                    <div className="weekly-calendar-label">Weekly check-in</div>
                                    <div className="weekly-calendar-grid">
                                      {weekDateOptions.map((dayOption) => {
                                        const checked = isWeeklyGoalChecked(goal, dayOption.iso);
                                        const isToday = dayOption.iso === today;
                                        const note = checked ? (data.entries.goalUpdates || []).find((e) => e.date === dayOption.iso && e.source === 'weekly-check' && e.goalId === goal.id)?.note : null;
                                        return (
                                          <button
                                            key={`${goal.id}-${dayOption.iso}`}
                                            type="button"
                                            className={`weekly-cal-day${checked ? ' checked' : ''}${isToday ? ' today' : ''}`}
                                            onClick={() => toggleWeeklyGoalCheck(goal, dayOption.iso)}
                                            aria-pressed={checked}
                                            title={note || ''}
                                          >
                                            <span className="weekly-cal-dayname">{dayOption.label}</span>
                                            <span className="weekly-cal-date">{dayOption.day}</span>
                                            {checked && <span className="weekly-cal-check">✓</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="goal-progress-capture">
                                    <div className="goal-progress-capture-meta">Update what you completed for this goal</div>
                                    <div className="goal-progress-capture-actions">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={goalUpdateDrafts[goal.id] ?? '1'}
                                        onChange={(e) => setGoalUpdateDrafts((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                                        aria-label={`Progress amount for ${goal.name}`}
                                      />
                                      <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => recordGoalProgress(goal, goalUpdateDrafts[goal.id] ?? '1')}
                                      >
                                        Add progress
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                            {goal.createdAt && (
                              <div className="goal-baseline-row">
                                <span>Since {goal.createdAt}</span>
                                <span>{Math.max(0, Math.floor((new Date(today + 'T00:00:00') - new Date(goal.createdAt + 'T00:00:00')) / 86400000))} days active</span>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ marginTop: 16 }}>Any start is a beginning. Add one goal and we can build the path with you.</div>
                  )
                ) : (
                  <WeeklyPlanView
                    weeklySchedules={data.weeklySchedules}
                    goalDeadlineLog={data.goalDeadlineLog}
                    todayIso={today}
                    onTaskStatusChange={handleTaskStatusChange}
                    onAlarmToggle={handleAlarmToggle}
                  />
                )}
              </>
            ) : (
              <div className="empty-state" style={{ marginTop: 16 }}>A single focus area is enough to get started. Add one and we’ll help shape the rest.</div>
            )}
          </section>
        </section>
      )}

      {tab === 'roadmap' && (
        <section className="card-grid">
          <section className="card roadmap-single-scroll">
            <div className="dash-sub-tabs at-top" role="tablist" aria-label="Roadmap views">
              <button
                type="button"
                className={roadmapView === 'roadmap' ? 'dash-sub-tab active' : 'dash-sub-tab'}
                onClick={() => setRoadmapView('roadmap')}
              >
                Roadmap
              </button>
              <button
                type="button"
                className={roadmapView === 'history' ? 'dash-sub-tab active' : 'dash-sub-tab'}
                onClick={() => setRoadmapView('history')}
              >
                Recent history
              </button>
            </div>

            {roadmapView === 'roadmap' ? (
              <>
                <div className="tabs category-tabs" role="tablist" aria-label="Roadmap categories">
                  {normalizedCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={activeGoalCategory?.id === category.id ? 'tab active' : 'tab'}
                      onClick={() => setActiveGoalCategoryId(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                {activeGoalCategory ? (
                  <div style={{ marginTop: 14 }}>
                    <RoadmapList goals={filteredRoadmapGoals} actions={filteredRoadmapActions} />
                  </div>
                ) : (
                  <div className="empty-state">A good plan can start small. Add one goal and we’ll help turn it into a path forward.</div>
                )}
              </>
            ) : (
              <>
                <div className="tabs category-tabs" role="tablist" aria-label="Roadmap history categories">
                  {normalizedCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={activeGoalCategory?.id === category.id ? 'tab active' : 'tab'}
                      onClick={() => setActiveGoalCategoryId(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                {activeGoalCategory ? (
                  <div className="roadmap-history-content" style={{ marginTop: 14 }}>
                    <EntryList
                      items={mergeEntries(activeGoalCategory.goals.map((goal) => {
                        const bucket = mapGoalToBucket(goal.name);
                        return [bucket || 'unknown', data.entries[bucket] || [], goal.name];
                      }))}
                      onDelete={removeEntry}
                    />
                  </div>
                ) : (
                  <div className="empty-state">A good plan can start small. Add one goal and we’ll help turn it into a path forward.</div>
                )}
              </>
            )}
          </section>
        </section>
      )}

      {tab === 'progress' && (
        <section className="card-grid">
          <section className="card">
            <div className="dash-sub-tabs at-top" role="tablist" aria-label="Progress views">
              <button
                type="button"
                className={progressView === 'goals' ? 'dash-sub-tab active' : 'dash-sub-tab'}
                onClick={() => setProgressView('goals')}
              >
                Goal progress
              </button>
              <button
                type="button"
                className={progressView === 'category' ? 'dash-sub-tab active' : 'dash-sub-tab'}
                onClick={() => setProgressView('category')}
              >
                Category analysis
              </button>
              <button
                type="button"
                className={progressView === 'checkins' ? 'dash-sub-tab active' : 'dash-sub-tab'}
                onClick={() => setProgressView('checkins')}
              >
                Check-in history
              </button>
            </div>

            {progressView === 'checkins' ? (
              <div style={{ marginTop: 14 }}>
                {(data.weeklyCheckIns?.entries || []).length ? (
                  <div className="checkin-history-list">
                    {(data.weeklyCheckIns?.entries || []).map((entry) => (
                      <div key={entry.id} className="checkin-history-card">
                        <div className="checkin-history-header">
                          <span className="checkin-history-week">Week {entry.weekId?.replace(/^\d{4}-W/, '')}</span>
                          <span className="checkin-history-date">{entry.date}</span>
                          <span className="checkin-history-rating">{['', '😞', '😐', '🙂', '😊', '🔥'][entry.rating || 0]}</span>
                        </div>
                        {entry.wentWell && <p className="checkin-history-note"><strong>Went well:</strong> {entry.wentWell}</p>}
                        {entry.toImprove && <p className="checkin-history-note"><strong>To improve:</strong> {entry.toImprove}</p>}
                        {entry.stats && (
                          <div className="checkin-history-stats">
                            <span>{entry.stats.weeklyLogs} logs</span>
                            <span>{entry.stats.streak}-day streak</span>
                            <span>{entry.stats.goalsOnPace}/{entry.stats.totalGoals} goals on pace</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">Your weekly reflection will show up here. Start with one check-in and we’ll build from there.</div>
                )}
              </div>
            ) : progressView === 'goals' ? (
              <>
                <div className="tabs category-tabs" role="tablist" aria-label="Goal progress categories">
                  {normalizedCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={activeGoalCategory?.id === category.id ? 'tab active' : 'tab'}
                      onClick={() => setActiveGoalCategoryId(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                {activeGoalCategory ? (
                  <div style={{ marginTop: 14 }}>
                    {activeAreaTrackableGoals.length ? activeAreaTrackableGoals.map((goal) => (
                      <div key={goal.id} style={{ marginTop: 10 }}>
                        <ProgressRow
                          label={goal.name}
                          value={goalCount(goal)}
                          target={Number(goal.target) || 0}
                          unit={goal.unit}
                        />
                      </div>
                    )) : <div className="empty-state" style={{ marginTop: 10 }}>A measurable goal here will make your progress easier to see week by week.</div>}
                    <div className="snapshot-row"><span>Action items complete</span><strong>{activeCategoryCompletedActions}/{filteredRoadmapActions.length}</strong></div>
                    <div className="snapshot-row"><span>Average short-term progress</span><strong>{activeCategoryAverageGoalProgress}%</strong></div>
                  </div>
                ) : (
                  <div className="empty-state">A good plan can start small. Add one goal and we’ll help turn it into a path forward.</div>
                )}
              </>
            ) : (
              <>
                <div className="tabs category-tabs" role="tablist" aria-label="Analytics categories">
                  {normalizedCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={activeGoalCategory?.id === category.id ? 'tab active' : 'tab'}
                      onClick={() => setActiveGoalCategoryId(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                {activeGoalCategory ? (
                  <div style={{ marginTop: 14 }}>
                    {activeGoalCategory.goals.length ? activeGoalCategory.goals.map((goal) => (
                      <div key={goal.id} style={{ marginTop: 10 }}>
                        <ProgressRow
                          label={goal.name}
                          value={isTargetGoalPeriod(goal.period) ? 0 : goalCount(goal)}
                          target={Number(goal.target) || 0}
                          unit={goal.unit}
                        />
                      </div>
                    )) : <div className="empty-state" style={{ marginTop: 10 }}>This category is ready for its first goal whenever you are.</div>}
                  </div>
                ) : (
                  <div className="empty-state">A good plan can start small. Add one goal and we’ll help turn it into a path forward.</div>
                )}
              </>
            )}
          </section>
        </section>
      )}

      {tab === 'log' && (
        <section className="card-grid">
          <section className="card">
            <div className="dash-sub-tabs at-top" role="tablist" aria-label="Log views">
              <button
                type="button"
                className={logView === 'capture' ? 'dash-sub-tab active' : 'dash-sub-tab'}
                onClick={() => setLogView('capture')}
              >
                Capture
              </button>
              <button
                type="button"
                className={logView === 'trend' ? 'dash-sub-tab active' : 'dash-sub-tab'}
                onClick={() => setLogView('trend')}
              >
                Weight trend
              </button>
            </div>

            {logView === 'trend' ? (
              <MiniLineChart data={weightSeries} />
            ) : (
              <>
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
                    (has('journal') || has('journey') || has('ai')) && { key: 'journal', label: 'Journal', form: <JournalForm onSave={(e) => { addEntry('journal', e); close(); }} /> },
                    has('bug')     && { key: 'bug',     label: 'Bug',     form: <BugForm     onSave={(e) => { addEntry('bugs', e);     close(); }} /> },
                    has('mentor')  && { key: 'mentor',  label: 'Mentor',  form: <MentorForm  onSave={(e) => { addEntry('mentor', e);   close(); }} /> },
                  ].filter(Boolean);
                  if (available.length === 0) return <div className="empty-state">Let\'s begin with one goal. Once it\'s in place, your tracking flow will be ready.</div>;
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
                      {openItem?.key === 'pool' && <div className="note-box">{data.reminders.preShotRoutine}</div>}
                      {openItem && <div className="log-form-body">{openItem.form}</div>}
                    </>
                  );
                })()}
              </>
            )}
          </section>
        </section>
      )}

      {/* ── CHECK-IN NOTE POPUP ─────────────────────────── */}
      {checkinPopup && (
        <div className="checkin-note-overlay">
          <div className="checkin-note-popup">
            <div className="checkin-note-header">
              <h3>What did you do?</h3>
              <span className="checkin-note-meta">{checkinPopup.goalName} · {checkinPopup.dateIso}</span>
            </div>
            <div className="checkin-note-mode-toggle">
              <button
                type="button"
                className={`checkin-mode-btn${checkinInputMode === 'text' ? ' active' : ''}`}
                onClick={() => { setCheckinInputMode('text'); if (checkinRecording) stopAudioRecording(); }}
                title="Type your note"
              >
                ✏️
              </button>
              <button
                type="button"
                className={`checkin-mode-btn${checkinInputMode === 'audio' ? ' active' : ''}`}
                onClick={() => setCheckinInputMode('audio')}
                title="Record audio note"
              >
                🎤
              </button>
            </div>

            {checkinInputMode === 'text' ? (
              <textarea
                className="checkin-note-input"
                placeholder="Quick summary of what you did..."
                value={checkinNote}
                onChange={(e) => setCheckinNote(e.target.value)}
                rows={3}
                autoFocus
              />
            ) : (
              <div className="checkin-audio-area">
                {!checkinRecording && !checkinAudioUrl && (
                  <button type="button" className="checkin-record-btn" onClick={startAudioRecording}>
                    <span className="checkin-record-icon">🎙️</span>
                    <span>Tap to record</span>
                  </button>
                )}
                {checkinRecording && (
                  <button type="button" className="checkin-record-btn recording" onClick={stopAudioRecording}>
                    <span className="checkin-record-pulse" />
                    <span>Recording... tap to stop</span>
                  </button>
                )}
                {checkinAudioUrl && !checkinRecording && (
                  <div className="checkin-audio-preview">
                    <audio controls src={checkinAudioUrl} />
                    <button type="button" className="link-btn" onClick={() => { setCheckinAudioUrl(null); setCheckinNote(''); }}>Re-record</button>
                  </div>
                )}
                {checkinNote && checkinInputMode === 'audio' && (
                  <div className="checkin-transcript">
                    <span className="checkin-transcript-label">Transcript</span>
                    <p>{checkinNote}</p>
                  </div>
                )}
              </div>
            )}

            <div className="checkin-note-actions">
              <button type="button" className="secondary" onClick={() => setCheckinPopup(null)}>Cancel</button>
              <button type="button" className="primary" onClick={submitCheckinPopup}>
                {checkinNote.trim() || checkinAudioUrl ? 'Save & check in →' : 'Check in →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsEditor
          data={data}
          setData={setData}
          onClose={() => setShowSettings(false)}
          onDeferPlanIntake={() => setGoalQuizDeferredTab(tab)}
          launchPlanIntake={settingsLaunchIntent}
          onLaunchPlanIntakeHandled={() => setSettingsLaunchIntent(null)}
          onExportData={exportData}
          onImportData={importData}
          activeTheme={activeTheme}
          setActiveTheme={setActiveTheme}
          themeMap={themeMap}
          trackEvent={trackEvent}
        />
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
  if (!items.length) return <div className="empty-state">Your progress history will begin with the first entry you add.</div>;
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
  if (!data.length) return <div className="empty-state">Add a few weight check-ins and your trend will start to take shape.</div>;
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
    return <div className="empty-state">Add one short-term goal or action step, and your roadmap will start taking shape.</div>;
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

function JournalForm({ onSave }) {
  const [date, setDate] = useState(ISO_DATE());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <BaseForm title="Journal entry">
      <DateField value={date} onChange={setDate} />
      <TextField label="What happened today?" value={title} onChange={setTitle} />
      <TextAreaField label="Thoughts, reflections, lessons learned" value={notes} onChange={setNotes} />
      <button className="primary" onClick={() => { if (!title) return; onSave({ date, title, notes }); setTitle(''); setNotes(''); }}>Save journal entry</button>
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
