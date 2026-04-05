import React, { useMemo, useEffect } from 'react';
import { DAYS_OF_WEEK, getDateForDayInWeek } from '../services/weeklyScheduleService';
import { requestNotificationPermission, scheduleAlarmsForDay, clearAllAlarms } from '../services/alarmService';

export default function WeeklyPlanView({
  weeklySchedules = {},
  goalDeadlineLog = [],
  todayIso = new Date().toISOString().slice(0, 10),
  onTaskStatusChange = () => {},
  onAlarmToggle = () => {}
}) {
  // Request notification permission and schedule alarms on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Schedule alarms for today's tasks whenever schedules change
  useEffect(() => {
    if (!weeklySchedules || Object.keys(weeklySchedules).length === 0) {
      clearAllAlarms();
      return;
    }

    const todayDay = new Date(`${todayIso}T00:00:00`).getDay();
    const todayDayIndex = todayDay === 0 ? 6 : todayDay - 1;

    // Collect all tasks for today
    const todaysTasks = [];
    Object.values(weeklySchedules).forEach((schedule) => {
      if (schedule?.scheduledTasks) {
        schedule.scheduledTasks.forEach((task) => {
          if (task.dayOfWeek === todayDayIndex) {
            todaysTasks.push(task);
          }
        });
      }
      if (schedule?.carryoverTasks) {
        schedule.carryoverTasks.forEach((task) => {
          if (task.dayOfWeek === todayDayIndex) {
            todaysTasks.push(task);
          }
        });
      }
    });

    // Schedule alarms for today's tasks
    scheduleAlarmsForDay(todayIso, todaysTasks);

    return () => {
      clearAllAlarms();
    };
  }, [weeklySchedules, todayIso]);

  if (!weeklySchedules || Object.keys(weeklySchedules).length === 0) {
    return (
      <div className="empty-state">
        <p>No weekly plan created yet. Create a goal and we'll generate a schedule for you.</p>
      </div>
    );
  }

  const todayDay = new Date(`${todayIso}T00:00:00`).getDay();
  const todayDayIndex = todayDay === 0 ? 6 : todayDay - 1;

  // Build a view combining all schedules for this week
  const schedulesByDay = useMemo(() => {
    const map = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };

    Object.values(weeklySchedules).forEach((scheduleForGoal) => {
      if (scheduleForGoal?.scheduledTasks) {
        scheduleForGoal.scheduledTasks.forEach((task) => {
          map[task.dayOfWeek] = map[task.dayOfWeek] || [];
          map[task.dayOfWeek].push({
            ...task,
            goalName: scheduleForGoal.goalName,
            goalId: scheduleForGoal.goalId,
            categoryName: scheduleForGoal.categoryName,
            scheduleKey: Object.keys(weeklySchedules).find((k) =>
              weeklySchedules[k].scheduledTasks.some((t) => t.id === task.id)
            )
          });
        });
      }

      // Add carryover tasks
      if (scheduleForGoal?.carryoverTasks) {
        scheduleForGoal.carryoverTasks.forEach((task) => {
          map[task.dayOfWeek] = map[task.dayOfWeek] || [];
          map[task.dayOfWeek].push({
            ...task,
            goalName: scheduleForGoal.goalName,
            goalId: scheduleForGoal.goalId,
            categoryName: scheduleForGoal.categoryName,
            scheduleKey: Object.keys(weeklySchedules).find((k) =>
              weeklySchedules[k].carryoverTasks?.some((t) => t.id === task.id)
            ),
            isCarryover: true
          });
        });
      }
    });

    // Sort tasks by time each day
    Object.keys(map).forEach((day) => {
      map[day].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    });

    return map;
  }, [weeklySchedules]);

  // Calculate accountability stats
  const deadlineStats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let missedTasks = 0;
    let maxDeadlineShift = 0;

    Object.values(weeklySchedules).forEach((schedule) => {
      if (schedule?.completionStatus) {
        totalTasks += schedule.completionStatus.planned || 0;
        completedTasks += schedule.completionStatus.completed || 0;
        missedTasks += schedule.completionStatus.missed || 0;
      }
    });

    (goalDeadlineLog || []).forEach((log) => {
      const shift = log.daysShifted || 0;
      maxDeadlineShift = Math.max(maxDeadlineShift, shift);
    });

    return {
      total: totalTasks,
      completed: completedTasks,
      missed: missedTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      maxDeadlineShift
    };
  }, [weeklySchedules, goalDeadlineLog]);

  return (
    <div className="weekly-plan-view">
      <div className="card">
        <div className="card-head">
          <h2>Weekly Plan</h2>
          <p>View your scheduled tasks for the week. Mark them complete or reschedule as needed.</p>
        </div>
      </div>

      {deadlineStats.missed > 0 && (
        <div className="weekly-plan-accountability">
          <p>
            <span className="weekly-plan-accountability-stat">{deadlineStats.missed} task{deadlineStats.missed !== 1 ? 's' : ''} missed</span> pushed your deadlines.
            {deadlineStats.maxDeadlineShift > 0 && (
              <> Your goal is now <span className="weekly-plan-accountability-stat">{deadlineStats.maxDeadlineShift} day{deadlineStats.maxDeadlineShift !== 1 ? 's' : ''} later</span>.</>
            )}
            {' '}Let's execute this week's plan as designed to stay on track.
          </p>
          <p style={{ marginTop: 6, fontSize: '12px', color: '#64748b' }}>
            Completion rate this week: <strong>{deadlineStats.completionRate}%</strong> ({deadlineStats.completed}/{deadlineStats.total})
          </p>
        </div>
      )}

      <div className="weekly-plan-grid">
        {DAYS_OF_WEEK.map((dayLabel, dayIndex) => {
          const tasks = schedulesByDay[dayIndex] || [];
          const isToday = dayIndex === todayDayIndex;
          const dateIso = getDateForDayInWeek(todayIso, dayIndex);

          return (
            <div key={`day-${dayIndex}`} className={`weekly-plan-day-card${isToday ? ' today' : ''}`}>
              <div className="weekly-plan-day-header">
                <div>
                  <div className="weekly-plan-day-label">{dayLabel}</div>
                  <div className="weekly-plan-day-date">{dateIso.slice(5)}</div>
                </div>
                {isToday && <div className="weekly-plan-day-mark-today">Today</div>}
              </div>

              <div className="weekly-plan-tasks">
                {tasks.length === 0 ? (
                  <div style={{ color: '#cbd5e1', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
                    No tasks
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={`${task.scheduleKey}-${task.id}`}
                      className={`weekly-plan-task${task.status === 'completed' ? ' completed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={task.status === 'completed'}
                        onChange={() =>
                          onTaskStatusChange(
                            task.scheduleKey,
                            task.id,
                            task.status === 'completed' ? 'planned' : 'completed'
                          )
                        }
                        aria-label={`Mark "${task.taskText}" as done`}
                      />
                      <div className="weekly-plan-task-text">
                        <div className="weekly-plan-task-name">{task.taskText}</div>
                        <div className="weekly-plan-task-time">
                          {task.time} • {task.duration || 30} min • {task.categoryName}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`weekly-plan-task-alarm${task.alarmEnabled ? ' active' : ''}`}
                        title={task.alarmEnabled ? 'Alarm enabled' : 'Enable alarm'}
                        onClick={() =>
                          onAlarmToggle(task.scheduleKey, task.id, !task.alarmEnabled)
                        }
                      >
                        🔔
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
