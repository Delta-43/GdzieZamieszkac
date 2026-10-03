import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi, jsonResponse, problemFixture } from '../test/fixtures'
import { mockFetch, renderApp, requestedUrls } from '../test/render'

const PAGE = '/districts?metric=test_sale'

test('the map gives every district a keyboard-reachable button whose name holds the value and the class', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  const map = await screen.findByRole('group', { name: 'Mapa dzielnic. Miara: Test sale label' })
  expect(await within(map).findByRole('button', { name: 'Alpha: 100 test, przedział 1 z 5' })).toBeInTheDocument()
  const buttons = within(map).getAllByRole('button')
  expect(buttons).toHaveLength(4)
  buttons.forEach((button) => expect(button).toHaveAttribute('tabindex', '0'))
  expect(within(map).getByRole('button', { name: 'Gamma: 300 test, przedział 4 z 5' })).toBeInTheDocument()
  // A district without a value says so. It never shows a zero.
  expect(within(map).getByRole('button', { name: 'Delta: brak danych' })).toBeInTheDocument()
})

test('the table holds everything the map shows, with labels from the catalogue and the API score note', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  const table = await screen.findByRole('table')
  const rowOf = (name: string) => within(table).getByRole('rowheader', { name: new RegExp(`^${name}`) }).closest('tr') as HTMLElement
  await within(table).findByText('100 test', { selector: 'td:nth-child(6)' })
  expect(screen.getByText('Test score note from the API.')).toBeInTheDocument()
  for (const header of ['Dzielnica', 'Wskaźnik jakości życia (0–100)', 'Powierzchnia (km²)', 'Test sale label', 'Test rent label', 'Pozycja', 'Przedział na mapie']) {
    expect(within(table).getAllByRole('columnheader', { name: header }).length).toBeGreaterThan(0)
  }
  const alpha = rowOf('Alpha')
  // The score and the area have no display string yet: shown as sent, with a decimal comma in Polish.
  expect(alpha).toHaveTextContent('61,5')
  expect(alpha).toHaveTextContent('10,5')
  expect(alpha).toHaveTextContent('100 test')
  expect(alpha).toHaveTextContent('obserwowane')
  expect(alpha).toHaveTextContent('Pozycja 1 z 3')
  const delta = rowOf('Delta')
  expect(delta).toHaveTextContent('brak danych')
  expect(delta).not.toHaveTextContent(/\b0\b/)
  const gamma = rowOf('Gamma')
  expect(gamma).toHaveTextContent('brak danych')
})

test('the legend and the provenance say what the colours mean, in words', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  expect(await screen.findByText('Przedział 1: 100 test')).toBeInTheDocument()
  expect(screen.getByText('Ciemniejszy kolor i wyższy numer oznaczają wyższą wartość.')).toBeInTheDocument()
  expect(screen.getByText('Pole kreskowane: brak danych')).toBeInTheDocument()
  expect(screen.getByText('Test source A')).toBeInTheDocument()
  expect(screen.getByText('2026-09-30')).toBeInTheDocument()
  expect(screen.getByText('test unit')).toBeInTheDocument()
})

test('choosing a district with the keyboard shows its value and rank and marks its table row', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)
  expect(await screen.findByText('Wybierz dzielnicę na mapie, aby zobaczyć jej wartość.')).toBeInTheDocument()

  const beta = await screen.findByRole('button', { name: 'Beta: 200 test, przedział 2 z 5' })
  fireEvent.keyDown(beta, { key: 'Enter' })

  expect(screen.getByRole('button', { name: /^Beta/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('heading', { level: 3, name: 'Beta' })).toBeInTheDocument()
  expect(screen.getByText(/niższa wartość to lepsza pozycja/)).toBeInTheDocument()
  const header = screen.getByRole('rowheader', { name: /^Beta/ })
  expect(header).toHaveTextContent('Beta (wybrana)')
  expect(header.closest('tr')).toHaveAttribute('aria-current', 'true')
})

test('a measure without data shows the API reason, a hatched map and no request for values', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp(PAGE)

  fireEvent.change(await screen.findByLabelText('Miara pokazana na mapie'), { target: { value: 'test_gap' } })

  expect(await screen.findByText(/Brak danych dla tej miary\. Test reason for the gap\./)).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Test gap label (brak danych)' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /: brak danych$/ })).toHaveLength(4)
  expect(requestedUrls(fetchMock).some((url) => url.includes('/metrics/test_gap/values'))).toBe(false)
})

test('an API error shows the error message with a retry button', async () => {
  mockFetch((request) => (new URL(request.url).pathname === '/v1/districts' ? jsonResponse(problemFixture, 503) : districtsApi(request)))
  renderApp(PAGE)

  const alerts = await screen.findAllByRole('alert')
  expect(alerts[0]).toHaveTextContent('Serwis z danymi jest chwilowo niedostępny.')
  expect(screen.getAllByRole('button', { name: 'Spróbuj ponownie' }).length).toBeGreaterThan(0)
})

test('the home page links to the districts page', async () => {
  mockFetch(districtsApi)
  renderApp('/')

  fireEvent.click(await screen.findByRole('link', { name: 'Zobacz dzielnice' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Dzielnice na mapie i w tabeli' })).toBeInTheDocument()
})

test.each(['pl', 'en'] as const)('the districts page has no automated accessibility violation in %s', async (language) => {
  mockFetch(districtsApi)
  const { container } = renderApp(PAGE)
  if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
  await screen.findByRole('table')
  fireEvent.click(await screen.findByRole('button', { name: /^Alpha: 100 test/ }))

  expect(document.documentElement.lang).toBe(language)
  expect((await axe(container)).violations).toEqual([])
})
