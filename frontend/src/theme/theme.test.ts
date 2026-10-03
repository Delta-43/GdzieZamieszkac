import { expect, test } from 'vitest'
import { contrastRatio } from './contrast'
import { themeCss } from './index'
import { colors, CONTRAST_PAIRS, MAP_RAMP, TEXT_MIN, UI_MIN } from './tokens'

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
  // "border" is a decorative hairline and carries no meaning, so it is the one colour with no requirement.
  const exempt = new Set<string>(['border', 'noDataStripe'])
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

test('no colour is written outside the theme folder', () => {
  const sources = import.meta.glob(['/src/**/*.{css,ts,tsx}', '!/src/theme/**', '!/src/api/schema.d.ts', '!/src/**/*.test.*'], {
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
