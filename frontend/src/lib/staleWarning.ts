import { useSyncExternalStore } from 'react'

// Remembers that the API sent X-Data-Warning. Only some endpoints send the header, so a response
// without it says nothing about staleness: the flag is set and never cleared (see API.md).
let warned = false
const listeners = new Set<() => void>()

export function markDataWarning() {
  if (warned) return
  warned = true
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDataWarning(): boolean {
  return useSyncExternalStore(subscribe, () => warned)
}

/** For tests only: the flag is module state and would leak between tests. */
export function resetDataWarningForTests() {
  warned = false
}
