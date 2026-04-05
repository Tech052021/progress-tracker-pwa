/**
 * Quest Milestones & Environments
 * Defines unlock thresholds, keepsakes, environments, and story elements
 */

/**
 * Milestones: Define what triggers unlocks
 * Each milestone unlocks a keepsake and/or environment
 */
export const MILESTONES = [
  {
    id: 'first-step',
    type: 'logs',
    threshold: 1,
    title: 'First Step',
    description: 'You have begun your quest.',
    keepsake: 'seedling',
    environment: 'vale-of-beginnings'
  },
  {
    id: 'consistency-week',
    type: 'streak',
    threshold: 7,
    title: 'Week of Consistency',
    description: 'Seven days of dedication unfold.',
    keepsake: 'streak-token',
    environment: 'garden-of-consistency'
  },
  {
    id: 'focused-mind',
    type: 'logs',
    threshold: 10,
    title: 'The Focused Mind',
    description: 'Ten chapters written. Your path becomes clear.',
    keepsake: 'focus-stone',
    environment: null
  },
  {
    id: 'commitment-month',
    type: 'streak',
    threshold: 30,
    title: 'Month of Commitment',
    description: 'Thirty days of unwavering focus.',
    keepsake: 'commitment-seal',
    environment: 'tower-of-focus'
  },
  {
    id: 'perfect-week',
    type: 'consistency',
    threshold: 100,
    title: 'Perfect Week',
    description: 'One hundred percent completion. Mastery begins.',
    keepsake: 'excellence-gem',
    environment: 'sanctuary-of-triumph'
  },
  {
    id: 'legend-born',
    type: 'logs',
    threshold: 50,
    title: 'Legend in the Making',
    description: 'Fifty chapters. Your story inspires.',
    keepsake: 'legend-crown',
    environment: null
  },
  {
    id: 'unshakeable',
    type: 'streak',
    threshold: 90,
    title: 'Unshakeable',
    description: 'Ninety days. You are unstoppable.',
    keepsake: 'unshakeable-emblem',
    environment: null
  }
];

/**
 * Keepsake Types: Collectible badges earned
 */
export const KEEPSAKE_TYPES = [
  {
    id: 'seedling',
    name: 'Seedling',
    emoji: '🌱',
    color: '#10b981',
    description: 'Your journey begins.',
    rarity: 'common'
  },
  {
    id: 'streak-token',
    name: 'Streak Token',
    emoji: '🔥',
    color: '#f97316',
    description: 'Seven days of consistency.',
    rarity: 'uncommon'
  },
  {
    id: 'focus-stone',
    name: 'Focus Stone',
    emoji: '💎',
    color: '#8b5cf6',
    description: 'Ten chapters of dedication.',
    rarity: 'uncommon'
  },
  {
    id: 'commitment-seal',
    name: 'Commitment Seal',
    emoji: '⭐',
    color: '#fbbf24',
    description: 'Thirty days maintained.',
    rarity: 'rare'
  },
  {
    id: 'excellence-gem',
    name: 'Excellence Gem',
    emoji: '💠',
    color: '#ec4899',
    description: 'Perfect consistency achieved.',
    rarity: 'rare'
  },
  {
    id: 'legend-crown',
    name: 'Legend Crown',
    emoji: '👑',
    color: '#fbbf24',
    description: 'Fifty chapters written.',
    rarity: 'epic'
  },
  {
    id: 'unshakeable-emblem',
    name: 'Unshakeable Emblem',
    emoji: '🛡️',
    color: '#6366f1',
    description: 'Ninety days of mastery.',
    rarity: 'epic'
  }
];

/**
 * Environments: Visual scenes unlocked as user progresses
 * Each environment has a story context and visual descriptor
 */
export const ENVIRONMENTS = [
  {
    id: 'vale-of-beginnings',
    name: 'Vale of Beginnings',
    emoji: '🌾',
    title: 'Every journey starts with a single step.',
    description: 'The soft, welcoming grassland where your story begins. New growth everywhere.',
    color: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
    unlockedAt: 1,
    narrative: 'You have entered the Vale of Beginnings, where all quests start. The grass is soft beneath your feet.'
  },
  {
    id: 'garden-of-consistency',
    name: 'Garden of Consistency',
    emoji: '🌻',
    title: 'Seven days of dedication bloom.',
    description: 'A flourishing garden where every day of effort shows. Flowers bloom in all directions.',
    color: 'linear-gradient(135deg, #fbbf24 0%, #ec4899 100%)',
    unlockedAt: 7,
    narrative: 'The garden burst into bloom around you. Each flower represents a day you showed up for yourself.'
  },
  {
    id: 'tower-of-focus',
    name: 'Tower of Focus',
    emoji: '🏔️',
    title: 'Thirty days of unwavering focus.',
    description: 'A towering achievement. The landscape rises majestically before you.',
    color: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    unlockedAt: 30,
    narrative: 'The tower solidifies beneath you. A month of discipline has built something unshakeable.'
  },
  {
    id: 'sanctuary-of-triumph',
    name: 'Sanctuary of Triumph',
    emoji: '🏛️',
    title: 'Perfect consistency achieved.',
    description: 'A sacred place of mastery. You have earned the right to rest here.',
    color: 'linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%)',
    unlockedAt: 100,
    narrative: 'You have entered the Sanctuary. Few find their way here. You are among the elite now.'
  }
];

/**
 * Story Fragment Templates by Category
 * Used when generating achievement messages
 */
export const ACHIEVEMENT_MESSAGES = {
  'first-step': 'Your journey has begun. Welcome to the quest.',
  'consistency-week': 'Seven days of dedication! The first flowers bloom.',
  'focused-mind': 'Ten chapters written. Your story grows stronger.',
  'commitment-month': 'A full month of consistency! The tower rises.',
  'perfect-week': 'Perfect execution. The Sanctuary awaits.',
  'legend-born': 'Fifty chapters. You are becoming legendary.',
  'unshakeable': 'Ninety days. You are unshakeable.'
};

/**
 * Coin Rewards
 */
export const COIN_REWARDS = {
  task_completion: 10,
  daily_streak_maintained: 5,
  weekly_checkin: 15,
  milestone_unlock: 50
};
