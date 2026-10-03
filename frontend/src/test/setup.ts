import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import i18n from '../i18n'
import { resetDataWarningForTests } from '../lib/staleWarning'

// Every test starts like a first visit: Polish, nothing stored, no stale warning seen.
beforeEach(async () => {
  await i18n.changeLanguage('pl')
  window.localStorage.clear()
  resetDataWarningForTests()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
