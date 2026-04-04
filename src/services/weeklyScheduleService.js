const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekIdFromDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const jan4 = new Date(date.getFullYear(), 0, 4);
  const daysDiff = date - jan4;
  const weekNum = Math.ceil((daysDiff / (24 * 60 * 60 * 1000) + jan4.getDay()) / 7);
  const year = date.getFullYear();
  return `${year}-w${String(Math.max(1, weekNum)).padStart(2, '0')}`;
}

function getDayOfWeekIndex(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // 0=Mon, 6=Sun
}

function getDateForDayInWeek(isoDate, dayIndex) {
  const date = new Date(`${isoDate}T00:00:00`);
  const monday = new Date(date);
  monday.setDate(monday.getDate() - monday.getDay() + 1);
  const target = new Date(monday);
  target.setDate(target.getDate() + dayIndex);
  return target.toISOString().slice(0, 10);
}

function uid() {
  try { return crypto.randomUUID(); } catch { return String(Math.random()).slice(2); }
}

/**
 * Distribute weekly work across Mon-Sun based on:
 * - Goals to achieve
 * - Available hours per week
 * - Time windows (best focus, fallback, recurring commitments)
 * - Schedule style (fixed, variable, shift-based)
 */
export function buildWeeklySchedule({
  weekId,
  isoDateToday,
  goals,
  goalName,
  goalId,
  categoryId,
  categoryName,
  coachNote,
  intake,
  weeklyGoals = [] // e.g. 3 sessions/week
}) {
  const bestFocusWindows = String(intake?.bestFocusWindows || '').trim();
  const fallbackWindows = String(intake?.fallbackWindows || '').trim();
  const weekdayAvailable = String(intake?.weekdayAvailable || '').trim();
  const weekendAvailable = String(intake?.weekendAvailable || '').trim();
  const scheduleStyle = String(intake?.scheduleStyle || 'fixed-week').toLowerCase();
  const sleepStartTime = String(intake?.sleepStartTime || '23:00').trim();
  const wakeTime = String(intake?.wakeTime || '07:00').trim();

  // Parse time windows into day-of-week suggestions
  const dayTimeMap = {};
  DAYS_OF_WEEK.forEach((day, idx) => {
    dayTimeMap[idx] = {
      day,
      focusTime: null,
      fallbackTime: null,
      reserved: []
    };
  });

  // Simple heuristic: distribute weekly goals across available windows
  // For fixed schedule, use weekdayAvailable/weekendAvailable patterns
  const scheduledTasks = [];
  const goalsToSchedule = Array.isArray(weeklyGoals) ? weeklyGoals : [];

  let dayIndex = 0;
  let currentTaskAssignments = 0;

  goalsToSchedule.forEach((goal, idx) => {
    const taskCount = Number(goal.target || 1);
    for (let i = 0; i < taskCount; i++) {
      // Simple round-robin across the week
      const assignedDayIndex = dayIndex % 7;
      const focusTimeChoice = (idx % 2 === 0) ? '06:00' : '18:00'; // Alternate morning/evening
      const taskId = uid();

      scheduledTasks.push({
        id: taskId,
        dayOfWeek: assignedDayIndex,
        time: focusTimeChoice,
        taskText: `${goal.name}${taskCount > 1 ? ` (${i + 1}/${taskCount})` : ''}`,
        duration: Math.max(30, Math.floor((Number(intake?.availableHoursPerWeek || 5) * 60) / (taskCount + 1))),
        alarmEnabled: true,
        alarmMinutesBefore: 15,
        status: 'planned',
        completedAt: null,
        rescheduledToDayOfWeek: null,
        rescheduledToTime: null,
        createdAt: new Date().toISOString()
      });

      dayIndex++;
    }
  });

  return {
    weekId,
    goalId,
    categoryId,
    categoryName,
    goalName,
    createdAt: new Date().toISOString(),
    scheduledTasks,
    carryoverTasks: [],
    completionStatus: {
      planned: scheduledTasks.length,
      completed: 0,
      missed: 0,
      rescheduled: 0
    }
  };
}

/**
 * Track task status change: planned → completed/missed/rescheduled
 * Returns {statusChanged, missedCount, deadlineImpact}
 */
export function updateTaskStatus({
  schedule,
  taskId,
  newStatus,
  completedAt = null,
  rescheduledToDayOfWeek = null,
  rescheduledToTime = null
}) {
  if (!schedule || !schedule.scheduledTasks) {
    return { statusChanged: false, missedCount: 0, deadlineImpact: 0 };
  }

  const task = schedule.scheduledTasks.find((t) => t.id === taskId);
  if (!task) return { statusChanged: false, missedCount: 0, deadlineImpact: 0 };

  const oldStatus = task.status;
  task.status = newStatus;
  task.completedAt = completedAt || null;
  task.rescheduledToDayOfWeek = rescheduledToDayOfWeek || null;
  task.rescheduledToTime = rescheduledToTime || null;
  task.updatedAt = new Date().toISOString();

  // Recalculate completion status
  const counts = schedule.scheduledTasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    },
    { planned: 0, completed: 0, missed: 0, rescheduled: 0 }
  );
  schedule.completionStatus = counts;

  // Calculate deadline impact: each missed task = +1 day
  const missedCount = counts.missed || 0;
  const deadlineImpact = missedCount;

  return {
    statusChanged: oldStatus !== newStatus,
    missedCount,
    deadlineImpact,
    task
  };
}

/**
 * Detect tasks from this week that should carry over to next week
 */
export function buildCarryoverTasks(schedule) {
  if (!schedule || !schedule.scheduledTasks) return [];

  return schedule.scheduledTasks
    .filter((task) => task.status === 'missed' || task.status === 'rescheduled')
    .map((task) => ({
      ...task,
      id: uid(), // new ID for carryover
      fromScheduleId: schedule.scheduleId,
      fromWeekId: schedule.weekId,
      fromDayOfWeek: task.dayOfWeek,
      fromTime: task.time,
      status: 'carryover',
      createdAt: new Date().toISOString()
    }));
}

/**
 * Replan next week's schedule by:
 * 1. Carrying over missed/rescheduled tasks from this week
 * 2. Adjusting based on completion rate
 * 3. Recommending reduced load if velocity is low
 */
export function replaceWeeklySchedule({
  currentWeekSchedule,
  nextWeekId,
  intake,
  coachNote,
  goals,
  goalId,
  categoryId,
  categoryName,
  goalName
}) {
  const carryover = buildCarryoverTasks(currentWeekSchedule);
  const completionRate = currentWeekSchedule.completionStatus.completed /
    (currentWeekSchedule.scheduledTasks.length || 1);

  // If completion rate < 50%, reduce next week's load
  const shouldReduceLoad = completionRate < 0.5;
  const adjustedWeeklyGoals = goals.map((g) => ({
    ...g,
    target: shouldReduceLoad ? Math.max(1, Math.floor(g.target * 0.75)) : g.target
  }));

  const nextSchedule = buildWeeklySchedule({
    weekId: nextWeekId,
    isoDateToday: new Date().toISOString().slice(0, 10),
    goals: adjustedWeeklyGoals,
    goalName,
    goalId,
    categoryId,
    categoryName,
    coachNote,
    intake
  });

  nextSchedule.carryoverTasks = carryover;
  nextSchedule.replannedReason = shouldReduceLoad
    ? `Completion rate was ${Math.round(completionRate * 100)}%. Reducing load this week to build momentum.`
    : `Carrying over ${carryover.length} incomplete task(s) from last week.`;

  return nextSchedule;
}

/**
 * Calculate deadline shift from accumulated misses
 */
export function calculateDeadlineShift({
  originalDeadline,
  missedTasksThisWeek,
  weekId,
  priorShifts = []
}) {
  const missedDays = missedTasksThisWeek * 1; // 1 day per missed task
  if (missedDays === 0) return { shifted: false, newDeadline: originalDeadline, shift: 0 };

  const deadline = new Date(`${originalDeadline}T00:00:00`);
  deadline.setDate(deadline.getDate() + missedDays);
  const newDeadlineIso = deadline.toISOString().slice(0, 10);

  return {
    shifted: true,
    newDeadline: newDeadlineIso,
    shift: missedDays,
    weekId,
    reason: `Missed ${missedTasksThisWeek} task${missedTasksThisWeek > 1 ? 's' : ''} this week`,
    timestamp: new Date().toISOString(),
    priorShifts: [...priorShifts, { weekId, shift: missedDays, from: originalDeadline, to: newDeadlineIso }]
  };
}

/**
 * Generate accountability message based on performance
 */
export function buildAccountabilityMessage({
  completionRate,
  missedCount,
  weeklyDeadlineShift,
  goalName,
  isFirstWeek = false
}) {
  if (isFirstWeek) {
    return `Let's establish discipline this week. Follow the plan as designed, and we'll build unstoppable momentum.`;
  }

  if (completionRate >= 0.9) {
    return `Excellent adherence last week. You completed ${Math.round(completionRate * 100)}% of planned tasks. Keep this discipline flowing.`;
  }

  if (completionRate >= 0.7) {
    return `Good progress, but ${missedCount} task${missedCount > 1 ? 's' : ''} slipped. This pushed your deadline ${weeklyDeadlineShift} day${weeklyDeadlineShift > 1 ? 's' : ''}. Let's execute tighter this week.`;
  }

  if (completionRate >= 0.5) {
    return `You completed ${Math.round(completionRate * 100)}% of tasks. ${missedCount} missed shifted your deadline by ${weeklyDeadlineShift} days. This week, let's aim for at least 70% execution.`;
  }

  return `Last week saw challenges: ${missedCount} missed tasks pushed "${goalName}" from its original date. Let's reset with a smaller, more achievable plan this week and build the discipline back.`;
}

export { DAYS_OF_WEEK, getWeekIdFromDate, getDayOfWeekIndex, getDateForDayInWeek };
