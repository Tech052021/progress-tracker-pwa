const SYNC_QUEUE_KEY = 'progress_tracker_sync_queue_v1';

function safeParseJSON(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return safeParseJSON(raw, fallback);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function createBackupAndPrune({ keyPrefix, rawJson, maxBackups = 5 }) {
  const backupKey = `${keyPrefix}${Date.now()}`;
  localStorage.setItem(backupKey, rawJson);

  const backupKeys = Object.keys(localStorage)
    .filter((key) => key.startsWith(keyPrefix))
    .sort();

  while (backupKeys.length > maxBackups) {
    const keyToDelete = backupKeys.shift();
    if (keyToDelete) localStorage.removeItem(keyToDelete);
  }
}

export function enqueueMutation(type, payload) {
  const existing = loadJSON(SYNC_QUEUE_KEY, []);
  const event = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ts: new Date().toISOString(),
    type,
    payload
  };
  existing.push(event);
  saveJSON(SYNC_QUEUE_KEY, existing);
}

export function readSyncQueue() {
  return loadJSON(SYNC_QUEUE_KEY, []);
}

export function clearSyncQueue() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}
