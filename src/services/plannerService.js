const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeftInMonth(isoDate) {
  const start = new Date(`${isoDate}T00:00:00`);
  const monthEnd = new Date(start);
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
  return Math.max(1, Math.ceil((monthEnd.getTime() - start.getTime()) / DAY_MS) + 1);
}

function daysLeftInYear(isoDate, year) {
  const start = new Date(`${isoDate}T00:00:00`);
  const yearEnd = new Date(`${year}-12-31T00:00:00`);
  return Math.max(1, Math.ceil((yearEnd.getTime() - start.getTime()) / DAY_MS) + 1);
}

function computeCadence(period, remaining, daysLeftWeek, daysLeftMonth, daysLeftYear) {
  if (period === 'day') return 1;
  if (period === 'week') return Math.max(1, Math.ceil(remaining / daysLeftWeek));
  if (period === 'month') return Math.max(1, Math.ceil(remaining / daysLeftMonth));
  if (period === 'year') return Math.max(1, Math.ceil(remaining / daysLeftYear));
  return Math.max(1, Math.ceil(remaining / 7));
}

export function buildSuggestedPlannerTasks({
  normalizedCategories,
  goalCount,
  isTargetGoalPeriod,
  normalizeGoalPeriod,
  actionItems,
  plannerDate,
  weekDateOptions,
  currentYear,
  uid
}) {
  const daysLeftWeek = Math.max(1, weekDateOptions.filter((opt) => opt.iso >= plannerDate).length);
  const daysLeftMonth = daysLeftInMonth(plannerDate);
  const daysLeftYear = daysLeftInYear(plannerDate, currentYear);

  const goalTasks = normalizedCategories
    .flatMap((category) =>
      (category.goals || []).map((goal) => {
        if (isTargetGoalPeriod(goal.period)) return null;
        const target = Number(goal.target || 0);
        if (target <= 0) return null;

        const current = goalCount(goal);
        const remaining = Math.max(0, target - current);
        if (remaining <= 0) return null;

        const period = normalizeGoalPeriod(goal.period);
        const cadence = computeCadence(period, remaining, daysLeftWeek, daysLeftMonth, daysLeftYear);
        const unit = goal.unit && goal.unit !== 'count' ? goal.unit : 'step';

        return {
          id: uid(),
          goalId: goal.id,
          text: goal.name,
          done: false,
          suggested: true,
          hint: `${cadence} ${unit}${cadence > 1 ? 's' : ''} today`,
          category: category.name,
          score: remaining
        };
      })
    )
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score, ...task }) => task);

  const openActionItems = (actionItems || [])
    .filter((item) => item.status !== 'done')
    .slice(0, 1)
    .map((item) => ({
      id: uid(),
      actionId: item.id,
      text: item.title,
      done: false,
      suggested: true,
      hint: 'Action item',
      category: ''
    }));

  return [...goalTasks, ...openActionItems].slice(0, 5);
}

export function createSeedPlannerEntry(suggestedTasks, todayMustWin) {
  const priorities = suggestedTasks.slice(0, 3).map((task) => task.text);
  while (priorities.length < 3) priorities.push('');

  return {
    mood: 3,
    weather: 'partly',
    tasks: suggestedTasks,
    priorities,
    reminder: todayMustWin || '',
    meals: { breakfast: false, lunch: false, dinner: false, snacks: false },
    waterCups: 0,
    exerciseMinutes: 0,
    strengthMinutes: 0,
    exerciseSteps: 0,
    proteinGrams: 0,
    sleepHours: 0,
    gratitude: '',
    notes: '',
    tomorrow: ''
  };
}
