import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi, jsonResponse, problemFixture } from '../test/fixtures'
import { mockFetch, renderApp } from '../test/render'

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

test('the list tab holds everything the map shows, with labels from the catalogue', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  const table = await screen.findByRole('table')
  const rowOf = (name: string) => within(table).getByRole('rowheader', { name: new RegExp(`^${name}`) }).closest('tr') as HTMLElement
  await within(table).findByText('100 test', { selector: 'td:nth-child(2)' })
  expect(screen.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true')
  for (const header of ['Dzielnica', 'Test sale label', 'Pozycja', 'Przedział na mapie', 'Wskaźnik jakości życia (0–100)', 'Powierzchnia (km²)', 'Test rent label']) {
    expect(within(table).getAllByRole('columnheader', { name: header }).length).toBeGreaterThan(0)
  }
  const alpha = rowOf('Alpha')
  // The score and the area have no display string yet: shown as sent, with a decimal comma in Polish.
  expect(alpha).toHaveTextContent('61,5')
  expect(alpha).toHaveTextContent('10,5')
  expect(alpha).toHaveTextContent('100 test')
  expect(alpha).toHaveTextContent('obserwowane')
  expect(alpha).toHaveTextContent('Pozycja 1 z 3')
  expect(rowOf('Delta')).toHaveTextContent('brak danych')
  expect(rowOf('Gamma')).toHaveTextContent('brak danych')
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
  expect(screen.getByText('Test score note from the API.')).toBeInTheDocument()
})

test('choosing a district with the keyboard opens its details: value, rank, category profile and the labelled AI report', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  fireEvent.keyDown(await screen.findByRole('button', { name: 'Beta: 200 test, przedział 2 z 5' }), { key: 'Enter' })

  expect(screen.getByRole('tab', { name: 'Szczegóły' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('button', { name: /^Beta/ })).toHaveAttribute('aria-pressed', 'true')
  const panel = screen.getByRole('tabpanel', { name: 'Szczegóły' })
  expect(within(panel).getByRole('heading', { level: 3, name: 'Beta' })).toBeInTheDocument()
  expect(within(panel).getByText(/niższa wartość to lepsza pozycja/)).toBeInTheDocument()
  // The profile: one row per scored category, with the label the API sends and the score as sent.
  const profile = await within(panel).findByRole('table')
  expect(within(profile).getAllByRole('rowheader')).toHaveLength(6)
  expect(await within(profile).findAllByText('40')).toHaveLength(6)
  expect(within(profile).getByRole('rowheader', { name: 'Test cost label' })).toBeInTheDocument()
  // The area report carries the AI label and is split into paragraphs.
  expect(await within(panel).findByText('Raport napisany przez sztuczną inteligencję na podstawie danych.')).toBeInTheDocument()
  expect(within(panel).getByText('Test report first paragraph.')).toBeInTheDocument()
  expect(within(panel).getByText('Test report second paragraph.')).toBeInTheDocument()

  fireEvent.click(within(panel).getByRole('button', { name: 'Wróć do listy' }))

  const header = screen.getByRole('rowheader', { name: /^Beta/ })
  expect(header).toHaveTextContent('Beta (wybrana)')
  expect(header.closest('tr')).toHaveAttribute('aria-current', 'true')
})

test('a district can be chosen from the list, and a district without a report shows no report', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  fireEvent.click(await screen.findByRole('button', { name: 'Alpha' }))

  const panel = screen.getByRole('tabpanel', { name: 'Szczegóły' })
  expect(within(panel).getByRole('heading', { level: 3, name: 'Alpha' })).toBeInTheDocument()
  await within(panel).findAllByText('0')
  await waitFor(() => expect(within(panel).queryByText('Wczytywanie danych…')).not.toBeInTheDocument())
  expect(within(panel).queryByText(/sztuczną inteligencję/)).not.toBeInTheDocument()
})

test('a category button colours the map with the score of that category alone, asked from /recommend', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp('/districts')

  fireEvent.click(await screen.findByRole('button', { name: 'Test cost label' }))

  expect(await screen.findByRole('button', { name: 'Delta: 80,5, przedział 4 z 5' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Test cost label' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('heading', { level: 2, name: 'Wynik kategorii: Test cost label (0–100)' })).toBeInTheDocument()
  expect(screen.getByText('Test recommend note from the API.')).toBeInTheDocument()
  const post = fetchMock.mock.calls.map(([input]) => input as Request).find((request) => request.method === 'POST')
  expect(post?.url).toBe('http://api.test/v1/recommend?lang=pl')
  expect(await post?.clone().json()).toEqual({
    weights: { category: { demographics: 0, transport: 0, livability: 0, amenities: 0, environment: 0, cost: 1, safety: 0 } },
  })
})

test('the tabs follow the keyboard pattern: arrow keys move between them', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  const list = await screen.findByRole('tab', { name: 'Lista' })
  expect(list).toHaveAttribute('tabindex', '0')
  fireEvent.keyDown(list, { key: 'ArrowRight' })

  const details = screen.getByRole('tab', { name: 'Szczegóły' })
  expect(details).toHaveAttribute('aria-selected', 'true')
  expect(details).toHaveFocus()
  expect(screen.getByText('Wybierz dzielnicę na mapie albo na liście, aby zobaczyć jej szczegóły.')).toBeInTheDocument()
})

test('a measure without data shows the API reason, a hatched map and no request for values', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp(PAGE)

  fireEvent.change(await screen.findByLabelText('Inna miara'), { target: { value: 'test_gap' } })

  expect(await screen.findByText(/Brak danych dla tej miary\. Test reason for the gap\./)).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Test gap label (brak danych)' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /: brak danych$/ })).toHaveLength(4)
  const urls = fetchMock.mock.calls.map(([input]) => (input as Request).url)
  expect(urls.some((url) => url.includes('/metrics/test_gap/values'))).toBe(false)
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

  expect(await screen.findByRole('heading', { level: 1, name: 'Dzielnice na mapie i na liście' })).toBeInTheDocument()
})

test.each(['pl', 'en'] as const)('the districts page has no automated accessibility violation in %s, with the list and with the details open', async (language) => {
  mockFetch(districtsApi)
  const { container } = renderApp(PAGE)
  if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
  await screen.findByRole('table')
  await screen.findByRole('button', { name: /^Beta: 200 test/ })
  expect(document.documentElement.lang).toBe(language)
  expect((await axe(container)).violations).toEqual([])

  fireEvent.click(screen.getByRole('button', { name: /^Beta: 200 test/ }))
  await screen.findByText('Test report first paragraph.')
  expect((await axe(container)).violations).toEqual([])
})
