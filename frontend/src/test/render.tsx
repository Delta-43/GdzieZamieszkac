import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { App } from '../App'

/** Renders the whole app at a path, with a fresh query cache and no retries. */
export function renderApp(path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Replaces fetch. The handler gets each request and returns the answer; a fresh Response is needed per call. */
export function mockFetch(handler: (request: Request) => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => handler(input as Request))
}

export function requestedUrls(fetchMock: ReturnType<typeof mockFetch>): string[] {
  return fetchMock.mock.calls.map(([input]) => (input as Request).url)
}
