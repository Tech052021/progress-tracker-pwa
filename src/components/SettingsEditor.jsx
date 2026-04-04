import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyGeneratedDraft,
  buildPlanBlueprint,
  parseNumericInput,
  stripDraftFields,
  toISODateAfter,
} from './settingsPlanner';
import useLayeredModalSizing from './useLayeredModalSizing';
import { buildGoalCoachNotes, buildFlowReadinessReview } from '../services/goalCoachAgent';

const LB_PER_KG = 2.20462;
const SESSION_DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function normalizeGoalPeriod(period) {
  const normalized = String(period || '').trim().toLowerCase().replace(/^\//, '');
  return normalized || 'week';
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

function getSuggestedUnits(goal, weightUnit = 'lb') {
  const name = String(goal?.name || '').toLowerCase();
  const current = String(goal?.unit || '').trim();
  let options = ['count'];

  if (name.includes('weight')) {
    options = [weightUnit, weightUnit === 'lb' ? 'kg' : 'lb'];
  } else if (name.includes('protein')) {
    options = ['g'];
  } else if (name.includes('water')) {
    options = ['liters', 'ml'];
  } else if (name.includes('sleep')) {
    options = ['hours'];
  } else if (/(cardio|strength|workout|session|practice)/.test(name)) {
    options = ['sessions'];
  } else if (/(read|book|page)/.test(name)) {
    options = ['pages'];
  }

  return [...new Set([...options, current].filter(Boolean))];
}

function getSuggestedPeriods(goal) {
  const name = String(goal?.name || '').toLowerCase();
  const current = normalizeGoalPeriod(goal?.period);

  let options = ['week', 'day', 'month', 'target'];
  if (name.includes('weight')) {
    options = ['target', 'week'];
  } else if (name.includes('protein') || name.includes('water') || name.includes('sleep')) {
    options = ['day', 'week'];
  }

  return [...new Set([...options, current])];
}

function getGoalHintText(goal) {
  const name = String(goal?.name || '').toLowerCase();
  const target = Number(goal?.target);
  const unit = String(goal?.unit || '').trim();

  if (name.includes('protein')) {
    if (Number.isFinite(target) && target > 0) {
      return `Daily target: ${target} ${unit || 'g'}. Log what you actually consume each day.`;
    }
    return 'Set a daily protein target in grams so progress is clear.';
  }

  if (name.includes('water')) {
    if (Number.isFinite(target) && target > 0) {
      return `Daily hydration target: ${target} ${unit || 'liters'}.`; 
    }
    return 'Set a daily water target to track hydration consistently.';
  }

  if (name.includes('sleep')) {
    if (Number.isFinite(target) && target > 0) {
      return `Daily sleep target: ${target} ${unit || 'hours'} each night.`;
    }
    return 'Set your ideal sleep hours per day.';
  }

  if (name.includes('weight') && normalizeGoalPeriod(goal?.period) === 'target') {
    return 'This is an outcome goal. Update progress whenever your measured weight changes.';
  }

  return '';
}

function createDefaultCategories() {
  return [
    { id: uid(), name: 'Health', goals: [] },
    { id: uid(), name: 'Career', goals: [] },
    { id: uid(), name: 'Hobby', goals: [] }
  ];
}

function formatTimeToVictory(victoryDate) {
  if (!victoryDate) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const victory = new Date(`${victoryDate}T00:00:00`);
  const diffMs = victory - today;
  if (diffMs < 0) return '(Past victory date)';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(diffDays / 7);
  const months = Math.floor(diffDays / 30);
  const years = Math.floor(diffDays / 365);
  if (diffDays === 0) return 'Victory today!';
  if (diffDays === 1) return '1 day to victory';
  if (weeks < 2) return `${diffDays} days to victory`;
  if (months < 2) return `${weeks} weeks to victory`;
  if (years < 1) return `${months} months to victory`;
  return `${years} year${years > 1 ? 's' : ''} to victory`;
}

function migrateCategories(data) {
  const s = data.settings || {};
  const weightUnit = s.units?.weight || s.weightUnit || 'lb';
  if (Array.isArray(s.categories)) {
    return s.categories.map((category) => ({
      ...category,
      goals: Array.isArray(category.goals)
        ? category.goals.map((goal) => ({
          ...goal,
          unit: goal.unit || inferGoalUnit(goal.name, weightUnit),
          period: normalizeGoalPeriod(goal.period),
          sessionPlan: normalizeSessionPlan(goal.sessionPlan)
        }))
        : []
    }));
  }

  return createDefaultCategories();
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
  const incomingCoachNotes = Array.isArray(data.goalPlan?.coachNotes) ? data.goalPlan.coachNotes : [];

  return {
    shortTermGoals: incomingGoals.map((goal) => ({
      ...goal,
      id: goal.id || uid(),
      title: goal.title || '',
      targetValue: Number(goal.targetValue) || 0,
      currentValue: Number(goal.currentValue) || 0,
      dueDate: goal.dueDate || ''
    })),
    actionItems: incomingActions.map((item) => ({
      ...item,
      id: item.id || uid(),
      title: item.title || '',
      goalId: item.goalId || '',
      dueDate: item.dueDate || '',
      status: item.status === 'done' ? 'done' : 'todo'
    })),
    coachNotes: incomingCoachNotes.map((note) => ({
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

function createDefaultPlanIntake() {
  return {
    planType: 'general',
    categoryName: '',
    goalText: '',
    currentValue: '',
    targetValue: '',
    targetUnit: '',
    targetDate: toISODateAfter(84),
    availableHoursPerWeek: 5,
    constraints: '',
    motivationWhy: '',
    currentReality: '',
    successDefinition: '',
    confidenceScore: 7,
    checkInPreference: 'daily',
    likelyDropOffReason: '',
    enjoymentAnchor: '',
    supportPeople: '',
    useSuggestedTimeline: true
  };
}

function getWeeksUntilTargetDate(targetDate) {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target - today;
  const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return Math.max(2, Math.ceil(diffDays / 7));
}


export default function SettingsEditor({ data, setData, onClose, onExportData, onImportData, activeTheme, setActiveTheme, themeMap, trackEvent, launchPlanIntake, onLaunchPlanIntakeHandled, onDeferPlanIntake }) {
  const [draft, setDraft] = useState(() => ({
    profile: migrateProfile(data),
    goalPlan: migrateGoalPlan(data),
    units: migrateUnits(data),
    categories: migrateCategories(data)
  }));
  // Track last added goal so we can autofocus its name input
  const [lastAddedGoalId, setLastAddedGoalId] = useState(null);
  const [expandedSessionGoalId, setExpandedSessionGoalId] = useState(null);
  const [showPlanIntakeDialog, setShowPlanIntakeDialog] = useState(false);
  const [intakeOnlyMode, setIntakeOnlyMode] = useState(false);
  const [planIntake, setPlanIntake] = useState(() => createDefaultPlanIntake());
  const [planIntakeMode, setPlanIntakeMode] = useState('append');
  const [lastGeneratedDraft, setLastGeneratedDraft] = useState(null);
  const settingsModalRef = useRef(null);
  const backupFileInputRef = useRef(null);

  const planFeedback = useMemo(() => {
    const currentValue = parseNumericInput(planIntake.currentValue);
    const targetValue = parseNumericInput(planIntake.targetValue);
    const weeksFromDate = getWeeksUntilTargetDate(planIntake.targetDate);
    const timeframeWeeks = weeksFromDate || Math.max(1, Number(planIntake.timeframeWeeks) || 12);
    const unit = String(planIntake.targetUnit || '').toLowerCase();
    const lowerGoal = String(planIntake.goalText || '').toLowerCase();
    const isWeightPlan = planIntake.planType === 'weight' || /(weight|lose|fat)/.test(lowerGoal) || unit === 'lb' || unit === 'lbs' || unit === 'kg';

    if (isWeightPlan && currentValue !== null && targetValue !== null && currentValue > targetValue) {
      const delta = currentValue - targetValue;
      const perWeek = delta / timeframeWeeks;
      const maxPerWeek = unit === 'kg' ? 0.9 : 2;
      const safePerWeek = unit === 'kg' ? 0.7 : 1.5;
      const recommendedWeeks = Math.max(timeframeWeeks, Math.ceil(delta / safePerWeek));
      const aggressive = perWeek > maxPerWeek;
      return {
        isWeightPlan: true,
        isAggressive: aggressive,
        recommendedWeeks,
        effectiveTimeframeWeeks: aggressive && planIntake.useSuggestedTimeline ? recommendedWeeks : timeframeWeeks,
        message: aggressive
          ? `This target date looks very aggressive. A steadier plan would be about ${recommendedWeeks} weeks so progress feels easier to sustain.`
          : 'This looks like a realistic pace if you stay consistent.'
      };
    }

    if ((planIntake.planType === 'study' || /a\+|grade|exam|class|course/.test(lowerGoal)) && Number(planIntake.availableHoursPerWeek || 0) < 4) {
      return {
        isWeightPlan: false,
        isAggressive: false,
        recommendedWeeks: timeframeWeeks,
        effectiveTimeframeWeeks: timeframeWeeks,
        message: 'This may still work, but consider reserving at least 4 focused hours each week for stronger results.'
      };
    }

    return {
      isWeightPlan: false,
      isAggressive: false,
      recommendedWeeks: timeframeWeeks,
      effectiveTimeframeWeeks: timeframeWeeks,
      message: 'We will create a draft plan you can adjust before saving.'
    };
  }, [planIntake]);

  const timelineSummary = useMemo(() => {
    const weeks = planFeedback.effectiveTimeframeWeeks;
    if (!weeks || !Number.isFinite(weeks)) return '';
    if (weeks < 5) return `${weeks} weeks`;
    const months = Math.max(1, Math.round((weeks / 52) * 12));
    if (months < 12) return `${weeks} weeks (about ${months} month${months > 1 ? 's' : ''})`;
    const years = Math.max(1, Math.round(months / 12));
    return `${weeks} weeks (about ${years} year${years > 1 ? 's' : ''})`;
  }, [planFeedback.effectiveTimeframeWeeks]);

  const planPreview = useMemo(() => {
    if (!String(planIntake.goalText || '').trim()) return null;
    return buildPlanBlueprint(
      { ...planIntake, effectiveTimeframeWeeks: planFeedback.effectiveTimeframeWeeks },
      draft.units.weight
    );
  }, [draft.units.weight, planFeedback.effectiveTimeframeWeeks, planIntake]);

  const coachPreview = useMemo(() => {
    if (!planPreview) return null;
    return buildGoalCoachNotes({
      intake: planIntake,
      blueprint: planPreview,
      planFeedback
    });
  }, [planPreview, planIntake, planFeedback]);

  const flowReadinessPreview = useMemo(() => {
    if (!coachPreview) return null;
    return buildFlowReadinessReview({
      intake: planIntake,
      coachNote: coachPreview,
      planFeedback
    });
  }, [coachPreview, planIntake, planFeedback]);

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

  const { plannerSubmodalStyle } = useLayeredModalSizing(
    settingsModalRef,
    showPlanIntakeDialog
  );

  const updateCategoryName = (catId, name) => {
    setDraft((d) => ({ ...d, categories: d.categories.map(c => c.id === catId ? { ...c, name } : c) }));
  };

  const openPlanIntake = (mode = 'append') => {
    setPlanIntakeMode(mode);
    if (mode === 'replace' && lastGeneratedDraft?.intake) {
      setPlanIntake({ ...createDefaultPlanIntake(), ...lastGeneratedDraft.intake });
    } else {
      setPlanIntake(createDefaultPlanIntake());
    }
    setShowPlanIntakeDialog(true);
  };

  const closePlanIntake = ({ defer = false } = {}) => {
    setShowPlanIntakeDialog(false);
    if (defer && intakeOnlyMode) {
      setIntakeOnlyMode(false);
      if (typeof onDeferPlanIntake === 'function') onDeferPlanIntake();
      if (typeof onClose === 'function') onClose();
    }
  };

  useEffect(() => {
    if (!launchPlanIntake?.token) return;
    setIntakeOnlyMode(Boolean(launchPlanIntake.focusOnly));
    openPlanIntake(launchPlanIntake.mode || 'append');
    if (typeof onLaunchPlanIntakeHandled === 'function') onLaunchPlanIntakeHandled();
  }, [launchPlanIntake?.token]);

  const generatePlanFromIntake = (mode = 'append') => {
    if (!String(planIntake.goalText || '').trim()) {
      alert('Please describe what you want to achieve.');
      return;
    }

    const blueprint = buildPlanBlueprint({ ...planIntake, effectiveTimeframeWeeks: planFeedback.effectiveTimeframeWeeks }, draft.units.weight);
    const coachNote = buildGoalCoachNotes({ intake: planIntake, blueprint, planFeedback });
    const draftId = mode === 'replace' && lastGeneratedDraft?.draftId ? lastGeneratedDraft.draftId : uid();
    let nextActiveId = null;

    setDraft((d) => {
      const result = applyGeneratedDraft({ draft: d, blueprint, draftId, mode, makeId: uid });
      nextActiveId = result.nextActiveId;
      const existingCoachNotes = Array.isArray(result.nextDraft.goalPlan?.coachNotes) ? result.nextDraft.goalPlan.coachNotes : [];
      const nextCoachNotes = [
        ...existingCoachNotes.filter((note) => !(mode === 'replace' && note._draftId === draftId)),
        { ...coachNote, _draftId: draftId, _draftSource: 'plan-intake' }
      ];

      return {
        ...result.nextDraft,
        goalPlan: {
          ...result.nextDraft.goalPlan,
          coachNotes: nextCoachNotes
        }
      };
    });

    if (nextActiveId) setActiveCatId(nextActiveId);
    setLastGeneratedDraft({ draftId, intake: { ...planIntake }, categoryName: blueprint.categoryName });
    if (intakeOnlyMode) setIntakeOnlyMode(false);
    closePlanIntake({ defer: false });
    if (trackEvent) trackEvent('plan_created', { mode, categoryName: blueprint.categoryName });
    alert(mode === 'replace' ? 'Draft plan regenerated. Review and edit before clicking Apply.' : 'Draft plan generated. Review and edit before clicking Apply.');
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
    setDraft((d) => ({ ...d, categories: d.categories.map(c => c.id === catId ? { ...c, goals: [...c.goals, { id: newId, name: 'New Goal', target: 0, period: 'week', unit: 'count', victoryDate: '', createdAt: new Date().toISOString().slice(0, 10), sessionPlan: normalizeSessionPlan(null) }] } : c) }));
    setLastAddedGoalId(newId);
    if (trackEvent) trackEvent('goal_added', { goalId: newId, categoryId: catId });
  };

  const removeGoal = (catId, goalId) => {
    if (!window.confirm('Delete this goal?')) return;
    if (trackEvent) trackEvent('goal_deleted', { goalId, categoryId: catId });
    setDraft((d) => ({ ...d, categories: d.categories.map(c => c.id === catId ? { ...c, goals: c.goals.filter(g => g.id !== goalId) } : c) }));
  };

  const updateGoal = (catId, goalId, patch) => {
    setDraft((d) => ({ ...d, categories: d.categories.map(c => c.id === catId ? { ...c, goals: c.goals.map(g => g.id === goalId ? { ...g, ...patch } : g) } : c) }));
  };

  const updateProfile = (patch) => {
    setDraft((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
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
    const prevWeightUnit = data.settings?.units?.weight || 'lb';
    const nextWeightUnit = draft.units.weight;
    const categoriesToPersist = stripDraftFields(draft.categories);
    const shortTermGoalsToPersist = stripDraftFields(draft.goalPlan.shortTermGoals);
    const actionItemsToPersist = stripDraftFields(draft.goalPlan.actionItems);
    const coachNotesToPersist = stripDraftFields(draft.goalPlan.coachNotes || []);
    const validGoalIds = new Set(
      categoriesToPersist.flatMap((category) =>
        (category.goals || []).map((goal) => goal.id).filter(Boolean)
      )
    );

    const workoutsPerWeek = findGoalTarget(categoriesToPersist, 'workout');
    const leetcodePerWeek = findGoalTarget(categoriesToPersist, 'leetcode');
    const poolPracticePerWeek = findGoalTarget(categoriesToPersist, 'pool');
    const uvmTopicsPerMonth = findGoalTarget(categoriesToPersist, 'uvm');
    const aiExperimentsPerMonth = findGoalTarget(categoriesToPersist, 'ai');
    const targetWeight = findGoalTarget(categoriesToPersist, 'weight');

    setData((prev) => ({
      ...prev,
      goalPlan: {
        ...prev.goalPlan,
        shortTermGoals: shortTermGoalsToPersist,
        actionItems: actionItemsToPersist,
        coachNotes: coachNotesToPersist
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
        goalUpdates: (prev.entries.goalUpdates || []).filter((entry) => entry.goalId && validGoalIds.has(entry.goalId)),
        weights: prev.entries.weights.map((entry) => ({
          ...entry,
          weight: convertWeightValue(entry.weight, prevWeightUnit, nextWeightUnit)
        }))
      }
    }));
    const goalsCount = categoriesToPersist.reduce((sum, c) => sum + (c.goals || []).length, 0);
    if (trackEvent) trackEvent('settings_applied', { categoriesCount: categoriesToPersist.length, goalsCount });
    alert('Your plan is updated and ready to build on.');
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
  const hasSubmodalOpen = showPlanIntakeDialog;

  return (
    <div className="modal-backdrop">
      {!intakeOnlyMode && (
      <div ref={settingsModalRef} className={`modal-content ${hasSubmodalOpen ? 'modal-content-submodal-open' : ''}`} onClick={(e) => e.stopPropagation()}>
        {themeMap && setActiveTheme && (
          <section className="card stack-gap theme-picker-card">
            <div className="card-head">
              <h2>Appearance</h2>
              <p>Pick a colour theme. Changes apply instantly and persist across sessions.</p>
            </div>
            <div className="theme-swatch-row">
              {Object.entries(themeMap).map(([key, def]) => (
                <button
                  key={key}
                  className={`theme-swatch-btn${activeTheme === key ? ' active' : ''}`}
                  title={def.label}
                  onClick={() => setActiveTheme(key)}
                  style={{ '--swatch-brand': def['--brand'], '--swatch-accent': def['--brand-accent'] }}
                >
                  <span className="theme-swatch-dot" />
                  <span className="theme-swatch-label">{def.emoji} {def.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="card stack-gap">
          <div className="card-head">
            <h2>Goals</h2>
            <p>Manage focus areas, edit measurable goals, and generate new goal plans from natural language.</p>
          </div>

          <div>
            <div className="settings-hint" style={{ marginBottom: 12 }}>
              <strong>How this workspace affects tracking:</strong>
              <p>
                The goals you define here drive dashboard cards, logging templates, progress summaries, and planner-generated roadmap items.
              </p>
            </div>

              <>
                <div className="settings-tabs">
                  <div className="tabs" role="tablist">
                    {draft.categories.map((cat) => (
                      <button key={cat.id} type="button" className={`tab ${cat.id === activeCatId ? 'active' : ''}`} onClick={() => setActiveCatId(cat.id)}>{cat.name}</button>
                    ))}
                    <button type="button" className="tab new-goal-tab" onClick={() => openPlanIntake('append')}>+ New goal</button>
                  </div>
                  <div style={{ marginLeft: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="primary" onClick={() => openPlanIntake('append')}>Quick start plan</button>
                    {lastGeneratedDraft && <button className="secondary" onClick={() => openPlanIntake('replace')}>Regenerate last draft</button>}
                  </div>
                </div>

                {activeCat ? (
                  <div className="form-card" key={activeCat.id} style={{ marginBottom: 12 }}>
                    <div className="category-header" style={{ marginBottom: 8 }}>
                      <input className="category-name" value={activeCat.name} onChange={(e) => updateCategoryName(activeCat.id, e.target.value)} />
                      <button className="secondary" onClick={() => removeCategory(activeCat.id)}>Delete category</button>
                    </div>
                    <p className="helper-text" style={{ marginTop: 0 }}>
                      Keep it simple and positive: what would you like to achieve, how much progress feels good, and how often can you do it.
                      Examples: Read | 20 | pages | week, Protein intake | 120 | g | day, Water intake | 3 | liters | day, Sleep duration | 8 | hours | day.
                      For weight outcomes, use {draft.units.weight} and set frequency to target.
                    </p>

                    <div className="planner-columns category-columns" aria-hidden="true">
                      <span>What would you like to achieve?</span>
                      <span>How much progress?</span>
                      <span>Unit</span>
                      <span>Any time you get a chance?</span>
                      <span>Victory day</span>
                      <span>Action</span>
                    </div>

                    <div className="goals-list">
                      {activeCat.goals.map((g) => {
                        const unitOptions = getSuggestedUnits(g, draft.units.weight);
                        const periodOptions = getSuggestedPeriods(g);
                        const hintText = getGoalHintText(g);
                        const sessionPlan = normalizeSessionPlan(g.sessionPlan);
                        const supportsSessionPlanning = isSessionPlanningGoal(g);
                        const sessionDetailsOpen = expandedSessionGoalId === g.id;

                        return <div className="goal-row" key={g.id}>
                          <div className="mobile-field" data-label="What would you like to achieve?">
                            <input className="goal-name" autoFocus={g.id === lastAddedGoalId} value={g.name} onChange={(e) => { updateGoal(activeCat.id, g.id, { name: e.target.value }); if (lastAddedGoalId === g.id) setLastAddedGoalId(null); }} placeholder="Example: Learn language" aria-label="Category goal name" />
                          </div>
                          <div className="mobile-field" data-label="How much progress?">
                            <input className="goal-target" type="number" value={g.target} onChange={(e) => updateGoal(activeCat.id, g.id, { target: Number(e.target.value) })} placeholder="Example: 20" aria-label="Category goal target" />
                          </div>
                          <div className="mobile-field" data-label="Unit">
                            <input className="goal-unit" value={g.unit || ''} onChange={(e) => updateGoal(activeCat.id, g.id, { unit: e.target.value })} placeholder="times / pages / kg" aria-label="Category goal unit" />
                            <div className="quick-chip-group" aria-label="Suggested unit shortcuts">
                              {unitOptions.map((unitOption) => (
                                <button
                                  key={`${g.id}-unit-${unitOption}`}
                                  type="button"
                                  className={`quick-chip ${String(g.unit || '').toLowerCase() === String(unitOption).toLowerCase() ? 'active' : ''}`}
                                  onClick={() => updateGoal(activeCat.id, g.id, { unit: unitOption })}
                                >
                                  {unitOption}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="mobile-field" data-label="Any time you get a chance?">
                            <input
                              className="goal-period"
                              list="goal-period-suggestions"
                              value={g.period || ''}
                              onChange={(e) => updateGoal(activeCat.id, g.id, { period: normalizeGoalPeriod(e.target.value) })}
                              placeholder="day / week / month / target"
                              aria-label="Goal frequency period"
                            />
                            <div className="quick-chip-group" aria-label="Suggested frequency shortcuts">
                              {periodOptions.map((periodOption) => (
                                <button
                                  key={`${g.id}-period-${periodOption}`}
                                  type="button"
                                  className={`quick-chip ${normalizeGoalPeriod(g.period) === periodOption ? 'active' : ''}`}
                                  onClick={() => updateGoal(activeCat.id, g.id, { period: periodOption })}
                                >
                                  {periodOption}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="mobile-field" data-label="Victory day (optional)">
                            <div>
                              <input type="date" value={g.victoryDate || ''} onChange={(e) => updateGoal(activeCat.id, g.id, { victoryDate: e.target.value })} aria-label="Goal victory day" />
                              {g.victoryDate && <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0' }}>{formatTimeToVictory(g.victoryDate)}</p>}
                            </div>
                          </div>
                          <div className="mobile-field" data-label="Action">
                            <button className="secondary" onClick={() => removeGoal(activeCat.id, g.id)}>Delete</button>
                          </div>
                          {supportsSessionPlanning && (
                            <div className="goal-session-toggle-row">
                              <button
                                type="button"
                                className={sessionDetailsOpen ? 'quick-chip active goal-session-toggle' : 'quick-chip goal-session-toggle'}
                                onClick={() => setExpandedSessionGoalId((prev) => prev === g.id ? null : g.id)}
                              >
                                {sessionDetailsOpen ? 'Hide session details' : 'Session details'}
                              </button>
                            </div>
                          )}
                          {hintText && <div className="goal-row-hint">{hintText}</div>}
                          {supportsSessionPlanning && sessionDetailsOpen && (
                            <div className="goal-session-editor">
                              <strong>Session plan</strong>
                              <div className="goal-session-days">
                                {SESSION_DAY_OPTIONS.map((day) => {
                                  const active = sessionPlan.days.includes(day);
                                  return (
                                    <button
                                      key={`${g.id}-day-${day}`}
                                      type="button"
                                      className={active ? 'quick-chip active' : 'quick-chip'}
                                      onClick={() => {
                                        const nextDays = active
                                          ? sessionPlan.days.filter((item) => item !== day)
                                          : [...sessionPlan.days, day];
                                        updateGoal(activeCat.id, g.id, { sessionPlan: { ...sessionPlan, days: nextDays } });
                                      }}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="goal-session-grid">
                                <label className="field">
                                  <span>Focus for this session</span>
                                  <input
                                    value={sessionPlan.focus}
                                    onChange={(e) => updateGoal(activeCat.id, g.id, { sessionPlan: { ...sessionPlan, focus: e.target.value } })}
                                    placeholder="Example: chest day, back day, intervals"
                                  />
                                </label>
                                <label className="field">
                                  <span>Resource link</span>
                                  <input
                                    value={sessionPlan.resourceUrl}
                                    onChange={(e) => updateGoal(activeCat.id, g.id, { sessionPlan: { ...sessionPlan, resourceUrl: e.target.value } })}
                                    placeholder="https://..."
                                  />
                                </label>
                              </div>
                              <div className="goal-session-grid">
                                <label className="field goal-planner-full">
                                  <span>Session notes / exercise list</span>
                                  <textarea
                                    rows="3"
                                    value={sessionPlan.instructions}
                                    onChange={(e) => updateGoal(activeCat.id, g.id, { sessionPlan: { ...sessionPlan, instructions: e.target.value } })}
                                    placeholder="Example: Bench press 4x8, incline dumbbells 3x10, pushups finisher"
                                  />
                                </label>
                              </div>
                              <div className="goal-session-grid">
                                <label className="field goal-planner-full">
                                  <span>Image link (optional)</span>
                                  <input
                                    value={sessionPlan.imageUrl}
                                    onChange={(e) => updateGoal(activeCat.id, g.id, { sessionPlan: { ...sessionPlan, imageUrl: e.target.value } })}
                                    placeholder="https://.../exercise-reference.jpg"
                                  />
                                </label>
                              </div>
                              {sessionPlan.imageUrl && (
                                <div className="goal-session-image-preview">
                                  <img src={sessionPlan.imageUrl} alt={`${g.name} session reference`} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>;
                      })}

                      <div style={{ marginTop: 8 }}>
                        <button className="secondary" onClick={() => addGoal(activeCat.id)}>Add goal</button>
                      </div>
                    </div>
                    <datalist id="goal-period-suggestions">
                      <option value="day" />
                      <option value="week" />
                      <option value="month" />
                      <option value="year" />
                      <option value="hour" />
                      <option value="minute" />
                      <option value="target" />
                    </datalist>
                  </div>
                ) : (
                  <div className="empty-state">
                    Every plan starts somewhere. Add one goal and we will help you shape the next steps.
                  </div>
                )}
              </>

            <div className="settings-actions settings-actions-sticky" style={{ marginTop: 16 }}>
              <div className="settings-backup-tools">
                <div>
                  <h3>Data backup</h3>
                  <p>Export a safety copy or import a previous backup file.</p>
                </div>
                <div className="settings-backup-actions">
                  <button type="button" className="secondary" onClick={onExportData}>Export backup</button>
                  <button type="button" className="secondary" onClick={() => backupFileInputRef.current?.click()}>Import backup</button>
                  <input
                    ref={backupFileInputRef}
                    type="file"
                    accept="application/json"
                    hidden
                    onChange={onImportData}
                  />
                </div>
              </div>
              <button className="secondary" onClick={cancel}>Cancel</button>
              <button className="primary" onClick={apply}>Apply</button>
            </div>
          </div>

        </section>
      </div>
      )}
      {showPlanIntakeDialog && (
        <div className="submodal-backdrop">
          <div className="submodal-content planner-submodal" style={plannerSubmodalStyle} onClick={(e) => e.stopPropagation()}>
            <div className="planner-submodal-header">
              <h3 style={{ marginBottom: 8 }}>{planIntakeMode === 'replace' ? 'Refresh your plan' : 'Start your plan'}</h3>
              <p style={{ marginBottom: 0, color: '#64748b' }}>
                Tell us your goal, where you are now, and where you want to go. We will suggest a practical draft plan you can edit.
              </p>
              {planIntakeMode === 'replace' && lastGeneratedDraft && (
                <div className="settings-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                  <strong>Tip:</strong>
                  <p>Reopen and change these answers anytime, then regenerate the draft before you click Apply.</p>
                </div>
              )}
              {coachPreview && (
                <div className="settings-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                  <strong>Coach preview</strong>
                  <p style={{ marginTop: 6 }}><strong>Long-term:</strong> {coachPreview.strategy.longTerm}</p>
                  <p style={{ marginTop: 6 }}><strong>Next best action:</strong> {coachPreview.nextBestAction}</p>
                  <p style={{ marginTop: 6 }}><strong>Daily:</strong> {(coachPreview.execution.daily || []).slice(0, 2).join(' | ') || 'Will be generated after intake.'}</p>
                  <p style={{ marginTop: 6 }}><strong>Weekly:</strong> {(coachPreview.execution.weekly || []).slice(0, 2).join(' | ') || 'Will be generated after intake.'}</p>
                </div>
              )}
            </div>
            <div className="planner-submodal-body">
                <label className="field">
                  <span>What kind of goal is this?</span>
                  <select
                    value={planIntake.planType}
                    onChange={(e) => setPlanIntake((p) => ({ ...p, planType: e.target.value, categoryName: p.categoryName || (e.target.value === 'weight' ? 'Health' : e.target.value === 'study' ? 'Learning' : e.target.value === 'career' ? 'Career' : '') }))}
                  >
                    <option value="general">General</option>
                    <option value="weight">Weight / health</option>
                    <option value="study">Study / class</option>
                    <option value="career">Career / business</option>
                  </select>
                </label>

                <div className="goal-planner-grid">
                  <label className="field">
                    <span>Category name</span>
                    <input
                      value={planIntake.categoryName}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, categoryName: e.target.value }))}
                      placeholder="Example: Health"
                    />
                  </label>
                  <label className="field">
                    <span>Target day</span>
                    <input
                      type="date"
                      value={planIntake.targetDate || ''}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, targetDate: e.target.value }))}
                    />
                  </label>
                </div>

                {(planIntake.planType === 'weight' || planIntake.planType === 'study') && (
                  <div className="goal-planner-grid">
                    <label className="field">
                      <span>Current situation</span>
                      <input
                        value={planIntake.currentValue}
                        onChange={(e) => setPlanIntake((p) => ({ ...p, currentValue: e.target.value }))}
                        placeholder={planIntake.planType === 'weight' ? 'Example: 210' : 'Example: Mid B average'}
                      />
                    </label>
                    <label className="field">
                      <span>Goal target</span>
                      <input
                        value={planIntake.targetValue}
                        onChange={(e) => setPlanIntake((p) => ({ ...p, targetValue: e.target.value }))}
                        placeholder={planIntake.planType === 'weight' ? 'Example: 160' : 'Example: A+'}
                      />
                    </label>
                    <label className="field">
                      <span>Unit</span>
                      <input
                        value={planIntake.targetUnit}
                        onChange={(e) => setPlanIntake((p) => ({ ...p, targetUnit: e.target.value }))}
                        placeholder={planIntake.planType === 'weight' ? 'lb / kg' : 'score / grade / chapters'}
                      />
                    </label>
                  </div>
                )}

                <label className="field">
                  <span>What would you like to achieve?</span>
                  <input
                    value={planIntake.goalText}
                    onChange={(e) => setPlanIntake((p) => ({ ...p, goalText: e.target.value }))}
                    placeholder="Example: I want to become Director of AI in the next 3 years."
                  />
                </label>

                <div className="goal-planner-grid">
                  <label className="field">
                    <span>Available hours per week</span>
                    <input
                      type="number"
                      min="1"
                      value={planIntake.availableHoursPerWeek}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, availableHoursPerWeek: e.target.value === '' ? '' : Number(e.target.value) }))}
                      onBlur={() => setPlanIntake((p) => ({ ...p, availableHoursPerWeek: Number(p.availableHoursPerWeek) || 1 }))}
                    />
                  </label>
                </div>

                {timelineSummary && (
                  <p className="helper-text" style={{ marginTop: 0 }}>
                    Timeline estimate from your target day: {timelineSummary}.
                  </p>
                )}

                <label className="field">
                  <span>Anything we should keep in mind?</span>
                  <textarea
                    rows="3"
                    value={planIntake.constraints}
                    onChange={(e) => setPlanIntake((p) => ({ ...p, constraints: e.target.value }))}
                    placeholder="Example: Busy workdays, knee pain, only evenings available"
                  />
                </label>

                <div className="settings-hint" style={{ marginBottom: 12 }}>
                  <strong>Flow fit template</strong>
                  <p>Fill this so Coach can generate the full plan and a repeat-use review.</p>
                </div>

                <div className="goal-planner-grid">
                  <label className="field">
                    <span>Why does this goal matter to you?</span>
                    <textarea
                      rows="2"
                      value={planIntake.motivationWhy}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, motivationWhy: e.target.value }))}
                      placeholder="Example: I want better energy and confidence."
                    />
                  </label>
                  <label className="field">
                    <span>Where are you right now?</span>
                    <textarea
                      rows="2"
                      value={planIntake.currentReality}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, currentReality: e.target.value }))}
                      placeholder="Example: I am inconsistent after busy workdays."
                    />
                  </label>
                </div>

                <div className="goal-planner-grid">
                  <label className="field">
                    <span>What does success look like week to week?</span>
                    <input
                      value={planIntake.successDefinition}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, successDefinition: e.target.value }))}
                      placeholder="Example: 4 workouts, 6.5h sleep average, one weekly review"
                    />
                  </label>
                  <label className="field">
                    <span>Confidence level (1-10)</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={planIntake.confidenceScore}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, confidenceScore: e.target.value === '' ? '' : Number(e.target.value) }))}
                      onBlur={() => setPlanIntake((p) => ({ ...p, confidenceScore: Math.min(10, Math.max(1, Number(p.confidenceScore) || 7)) }))}
                    />
                  </label>
                </div>

                <div className="goal-planner-grid">
                  <label className="field">
                    <span>Preferred check-in rhythm</span>
                    <select
                      value={planIntake.checkInPreference}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, checkInPreference: e.target.value }))}
                    >
                      <option value="daily">Daily</option>
                      <option value="3-times-week">3 times per week</option>
                      <option value="2-times-week">2 times per week</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Most likely reason you may drop off</span>
                    <input
                      value={planIntake.likelyDropOffReason}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, likelyDropOffReason: e.target.value }))}
                      placeholder="Example: Meetings run late and I feel drained"
                    />
                  </label>
                </div>

                <div className="goal-planner-grid">
                  <label className="field">
                    <span>What makes this enjoyable for you?</span>
                    <input
                      value={planIntake.enjoymentAnchor}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, enjoymentAnchor: e.target.value }))}
                      placeholder="Example: Training with music or tracking streaks"
                    />
                  </label>
                  <label className="field">
                    <span>Who can support accountability?</span>
                    <input
                      value={planIntake.supportPeople}
                      onChange={(e) => setPlanIntake((p) => ({ ...p, supportPeople: e.target.value }))}
                      placeholder="Example: Friend + Sunday check-in"
                    />
                  </label>
                </div>

                <div className="settings-hint" style={{ marginBottom: 12 }}>
                  <strong>{planFeedback.isAggressive ? 'Gentle reality check' : 'Planning note'}</strong>
                  <p>{planFeedback.message}</p>
                  {planFeedback.isAggressive && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: '#475569', fontSize: '14px' }}>
                      <input
                        type="checkbox"
                        checked={planIntake.useSuggestedTimeline}
                        onChange={(e) => setPlanIntake((p) => ({ ...p, useSuggestedTimeline: e.target.checked }))}
                        style={{ width: 'auto' }}
                      />
                      Use the suggested easier timeline ({planFeedback.recommendedWeeks} weeks)
                    </label>
                  )}
                </div>

                {planPreview && (
                  <div className="form-card" style={{ marginBottom: 12 }}>
                    <div className="card-head" style={{ marginBottom: 10 }}>
                      <h3 style={{ marginBottom: 6 }}>Draft preview</h3>
                      <p>
                        Category: <strong>{planPreview.categoryName}</strong>
                      </p>
                    </div>

                    <div className="goal-planner-grid">
                      <div className="mini-form">
                        <strong style={{ display: 'block', marginBottom: 8, color: '#0f172a' }}>Suggested goals</strong>
                        <div className="stack-gap">
                          {planPreview.goals.map((goal) => (
                            <div key={`${goal.name}-${goal.period}`}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{goal.name}</div>
                              <div className="helper-text" style={{ margin: '4px 0 0' }}>
                                {goal.period === 'target' ? `Target ${goal.target} ${goal.unit}` : `${goal.target} ${goal.unit} per ${goal.period}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mini-form">
                        <strong style={{ display: 'block', marginBottom: 8, color: '#0f172a' }}>Suggested milestones</strong>
                        <div className="stack-gap">
                          {planPreview.milestones.map((milestone) => (
                            <div key={`${milestone.title}-${milestone.dueDate}`}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{milestone.title}</div>
                              <div className="helper-text" style={{ margin: '4px 0 0' }}>Due by {milestone.dueDate}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mini-form" style={{ marginTop: 10 }}>
                      <strong style={{ display: 'block', marginBottom: 8, color: '#0f172a' }}>First action steps</strong>
                      <div className="stack-gap">
                        {planPreview.actions.map((action) => (
                          <div key={`${action.title}-${action.dueDate}`}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{action.title}</div>
                            <div className="helper-text" style={{ margin: '4px 0 0' }}>Target date: {action.dueDate}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {flowReadinessPreview && (
                  <div className="settings-hint" style={{ marginBottom: 12 }}>
                    <strong>Flow viability review</strong>
                    <p style={{ marginTop: 6 }}><strong>Come-back likelihood:</strong> {flowReadinessPreview.comebackScore}/100</p>
                    <p style={{ marginTop: 6 }}><strong>Verdict:</strong> {flowReadinessPreview.verdict}</p>
                    <p style={{ marginTop: 6 }}><strong>Rhythm:</strong> {flowReadinessPreview.rhythmRecommendation}</p>
                    <p style={{ marginTop: 6 }}><strong>First review prompt:</strong> {flowReadinessPreview.reviewPrompt}</p>
                    <p style={{ marginTop: 6 }}><strong>Suggested improvements:</strong> {(flowReadinessPreview.improvements || []).join(' | ')}</p>
                  </div>
                )}


            </div>{/* /.planner-submodal-body */}
            <div className="submodal-actions planner-submodal-actions">
              <button type="button" className="secondary" onClick={() => closePlanIntake({ defer: true })}>{intakeOnlyMode ? 'Fill later' : 'Cancel'}</button>
              <button type="button" className="primary" onClick={() => generatePlanFromIntake(planIntakeMode)}>{planIntakeMode === 'replace' ? 'Regenerate draft plan' : 'Generate draft plan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

