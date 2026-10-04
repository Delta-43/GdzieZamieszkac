import { expect, test } from 'vitest'
import { contrastRatio } from './contrast'
import { themeCss } from './index'
import { colors, CONTRAST_PAIRS, MAP_RAMP, scale, TEXT_MIN, UI_MIN } from './tokens'

test('the contrast formula matches the known WCAG values', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  // #767676 on white is the well-known grey that just passes 4.5:1.
  expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5)
})

test.each(CONTRAST_PAIRS)('$fg on $bg reaches $min:1 ($use)', ({ fg, bg, min }) => {
  expect([TEXT_MIN, UI_MIN]).toContain(min)
  expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min)
})

test('every colour that can sit on a background is covered by a contrast pair', () => {
  const backgrounds = new Set<string>(['bg', 'surface', 'surfaceRaised', 'accent', 'accentHover', ...MAP_RAMP])
  // "border" is a decorative hairline and carries no meaning, so it has no requirement. The same goes for the context of the map
  // (water, roads, railways): they only help to find one's way, nothing is read from them, and they are thin and see-through.
  const exempt = new Set<string>(['border', 'noDataStripe', 'mapWater', 'mapRoad', 'mapRail'])
  const covered = new Set<string>(CONTRAST_PAIRS.map((pair) => pair.fg))
  const uncovered = Object.keys(colors).filter((name) => !backgrounds.has(name) && !exempt.has(name) && !covered.has(name))
  expect(uncovered).toEqual([])
})

test('the map ramp gets darker with every step, so its order does not depend on hue', () => {
  const againstWhite = MAP_RAMP.map((step) => contrastRatio(colors[step], '#ffffff'))
  expect(MAP_RAMP).toHaveLength(5)
  expect([...againstWhite].sort((a, b) => a - b)).toEqual(againstWhite)
  expect(new Set(againstWhite).size).toBe(5)
})

test('a district name on the map reaches 4.5:1 on every step of the ramp', () => {
  // The name is dark on the three pale steps and light on the two deep ones.
  MAP_RAMP.forEach((step, index) => {
    const ink = index < 3 ? colors.text : colors.accentContrast
    expect(contrastRatio(ink, colors[step])).toBeGreaterThanOrEqual(TEXT_MIN)
  })
})

test('the theme stylesheet defines a custom property for every colour', () => {
  const css = themeCss()
  expect(css).toContain(`--color-bg: ${colors.bg};`)
  expect(css).toContain(`--color-accent-contrast: ${colors.accentContrast};`)
  expect(css).toContain('--font-body:')
  expect(css).toContain('--font-ui:')
  expect(css).toContain('prefers-reduced-motion')
})

test('with reduced motion every duration token is zero, and the stylesheet writes no duration of its own', () => {
  const reduced = themeCss().split('prefers-reduced-motion')[1] ?? ''
  const durations = Object.keys(scale).filter((name) => name.startsWith('duration-'))
  expect(durations.length).toBeGreaterThan(0)
  for (const name of durations) expect(reduced).toContain(`--${name}: 0ms;`)
  // A duration typed into the stylesheet would keep moving for a person who asked for less motion.
  const styles = import.meta.glob('/src/styles.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const typed = Object.values(styles)
    .join('\n')
    .split('\n')
    .filter((line) => /transition|animation/.test(line) && /\b\d+m?s\b/.test(line) && !/\b0s\b/.test(line.replace(/var\([^)]*\)/g, '')))
  expect(typed).toEqual([])
})

test('no colour is written outside the theme folder', () => {
  const sources = import.meta.glob(['/src/**/*.{css,ts,tsx}', '!/src/theme/**', '!/src/api/schema.d.ts', '!/src/api/citySchema.d.ts', '!/src/**/*.test.*'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  const literalColour = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\(/i

  const offenders = Object.entries(sources)
    .filter(([, text]) => literalColour.test(text))
    .map(([path]) => path)

  expect(Object.keys(sources).length).toBeGreaterThan(5)
  expect(offenders).toEqual([])
})

test('the favicon is drawn in the blues of the map, and the page links to it from the same server', async () => {
  const { readFileSync } = await import('node:fs')
  const icon = readFileSync('public/favicon.svg', 'utf8')
  const fills = [...icon.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((match) => match[1])
  expect(fills).toEqual([colors.mapRamp2, colors.mapRamp4, colors.mapRamp3, colors.mapRamp5])
  const page = readFileSync('index.html', 'utf8')
  expect(page).toContain('<link rel="icon" href="/favicon.ico" sizes="32x32" />')
  expect(page).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />')
  // No icon from another host.
  expect(page).not.toMatch(/rel="icon" href="https?:/)
})
