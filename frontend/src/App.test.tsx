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

test('the menu button opens and closes the menu, moves the focus, and makes the page under it inert', async () => {
  mockFetch(districtsApi)
  renderApp()
  const button = await screen.findByRole('button', { name: 'Menu' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  // Closed, the menu is hidden from assistive software and cannot be reached.
  expect(screen.queryByRole('navigation', { name: 'Nawigacja główna' })).not.toBeInTheDocument()

  fireEvent.click(button)

  const menu = screen.getByRole('navigation', { name: 'Nawigacja główna' })
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(menu.parentElement).toHaveFocus()
  expect(document.querySelector('main')?.closest('[inert]')).not.toBeNull()
  // The header stays usable while the menu is open: the same button closes it.
  expect(button.closest('[inert]')).toBeNull()
  expect(within(menu).getByRole('link', { name: 'Strona główna' })).toHaveAttribute('aria-current', 'page')
  expect(within(menu).getByRole('link', { name: 'Dzielnice na mapie' })).toHaveAttribute('href', '/districts')
  // There is no search field in the menu.
  expect(within(menu).queryByRole('searchbox')).not.toBeInTheDocument()

  fireEvent.keyDown(document, { key: 'Escape' })

  expect(screen.queryByRole('navigation', { name: 'Nawigacja główna' })).not.toBeInTheDocument()
  expect(button).toHaveFocus()
  expect(document.querySelector('main')?.closest('[inert]')).toBeNull()

  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'false')
})

test('the menu lists every district, and choosing one opens its page and closes the menu', async () => {
  mockFetch(districtsApi)
  renderApp()
  fireEvent.click(await screen.findByRole('button', { name: 'Menu' }))
  const menu = screen.getByRole('navigation', { name: 'Nawigacja główna' })
  const districts = await within(menu).findByRole('list', { name: 'Dzielnice' })
  expect(within(districts).getAllByRole('link')).toHaveLength(4)

  fireEvent.click(within(districts).getByRole('link', { name: 'Alpha' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Nawigacja główna' })).not.toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveFocus()
})

test('the footer lists the pages and every credit line, each linked to where its data comes from', async () => {
  mockFetch(districtsApi)
  renderApp()

  const footer = await screen.findByRole('contentinfo')
  expect(within(footer).getByText('Poznaj dzielnice, zanim zaczniesz szukać mieszkania.')).toBeInTheDocument()
  expect(within(footer).getByRole('navigation', { name: 'Nawigacja w stopce' })).toBeInTheDocument()
  // The footer has no list of districts: only the sources.
  expect(within(footer).queryByRole('link', { name: 'Gamma' })).not.toBeInTheDocument()
  expect(within(footer).getByRole('heading', { name: 'Źródła danych' })).toBeInTheDocument()

  const first = await within(footer).findByRole('link', { name: /^Test credit line A\s*\(otwiera się w nowej karcie\)$/ })
  expect(first).toHaveAttribute('href', 'https://example.org/source-a')
  expect(first).toHaveAttribute('target', '_blank')
  expect(first).toHaveAttribute('rel', 'noopener noreferrer')
  // A second address of the same source follows as a numbered link.
  expect(within(footer).getByRole('link', { name: 'Test credit line A: adres 2 (otwiera się w nowej karcie)' })).toHaveAttribute('href', 'https://example.org/source-a2')
  // A source without an address, and a listings site, are named but not linked.
  expect(within(footer).getByText('Test credit line B')).toBeInTheDocument()
  expect(within(footer).queryByRole('link', { name: /Test credit line B/ })).not.toBeInTheDocument()
  expect(within(footer).getByText('Test listings credit')).toBeInTheDocument()
  expect(within(footer).queryByRole('link', { name: /Test listings credit/ })).not.toBeInTheDocument()
})

test.each(['pl', 'en'] as const)('the home page marks official notices as a concept and calls no endpoint for them in %s', async (language) => {
  const fetchMock = mockFetch(() => jsonResponse(metaFixture))
  renderApp('/')
  if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
  const section = (await screen.findByRole('heading', { level: 2, name: language === 'pl' ? /Oficjalne komunikaty miasta/ : /Official notices/ })).closest('section')!
  expect(section).toHaveTextContent(language === 'pl' ? 'Koncepcja' : 'Concept')
  expect(section).toHaveTextContent(language === 'pl' ? 'po zatwierdzeniu przez miasto' : 'after city approval')
  // Nothing is asked for notices, and nothing goes to the city service.
  const paths = fetchMock.mock.calls.map(([input]) => new URL((input as Request).url).pathname)
  expect(paths.some((path) => /notice/i.test(path) || path === '/v1/ai-report' || path.startsWith('/v1/feedback'))).toBe(false)
})
