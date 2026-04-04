function normalizeText(value, fallback = '') {
  const next = String(value || '').trim();
  return next || fallback;
}

const UNSAFE_PATTERN = /\b(kill|hurt|harm|attack|abuse|self\s*harm|suicide|die|violent|weapon|hate|racist|sexist|punish|starve|overdose)\b/i;
const SHAMING_PATTERN = /\b(lazy|failure|worthless|pathetic|stupid|useless)\b/i;

function isUnsafeText(value) {
  return UNSAFE_PATTERN.test(String(value || ''));
}

function applyPositiveTone(value, fallback) {
  const cleaned = normalizeText(value, fallback);
  if (!cleaned) return normalizeText(fallback);
  const noShame = cleaned.replace(SHAMING_PATTERN, 'in progress');
  return /^try\b|^focus\b|^complete\b|^schedule\b|^review\b|^track\b|^stay\b|^build\b/i.test(noShame)
    ? noShame
    : `Try to ${noShame.charAt(0).toLowerCase()}${noShame.slice(1)}`;
}

function sanitizeSuggestion(value, fallback) {
  if (isUnsafeText(value)) return normalizeText(fallback);
  return applyPositiveTone(value, fallback);
}

function sanitizeList(values, fallbackItems) {
  const base = Array.isArray(values) ? values : [];
  const safe = base
    .map((item) => sanitizeSuggestion(item, 'Take one small positive action.'))
    .filter(Boolean);
  if (safe.length) return uniqueList(safe);
  return uniqueList((fallbackItems || []).map((item) => sanitizeSuggestion(item, 'Take one small positive action.')));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function enforceCoachGuardrails(note) {
  const safeNote = note || {};
  const safeLongTerm = sanitizeSuggestion(
    safeNote.strategy?.longTerm,
    'Focus on steady progress with a healthy and sustainable pace.'
  );
  const safeShortTerm = sanitizeList(
    safeNote.strategy?.shortTerm,
    ['Complete your first milestone with a manageable weekly rhythm.']
  ).slice(0, 3);
  const safeDaily = sanitizeList(
    safeNote.execution?.daily,
    ['Do one focused session today.', 'Log one small progress update.']
  ).slice(0, 4);
  const safeWeekly = sanitizeList(
    safeNote.execution?.weekly,
    ['Review wins and blockers once this week.', 'Plan your top 3 actions for next week.']
  ).slice(0, 5);
  const safeYearly = sanitizeList(
    safeNote.execution?.yearly,
    ['Run monthly reviews and adjust your plan with compassion.']
  ).slice(0, 3);
  const safeNextAction = sanitizeSuggestion(
    safeNote.nextBestAction,
    safeDaily[0] || 'Start with one focused session today.'
  );
  const safeRisks = sanitizeList(
    safeNote.riskFlags,
    ['If progress stalls, reduce scope and restart with a smaller daily action.']
  ).slice(0, 4);

  return {
    ...safeNote,
    strategy: {
      longTerm: safeLongTerm,
      shortTerm: safeShortTerm,
    },
    execution: {
      daily: safeDaily,
      weekly: safeWeekly,
      yearly: safeYearly,
    },
    nextBestAction: safeNextAction,
    riskFlags: safeRisks,
    coachMessage: 'You are building momentum. Keep going one step at a time; consistency beats intensity.'
  };
}

export function buildFlowReadinessReview({ intake, coachNote, planFeedback }) {
  const hoursPerWeek = Number(intake?.availableHoursPerWeek || 0);
  const confidenceScore = clamp(Number(intake?.confidenceScore || 5), 1, 10);
  const cadence = String(intake?.checkInPreference || 'daily').toLowerCase();
  const hasDropoffRisk = normalizeText(intake?.likelyDropOffReason).length > 0;
  const hasEnjoymentAnchor = normalizeText(intake?.enjoymentAnchor).length > 0;
  const hasSupport = normalizeText(intake?.supportPeople).length > 0;

  const timeReadiness = clamp(Math.round(hoursPerWeek * 12), 20, 100);
  const confidenceReadiness = clamp(confidenceScore * 10, 10, 100);
  const cadenceReadiness = cadence === 'daily' ? 95 : cadence === '3-times-week' ? 82 : 70;
  const consistencyPenalty = hasDropoffRisk ? 8 : 0;
  const consistencyBonus = (hasEnjoymentAnchor ? 6 : 0) + (hasSupport ? 5 : 0);
  const pacePenalty = planFeedback?.isAggressive ? 8 : 0;

  const comebackScore = clamp(
    Math.round((timeReadiness * 0.3) + (confidenceReadiness * 0.3) + (cadenceReadiness * 0.2) + (consistencyBonus * 2) - consistencyPenalty - pacePenalty),
    20,
    98
  );

  const verdict = comebackScore >= 80
    ? 'Strong repeat-use potential'
    : comebackScore >= 65
      ? 'Good potential with small flow tweaks'
      : 'Needs simplification to improve repeat use';

  const rhythmRecommendation = cadence === 'daily'
    ? 'Use a short daily check-in plus one weekly review.'
    : cadence === '3-times-week'
      ? 'Use 3 focused check-ins per week and one Friday review.'
      : 'Start with 2 check-ins per week, then increase once habit is stable.';

  const frictionFix = hasDropoffRisk
    ? `Pre-plan a fallback when this appears: ${normalizeText(intake.likelyDropOffReason)}.`
    : 'Define one fallback step for low-energy days to protect consistency.';

  const planSummary = coachNote?.nextBestAction
    ? `Start each session with: ${coachNote.nextBestAction}`
    : 'Start each session with one small, clear action.';

  return {
    comebackScore,
    verdict,
    rhythmRecommendation,
    reviewPrompt: sanitizeSuggestion(planSummary, 'Start with one small, clear action.'),
    improvements: sanitizeList([
      frictionFix,
      hasEnjoymentAnchor
        ? `Anchor your routine to what you enjoy: ${normalizeText(intake.enjoymentAnchor)}.`
        : 'Pair your plan with an activity you enjoy to improve consistency.',
      hasSupport
        ? `Use accountability support: ${normalizeText(intake.supportPeople)}.`
        : 'Add one accountability partner or weekly check-in buddy.'
    ], [
      'Keep daily actions simple and measurable.',
      'Use one weekly review to adjust workload.',
      'Celebrate small wins to maintain motivation.'
    ]).slice(0, 3)
  };
}

function uniqueList(items) {
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const normalized = normalizeText(item);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

function toReadableDate(isoDate) {
  if (!isoDate) return '';
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildDailyActions(blueprint) {
  const goals = Array.isArray(blueprint?.goals) ? blueprint.goals : [];
  const byDay = goals.filter((g) => String(g.period || '').toLowerCase() === 'day').slice(0, 3);
  const fallback = (Array.isArray(blueprint?.actions) ? blueprint.actions : []).slice(0, 2).map((a) => a.title);
  return uniqueList([
    ...byDay.map((g) => `Hit ${g.target} ${g.unit} for ${g.name.toLowerCase()}`),
    ...fallback
  ]).slice(0, 4);
}

function buildWeeklyActions(blueprint) {
  const goals = Array.isArray(blueprint?.goals) ? blueprint.goals : [];
  const weeklyGoals = goals.filter((g) => String(g.period || '').toLowerCase() === 'week').slice(0, 4);
  const milestoneTitles = (Array.isArray(blueprint?.milestones) ? blueprint.milestones : []).slice(0, 2).map((m) => m.title);
  return uniqueList([
    ...weeklyGoals.map((g) => `Complete ${g.target} ${g.unit} for ${g.name.toLowerCase()}`),
    ...milestoneTitles.map((title) => `Advance milestone: ${title}`)
  ]).slice(0, 5);
}

function buildYearlyActions(intake, blueprint, finishDate) {
  const goalText = normalizeText(intake?.goalText, 'your goal');
  const milestones = Array.isArray(blueprint?.milestones) ? blueprint.milestones : [];
  const checkpointCount = Math.max(4, Math.min(12, milestones.length * 2));
  const targetDateText = finishDate ? ` by ${toReadableDate(finishDate)}` : '';
  return [
    `Stay consistent with the weekly system until ${goalText} is complete${targetDateText}`,
    `Run ${checkpointCount} formal progress checkpoints this year`,
    'Review and rebalance your plan every month based on actual outcomes'
  ];
}

function buildRiskFlags(intake, planFeedback) {
  const flags = [];
  if (Number(intake?.availableHoursPerWeek || 0) < 3) {
    flags.push('Low time budget: protect at least 3 focused hours per week.');
  }
  if (normalizeText(intake?.constraints)) {
    flags.push(`Constraint to plan around: ${normalizeText(intake.constraints)}`);
  }
  if (planFeedback?.isAggressive) {
    flags.push('Timeline risk: target pace is aggressive, use the suggested longer timeline.');
  }
  return flags;
}

export function buildGoalCoachNotes({ intake, blueprint, planFeedback }) {
  const goalText = normalizeText(intake?.goalText, 'Goal');
  const finishDate = normalizeText(intake?.targetDate || (blueprint?.milestones || [])[blueprint?.milestones?.length - 1]?.dueDate);
  const shortTermMilestones = (Array.isArray(blueprint?.milestones) ? blueprint.milestones : []).slice(0, 3).map((m) => m.title);
  const daily = buildDailyActions(blueprint);
  const weekly = buildWeeklyActions(blueprint);
  const yearly = buildYearlyActions(intake, blueprint, finishDate);
  const nextBestAction = (Array.isArray(blueprint?.actions) ? blueprint.actions : [])[0]?.title || daily[0] || 'Start with one focused session today.';

  const rawNote = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    categoryName: normalizeText(blueprint?.categoryName, 'General'),
    goalText,
    victoryDate: finishDate,
    strategy: {
      longTerm: `Achieve ${goalText}${finishDate ? ` by ${toReadableDate(finishDate)}` : ''} through consistent weekly execution and monthly adaptation.`,
      shortTerm: shortTermMilestones.length
        ? shortTermMilestones
        : ['Establish momentum with the first 2 weeks of consistent action.']
    },
    execution: {
      daily,
      weekly,
      yearly
    },
    nextBestAction,
    riskFlags: buildRiskFlags(intake, planFeedback),
    coachMessage: planFeedback?.message || 'Start simple, stay consistent, and adapt every week.'
  };

  return enforceCoachGuardrails(rawNote);
}
