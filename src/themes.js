/**
 * NextStride theme presets.
 * Each key maps to a CSS custom property on :root.
 * The useTheme hook applies these by calling
 *   document.documentElement.style.setProperty(key, value)
 *
 * Auto-contrast: Hero text colors are computed based on the background gradient's
 * starting color (dark parameter). If lightness < 60%, use light text. Otherwise dark.
 */

// Helper: Extract lightness from HSL string and determine text color
const _getHeroTextColors = (hslColor) => {
  const match = hslColor.match(/hsl\((\d+)\s+([\d.]+)%\s+([\d.]+)%\)/);
  if (!match) return { light: 'hsl(0 0% 100%)', dark: 'hsl(0 0% 0%)' };
  
  const lightness = parseFloat(match[3]);
  
  // Dark background (L < 60%) → light text for dark background, dark for light
  if (lightness < 60) {
    return {
      light: 'hsl(0 0% 100%)',     // white for hero sections
      dark: 'hsl(0 0% 5%)',          // near-black for secondary text
    };
  }
  // Light background (L >= 60%) → dark text for light background
  return {
    light: 'hsl(0 0% 15%)',          // near-black for light backgrounds
    dark: 'hsl(0 0% 45%)',           // medium gray for secondary text
  };
};

const _t = (brand, brand2, accent, dark, rgb, tints, texts, bg) => {
  const heroTextColors = _getHeroTextColors(dark);
  return {
    '--brand':        brand,
    '--brand-2':      brand2,
    '--brand-accent': accent,
    '--brand-dark':   dark,
    '--brand-rgb':    rgb,
    '--brand-grad':       `linear-gradient(135deg, ${brand} 0%, ${brand2} 55%, ${accent} 100%)`,
    '--brand-grad-hero':  `linear-gradient(135deg, ${dark} 0%, ${brand} 40%, ${brand2} 75%, ${accent} 100%)`,
    '--progress-grad':    `linear-gradient(90deg, ${brand}, ${brand2}, ${accent})`,
    '--tint-grad':        `linear-gradient(135deg, ${tints[0]} 0%, ${tints[1]} 100%)`,
    '--momentum-grad':    `linear-gradient(90deg, ${tints[2]}, ${brand2}, ${accent})`,
    '--bg-page':          bg,
    '--tint-50':  tints[0],
    '--tint-100': tints[1],
    '--tint-200': tints[2],
    '--tint-300': tints[3],
    '--tint-400': tints[4],
    '--text-brand':      texts[0],
    '--text-brand-dark': texts[1],
    '--hero-text':        heroTextColors.light,
    '--hero-text-muted':  heroTextColors.light === 'hsl(0 0% 100%)' ? 'rgba(255,255,255,0.78)' : 'rgba(20,20,20,0.65)',
    '--progress-low':  'hsl(0 66% 56%)',
    '--progress-mid':  'hsl(40 84% 54%)',
    '--progress-high': 'hsl(145 56% 42%)',
    '--progress-semantic-grad': 'linear-gradient(90deg, hsl(0 66% 56%), hsl(40 84% 54%), hsl(145 56% 42%))',
    '--surface-2': tints[0],
    '--border':  `rgba(${rgb}, 0.13)`,
    '--shadow':  `0 4px 24px rgba(${rgb}, 0.10)`,
  };
};

export const themes = {
  navy: {
    label: 'Blue Eclipse',
    emoji: '🌌',
    ..._t(
      'hsl(222 63% 33%)', 'hsl(208 89% 56%)', 'hsl(191 86% 57%)', 'hsl(221 66% 19%)', '31,63,137',
      ['hsl(216 57% 96%)', 'hsl(213 52% 92%)', 'hsl(212 45% 85%)', 'hsl(214 32% 71%)', 'hsl(214 35% 80%)'],
      ['hsl(214 70% 42%)', 'hsl(221 66% 20%)'],
      'linear-gradient(145deg, hsl(220 32% 11%) 0%, hsl(220 42% 18%) 45%, hsl(211 55% 24%) 100%)',
    ),
  },

  ocean: {
    label: 'Stormy Morning',
    emoji: '🌫️',
    ..._t(
      'hsl(214 36% 31%)', 'hsl(211 24% 49%)', 'hsl(210 14% 66%)', 'hsl(218 34% 19%)', '50,74,103',
      ['hsl(210 25% 96%)', 'hsl(208 18% 92%)', 'hsl(210 14% 84%)', 'hsl(211 12% 70%)', 'hsl(211 13% 79%)'],
      ['hsl(214 30% 39%)', 'hsl(219 28% 24%)'],
      'linear-gradient(140deg, hsl(213 36% 94%) 0%, hsl(209 18% 90%) 52%, hsl(205 13% 84%) 100%)',
    ),
  },

  violet: {
    label: 'Soft-Tech Pastels',
    emoji: '🫧',
    ..._t(
      'hsl(258 55% 66%)', 'hsl(195 50% 65%)', 'hsl(24 74% 77%)', 'hsl(258 43% 42%)', '148,122,214',
      ['hsl(256 48% 97%)', 'hsl(258 44% 94%)', 'hsl(196 38% 86%)', 'hsl(253 42% 78%)', 'hsl(189 34% 84%)'],
      ['hsl(255 48% 49%)', 'hsl(257 39% 34%)'],
      'linear-gradient(142deg, hsl(258 50% 97%) 0%, hsl(191 46% 95%) 52%, hsl(24 68% 94%) 100%)',
    ),
  },

  emerald: {
    label: 'Lush Forest',
    emoji: '🌲',
    ..._t(
      'hsl(154 45% 31%)', 'hsl(150 46% 45%)', 'hsl(142 53% 67%)', 'hsl(156 52% 20%)', '43,114,83',
      ['hsl(120 31% 96%)', 'hsl(126 34% 92%)', 'hsl(133 33% 84%)', 'hsl(138 34% 65%)', 'hsl(136 34% 77%)'],
      ['hsl(153 46% 32%)', 'hsl(156 49% 21%)'],
      'linear-gradient(142deg, hsl(120 32% 95%) 0%, hsl(137 30% 90%) 48%, hsl(44 34% 90%) 100%)',
    ),
  },

  sunset: {
    label: 'Golden Hour',
    emoji: '🌅',
    ..._t(
      'hsl(34 84% 52%)', 'hsl(24 83% 66%)', 'hsl(12 80% 68%)', 'hsl(26 82% 41%)', '236,147,29',
      ['hsl(35 100% 96%)', 'hsl(34 100% 91%)', 'hsl(31 94% 82%)', 'hsl(29 90% 70%)', 'hsl(41 89% 76%)'],
      ['hsl(26 81% 44%)', 'hsl(20 64% 28%)'],
      'linear-gradient(140deg, hsl(36 100% 95%) 0%, hsl(42 100% 93%) 52%, hsl(12 90% 93%) 100%)',
    ),
  },

  rose: {
    label: 'Electric Kiwi',
    emoji: '🥝',
    ..._t(
      'hsl(96 89% 46%)', 'hsl(152 67% 46%)', 'hsl(191 78% 58%)', 'hsl(210 24% 14%)', '101,222,13',
      ['hsl(110 42% 96%)', 'hsl(118 45% 92%)', 'hsl(134 45% 84%)', 'hsl(141 50% 62%)', 'hsl(152 48% 74%)'],
      ['hsl(147 55% 32%)', 'hsl(210 24% 16%)'],
      'linear-gradient(145deg, hsl(210 22% 11%) 0%, hsl(170 38% 14%) 44%, hsl(95 38% 20%) 100%)',
    ),
    '--brand-grad-hero': 'linear-gradient(135deg, hsl(210 24% 14%) 0%, hsl(96 89% 46%) 40%, hsl(152 67% 46%) 74%, hsl(191 78% 58%) 100%)',
  },

  matte: {
    label: 'Matte Spectrum',
    emoji: '🎨',
    ..._t(
      '#5f6f8f', '#7b6a8f', '#b46a7a', '#2e3446', '95,111,143',
      ['#f2f2f0', '#e8e7e2', '#d4d3cc', '#aaa79c', '#c2bdb1'],
      ['#4a5673', '#2a3040'],
      'linear-gradient(140deg, #121417 0%, #1d1f24 45%, #27231e 100%)',
    ),
    '--momentum-grad': 'linear-gradient(90deg, #8d4747, #9a6c3f, #9c8a3d, #5e7d3d, #476d6c, #4a6889, #6a5b88, #8a5f7e, #8b8479, #7c7f83)',
    '--brand-grad-hero': 'linear-gradient(135deg, #2e3446 0%, #5f6f8f 38%, #7b6a8f 70%, #b46a7a 100%)',
  },
};

export const THEME_KEY = 'nextstride_theme';
export const DEFAULT_THEME = 'navy';
