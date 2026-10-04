import { expect, test } from 'vitest'
import en from './locales/en.json'
import pl from './locales/pl.json'

function keysOf(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null ? keysOf(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  )
}

test('pl.json and en.json have the same keys', () => {
  expect(keysOf(pl).sort()).toEqual(keysOf(en).sort())
})

test('no interface text is empty', () => {
  for (const locale of [pl, en]) {
    const text = JSON.stringify(locale)
    expect(text).not.toMatch(/:""/)
  }
})

test('no interface text says "percentile" or gives a map class by its number', () => {
  // Issue #82: a resident reads a place (1 is the best) or the size of a value in words, never a percentile or "class 4 of 5".
  for (const locale of [pl, en]) {
    const text = JSON.stringify(locale)
    expect(text).not.toMatch(/percentyl|percentile/i)
    expect(text).not.toMatch(/\{\{(number|class)\}\}/)
  }
})
