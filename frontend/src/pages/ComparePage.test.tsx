import { act, fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi } from '../test/fixtures'
import { mockFetch, renderApp, requestedUrls } from '../test/render'

function compareRequests(fetchMock: ReturnType<typeof mockFetch>): string[] {
  return requestedUrls(fetchMock).filter((url) => new URL(url).pathname === '/v1/compare')
}

test('nothing is compared until two districts are ticked, and the page says how many are needed', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp('/compare')

  expect(await screen.findByRole('checkbox', { name: 'Alpha' })).not.toBeChecked()
  expect(screen.getAllByRole('checkbox')).toHaveLength(4)
  expect(screen.getByRole('group', { name: 'Wybierz dzielnice (od 2 do 4)' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha' }))

  expect(screen.getByText('Wybierz co najmniej 2 dzielnice, aby zobaczyć porównanie.')).toHaveAttribute('role', 'status')
  expect(screen.getByText('Wybrane dzielnice: 1 z 4.')).toBeInTheDocument()
  expect(compareRequests(fetchMock)).toHaveLength(0)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('two ticked districts are asked for in the order chosen and shown as tables with real headers', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp('/compare')
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Gamma' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha' }))

  expect(await screen.findByText('Porównanie gotowe: Gamma, Alpha.')).toHaveAttribute('role', 'status')
  expect(compareRequests(fetchMock)).toEqual(['http://api.test/v1/compare?codes=gamma%2Calpha&lang=pl'])
  // One table per category that has metrics, named by the API's category label.
  const cost = screen.getByRole('table', { name: 'Test cost label' })
  expect(within(cost).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Miara', 'Gamma', 'Alpha'])
  expect(within(cost).getByRole('link', { name: 'Gamma' })).toHaveAttribute('href', '/districts/gamma')
  const sale = within(cost).getByRole('rowheader', { name: /Test sale label/ })
  expect(sale).toHaveTextContent('Źródło: Test source A')
  // Each cell: the API's display string, the data kind in words and the date.
  const cells = within(sale.closest('tr') as HTMLElement).getAllByRole('cell')
  expect(cells.map((cell) => cell.textContent)).toEqual(['100 test zmierzoneStan na: 30 września 2026', '100 test zmierzoneStan na: 30 września 2026'])
  // A metric without data shows the API's reason, never a zero.
  const gap = within(cost).getByRole('rowheader', { name: 'Test gap label' })
  expect(within(gap.closest('tr') as HTMLElement).getAllByRole('cell')[0]).toHaveTextContent('Brak danych. Test reason for the gap.')
  expect(within(screen.getByRole('table', { name: 'Najem a cena zakupu' })).getAllByText('5 test percent')).toHaveLength(2)
  expect(screen.getByText('Test score note from the API.')).toBeInTheDocument()
  // The choice is kept in the address only.
  expect(window.localStorage).toHaveLength(0)
})

test('two ticks with no pause between them are both kept', async () => {
  mockFetch(districtsApi)
  renderApp('/compare')
  const alpha = await screen.findByRole('checkbox', { name: 'Alpha' })
  const gamma = screen.getByRole('checkbox', { name: 'Gamma' })

  // Both clicks arrive before the page has rendered the first one (issue #56).
  act(() => {
    alpha.click()
    gamma.click()
  })

  expect(await screen.findByText('Porównanie gotowe: Alpha, Gamma.')).toBeInTheDocument()
  expect(alpha).toBeChecked()
  expect(gamma).toBeChecked()
})

test('a district that lacks a value others have shows "no data" in its place', async () => {
  mockFetch(districtsApi)
  renderApp('/compare?codes=alpha,beta')

  const cost = within(await screen.findByRole('table', { name: 'Test cost label' }))
  const cells = within(cost.getByRole('rowheader', { name: /Test sale label/ }).closest('tr') as HTMLElement).getAllByRole('cell')
  expect(cells[0]).toHaveTextContent('100 test')
  expect(cells[1]).toHaveTextContent('Brak danych.')
  expect(screen.getByRole('checkbox', { name: 'Alpha' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Beta' })).toBeChecked()
})

test('with four districts chosen a fifth cannot be added, and the page says why', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp('/compare?codes=alpha,beta,gamma')
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Delta' }))

  expect(await screen.findByText('Porównanie gotowe: Alpha, Beta, Gamma, Delta.')).toBeInTheDocument()
  expect(screen.getByText('Wybrane dzielnice: 4 z 4. Aby dodać inną dzielnicę, najpierw odznacz jedną z wybranych.')).toBeInTheDocument()
  expect(compareRequests(fetchMock)).toHaveLength(2)

  fireEvent.click(screen.getByRole('button', { name: 'Wyczyść wybór' }))
  expect(screen.getByRole('checkbox', { name: 'Alpha' })).not.toBeChecked()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('an unknown district in the address gets a clear message and the list still works', async () => {
  mockFetch(districtsApi)
  renderApp('/compare?codes=alpha,nope')

  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się porównać tych dzielnic. Sprawdź adres strony albo wybierz dzielnice z listy.')
  fireEvent.click(screen.getByRole('button', { name: 'Wyczyść wybór' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('the tables mark no district as better: no rank and no verdict word', async () => {
  mockFetch(districtsApi)
  renderApp('/compare?codes=alpha,gamma')

  const main = screen.getByRole('main')
  await within(main).findAllByRole('table')
  expect(main).not.toHaveTextContent(/Pozycja|najleps|zwyci|bezpiecz/i)
})

test('the menu links to the compare page', async () => {
  mockFetch(districtsApi)
  renderApp('/compare')

  expect(await screen.findByRole('heading', { level: 1, name: 'Porównaj dzielnice' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  expect(within(screen.getByRole('navigation', { name: 'Nawigacja główna' })).getByRole('link', { name: 'Porównaj dzielnice' })).toHaveAttribute('aria-current', 'page')
})

test.each(['pl', 'en'] as const)('the compare page has no automated accessibility violation in %s', async (language) => {
  mockFetch(districtsApi)
  const { container } = renderApp('/compare?codes=alpha,beta')
  if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
  await screen.findAllByRole('table')
  await screen.findByRole('checkbox', { name: 'Alpha' })

  expect(document.documentElement.lang).toBe(language)
  expect((await axe(container)).violations).toEqual([])
})
