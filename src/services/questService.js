/**
 * Quest Service
 * Manages the user's personal quest narrative:
 * - Story chapters (one per logged activity)
 * - Keepsakes (earned badges/tokens)
 * - Unlocked environments (visual scenes)
 * - Coin accumulation
 * - Milestone progression
 */

import { MILESTONES, ENVIRONMENTS, KEEPSAKE_TYPES } from '../data/questMilestones';

/**
 * Create a new quest chapter from a logged activity
 * @param {Object} params - { goalName, categoryName, activity, value, unit }
 * @returns {Object} chapter object { id, timestamp, title, story, goalName, categoryName, coins }
 */
export function createChapter(params) {
  const { goalName = '', categoryName = '', activity = '', value = 0, unit = '' } = params;
  
  const id = `ch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  
  // Generate story fragment
  const story = generateStoryFragment({ goalName, activity, value, unit });
  
  return {
    id,
    timestamp,
    title: `${activity} — ${goalName || categoryName}`,
    story,
    goalName,
    categoryName,
    value,
    unit,
    coins: 10 // Base coin reward per log
  };
}

/**
 * Generate a personalized story fragment for an activity log
 * Pulled from templates based on goal type and activity
 * @param {Object} params
 * @returns {string} story fragment
 */
export function generateStoryFragment(params) {
  const { goalName = '', activity = '', value = 0, unit = '' } = params;
  
  const templates = {
    strength: [
      `You pushed through {{value}} {{unit}} of strength training today. Your dedication strengthens with every session.`,
      `{{value}} {{unit}} of {{goal}} completed. The tower grows taller.`,
      `Another {{value}} {{unit}} of {{goal}}. You're building momentum.`
    ],
    cardio: [
      `You conquered {{value}} {{unit}} of cardio today. Your heart grows stronger.`,
      `{{value}} {{unit}} of {{goal}} completed. One step closer to endurance.`,
      `You've logged {{value}} {{unit}} of movement. Your journey continues.`
    ],
    coding: [
      `You solved {{value}} {{unit}} of coding challenges today. Your mind sharpens with every problem.`,
      `{{value}} {{unit}} of {{goal}} unlocked. The path forward becomes clearer.`,
      `Another {{value}} {{unit}} conquered. You're becoming unstoppable.`
    ],
    learning: [
      `You learned {{value}} {{unit}} of {{goal}} today. Knowledge compounds quietly.`,
      `{{value}} {{unit}} of new territory explored. Your horizon expands.`,
      `Another step through {{goal}}. Consistency is your greatest teacher.`
    ],
    work: [
      `You dedicated {{value}} {{unit}} to {{goal}}. Your effort ripples forward.`,
      `{{value}} {{unit}} of focused work done. The world takes notice.`,
      `Another block of time invested in what matters. You're building a legacy.`
    ],
    default: [
      `You logged {{value}} {{unit}} of {{goal}} today. Your consistency is your compass.`,
      `{{value}} {{unit}} of {{goal}} complete. One chapter closer to mastery.`,
      `Another day of progress. Your story unfolds with every entry.`,
      `{{value}} {{unit}} of dedication. Small acts compound into greatness.`,
      `You showed up for {{goal}} today. That's what winners do.`
    ]
  };

  // Infer category from goal name
  let category = 'default';
  const goalLower = String(goalName).toLowerCase();
  if (goalLower.includes('strength') || goalLower.includes('lift')) category = 'strength';
  else if (goalLower.includes('cardio') || goalLower.includes('run') || goalLower.includes('bike')) category = 'cardio';
  else if (goalLower.includes('code') || goalLower.includes('leetcode') || goalLower.includes('problem')) category = 'coding';
  else if (goalLower.includes('read') || goalLower.includes('learn') || goalLower.includes('topic')) category = 'learning';
  else if (goalLower.includes('work') || goalLower.includes('career') || goalLower.includes('block')) category = 'work';

  const pool = templates[category] || templates.default;
  const template = pool[Math.floor(Math.random() * pool.length)];

  return template
    .replace(/{{value}}/g, String(value))
    .replace(/{{unit}}/g, String(unit))
    .replace(/{{goal}}/g, String(goalName))
    .replace(/{{activity}}/g, String(activity));
}

/**
 * Check if user has unlocked new milestones based on quest state
 * @param {Object} questData - current quest state
 * @param {number} streakDays
 * @param {number} totalLogs
 * @param {number} completionRate (0-100)
 * @returns {Array} newly unlocked keepsakes and environments
 */
export function checkMilestones(questData, streakDays, totalLogs, completionRate) {
  const newUnlocks = [];

  MILESTONES.forEach((milestone) => {
    const alreadyUnlocked = questData.unlockedMilestones?.includes(milestone.id);
    if (alreadyUnlocked) return;

    let isUnlocked = false;

    if (milestone.type === 'streak' && streakDays >= milestone.threshold) {
      isUnlocked = true;
    } else if (milestone.type === 'logs' && totalLogs >= milestone.threshold) {
      isUnlocked = true;
    } else if (milestone.type === 'consistency' && completionRate >= milestone.threshold) {
      isUnlocked = true;
    }

    if (isUnlocked) {
      newUnlocks.push({
        id: milestone.id,
        type: milestone.type,
        keepsake: milestone.keepsake,
        environment: milestone.environment,
        title: milestone.title,
        description: milestone.description
      });
    }
  });

  return newUnlocks;
}

/**
 * Get the current active chapter number
 * @param {Array} chapters
 * @returns {number}
 */
export function getActiveChapterNumber(chapters) {
  return Array.isArray(chapters) ? chapters.length : 0;
}

/**
 * Get the next milestone toward unlock
 * @param {Object} questData
 * @param {number} streakDays
 * @param {number} totalLogs
 * @returns {Object|null} next milestone { id, title, progress, threshold }
 */
export function getNextMilestone(questData, streakDays, totalLogs) {
  const unlockedIds = questData.unlockedMilestones || [];

  for (const milestone of MILESTONES) {
    if (unlockedIds.includes(milestone.id)) continue;

    let currentProgress = 0;
    if (milestone.type === 'streak') {
      currentProgress = streakDays;
    } else if (milestone.type === 'logs') {
      currentProgress = totalLogs;
    }

    if (currentProgress > 0) {
      return {
        id: milestone.id,
        title: milestone.title,
        type: milestone.type,
        progress: currentProgress,
        threshold: milestone.threshold,
        environment: milestone.environment
      };
    }
  }

  return null;
}

/**
 * Get all unlocked environments
 * @param {Object} questData
 * @returns {Array} environment objects
 */
export function getUnlockedEnvironments(questData) {
  const unlockedIds = questData.unlockedMilestones || [];
  const environments = [];

  unlockedIds.forEach((id) => {
    const milestone = MILESTONES.find((m) => m.id === id);
    if (milestone && milestone.environment) {
      const env = ENVIRONMENTS.find((e) => e.id === milestone.environment);
      if (env && !environments.find((e) => e.id === env.id)) {
        environments.push(env);
      }
    }
  });

  return environments;
}

/**
 * Get all unlocked keepsakes
 * @param {Object} questData
 * @returns {Array} keepsake objects
 */
export function getUnlockedKeepsakes(questData) {
  const unlockedIds = questData.unlockedMilestones || [];
  const keepsakes = [];

  unlockedIds.forEach((id) => {
    const milestone = MILESTONES.find((m) => m.id === id);
    if (milestone && milestone.keepsake) {
      const keepsake = KEEPSAKE_TYPES.find((k) => k.id === milestone.keepsake);
      if (keepsake) {
        keepsakes.push(keepsake);
      }
    }
  });

  return keepsakes;
}

/**
 * Initialize quest data for new user
 * @returns {Object} initial quest state
 */
export function createDefaultQuestData() {
  return {
    chapters: [],
    totalCoins: 0,
    unlockedMilestones: [],
    keepsakes: [],
    environments: [],
    createdAt: new Date().toISOString()
  };
}

/**
 * Update quest state after task completion
 * @param {Object} questData
 * @param {Object} chapterParams
 * @param {Object} progressMetrics - { streakDays, totalLogs, completionRate }
 * @returns {Object} updated quest data + unlocks
 */
export function updateQuestOnTaskCompletion(questData, chapterParams, progressMetrics) {
  const updated = { ...questData };
  
  // Add new chapter
  const newChapter = createChapter(chapterParams);
  updated.chapters = [...(updated.chapters || []), newChapter];
  updated.totalCoins = (updated.totalCoins || 0) + newChapter.coins;

  // Check for new milestone unlocks
  const newUnlocks = checkMilestones(
    updated,
    progressMetrics.streakDays || 0,
    progressMetrics.totalLogs || updated.chapters.length,
    progressMetrics.completionRate || 0
  );

  if (newUnlocks.length > 0) {
    updated.unlockedMilestones = [
      ...(updated.unlockedMilestones || []),
      ...newUnlocks.map((u) => u.id)
    ];
    updated.keepsakes = getUnlockedKeepsakes(updated);
    updated.environments = getUnlockedEnvironments(updated);
  }

  return { ...updated, newUnlocks };
}
