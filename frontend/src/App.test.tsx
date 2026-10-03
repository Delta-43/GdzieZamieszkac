import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi, jsonResponse, metaFixture, problemFixture } from './test/fixtures'
import { mockFetch, renderApp, requestedUrls } from './test/render'

test('starts in Polish, with the skip link as the first focusable element', async () => {
  mockFetch(() => jsonResponse(metaFixture))

  renderApp()

  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Porównaj dzielnice')
  expect(document.documentElement.lang).toBe('pl')
  expect(document.title).toBe('Strona główna – GdzieZamieszkać')
  const firstFocusable = document.querySelector('a[href], button')
  expect(firstFocusable).toHaveTextContent('Przejdź do treści głównej')
  expect(firstFocusable).toHaveAttribute('href', '#main')
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
})

test('the toggle switches the text, the page language, the stored choice and the API language', async () => {
  const fetchMock = mockFetch(() => jsonResponse(metaFixture))
  renderApp()
  await screen.findByText('Test credit line B')
  // Every page asks for /meta (header, footer) and /districts (menu, footer), both in the chosen language.
  expect(requestedUrls(fetchMock).sort()).toEqual(['http://api.test/v1/districts?lang=pl', 'http://api.test/v1/meta?lang=pl'])

  fireEvent.click(screen.getByRole('button', { name: 'English' }))

  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Compare the districts')
  expect(document.documentElement.lang).toBe('en')
  expect(document.title).toBe('Home – GdzieZamieszkać')
  expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Polski' })).toHaveAttribute('aria-pressed', 'false')
  expect(window.localStorage.getItem('lang')).toBe('en')
  // The language choice is the only thing stored in the browser.
  expect(window.localStorage.length).toBe(1)
  await waitFor(() => expect(requestedUrls(fetchMock)).toContain('http://api.test/v1/meta?lang=en'))
})

test('shows the city name and each credit line from /meta once', async () => {
  mockFetch(() => jsonResponse(metaFixture))

  renderApp()

  expect(await screen.findByText('Miasto: Testowo')).toBeInTheDocument()
  expect(screen.getAllByText('Test credit line A')).toHaveLength(1)
  expect(screen.getByText('Test credit line B')).toBeInTheDocument()
})

test('shows the stale notice when the API sends X-Data-Warning, and keeps it after an answer without the header', async () => {
  let calls = 0
  mockFetch((request) => {
    if (new URL(request.url).pathname !== '/v1/meta') return jsonResponse(metaFixture)
    calls += 1
    return jsonResponse(metaFixture, 200, calls === 1 ? { 'X-Data-Warning': 'stale-data; see /v1/meta' } : {})
  })

  renderApp()

  expect(await screen.findByText(/Część danych może być nieaktualna/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  await waitFor(() => expect(calls).toBe(2))
  expect(await screen.findByText(/Some data may be out of date/)).toBeInTheDocument()
})

test('shows the stale notice with the API reasons when /meta says the data is stale', async () => {
  mockFetch(() => jsonResponse({ ...metaFixture, stale: { is_stale: true, reasons: ['Test stale reason.'] } }))

  renderApp()

  expect(await screen.findByText(/Część danych może być nieaktualna/)).toBeInTheDocument()
  expect(screen.getByText('Test stale reason.')).toBeInTheDocument()
})

test('shows no stale notice when nothing reports stale data', async () => {
  mockFetch(() => jsonResponse(metaFixture))

  renderApp()

  await screen.findByText('Test credit line B')
  expect(screen.queryByText(/Część danych może być nieaktualna/)).not.toBeInTheDocument()
})

test('an API error shows what to do next and a retry button that loads the data', async () => {
  let fail = true
  mockFetch(() => (fail ? jsonResponse(problemFixture, 503) : jsonResponse(metaFixture)))
  renderApp()

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Serwis z danymi jest chwilowo niedostępny. Spróbuj ponownie za chwilę.')

  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))

  expect(await screen.findByText('Test credit line B')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an unknown address shows the not-found page, and going back moves focus to the main region', async () => {
  mockFetch(() => jsonResponse(metaFixture))
  renderApp('/no-such-page')

  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Nie znaleziono strony')
  expect(document.title).toBe('Nie znaleziono strony – GdzieZamieszkać')

  fireEvent.click(screen.getByRole('link', { name: 'Wróć na stronę główną' }))

  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Porównaj dzielnice')
  expect(screen.getByRole('main')).toHaveFocus()
})

test.each(['pl', 'en'] as const)('the home and not-found pages have no automated accessibility violation in %s', async (language) => {
  mockFetch(() => jsonResponse({ ...metaFixture, stale: { is_stale: true, reasons: ['Test stale reason.'] } }))

  for (const path of ['/', '/no-such-page']) {
    const { container, unmount } = renderApp(path)
    if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
    await screen.findByText('Test credit line B')
    expect(document.documentElement.lang).toBe(language)
    expect((await axe(container)).violations).toEqual([])
    unmount()
  }
})

test('the menu opens from its button, takes the focus, makes the page inert, and closes with Escape', async () => {
  mockFetch(districtsApi)
  renderApp()
  const button = await screen.findByRole('button', { name: 'Menu' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  // Closed, the menu is hidden from assistive software and cannot be reached.
  expect(screen.queryByRole('navigation', { name: 'Nawigacja główna' })).not.toBeInTheDocument()

  fireEvent.click(button)

  const menu = screen.getByRole('navigation', { name: 'Nawigacja główna' })
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(within(menu).getByRole('button', { name: 'Zamknij' })).toHaveFocus()
  expect(document.querySelector('main')?.closest('[inert]')).not.toBeNull()
  expect(within(menu).getByRole('link', { name: 'Strona główna' })).toHaveAttribute('aria-current', 'page')
  expect(within(menu).getByRole('link', { name: 'Dzielnice na mapie' })).toHaveAttribute('href', '/districts')
  expect(await within(menu).findByText('Testowo')).toBeInTheDocument()

  fireEvent.keyDown(document, { key: 'Escape' })

  expect(screen.queryByRole('navigation', { name: 'Nawigacja główna' })).not.toBeInTheDocument()
  expect(button).toHaveFocus()
  expect(document.querySelector('main')?.closest('[inert]')).toBeNull()
})

test('the menu search filters the districts without diacritics, and Enter opens the first match', async () => {
  mockFetch(districtsApi)
  renderApp()
  fireEvent.click(await screen.findByRole('button', { name: 'Menu' }))
  const menu = screen.getByRole('navigation', { name: 'Nawigacja główna' })
  expect(await within(menu).findByRole('link', { name: 'Alpha' })).toBeInTheDocument()
  expect(within(menu).getByRole('link', { name: 'Delta' })).toBeInTheDocument()

  const search = within(menu).getByLabelText('Znajdź')
  fireEvent.change(search, { target: { value: 'zzz' } })
  expect(within(menu).getByText('Nie ma dzielnicy o takiej nazwie.')).toBeInTheDocument()

  fireEvent.change(search, { target: { value: 'ÁLP' } })
  expect(within(menu).getByRole('link', { name: 'Alpha' })).toBeInTheDocument()
  expect(within(menu).queryByRole('link', { name: 'Delta' })).not.toBeInTheDocument()

  fireEvent.submit(search.closest('form') as HTMLFormElement)

  // Navigation closes the menu and moves the focus to the new page.
  expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Nawigacja główna' })).not.toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveFocus()
})

test('the footer lists the pages, every district and every credit line', async () => {
  mockFetch(districtsApi)
  renderApp()

  const footer = await screen.findByRole('contentinfo')
  expect(within(footer).getByText('Poznaj dzielnice, zanim zaczniesz szukać mieszkania.')).toBeInTheDocument()
  expect(within(footer).getByRole('navigation', { name: 'Nawigacja w stopce' })).toBeInTheDocument()
  const districts = await within(footer).findByRole('navigation', { name: 'Dzielnice' })
  expect(within(districts).getAllByRole('link')).toHaveLength(4)
  expect(within(districts).getByRole('link', { name: 'Gamma' })).toHaveAttribute('href', '/districts/gamma')
  expect(within(footer).getByRole('heading', { name: 'Źródła danych' })).toBeInTheDocument()
  expect(within(footer).getByText('Test credit line A')).toBeInTheDocument()
})
