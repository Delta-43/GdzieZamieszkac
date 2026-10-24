import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import i18n from '../i18n'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function badge() {
  const { DataKindBadge } = await import('./DataKindBadge')
  render(<DataKindBadge kind="observed" />)
}

test('in a normal build an observed value is called measured', async () => {
  await badge()
  expect(screen.getByText('zmierzone')).toBeInTheDocument()
})

test.each([
  ['pl', 'przykładowe'],
  ['en', 'sample'],
])('in the demo build an observed value is called sample, never measured (%s)', async (lang, word) => {
  vi.stubEnv('VITE_DEMO', 'true')
  vi.resetModules()
  await i18n.changeLanguage(lang)
  await badge()
  expect(screen.getByText(word)).toBeInTheDocument()
  expect(screen.queryByText(/zmierzone|measured/)).not.toBeInTheDocument()
})
