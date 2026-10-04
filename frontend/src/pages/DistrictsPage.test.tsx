import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi, jsonResponse, metricValuesFixture, problemFixture } from '../test/fixtures'
import { mockFetch, renderApp } from '../test/render'

const PAGE = '/districts?metric=test_sale'

test('the map gives every district a keyboard-reachable button whose name holds the value and the place', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  const map = await screen.findByRole('group', { name: 'Mapa dzielnic. Miara: Test sale label' })
  expect(await within(map).findByRole('button', { name: 'Alpha: 100 test, miejsce 1 z 3' })).toBeInTheDocument()
  const buttons = within(map).getAllByRole('button')
  expect(buttons).toHaveLength(4)
  buttons.forEach((button) => expect(button).toHaveAttribute('tabindex', '0'))
  expect(within(map).getByRole('button', { name: 'Gamma: 300 test, miejsce 3 z 3' })).toBeInTheDocument()
  // A district without a value says so. It never shows a zero.
  expect(within(map).getByRole('button', { name: 'Delta: brak danych' })).toBeInTheDocument()
})

test('a measure the API does not rank says how large the value is in words, and never a class number', async () => {
  // A neutral measure (more is neither better nor worse) arrives without a rank.
  mockFetch((request) =>
    new URL(request.url).pathname === '/v1/metrics/test_sale/values'
      ? jsonResponse({ ...metricValuesFixture, higher_is: 'neutral', values: metricValuesFixture.values.map((value) => ({ ...value, rank: undefined })) })
      : districtsApi(request),
  )
  renderApp(PAGE)

  const map = await screen.findByRole('group', { name: 'Mapa dzielnic. Miara: Test sale label' })
  const alpha = await within(map).findByRole('button', { name: 'Alpha: 100 test, wartość bardzo niska' })
  expect(within(map).getByRole('button', { name: 'Gamma: 300 test, wartość wysoka' })).toBeInTheDocument()

  fireEvent.keyDown(alpha, { key: 'Enter' })

  const panel = screen.getByRole('region', { name: 'Szczegóły wybranej dzielnicy' })
  expect(within(panel).getByText('Na tle innych dzielnic').nextElementSibling).toHaveTextContent('wartość bardzo niska')
  expect(screen.getByRole('main')).not.toHaveTextContent(/przedział \d/i)
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

  expect(await within(map).findByRole('button', { name: 'Alpha: 100 test, miejsce 1 z 3' })).toBeInTheDocument()
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
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Dzielnica', 'Wynik ogólny (miejsce 1 = najlepsze) oszacowane', 'Test sale label'])
  const alpha = rowOf('Alpha')
  // The score is a whole number with "pkt": 61.5 from the API reads "62 pkt".
  expect(alpha).toHaveTextContent('62 pkt')
  expect(alpha).not.toHaveTextContent('61,5')
  expect(alpha).toHaveTextContent('100 test')
  expect(alpha).toHaveTextContent('zmierzone')
  // The data kind badge is a shape and a word: the shape is an SVG hidden from screen readers.
  expect(alpha.querySelector('.data-kind svg[aria-hidden="true"]')).not.toBeNull()
  // A district without a value, or without a score, says so. It never shows a zero.
  expect(rowOf('Delta')).toHaveTextContent('brak danych')
  expect(rowOf('Gamma')).toHaveTextContent('brak danych')
})

test('with the overall score on the map the list has one value column, and the map prints no names', async () => {
  mockFetch(districtsApi)
  const { container } = renderApp('/districts')

  const table = await screen.findByRole('table', { name: 'Dzielnice: wynik ogólny' })
  expect(within(table).getAllByRole('columnheader')).toHaveLength(2)
  // The names are in each district's button and card, not printed on the map.
  expect(container.querySelectorAll('.map-label')).toHaveLength(0)
})

test('typing in the search field narrows the list of measures, without regard to accents or capitals, and says how many match', async () => {
  mockFetch(districtsApi)
  renderApp('/districts')
  const select = await screen.findByRole('combobox', { name: 'Inna miara' })
  const all = within(select).getAllByRole('option').length
  expect(all).toBeGreaterThan(2)

  fireEvent.change(screen.getByRole('searchbox', { name: 'Szukaj miary' }), { target: { value: 'SALE' } })

  // The first option is the prompt; the rest are the measures that match.
  expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['— wybierz miarę —', 'Test sale label'])
  expect(screen.getByText('Pasujące miary: 1.')).toHaveAttribute('role', 'status')

  fireEvent.change(select, { target: { value: 'test_sale' } })
  expect(await screen.findByRole('heading', { level: 2, name: 'Test sale label' })).toBeInTheDocument()

  // A text that matches nothing says so, and the chosen measure stays in the list.
  fireEvent.change(screen.getByRole('searchbox', { name: 'Szukaj miary' }), { target: { value: 'zzz' } })
  expect(screen.getByText('Żadna miara nie pasuje. Zmień wpisany tekst.')).toBeInTheDocument()
  expect(select).toHaveValue('test_sale')
})

test('the legend and the provenance say what the colours mean, in words', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  // The key of the map is one line: the words at its two ends, and the pattern for "no data".
  expect(await screen.findByText('niższa wartość')).toBeInTheDocument()
  expect(screen.getByText('wyższa wartość')).toBeInTheDocument()
  expect(screen.getByText('Pole kreskowane: brak danych')).toBeInTheDocument()
  expect(screen.getByText('Test source A')).toBeInTheDocument()
  expect(screen.getByText('30 września 2026')).toHaveAttribute('datetime', '2026-09-30')
  // What darker means for this measure, and whether more is better, in words.
  expect(screen.getByText('Ciemniejszy kolor oznacza wyższą wartość: Test sale label. Dla tej miary wyższa wartość jest gorsza.')).toBeInTheDocument()
  expect(screen.getByText('test unit')).toBeInTheDocument()
  expect(screen.getByText('Test score note from the API.')).toBeInTheDocument()
})

test('choosing a district with the keyboard opens its details: value, rank, category profile and the labelled AI report', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  fireEvent.keyDown(await screen.findByRole('button', { name: 'Beta: 200 test, miejsce 2 z 3' }), { key: 'Enter' })

  expect(screen.getByRole('button', { name: 'Beta: 200 test, miejsce 2 z 3' })).toHaveAttribute('aria-pressed', 'true')
  const panel = screen.getByRole('region', { name: 'Szczegóły wybranej dzielnicy' })
  expect(within(panel).getByRole('heading', { level: 3, name: 'Beta' })).toBeInTheDocument()
  expect(within(panel).getByText('Miejsce 2 z 3 (1 = najlepsze). Im mniej, tym lepiej.')).toBeInTheDocument()
  // The profile: one row per scored category, with the label the API sends, the place and the score as a whole number.
  const profile = await within(panel).findByRole('table')
  expect(within(profile).getAllByRole('rowheader')).toHaveLength(6)
  expect(await within(profile).findAllByText('40 pkt')).toHaveLength(6)
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
  expect(screen.getByRole('button', { name: 'Beta: 200 test, miejsce 2 z 3' })).toHaveAttribute('aria-pressed', 'false')
})

test('a district under the pointer or the keyboard focus shows a card with its name, value, step in words and prices; Escape puts it away', async () => {
  mockFetch(districtsApi)
  const { container } = renderApp(PAGE)
  const beta = await screen.findByRole('button', { name: 'Beta: 200 test, miejsce 2 z 3' })
  const card = () => container.querySelector('.map-tip')
  expect(card()).toBeNull()

  fireEvent.pointerEnter(beta, { pointerType: 'mouse' })

  expect(card()).toHaveTextContent('Beta')
  expect(card()).toHaveTextContent('200 test')
  expect(card()).toHaveTextContent('Test sale label')
  expect(card()).toHaveTextContent('Wartość niska: 200 test')
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
  await within(panel).findAllByText('0 pkt')
  await waitFor(() => expect(within(panel).queryByText('Wczytywanie danych…')).not.toBeInTheDocument())
  expect(within(panel).queryByText(/sztuczną inteligencję/)).not.toBeInTheDocument()
})

test('a category button colours the map with the score of that category alone, asked from /recommend', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp('/districts')

  fireEvent.click(await screen.findByRole('button', { name: 'Test cost label' }))

  expect(await screen.findByRole('button', { name: 'Delta: 81 pkt, miejsce 1 z 4' })).toBeInTheDocument()
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
