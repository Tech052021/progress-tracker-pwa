/**
 * Alarm Service — Browser notifications for scheduled tasks
 * 
 * Responsibilities:
 * - Request notification permissions
 * - Schedule notifications for alarms
 * - Calculate when to show notification (now - alarmMinutesBefore)
 * - Fallback to console warnings if Notification API unavailable
 */

export const AlarmServiceState = {
  permissionRequested: false,
  scheduledAlarms: new Map(), // taskId → timeoutId
};

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Notification API not available');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.log('Notification permission denied');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Schedule an alarm notification for a task
 * 
 * @param {Object} task - Task object with {id, taskText, time, alarmEnabled, alarmMinutesBefore, categoryName, duration}
 * @param {string} dateIso - Task date in YYYY-MM-DD format
 * @param {function} onAlarmFired - Callback when alarm triggers (optional)
 */
export function scheduleAlarm(task, dateIso, onAlarmFired = null) {
  if (!task.alarmEnabled) return;

  // Clear existing alarm if any
  clearAlarm(task.id);

  // Parse task time (format: "HH:MM")
  const [hours, minutes] = (task.time || '00:00').split(':').map(Number);
  const taskDateTime = new Date(`${dateIso}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  
  // Calculate when alarm should fire (taskTime - alarmMinutesBefore)
  const alarmMinutesBefore = task.alarmMinutesBefore || 15;
  const alarmFireTime = new Date(taskDateTime.getTime() - alarmMinutesBefore * 60000);

  const now = new Date();

  // Only schedule if alarm time is in the future
  if (alarmFireTime <= now) {
    return;
  }

  const delayMs = alarmFireTime.getTime() - now.getTime();

  // Schedule the alarm
  const timeoutId = setTimeout(() => {
    showNotification(task, dateIso);
    if (onAlarmFired) {
      onAlarmFired(task.id);
    }
    AlarmServiceState.scheduledAlarms.delete(task.id);
  }, delayMs);

  AlarmServiceState.scheduledAlarms.set(task.id, timeoutId);
}

/**
 * Clear a scheduled alarm
 */
export function clearAlarm(taskId) {
  const timeoutId = AlarmServiceState.scheduledAlarms.get(taskId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    AlarmServiceState.scheduledAlarms.delete(taskId);
  }
}

/**
 * Show notification for task
 */
function showNotification(task, dateIso) {
  const title = `Task: ${task.taskText}`;
  const options = {
    body: `At ${task.time} (${task.categoryName}) • ${task.duration || 30}min`,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `alarm-${task.id}`,
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'snooze', title: 'Snooze 5min' },
    ],
  };

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
      fallbackAlarm(title, options.body);
    }
  } else {
    fallbackAlarm(title, options.body);
  }
}

/**
 * Fallback alarm if Notification API unavailable
 */
function fallbackAlarm(title, body) {
  console.warn(`🔔 ALARM: ${title}\n${body}`);
  // Could play a sound or log more visibly
}

/**
 * Reschedule all alarms for a day's tasks
 * Call this when WeeklyPlanView mounts or when day changes
 */
export function scheduleAlarmsForDay(todayIso, tasksForDay) {
  // Clear all existing alarms
  AlarmServiceState.scheduledAlarms.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  AlarmServiceState.scheduledAlarms.clear();

  // Schedule alarms for enabled tasks
  (tasksForDay || []).forEach((task) => {
    if (task.alarmEnabled) {
      scheduleAlarm(task, todayIso);
    }
  });
}

/**
 * Clear all alarms
 */
export function clearAllAlarms() {
  AlarmServiceState.scheduledAlarms.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  AlarmServiceState.scheduledAlarms.clear();
}
