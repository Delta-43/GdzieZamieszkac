// The one file that holds the theme. No component and no stylesheet writes a colour, a font or a size of its own:
// they use the CSS custom properties that src/theme/index.ts builds from these values.
//
// Status: PROPOSAL (3 October 2026). The look follows the city's own website, krakow.pl: a white page, grey panels,
// one blue, dark navy text and the Lato typeface. The colours are the ones that site's stylesheet uses most
// (blue #0063af, ink #071f32, grey #f5f5f5, hairline #bfbfbf). Colours and a typeface only: no logo, crest or photo.
// The map ramp is the one from ../../design/krakow-blue.tokens.css. The focus and status colours are ours.
// The coordinator's accepted design is ../../../docs/DESIGN.md (Field Journal); whether this look replaces it is the
// coordinator's open decision. Changing the look means changing the values here; theme.test.ts keeps the contrast honest.

export const colors = {
  /** The page. */
  bg: '#ffffff',
  /** Grey panels: the map stage, notices, the footer, a chosen table row. */
  surface: '#f5f5f5',
  /** White cards and controls. */
  surfaceRaised: '#ffffff',
  /** Decorative hairline between rows. It carries no meaning, so it has no contrast requirement. */
  border: '#bfbfbf',
  /** Border of a control (button, input). It must reach 3:1 against the page and against a panel. */
  borderStrong: '#6b6b6b',
  text: '#071f32',
  textMuted: '#505050',
  /** The one Kraków blue: the navigation band, the primary action, the chosen item and links. */
  accent: '#0063af',
  accentContrast: '#ffffff',
  link: '#0063af',
  /** The focus ring on the page and on panels. */
  focus: '#b35c00',
  /** The focus ring on the blue band, where the orange ring would not show. */
  focusOnAccent: '#ffffff',
  success: '#21763c',
  warning: '#aa6a00',
  danger: '#be2f2c',
  info: '#286cab',
  /**
   * The map ramp: five ordered steps of one blue, from a pale tint to a deep shade. Lightness falls in one
   * direction, so the order still reads in greyscale. It means "more" or "less" of a measure, never "good" or "bad".
   */
  mapRamp1: '#e5f0fa',
  mapRamp2: '#b5d3ee',
  mapRamp3: '#7fb0dc',
  mapRamp4: '#0063af',
  mapRamp5: '#0a3a66',
  /** "No data" is hatching, never a fill that looks like a low value. */
  noDataStripe: '#bfbfbf',
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
  pair('focusOnAccent', 'accent', UI_MIN, 'focus ring on the navigation band'),
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

/**
 * One typeface for everything, as on the city's website: Lato, regular and bold. It is self-hosted (bundled from the
 * @fontsource/lato package, SIL Open Font Licence 1.1) and includes the Latin Extended range that Polish needs.
 * The two names stay separate, so text and interface can take different faces again without touching the styles.
 */
export const fonts = {
  body: "Lato, 'Segoe UI', Arial, sans-serif",
  ui: "Lato, 'Segoe UI', Arial, sans-serif",
} as const

/** Sizes, spacing, corners and durations, in rem so the user's text size setting is respected. */
export const scale = {
  'text-xs': '0.8125rem',
  'text-sm': '0.9375rem',
  'text-base': '1.125rem',
  'text-lg': '1.3125rem',
  'text-xl': '1.625rem',
  'text-2xl': '2rem',
  'line-tight': '1.2',
  'line-base': '1.5',
  'space-1': '0.25rem',
  'space-2': '0.5rem',
  'space-3': '0.75rem',
  'space-4': '1rem',
  'space-5': '1.5rem',
  'space-6': '2rem',
  'space-7': '3rem',
  'radius-sm': '0.25rem',
  'radius-md': '0.375rem',
  'radius-pill': '999px',
  container: '75rem',
  measure: '68ch',
  /** 44 CSS pixels at the default text size: the aim for pointer targets on touch screens (24 is the minimum). */
  target: '2.75rem',
  /** The one shadow in the interface: under the menu sheet, which lies over the page. Navy at low opacity. */
  'shadow-menu': '0 0 2.5rem rgb(7 31 50 / 0.28)',
  'duration-fast': '120ms',
  'duration-base': '200ms',
} as const
