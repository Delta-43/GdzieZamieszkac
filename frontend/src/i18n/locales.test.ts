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
