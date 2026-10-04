import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
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

test('while the values are loading, districts say so and are not shown as "no data"', async () => {
  let release: (response: Response) => void = () => {}
  const pending = new Promise<Response>((resolve) => {
    release = resolve
  })
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request
    return new URL(request.url).pathname === '/v1/metrics/test_sale/values' ? pending : districtsApi(request)
  })
  renderApp(PAGE)

  const map = await screen.findByRole('group', { name: 'Mapa dzielnic. Miara: Test sale label' })
  expect(within(map).getByRole('button', { name: 'Alpha: wczytywanie danych' })).toHaveClass('map-district--loading')
  expect(within(map).queryByRole('button', { name: /brak danych/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Pole kreskowane: brak danych')).not.toBeInTheDocument()

  release(districtsApi(new Request('http://api.test/v1/metrics/test_sale/values')))

  expect(await within(map).findByRole('button', { name: 'Alpha: 100 test, przedział 1 z 5' })).toBeInTheDocument()
  // Now the gap is real: Delta has no value, and only now is it called "no data".
  expect(within(map).getByRole('button', { name: 'Delta: brak danych' })).toHaveClass('map-district--none')
})

test('the list is short: each district with its overall score and the value shown on the map', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  const table = await screen.findByRole('table')
  const rowOf = (name: string) => within(table).getByRole('rowheader', { name: new RegExp(`^${name}`) }).closest('tr') as HTMLElement
  await within(table).findByText('100 test', { selector: 'td:nth-child(3)' })
  // The list is under the map, with its own heading, and no district is chosen yet: no details on the page.
  expect(screen.getByRole('heading', { level: 2, name: 'Lista dzielnic' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Szczegóły wybranej dzielnicy' })).not.toBeInTheDocument()
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Dzielnica', 'Wynik ogólny (0–100) szacowane', 'Test sale label'])
  const alpha = rowOf('Alpha')
  // The score has no display string yet: shown as sent, with a decimal comma in Polish.
  expect(alpha).toHaveTextContent('61,5')
  expect(alpha).toHaveTextContent('100 test')
  expect(alpha).toHaveTextContent('obserwowane')
  // The data kind badge is a shape and a word: the shape is an SVG hidden from screen readers.
  expect(alpha.querySelector('.data-kind svg[aria-hidden="true"]')).not.toBeNull()
  // A district without a value, or without a score, says so. It never shows a zero.
  expect(rowOf('Delta')).toHaveTextContent('brak danych')
  expect(rowOf('Gamma')).toHaveTextContent('brak danych')
})

test('with the overall score on the map the list has one value column, the map prints no names, and it is coloured as a score', async () => {
  mockFetch(districtsApi)
  const { container } = renderApp('/districts')

  const table = await screen.findByRole('table', { name: 'Dzielnice: wynik ogólny' })
  expect(within(table).getAllByRole('columnheader')).toHaveLength(2)
  // The names are in each district's button and card, not printed on the map.
  expect(container.querySelectorAll('.map-label')).toHaveLength(0)
  // The overall score is a score, where higher is better: the red to green palette. A single measure keeps the blue one.
  expect(container.querySelector('svg.district-map')).toHaveClass('district-map--score')
  fireEvent.change(screen.getByRole('combobox', { name: 'Inna miara' }), { target: { value: 'test_sale' } })
  await waitFor(() => expect(container.querySelector('svg.district-map')).toHaveClass('district-map--measure'))
})

test('the legend and the provenance say what the colours mean, in words', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  // The key of the map is one line: the words at its two ends, and the pattern for "no data".
  expect(await screen.findByText('niższa wartość')).toBeInTheDocument()
  expect(screen.getByText('wyższa wartość')).toBeInTheDocument()
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

  expect(screen.getByRole('button', { name: 'Beta: 200 test, przedział 2 z 5' })).toHaveAttribute('aria-pressed', 'true')
  const panel = screen.getByRole('region', { name: 'Szczegóły wybranej dzielnicy' })
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

  // The list marks the chosen district in words too.
  const header = screen.getByRole('rowheader', { name: /^Beta/ })
  expect(header).toHaveTextContent('Beta (wybrana)')
  expect(header.closest('tr')).toHaveAttribute('aria-current', 'true')

  // Closing the details takes them off the page and leaves no district chosen.
  fireEvent.click(within(panel).getByRole('button', { name: 'Zamknij szczegóły' }))

  expect(screen.queryByRole('region', { name: 'Szczegóły wybranej dzielnicy' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Beta: 200 test, przedział 2 z 5' })).toHaveAttribute('aria-pressed', 'false')
})

test('a district under the pointer or the keyboard focus shows a card with its name, value, class and prices; Escape puts it away', async () => {
  mockFetch(districtsApi)
  const { container } = renderApp(PAGE)
  const beta = await screen.findByRole('button', { name: 'Beta: 200 test, przedział 2 z 5' })
  const card = () => container.querySelector('.map-tip')
  expect(card()).toBeNull()

  fireEvent.pointerEnter(beta, { pointerType: 'mouse' })

  expect(card()).toHaveTextContent('Beta')
  expect(card()).toHaveTextContent('200 test')
  expect(card()).toHaveTextContent('Test sale label')
  expect(card()).toHaveTextContent('Przedział 2: 200 test')
  // The card repeats what the button's name already says, so assistive technology does not get it twice.
  expect(card()).toHaveAttribute('aria-hidden', 'true')
  // The pointer does not choose the district: no details open.
  expect(screen.queryByRole('region', { name: 'Szczegóły wybranej dzielnicy' })).not.toBeInTheDocument()

  fireEvent.pointerLeave(beta)
  await waitFor(() => expect(card()).toBeNull())

  // The keyboard gets the same card, and Escape puts it away without moving the focus.
  fireEvent.focus(beta)
  expect(card()).toHaveTextContent('Beta')
  fireEvent.keyDown(beta, { key: 'Escape' })
  expect(card()).toBeNull()
})

test('a district can be chosen from the list, and a district without a report shows no report', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  fireEvent.click(await screen.findByRole('button', { name: 'Alpha' }))

  const panel = screen.getByRole('region', { name: 'Szczegóły wybranej dzielnicy' })
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
