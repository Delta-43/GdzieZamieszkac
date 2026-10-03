import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { App } from './App'
import { jsonResponse, metaFixture } from './test/fixtures'

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

test('shows the city name and district count from /meta', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(metaFixture))

  const { container } = renderApp()

  expect(await screen.findByText(/Miasto: Testowo\. Liczba dzielnic: 4\./)).toBeInTheDocument()
  expect((await axe(container)).violations).toEqual([])
})

test('shows an alert when the API cannot be reached', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    jsonResponse({ type: 'about:blank', title: 'Data unavailable', status: 503 }, 503),
  )

  const { container } = renderApp()

  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się połączyć z API.')
  expect((await axe(container)).violations).toEqual([])
})
