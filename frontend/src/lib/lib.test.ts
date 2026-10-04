import { expect, test } from 'vitest'
import { classify } from './classes'
import { dateInWords, machineDate } from './dates'
import { buildMap } from './geo'
import { plainNumber } from './plainNumber'
import { betterThan, wholeScore } from './score'

const values = (numbers: number[]) => numbers.map((value, i) => ({ district: `d${i}`, value, display: `${value} u` }))

test('classify puts the lowest values in class 1 and the highest in class 5', () => {
  const { classOf, classes } = classify(values([50, 10, 40, 20, 30, 60, 70, 80, 90, 100]))

  expect(classOf.get('d1')).toBe(1)
  expect(classOf.get('d9')).toBe(5)
  expect(classes.map((c) => c.number)).toEqual([1, 2, 3, 4, 5])
  expect(classes[0]).toEqual({ number: 1, minDisplay: '10 u', maxDisplay: '20 u' })
  expect(classes[4]).toEqual({ number: 5, minDisplay: '90 u', maxDisplay: '100 u' })
})

test('classify gives equal values the same class and handles an empty list', () => {
  const { classOf } = classify(values([5, 5, 5, 5, 9]))
  expect(new Set(['d0', 'd1', 'd2', 'd3'].map((d) => classOf.get(d))).size).toBe(1)
  expect(classify([]).classes).toEqual([])
})

test('buildMap draws a path per district and puts the label inside a bent shape', () => {
  // An L shape: its centroid is near the inner corner, and the label must land inside the shape.
  const lShape = { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4], [0, 0]]] }
  const multi = { type: 'MultiPolygon', coordinates: [[[[5, 0], [6, 0], [6, 1], [5, 1], [5, 0]]]] }
  const map = buildMap([
    { geometry: lShape, properties: { code: 'l', name: 'L' } },
    { geometry: multi, properties: { code: 'm', name: 'M' } },
    { geometry: { type: 'Point', coordinates: [0, 0] }, properties: { code: 'p', name: 'P' } },
  ])

  expect(map.shapes.map((s) => s.code)).toEqual(['l', 'm'])
  expect(map.shapes[0]?.path.startsWith('M')).toBe(true)
  expect(map.width).toBe(1000)
  expect(map.height).toBeGreaterThan(0)
  const unit = map.width / 6
  const { x, y } = map.shapes[0]!.label
  // Inside the L: either in the bottom arm or in the left arm, in projected units (north is up, so y is flipped).
  const lon = x / unit
  const lat = 4 - y / unit
  expect((lat <= 1.05 && lon <= 4.05) || (lon <= 1.05 && lat <= 4.05)).toBe(true)
})

test('plainNumber changes only the decimal sign, and only in Polish', () => {
  expect(plainNumber(57.8, 'pl')).toBe('57,8')
  expect(plainNumber(57.8, 'en')).toBe('57.8')
  expect(plainNumber(49, 'pl')).toBe('49')
  expect(plainNumber(3.694, 'pl')).toBe('3,694')
})

test('sourceLinks keeps real pages, splits several addresses, and avoids downloads and listings sites', async () => {
  const { sourceLinks } = await import('./sourceLinks')
  expect(sourceLinks(undefined)).toEqual([])
  expect(sourceLinks('https://example.org/page')).toEqual(['https://example.org/page'])
  expect(sourceLinks('https://a.example.org/x ; https://b.example.org/y')).toEqual(['https://a.example.org/x', 'https://b.example.org/y'])
  // A data file would start a download: link to the site that publishes it.
  expect(sourceLinks('https://files.example.org/a.zip ; https://files.example.org/b.zip')).toEqual(['https://files.example.org'])
  // The portal never links to a listings site.
  expect(sourceLinks('https://www.otodom.pl ; https://www.olx.pl')).toEqual([])
  expect(sourceLinks('javascript:alert(1)')).toEqual([])
  expect(sourceLinks('not a url')).toEqual([])
})

test('a date from the API is shown in words in the language of the page, and kept in ISO form for machines', () => {
  expect(dateInWords('2026-09-30', 'pl')).toBe('30 września 2026')
  expect(dateInWords('2026-09-30', 'en')).toBe('30 September 2026')
  // A time stamp gives its day, read as UTC, so the day does not move with the reader's time zone.
  expect(dateInWords('2026-10-01T23:30:00+00:00', 'pl')).toBe('1 października 2026')
  expect(machineDate('2026-10-01T23:30:00+00:00')).toBe('2026-10-01')
  // A text that is not a date is shown as sent.
  expect(dateInWords('test period', 'pl')).toBe('test period')
  expect(machineDate('test period')).toBeUndefined()
})

test('a percentile becomes "better than k of the other n − 1 districts", and a score becomes a whole number', () => {
  expect(betterThan(82.4, 18)).toBe(14)
  expect(betterThan(100, 18)).toBe(17)
  expect(betterThan(0, 18)).toBe(0)
  expect(wholeScore(40.9)).toBe(41)
  expect(wholeScore(41.3)).toBe(41)
})
