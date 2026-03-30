const LB_PER_KG = 2.20462;

export function toISODateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function normalizeCategoryName(name) {
  const cleaned = String(name || '').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function parseNumericInput(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function stripDraftFields(value) {
  if (Array.isArray(value)) return value.map(stripDraftFields);
  if (!value || typeof value !== 'object') return value;
  const next = {};
  Object.entries(value).forEach(([key, entryValue]) => {
    if (!key.startsWith('_')) {
      next[key] = stripDraftFields(entryValue);
    }
  });
  return next;
}

export function buildPlanBlueprint(intake, weightUnit) {
  const goalText = String(intake.goalText || '').trim();
  const lower = goalText.toLowerCase();
  const targetDate = String(intake.targetDate || '').trim();
  let weeksFromTarget = null;
  if (targetDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${targetDate}T00:00:00`);
    if (!Number.isNaN(target.getTime())) {
      const diffMs = target - today;
      const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      weeksFromTarget = Math.max(2, Math.ceil(diffDays / 7));
    }
  }

  const weeks = Math.max(2, Number(intake.effectiveTimeframeWeeks || weeksFromTarget || intake.timeframeWeeks) || 12);
  const hoursPerWeek = Math.max(1, Number(intake.availableHoursPerWeek) || 5);
  const finishDate = targetDate || toISODateAfter(weeks * 7);
  const targetValue = parseNumericInput(intake.targetValue);
  const chosenUnit = intake.targetUnit || weightUnit;

  const courseMatch = goalText.match(/\b([A-Za-z]{2,}\s?\d{2,3})\b/);

  if (/(weight|lose|fat|fit|fitness|health)/.test(lower) || intake.planType === 'weight') {
    const currentWeight = parseNumericInput(intake.currentValue);
    const weightInLb = currentWeight === null
      ? null
      : (String(chosenUnit || '').toLowerCase() === 'kg' ? currentWeight * LB_PER_KG : currentWeight);
    const suggestedProteinGrams = weightInLb === null
      ? 120
      : Math.min(220, Math.max(90, Math.round(weightInLb * 0.7)));

    return {
      categoryName: normalizeCategoryName(intake.categoryName) || 'Health',
      goals: [
        { name: 'Cardio sessions', target: Math.max(2, Math.round(hoursPerWeek / 3)), period: 'week', unit: 'sessions', victoryDate: finishDate },
        { name: 'Strength workouts', target: Math.max(2, Math.round(hoursPerWeek / 3)), period: 'week', unit: 'sessions', victoryDate: finishDate },
        { name: 'Protein intake', target: suggestedProteinGrams, period: 'day', unit: 'g', victoryDate: finishDate },
        { name: 'Water intake', target: 3, period: 'day', unit: 'liters', victoryDate: finishDate },
        { name: 'Sleep duration', target: 8, period: 'day', unit: 'hours', victoryDate: finishDate },
        { name: 'Weight', target: targetValue ?? 0, period: 'target', unit: chosenUnit || weightUnit, victoryDate: finishDate }
      ],
      milestones: [
        { title: 'Set baseline, meals, and workout rhythm', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(7) },
        { title: 'Complete first 2 consistent weeks', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(14) },
        { title: 'Reach next healthy weight checkpoint', targetValue: 1, currentValue: 0, dueDate: finishDate }
      ],
      actions: [
        { title: 'Plan protein-first meals for the next 3 days', dueDate: toISODateAfter(1), status: 'todo' },
        { title: 'Complete one cardio session and one strength session this week', dueDate: toISODateAfter(3), status: 'todo' },
        { title: 'Log a weight check-in and note how you feel', dueDate: toISODateAfter(5), status: 'todo' }
      ]
    };
  }

  if (/(class|course|grade|exam|assignment|study|cs\d+)/.test(lower) || intake.planType === 'study') {
    const categoryName = normalizeCategoryName(intake.categoryName) || (courseMatch ? courseMatch[1].toUpperCase().replace(/\s+/, '') : 'Learning');
    return {
      categoryName,
      goals: [
        { name: 'Study sessions', target: Math.max(3, Math.round(hoursPerWeek)), period: 'week', unit: 'sessions', victoryDate: finishDate },
        { name: 'Practice problems', target: Math.max(8, Math.round(hoursPerWeek * 2)), period: 'week', unit: 'problems', victoryDate: finishDate },
        { name: 'Mock test score', target: 95, period: 'target', unit: 'score', victoryDate: finishDate }
      ],
      milestones: [
        { title: 'Finish first revision pass', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(Math.max(7, Math.round((weeks * 7) * 0.3))) },
        { title: 'Complete practice set checkpoint', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(Math.max(14, Math.round((weeks * 7) * 0.65))) },
        { title: 'Final exam readiness checkpoint', targetValue: 1, currentValue: 0, dueDate: finishDate }
      ],
      actions: [
        { title: 'Book 3 focused study blocks this week', dueDate: toISODateAfter(2), status: 'todo' },
        { title: 'Solve a timed problem set', dueDate: toISODateAfter(4), status: 'todo' },
        { title: 'Review mistakes and weak topics', dueDate: toISODateAfter(6), status: 'todo' }
      ]
    };
  }

  if (/(language|speak|speaking|vocabulary|english|spanish|french|german|japanese|hindi)/.test(lower)) {
    return {
      categoryName: normalizeCategoryName(intake.categoryName) || 'Learning',
      goals: [
        { name: 'Language practice sessions', target: Math.max(4, Math.round(hoursPerWeek)), period: 'week', unit: 'sessions', victoryDate: finishDate },
        { name: 'Vocabulary review', target: Math.max(20, Math.round(hoursPerWeek * 10)), period: 'week', unit: 'words', victoryDate: finishDate },
        { name: 'Speaking practice', target: Math.max(2, Math.round(hoursPerWeek / 2)), period: 'week', unit: 'sessions', victoryDate: finishDate }
      ],
      milestones: [
        { title: 'Build first learning routine', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(7) },
        { title: 'Hold a short conversation confidently', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(Math.max(14, Math.round((weeks * 7) * 0.5))) },
        { title: 'Reach your language checkpoint', targetValue: 1, currentValue: 0, dueDate: finishDate }
      ],
      actions: [
        { title: 'Schedule 3 short language sessions', dueDate: toISODateAfter(2), status: 'todo' },
        { title: 'Review today\'s vocabulary set', dueDate: toISODateAfter(1), status: 'todo' },
        { title: 'Do one speaking practice session', dueDate: toISODateAfter(4), status: 'todo' }
      ]
    };
  }

  if (/(job|career|promotion|business|economics|interview|company|role|sales|manager|leadership)/.test(lower)) {
    return {
      categoryName: normalizeCategoryName(intake.categoryName) || 'Career',
      goals: [
        { name: 'Deep work sessions', target: Math.max(3, Math.round(hoursPerWeek)), period: 'week', unit: 'sessions', victoryDate: finishDate },
        { name: 'Skill-building blocks', target: Math.max(2, Math.round(hoursPerWeek / 2)), period: 'week', unit: 'sessions', victoryDate: finishDate },
        { name: 'Career checkpoint', target: 1, period: 'target', unit: 'outcome', victoryDate: finishDate }
      ],
      milestones: [
        { title: 'Define success criteria and materials', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(7) },
        { title: 'Complete first strong work sample', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(Math.max(14, Math.round((weeks * 7) * 0.45))) },
        { title: 'Reach target career checkpoint', targetValue: 1, currentValue: 0, dueDate: finishDate }
      ],
      actions: [
        { title: 'Block focused work time on calendar', dueDate: toISODateAfter(1), status: 'todo' },
        { title: 'Complete one career improvement task', dueDate: toISODateAfter(3), status: 'todo' },
        { title: 'Review progress and adjust next steps', dueDate: toISODateAfter(7), status: 'todo' }
      ]
    };
  }

  const categoryName = normalizeCategoryName(intake.categoryName) || (goalText.split(' ').slice(0, 2).join(' ') || 'Personal Growth').replace(/^./, (c) => c.toUpperCase());
  return {
    categoryName,
    goals: [
      { name: goalText || 'Outcome goal', target: 1, period: 'target', unit: 'milestone', victoryDate: finishDate },
      { name: 'Focused sessions', target: Math.max(3, Math.round(hoursPerWeek)), period: 'week', unit: 'sessions', victoryDate: finishDate },
      { name: 'Weekly review', target: 1, period: 'week', unit: 'review', victoryDate: finishDate }
    ],
    milestones: [
      { title: 'Kickoff and setup complete', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(7) },
      { title: 'Midpoint consistency checkpoint', targetValue: 1, currentValue: 0, dueDate: toISODateAfter(Math.max(14, Math.round((weeks * 7) * 0.5))) },
      { title: 'Final outcome checkpoint', targetValue: 1, currentValue: 0, dueDate: finishDate }
    ],
    actions: [
      { title: 'Do one focused session today', dueDate: toISODateAfter(1), status: 'todo' },
      { title: 'Schedule next 3 sessions', dueDate: toISODateAfter(2), status: 'todo' },
      { title: 'Review progress and adjust plan', dueDate: toISODateAfter(7), status: 'todo' }
    ]
  };
}

export function applyGeneratedDraft({ draft, blueprint, draftId, mode, makeId }) {
  let nextActiveId = null;
  const categories = draft.categories
    .map((category) => ({ ...category, goals: [...(category.goals || [])] }))
    .filter((category) => {
      const remainingGoals = category.goals.filter((goal) => !(mode === 'replace' && goal._draftId === draftId));
      category.goals = remainingGoals;
      if (mode === 'replace' && category._draftId === draftId && remainingGoals.length === 0) {
        return false;
      }
      return true;
    });

  const categoryIndex = categories.findIndex((c) => c.name.trim().toLowerCase() === blueprint.categoryName.trim().toLowerCase());
  const targetCategory = categoryIndex >= 0
    ? { ...categories[categoryIndex], goals: [...(categories[categoryIndex].goals || [])] }
    : { id: makeId(), name: blueprint.categoryName, goals: [], _draftId: draftId, _draftSource: 'plan-intake' };

  const existingGoalNames = new Set(targetCategory.goals.map((g) => String(g.name || '').trim().toLowerCase()));
  const generatedGoals = blueprint.goals.map((goal) => {
    let nextName = goal.name;
    let suffix = 2;
    while (existingGoalNames.has(nextName.trim().toLowerCase())) {
      nextName = `${goal.name} (${suffix})`;
      suffix += 1;
    }
    existingGoalNames.add(nextName.trim().toLowerCase());
    return { ...goal, id: makeId(), name: nextName, _draftId: draftId, _draftSource: 'plan-intake' };
  });

  targetCategory.goals = [...targetCategory.goals, ...generatedGoals];
  nextActiveId = targetCategory.id;

  if (categoryIndex >= 0) {
    categories[categoryIndex] = targetCategory;
  } else {
    categories.push(targetCategory);
  }

  const createdMilestones = blueprint.milestones.map((milestone) => ({
    id: makeId(),
    categoryId: targetCategory.id,
    categoryName: targetCategory.name,
    ...milestone,
    _draftId: draftId,
    _draftSource: 'plan-intake'
  }));
  const createdActions = blueprint.actions.map((action, idx) => ({
    id: makeId(),
    categoryId: targetCategory.id,
    categoryName: targetCategory.name,
    goalId: createdMilestones[Math.min(idx, createdMilestones.length - 1)]?.id || '',
    ...action,
    _draftId: draftId,
    _draftSource: 'plan-intake'
  }));

  return {
    nextActiveId,
    nextDraft: {
      ...draft,
      categories,
      goalPlan: {
        ...draft.goalPlan,
        shortTermGoals: [
          ...draft.goalPlan.shortTermGoals.filter((goal) => !(mode === 'replace' && goal._draftId === draftId)),
          ...createdMilestones
        ],
        actionItems: [
          ...draft.goalPlan.actionItems.filter((item) => !(mode === 'replace' && item._draftId === draftId)),
          ...createdActions
        ]
      }
    }
  };
}