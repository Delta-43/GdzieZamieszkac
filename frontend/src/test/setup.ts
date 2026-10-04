import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import i18n from '../i18n'
import { resetDataWarningForTests } from '../lib/staleWarning'

// Waiting for something to appear (findBy, waitFor) gives up after one second by default. A busy machine or a CI runner needs longer.
configure({ asyncUtilTimeout: 5000 })

// jsdom has no canvas. The pixel layer of the map is only a picture under the SVG, so it draws nothing in a test.
HTMLCanvasElement.prototype.getContext = () => null

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
