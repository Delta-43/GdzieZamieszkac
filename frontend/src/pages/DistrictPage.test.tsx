import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi, jsonResponse, reportFixture } from '../test/fixtures'
import { mockFetch, renderApp } from '../test/render'

const PAGE = '/districts/alpha'

function rowOf(label: string): HTMLElement {
  return screen.getByText(label, { selector: 'dt' }).closest('.metric') as HTMLElement
}

test('every metric shows its value as given, with rank, sample size and caveat; its data kind, date and source are one press away', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument()
  expect(document.title).toBe('Alpha – GdzieZamieszkać')
  const sale = rowOf('Test sale label')
  expect(sale).toHaveTextContent('100 test')
  expect(sale).toHaveTextContent('Miejsce 2 z 4 (1 = najlepsze). Im mniej, tym lepiej.')
  expect(sale).toHaveTextContent('Liczba obserwacji: 42')
  expect(sale).toHaveTextContent('Zastrzeżenie: Test caveat from the API.')
  // One collapsible detail, "What does this mean?": the description from the catalogue first, then the data kind with
  // one sentence on it, the date in words, the source, the method, the licence and the credit line.
  const more = within(sale).getByText('Co to znaczy?').closest('details') as HTMLElement
  expect(within(sale).getAllByText('Co to znaczy?')).toHaveLength(1)
  expect(more).toHaveTextContent('Test sale label description from the API.')
  expect(more).toHaveTextContent('Zmierzone albo podane w oficjalnych danych.')
  expect(more).toHaveTextContent('Rodzaj danych')
  expect(more).toHaveTextContent('zmierzone')
  expect(within(more).getByText('30 września 2026')).toHaveAttribute('datetime', '2026-09-30')
  expect(more).toHaveTextContent('Test source A')
  expect(more).toHaveTextContent('Test method text.')
  expect(more).toHaveTextContent('Test licence text')
  expect(more).toHaveTextContent('Test credit line A')
  // A measured value carries no mark beside the number: the only badge of this row is the one in the detail.
  expect(sale.querySelectorAll('.data-kind')).toHaveLength(1)
  expect(more.querySelectorAll('.data-kind')).toHaveLength(1)
})

test('a value that is an estimate keeps its mark beside the number', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  await screen.findByRole('heading', { level: 1, name: 'Alpha' })
  // The yield is estimated: the reader sees that without opening anything.
  const row = rowOf('Test yield label')
  const value = row.querySelector('.metric__value') as HTMLElement
  expect(value).toHaveTextContent('5 test percent')
  expect(value).toHaveTextContent('oszacowane')
})

test('a metric without data shows its reason and no value', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  await screen.findByRole('heading', { level: 1, name: 'Alpha' })
  const gap = rowOf('Test gap label')
  expect(gap).toHaveClass('metric--missing')
  expect(gap).toHaveTextContent('Brak danych. Test reason for the gap.')
  expect(gap).not.toHaveTextContent(/\d/)
})

test('the page opens with the area, the score with its provenance and the API score note', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  await screen.findByRole('heading', { level: 1, name: 'Alpha' })
  // The area has no display string yet: shown as sent, with a decimal comma in Polish.
  expect(rowOf('Powierzchnia')).toHaveTextContent('10,5 km²')
  const score = rowOf('Test score label')
  expect(score).toHaveTextContent('61,5 test points')
  expect(score).toHaveTextContent('oszacowane')
  expect(screen.getByText('Test score note from the API.')).toBeInTheDocument()
  // The score is shown once, at the top, and not again inside its category.
  expect(screen.getAllByText('Test score label', { selector: 'dt' })).toHaveLength(1)
  // One section per category, with the label the API sends.
  expect(screen.getByRole('heading', { level: 2, name: 'Test cost label' })).toBeInTheDocument()
  expect(rowOf('Test yield label')).toHaveTextContent('5 test percent')
})

test('the area report carries the AI label, and a fallback note when the text is in English', async () => {
  mockFetch((request) =>
    new URL(request.url).pathname === '/v1/districts/alpha/report'
      ? jsonResponse({ ...reportFixture, district: 'alpha', lang: 'en', lang_fallback: true })
      : districtsApi(request),
  )
  renderApp(PAGE)

  expect(await screen.findByText('Raport napisany przez sztuczną inteligencję na podstawie danych.')).toBeInTheDocument()
  expect(screen.getByText('Ten tekst jest dostępny tylko po angielsku.')).toBeInTheDocument()
  const body = screen.getByText('Test report first paragraph.')
  expect(body.tagName).toBe('P')
  expect(body.parentElement).toHaveAttribute('lang', 'en')
  expect(screen.getByText('Test report second paragraph.')).toBeInTheDocument()
})

test('the price history has a summary in words, a table with every value and a marked low-confidence quarter', async () => {
  mockFetch(districtsApi)
  const { container } = renderApp(PAGE)

  expect(await screen.findByRole('heading', { level: 2, name: 'Historia: Test series label' })).toBeInTheDocument()
  expect(screen.getByText(/Pierwszy kwartał \(1 stycznia 2025\): 100 test\. Ostatni kwartał \(do 30 września 2025\): 120 test\. Liczba kwartałów: 3\./)).toBeInTheDocument()
  expect(screen.getByText(/Puste, większe kółko oznacza kwartał o niskiej wiarygodności\./)).toBeInTheDocument()
  expect(screen.getByText(/Test series caveat from the API\./)).toBeInTheDocument()

  const table = screen.getByRole('table', { name: 'Wartości z wykresu, kwartał po kwartale' })
  const rows = within(table).getAllByRole('row')
  expect(rows).toHaveLength(4)
  expect(rows[2]).toHaveTextContent('1 kwietnia 2025 – 30 czerwca 2025')
  expect(rows[2]).toHaveTextContent('80 test')
  expect(rows[2]).toHaveTextContent('7')
  expect(rows[2]).toHaveTextContent('niska')
  expect(rows[1]).toHaveTextContent('wystarczająca')

  // The chart: one marker per quarter, and the low-confidence one differs in shape.
  expect(container.querySelectorAll('.chart-marker')).toHaveLength(3)
  expect(container.querySelectorAll('.chart-marker--low')).toHaveLength(1)
  expect(container.querySelector('.price-chart svg')).toHaveAttribute('aria-hidden', 'true')
  // The gridline labels are the API's display strings of the lowest and the highest value.
  expect(container.querySelector('.price-chart svg')).toHaveTextContent('najwyższa: 120 test')
  expect(container.querySelector('.price-chart svg')).toHaveTextContent('najniższa: 80 test')
})

test('a district without history or report shows neither section', async () => {
  const notFound = () => jsonResponse({ type: 'about:blank', title: 'Not found', status: 404 }, 404)
  mockFetch((request) => {
    const { pathname } = new URL(request.url)
    return pathname.includes('/series/') || pathname.endsWith('/report') ? notFound() : districtsApi(request)
  })
  renderApp(PAGE)

  await screen.findByRole('heading', { level: 1, name: 'Alpha' })
  await waitFor(() => expect(screen.queryByText('Wczytywanie danych…')).not.toBeInTheDocument())
  expect(screen.queryByText(/sztuczną inteligencję/)).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /^Historia/ })).not.toBeInTheDocument()
  // The rest of the page is still there, and no error is shown for the two missing parts.
  expect(screen.getByRole('heading', { level: 2, name: 'Test cost label' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an unknown district shows a clear message and a link back', async () => {
  mockFetch(districtsApi)
  renderApp('/districts/nope')

  expect(await screen.findByRole('heading', { level: 1, name: 'Nie ma takiej dzielnicy' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Wróć do listy dzielnic' })).toHaveAttribute('href', '/districts')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('the details tab of the districts page links to the full profile', async () => {
  mockFetch(districtsApi)
  renderApp('/districts?metric=test_sale')

  fireEvent.click(await screen.findByRole('button', { name: 'Alpha' }))
  fireEvent.click(screen.getByRole('link', { name: 'Zobacz pełny profil dzielnicy' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveFocus()
})

test.each(['pl', 'en'] as const)('the district page has no automated accessibility violation in %s', async (language) => {
  mockFetch(districtsApi)
  const { container } = renderApp(PAGE)
  if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
  await screen.findByRole('heading', { level: 1, name: 'Alpha' })
  await screen.findByRole('table')

  expect(document.documentElement.lang).toBe(language)
  expect((await axe(container)).violations).toEqual([])
})

test('travel times are listed nearest first with the API caveat, and a missing connection is said in words', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  const section = (await screen.findByRole('heading', { level: 2, name: 'Dojazd komunikacją miejską z tej dzielnicy' })).closest('section') as HTMLElement
  const rows = within(within(section).getByRole('table')).getAllByRole('row')
  // The district itself is left out. The minutes are shown as sent, with a decimal comma in Polish. No connection is never a zero.
  expect(rows.slice(1).map((row) => row.textContent)).toEqual(['Delta12 min', 'Beta41,5 min', 'Gammanie znaleziono połączenia'])
  expect(within(section).getByRole('link', { name: 'Delta' })).toHaveAttribute('href', '/districts/delta')
  // The caveat is on the page without a press, with the data kind, the day of the timetable and the note on long trips.
  expect(section).toHaveTextContent('Zastrzeżenie: Test commute caveat from the API.')
  expect(section).toHaveTextContent('oszacowane')
  expect(within(section).getByText('7 października 2026')).toHaveAttribute('datetime', '2026-10-07')
  expect(section).toHaveTextContent('Czasy powyżej około 60 minut są zaniżone')
  expect(within(section).getByText('Co to znaczy?').closest('details')).toHaveTextContent('Test commute method.')
})

test('the travel times are hidden when the API answers 501, and the rest of the page stays', async () => {
  mockFetch((request) =>
    new URL(request.url).pathname === '/v1/commute' ? jsonResponse({ type: 'about:blank', title: 'Not implemented', status: 501 }, 501) : districtsApi(request),
  )
  renderApp(PAGE)

  expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument()
  await screen.findByText('Test sale label', { selector: 'dt' })
  expect(screen.queryByRole('heading', { level: 2, name: 'Dojazd komunikacją miejską z tej dzielnicy' })).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('the outlook is history: the change in the district, the city in the past, the reason for no forecast, and no future price', async () => {
  mockFetch(districtsApi)
  renderApp(PAGE)

  const section = (await screen.findByRole('heading', { level: 2, name: 'Jak zmieniały się ceny' })).closest('section') as HTMLElement
  // The API's caveat opens the section: this is the past, not a forecast.
  expect(within(section).getByText('Test outlook caveat: a record of the past, not a forecast.')).toBeInTheDocument()
  // The change as the API words it, with the two prices and dates it compares, the sample sizes and the low-confidence mark.
  const last = within(section).getByText('Ostatnie 12 miesięcy').closest('.metric') as HTMLElement
  expect(last).toHaveTextContent('+10 test% (niska wiarygodność)')
  expect(last).toHaveTextContent('od 1 kwietnia 2025 (100 test) do 1 kwietnia 2026 (110 test)')
  expect(last).toHaveTextContent('Liczba transakcji: 78 i 12')
  // A change without data says so in words, never a zero.
  expect(within(section).getByText('Od początku danych').closest('.metric')).toHaveTextContent('Za mało danych, aby pokazać zmianę.')
  // The city in the past, as the API words each figure.
  const city = within(section).getByRole('table', { name: 'Zmiana cen w mieście w przeszłych okresach tej długości' })
  expect(within(city).getAllByRole('row')[1]).toHaveTextContent('Test year+3 test%-5 test%+15 test%')
  expect(section).toHaveTextContent('Test city source')
  // No forecast: the API's reason, and the test behind it with its figures as sent.
  expect(within(section).getByRole('heading', { level: 3, name: 'Dlaczego nie ma prognozy' })).toBeInTheDocument()
  expect(section).toHaveTextContent('Test reason for no forecast.')
  const test = within(section).getByText('Jak sprawdzono metody prognozy').closest('details') as HTMLElement
  expect(test).toHaveTextContent('Test method name40,06190,07120,04150,686niezaliczony')
})

test('the outlook is hidden when the API answers 501', async () => {
  mockFetch((request) =>
    new URL(request.url).pathname.endsWith('/outlook') ? jsonResponse({ type: 'about:blank', title: 'Not implemented', status: 501 }, 501) : districtsApi(request),
  )
  renderApp(PAGE)

  expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  await screen.findByText('Test sale label', { selector: 'dt' })
  expect(screen.queryByRole('heading', { level: 2, name: 'Jak zmieniały się ceny' })).not.toBeInTheDocument()
})
