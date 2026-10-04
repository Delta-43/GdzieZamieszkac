import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { districtsApi, jsonResponse, metricValuesFixture } from '../test/fixtures'
import { mockFetch, renderApp } from '../test/render'

/** The districts fixtures, plus values for the overall score, which the home map is coloured by. */
const homeApi = (request: Request) =>
  new URL(request.url).pathname === '/v1/metrics/livability_score_default/values'
    ? jsonResponse({ ...metricValuesFixture, key: 'livability_score_default' })
    : districtsApi(request)

async function search() {
  mockFetch(homeApi)
  renderApp('/')
  return screen.findByRole('combobox', { name: 'Wpisz nazwę dzielnicy' })
}

test('the home page shows what the portal is, a search by district name, and the map with its legend', async () => {
  const field = await search()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Porównaj dzielnice')
  expect(field).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: 'Pokaż na mapie' })).toBeInTheDocument()
  // The map is the second main part of the page, with the measure in its heading and one button per district.
  const map = await screen.findByRole('group', { name: /Mapa dzielnic\. Miara: Test score label/ })
  expect(within(map).getAllByRole('button')).toHaveLength(4)
  // The key of the map: one line, from the lower score to the higher one.
  expect(await screen.findByText('niższy wynik')).toBeInTheDocument()
  expect(screen.getByText('wyższy wynik')).toBeInTheDocument()
})

test('typing shows the matching districts, the arrow keys move through them, and Enter opens the map on that district', async () => {
  const field = await search()
  fireEvent.change(field, { target: { value: 'ta' } }) // Beta and Delta
  expect(field).toHaveAttribute('aria-expanded', 'true')
  const list = screen.getByRole('listbox', { name: 'Dzielnice pasujące do wpisanego tekstu' })
  expect(
    within(list)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Beta', 'Delta'])
  expect(screen.getByText('Podpowiedzi: 2.')).toBeInTheDocument()

  fireEvent.keyDown(field, { key: 'ArrowDown' })
  const first = within(list).getByRole('option', { name: 'Beta' })
  expect(first).toHaveAttribute('aria-selected', 'true')
  expect(field).toHaveAttribute('aria-activedescendant', first.id)
  fireEvent.keyDown(field, { key: 'ArrowDown' })
  expect(within(list).getByRole('option', { name: 'Delta' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.keyDown(field, { key: 'ArrowUp' })
  expect(first).toHaveAttribute('aria-selected', 'true')

  fireEvent.submit(field.closest('form')!)
  // The map page opens with Beta chosen: its details show, and the map says it zoomed to it.
  expect(await screen.findByRole('heading', { level: 1, name: /Dzielnice na mapie/ })).toBeInTheDocument()
  expect(await screen.findByText('Przybliżono do dzielnicy: Beta.')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Szczegóły wybranej dzielnicy' })).getByRole('heading', { level: 3, name: 'Beta' })).toBeInTheDocument()
})

test('a single match is chosen with Enter, and accents and capitals do not matter', async () => {
  const field = await search()
  fireEvent.change(field, { target: { value: 'ALPH' } })
  fireEvent.submit(field.closest('form')!)
  expect(await screen.findByText('Przybliżono do dzielnicy: Alpha.')).toBeInTheDocument()
})

test('with several matches and no arrow key, Enter shows the suggestions instead of guessing', async () => {
  const field = await search()
  fireEvent.change(field, { target: { value: 'a' } })
  fireEvent.submit(field.closest('form')!)
  expect(await screen.findByRole('listbox')).toBeVisible()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Porównaj dzielnice')
})

test('a name that matches nothing says so in text and marks the field, and Escape closes the suggestions', async () => {
  const field = await search()
  fireEvent.change(field, { target: { value: 'zzz' } })
  fireEvent.submit(field.closest('form')!)
  expect(await screen.findByText(/Nie ma dzielnicy o takiej nazwie/)).toBeInTheDocument()
  expect(field).toBeInvalid()
  expect(field).toHaveAccessibleDescription(/Nie ma dzielnicy o takiej nazwie/)

  fireEvent.change(field, { target: { value: 'be' } })
  expect(field).toHaveAttribute('aria-expanded', 'true')
  fireEvent.keyDown(field, { key: 'Escape' })
  expect(field).toHaveAttribute('aria-expanded', 'false')
})

test('choosing a suggestion with the mouse opens the map on that district', async () => {
  const field = await search()
  fireEvent.change(field, { target: { value: 'gam' } })
  fireEvent.click(screen.getByRole('option', { name: 'Gamma' }))
  expect(await screen.findByText('Przybliżono do dzielnicy: Gamma.')).toBeInTheDocument()
})

test('a district on the home map opens the map page on that district', async () => {
  await search()
  const map = await screen.findByRole('group', { name: /Mapa dzielnic/ })
  fireEvent.click(await within(map).findByRole('button', { name: /^Delta/ }))
  expect(await screen.findByText('Przybliżono do dzielnicy: Delta.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('region', { name: 'Szczegóły wybranej dzielnicy' })).toBeInTheDocument())
})
