// The one file that holds the theme. No component and no stylesheet writes a colour, a font or a size of its own:
// they use the CSS custom properties that src/theme/index.ts builds from these values.
//
// Status: PROVISIONAL. This follows the "Civic Map Desk" proposal in the team design library, which the library
// owner had not approved on 3 October 2026. The type scale, spacing, neutral greys and status colours come from the
// library's Vienna Voxel system. The blue and the surface tint are the values the library generated from the
// Kraków city page reference, with the blue darkened until white text on it passes 4.5:1.
// When a system is approved, replace the values here with its exported tokens; theme.test.ts keeps the contrast honest.

export const colors = {
  bg: '#ffffff',
  surface: '#f5f3f4',
  surfaceRaised: '#ffffff',
  /** Decorative hairline between rows. It carries no meaning, so it has no contrast requirement. */
  border: '#d4d4d4',
  /** Border of a control (button, input). It must reach 3:1 against the page. */
  borderStrong: '#6b6b6b',
  text: '#0a0a0a',
  textMuted: '#6b6b6b',
  /** The one civic blue: the navigation band, the primary action, the chosen item and links. */
  accent: '#196ba9',
  accentContrast: '#ffffff',
  link: '#196ba9',
  focus: '#0a0a0a',
  success: '#21763c',
  warning: '#aa6a00',
  danger: '#be2f2c',
  info: '#286cab',
  /**
   * The map ramp: five ordered steps of the accent blue, from a pale tint to a deep shade. Lightness falls in one
   * direction, so the order still reads in greyscale. It means "more" or "less" of a measure, never "good" or "bad".
   */
  mapRamp1: '#dceeff',
  mapRamp2: '#a6d0f6',
  mapRamp3: '#6faae0',
  mapRamp4: '#196ba9',
  mapRamp5: '#003f6e',
} as const

export type ColorToken = keyof typeof colors

/** WCAG 2.2 AA minimums: normal text, and interface parts or large text. */
export const TEXT_MIN = 4.5
export const UI_MIN = 3

type ContrastPair = { fg: ColorToken; bg: ColorToken; min: number; use: string }

const pair = (fg: ColorToken, bg: ColorToken, min: number, use: string): ContrastPair => ({ fg, bg, min, use })

/** Every colour pair the interface uses. Add a pair here before you put a colour on a new background. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  pair('text', 'bg', TEXT_MIN, 'body text on the page'),
  pair('text', 'surface', TEXT_MIN, 'body text on a panel'),
  pair('text', 'surfaceRaised', TEXT_MIN, 'body text on a raised panel or button'),
  pair('textMuted', 'bg', TEXT_MIN, 'captions on the page'),
  pair('textMuted', 'surface', TEXT_MIN, 'captions on a panel'),
  pair('link', 'bg', TEXT_MIN, 'links on the page'),
  pair('link', 'surface', TEXT_MIN, 'links on a panel'),
  pair('accentContrast', 'accent', TEXT_MIN, 'text on the navigation band and on the primary button'),
  pair('accent', 'bg', UI_MIN, 'the band and the primary button against the page'),
  pair('borderStrong', 'bg', UI_MIN, 'control borders on the page'),
  pair('borderStrong', 'surface', UI_MIN, 'control borders on a panel'),
  pair('focus', 'bg', UI_MIN, 'focus ring on the page'),
  pair('focus', 'surface', UI_MIN, 'focus ring on a panel'),
  pair('focus', 'accent', UI_MIN, 'focus ring on the navigation band'),
  pair('success', 'bg', UI_MIN, 'status rule on the page'),
  pair('success', 'surface', UI_MIN, 'status rule on a panel'),
  pair('warning', 'bg', UI_MIN, 'status rule on the page'),
  pair('warning', 'surface', UI_MIN, 'status rule on a panel'),
  pair('danger', 'bg', UI_MIN, 'status rule on the page'),
  pair('danger', 'surface', UI_MIN, 'status rule on a panel'),
  pair('info', 'bg', UI_MIN, 'status rule on the page'),
  pair('info', 'surface', UI_MIN, 'status rule on a panel'),
  // The class number printed on each district of the map: dark on the pale steps, light on the deep ones.
  pair('text', 'mapRamp1', TEXT_MIN, 'class number on map step 1'),
  pair('text', 'mapRamp2', TEXT_MIN, 'class number on map step 2'),
  pair('text', 'mapRamp3', TEXT_MIN, 'class number on map step 3'),
  pair('accentContrast', 'mapRamp4', TEXT_MIN, 'class number on map step 4'),
  pair('accentContrast', 'mapRamp5', TEXT_MIN, 'class number on map step 5'),
]

/** The ramp steps in order, palest first. */
export const MAP_RAMP: ColorToken[] = ['mapRamp1', 'mapRamp2', 'mapRamp3', 'mapRamp4', 'mapRamp5']

/** Fonts are self-hosted (bundled from the fontsource packages, SIL Open Font Licence). Nothing loads from a third party. */
export const fonts = {
  body: "'Schibsted Grotesk Variable', 'Helvetica Neue', Arial, sans-serif",
  mono: "'DM Mono', ui-monospace, Menlo, monospace",
} as const

/** Sizes, spacing, corners and durations, in rem so the user's text size setting is respected. */
export const scale = {
  'text-xs': '0.75rem',
  'text-sm': '0.875rem',
  'text-base': '1.0625rem',
  'text-lg': '1.375rem',
  'text-xl': '1.875rem',
  'text-2xl': '2.875rem',
  'line-tight': '1.2',
  'line-base': '1.6',
  'space-1': '0.25rem',
  'space-2': '0.5rem',
  'space-3': '0.75rem',
  'space-4': '1rem',
  'space-5': '1.5rem',
  'space-6': '2rem',
  'space-7': '3rem',
  'radius-sm': '0.25rem',
  'radius-md': '0.5rem',
  'radius-pill': '999px',
  container: '70rem',
  measure: '64ch',
  /** 44 CSS pixels at the default text size: the aim for pointer targets on touch screens (24 is the minimum). */
  target: '2.75rem',
  'duration-fast': '120ms',
  'duration-base': '220ms',
} as const
