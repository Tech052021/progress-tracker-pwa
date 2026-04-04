import { describe, expect, it } from 'vitest';
import {
  buildWeeklySchedule,
  updateTaskStatus,
  buildCarryoverTasks,
  calculateDeadlineShift,
  buildAccountabilityMessage,
  getWeekIdFromDate,
  getDayOfWeekIndex,
  DAYS_OF_WEEK
} from './weeklyScheduleService';

describe('weeklyScheduleService', () => {
  it('builds a weekly schedule with timed tasks', () => {
    const schedule = buildWeeklySchedule({
      weekId: '2026-w14',
      isoDateToday: '2026-04-06',
      goals: [],
      goalName: 'Build strength',
      goalId: 'goal-1',
      categoryId: 'cat-1',
      categoryName: 'Health',
      intake: { availableHoursPerWeek: 5 },
      weeklyGoals: [
        { name: 'Strength', target: 3, period: 'week', unit: 'sessions' },
        { name: 'Cardio', target: 2, period: 'week', unit: 'sessions' }
      ]
    });

    expect(schedule.weekId).toBe('2026-w14');
    expect(schedule.goalId).toBe('goal-1');
    expect(schedule.scheduledTasks.length).toBeGreaterThan(0);
    expect(schedule.completionStatus.planned).toBeGreaterThan(0);
    schedule.scheduledTasks.forEach((task) => {
      expect(task.id).toBeTruthy();
      expect(task.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(task.dayOfWeek).toBeLessThan(7);
      expect(task.time).toMatch(/^\d{2}:\d{2}$/);
      expect(task.status).toBe('planned');
      expect(task.alarmEnabled).toBe(true);
      expect(task.alarmMinutesBefore).toBeGreaterThan(0);
    });
  });

  it('tracks task status changes and updates completion stats', () => {
    const schedule = buildWeeklySchedule({
      weekId: '2026-w14',
      isoDateToday: '2026-04-06',
      goals: [],
      goalName: 'Build strength',
      goalId: 'goal-1',
      categoryId: 'cat-1',
      categoryName: 'Health',
      intake: { availableHoursPerWeek: 5 },
      weeklyGoals: [{ name: 'Strength', target: 1, period: 'week', unit: 'sessions' }]
    });

    const taskId = schedule.scheduledTasks[0].id;
    const result = updateTaskStatus({
      schedule,
      taskId,
      newStatus: 'completed',
      completedAt: new Date().toISOString()
    });

    expect(result.statusChanged).toBe(true);
    expect(result.missedCount).toBe(0);
    expect(result.deadlineImpact).toBe(0);
    expect(schedule.completionStatus.completed).toBe(1);
  });

  it('marks task as missed and calculates deadline impact', () => {
    const schedule = buildWeeklySchedule({
      weekId: '2026-w14',
      isoDateToday: '2026-04-06',
      goals: [],
      goalName: 'Build strength',
      goalId: 'goal-1',
      categoryId: 'cat-1',
      categoryName: 'Health',
      intake: { availableHoursPerWeek: 5 },
      weeklyGoals: [
        { name: 'Strength', target: 3, period: 'week', unit: 'sessions' }
      ]
    });

    const taskIds = schedule.scheduledTasks.slice(0, 2).map((t) => t.id);
    taskIds.forEach((taskId) => {
      updateTaskStatus({
        schedule,
        taskId,
        newStatus: 'missed'
      });
    });

    expect(schedule.completionStatus.missed).toBe(2);
  });

  it('builds carryover tasks from missed tasks', () => {
    const schedule = buildWeeklySchedule({
      weekId: '2026-w14',
      isoDateToday: '2026-04-06',
      goals: [],
      goalName: 'Build strength',
      goalId: 'goal-1',
      categoryId: 'cat-1',
      categoryName: 'Health',
      intake: { availableHoursPerWeek: 5 },
      weeklyGoals: [{ name: 'Strength', target: 2, period: 'week', unit: 'sessions' }]
    });

    // Mark one as missed
    updateTaskStatus({
      schedule,
      taskId: schedule.scheduledTasks[0].id,
      newStatus: 'missed'
    });

    const carryover = buildCarryoverTasks(schedule);

    expect(carryover.length).toBe(1);
    expect(carryover[0].status).toBe('carryover');
    expect(carryover[0].fromWeekId).toBe('2026-w14');
  });

  it('calculates deadline shift based on missed tasks', () => {
    const result = calculateDeadlineShift({
      originalDeadline: '2026-05-01',
      missedTasksThisWeek: 3,
      weekId: '2026-w14'
    });

    expect(result.shifted).toBe(true);
    expect(result.shift).toBe(3);
    expect(result.newDeadline).toBe('2026-05-04');
  });

  it('returns no shift when no tasks missed', () => {
    const result = calculateDeadlineShift({
      originalDeadline: '2026-05-01',
      missedTasksThisWeek: 0,
      weekId: '2026-w14'
    });

    expect(result.shifted).toBe(false);
    expect(result.newDeadline).toBe('2026-05-01');
    expect(result.shift).toBe(0);
  });

  it('generates accountability messages based on performance', () => {
    const firstWeekMsg = buildAccountabilityMessage({
      completionRate: 0,
      missedCount: 0,
      weeklyDeadlineShift: 0,
      goalName: 'Build strength',
      isFirstWeek: true
    });
    expect(firstWeekMsg).toContain('discipline');

    const excellentMsg = buildAccountabilityMessage({
      completionRate: 0.95,
      missedCount: 0,
      weeklyDeadlineShift: 0,
      goalName: 'Build strength',
      isFirstWeek: false
    });
    expect(excellentMsg).toContain('Excellent');

    const poorMsg = buildAccountabilityMessage({
      completionRate: 0.4,
      missedCount: 4,
      weeklyDeadlineShift: 4,
      goalName: 'Build strength',
      isFirstWeek: false
    });
    expect(poorMsg).toContain('challenges');
    expect(poorMsg).toContain('4');
  });

  it('derives week ID from ISO date', () => {
    const weekId = getWeekIdFromDate('2026-04-06'); // Monday
    expect(weekId).toMatch(/\d{4}-w\d{2}/);
  });

  it('derives day of week index from ISO date', () => {
    const monday = getDayOfWeekIndex('2026-04-06'); // Monday
    expect(monday).toBe(0);

    const friday = getDayOfWeekIndex('2026-04-10'); // Friday
    expect(friday).toBe(4);

    const sunday = getDayOfWeekIndex('2026-04-12'); // Sunday
    expect(sunday).toBe(6);
  });

  it('exports DAYS_OF_WEEK constant', () => {
    expect(DAYS_OF_WEEK).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});
