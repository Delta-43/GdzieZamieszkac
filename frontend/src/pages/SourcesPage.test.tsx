import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi, jsonResponse, metaFixture } from '../test/fixtures'
import { mockFetch, renderApp } from '../test/render'

const section = (name: string) => screen.getByRole('region', { name })

test('every source from the API is listed with its credit line, licence, date and the figures it gives, and a listings site is not linked', async () => {
  mockFetch(districtsApi)
  renderApp('/sources')
  expect(await screen.findByRole('heading', { level: 1, name: 'Źródła i jak to działa' })).toBeInTheDocument()
  expect(document.title).toBe('Źródła i jak to działa – GdzieZamieszkać')

  const sources = section('Źródła')
  expect(await within(sources).findByText('Test source A')).toBeInTheDocument()
  expect(within(sources).getAllByRole('listitem')).toHaveLength(3)
  // The credit line links to the first address the API gives.
  expect(within(sources).getByRole('link', { name: /Test credit line A/ })).toHaveAttribute('href', 'https://example.org/source-a')
  expect(within(sources).getByText(/Licencja: Test licence · Stan danych na: 2026-09-30/)).toBeInTheDocument()
  // The figures of a source are named with their labels from the catalogue.
  expect(within(sources).getByText(/Liczby z tego źródła: Test sale label/)).toBeInTheDocument()
  // A source without an address is shown as text, and a listings site is named but not linked.
  expect(within(sources).getByText(/Podpis: Test credit line B/)).toBeInTheDocument()
  expect(within(sources).queryByRole('link', { name: /Test listings credit/ })).not.toBeInTheDocument()
  expect(within(sources).getByText(/Test listings credit/)).toBeInTheDocument()
})

test('the gaps list gives the reason of the API, and no figure with data appears in it', async () => {
  mockFetch(districtsApi)
  renderApp('/sources')
  const gaps = section('Luki w danych')
  expect(await within(gaps).findByText('Test gap label')).toBeInTheDocument()
  expect(gaps).toHaveTextContent('Test reason for the gap.')
  expect(within(gaps).queryByText('Test sale label')).not.toBeInTheDocument()
})

test('the explanation says the score is computed in code, where the model is and is not used, and what the portal does not do', async () => {
  mockFetch(districtsApi)
  renderApp('/sources')
  expect(await screen.findByText(/Wynik liczy kod programu/)).toBeInTheDocument()
  expect(section('Gdzie używamy sztucznej inteligencji')).toHaveTextContent('Wyniku i rankingu nigdy nie liczy model.')
  expect(section('Czego ten portal nie robi')).toHaveTextContent('To nie jest serwis z ogłoszeniami.')
  // The score note is the API's own text, shown as given.
  expect(await screen.findByText('Test score note.')).toBeInTheDocument()
  // The draft statement says what is not yet checked.
  expect(section('Deklaracja dostępności (projekt)')).toHaveTextContent('Pełnego sprawdzenia czytnikiem ekranu')
})

test('the page is in the menu and in English when the toggle is used', async () => {
  mockFetch(districtsApi)
  renderApp('/sources')
  fireEvent.click(await screen.findByRole('button', { name: 'English' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Sources and how it works' })).toBeInTheDocument()
  expect(section('Where artificial intelligence is used')).toHaveTextContent('never computed by a model')
  expect(screen.getAllByRole('link', { name: 'Sources and how it works' }).length).toBeGreaterThan(0)
})

test('a failing /meta shows an error with a retry and keeps the explanation', async () => {
  mockFetch((request) => (new URL(request.url).pathname === '/v1/meta' ? jsonResponse({ ...metaFixture, title: 'x', status: 503 }, 503) : districtsApi(request)))
  renderApp('/sources')
  expect(await within(section('Źródła')).findByRole('alert')).toBeInTheDocument()
  expect(screen.getByText(/Wynik liczy kod programu/)).toBeInTheDocument()
})

test.each(['pl', 'en'] as const)('the sources page has no automated accessibility violation in %s', async (language) => {
  mockFetch(districtsApi)
  const { container } = renderApp('/sources')
  if (language === 'en') fireEvent.click(await screen.findByRole('button', { name: 'English' }))
  await screen.findByText('Test source A')
  expect(document.documentElement.lang).toBe(language)
  expect((await axe(container)).violations).toEqual([])
})
