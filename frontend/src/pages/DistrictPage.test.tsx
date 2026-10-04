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
  expect(sale).toHaveTextContent('Pozycja 2 z 4 (niższa wartość to lepsza pozycja)')
  expect(sale).toHaveTextContent('Liczba obserwacji: 42')
  expect(sale).toHaveTextContent('Zastrzeżenie: Test caveat from the API.')
  // The data kind, the date, the source, the method, the licence and the credit line sit in a collapsible detail.
  const more = within(sale).getByText('Rodzaj danych, data, źródło, metoda i licencja').closest('details') as HTMLElement
  expect(more).toHaveTextContent('Rodzaj danych')
  expect(more).toHaveTextContent('obserwowane')
  expect(more).toHaveTextContent('2026-09-30')
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
  expect(value).toHaveTextContent('szacowane')
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
  expect(score).toHaveTextContent('szacowane')
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
  expect(screen.getByText(/Pierwszy kwartał \(2025-01-01\): 100 test\. Ostatni kwartał \(do 2025-09-30\): 120 test\. Liczba kwartałów: 3\./)).toBeInTheDocument()
  expect(screen.getByText(/Puste, większe kółko oznacza kwartał o niskiej wiarygodności\./)).toBeInTheDocument()
  expect(screen.getByText(/Test series caveat from the API\./)).toBeInTheDocument()

  const table = screen.getByRole('table', { name: 'Wartości z wykresu, kwartał po kwartale' })
  const rows = within(table).getAllByRole('row')
  expect(rows).toHaveLength(4)
  expect(rows[2]).toHaveTextContent('2025-04-01 – 2025-06-30')
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
