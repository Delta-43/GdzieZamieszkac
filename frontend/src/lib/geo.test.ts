import { expect, test } from 'vitest'
import { buildMap, parseBasemap } from './geo'

const square = (code: string, x: number, y: number) => ({
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + 0.01, y],
        [x + 0.01, y + 0.01],
        [x, y + 0.01],
        [x, y],
      ],
    ],
  },
  properties: { code, name: code.toUpperCase() },
})

test('every shape knows how far it is from the middle of the map, for the wave of colour', () => {
  const map = buildMap([square('a', 20, 50), square('b', 20.011, 50), square('c', 20.022, 50)])
  const wave = Object.fromEntries(map.shapes.map((shape) => [shape.code, shape.wave]))
  // The middle district changes first, its two neighbours after it, and every place is between 0 and 1.
  expect(wave.b).toBeLessThan(wave.a as number)
  expect(wave.b).toBeLessThan(wave.c as number)
  expect(map.shapes.every((shape) => shape.wave >= 0 && shape.wave <= 1)).toBe(true)
})

test('every shape knows its extent, for zooming to it', () => {
  const [shape] = buildMap([square('a', 20, 50)]).shapes
  expect(shape?.box.x1).toBeGreaterThan(shape?.box.x0 ?? 0)
  expect(shape?.box.y1).toBeGreaterThan(shape?.box.y0 ?? 0)
})

test('the context is drawn in the same projection, and a wrong file gives no context', () => {
  const basemap = parseBasemap({
    attribution: '© Test credit',
    roads: [
      {
        class: 'motorway',
        line: [
          [20, 50],
          [20.005, 50.005],
        ],
      },
      {
        class: 'primary',
        line: [
          [20, 50.002],
          [20.008, 50.002],
        ],
      },
      { class: 'primary', line: 'not a line' },
    ],
    rail: [
      {
        line: [
          [20, 50.001],
          [20.01, 50.001],
        ],
      },
    ],
    rivers: [
      {
        line: [
          [20.002, 50],
          [20.002, 50.01],
        ],
      },
    ],
    lakes: [
      {
        ring: [
          [20.003, 50.003],
          [20.004, 50.003],
          [20.004, 50.004],
          [20.003, 50.003],
        ],
      },
    ],
    places: [{ name: 'Test place', lon: 20.005, lat: 50.005 }, { name: 'Broken' }],
  })
  expect(basemap?.roads).toHaveLength(2)
  expect(basemap?.places).toHaveLength(1)
  const context = buildMap([square('a', 20, 50)], basemap).context
  expect(context?.roadsMajor.startsWith('M')).toBe(true)
  expect(context?.roadsMinor.startsWith('M')).toBe(true)
  expect(context?.lakes.endsWith('Z')).toBe(true)
  expect(context?.places[0]?.name).toBe('Test place')
  expect(context?.attribution).toBe('© Test credit')

  expect(parseBasemap(null)).toBeNull()
  expect(parseBasemap({ roads: [] })).toBeNull()
  expect(buildMap([square('a', 20, 50)]).context).toBeNull()
})
