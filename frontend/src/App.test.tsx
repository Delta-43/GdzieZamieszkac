import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi, jsonResponse, metaFixture, problemFixture } from './test/fixtures'
import { mockFetch, renderApp, requestedUrls } from './test/render'

/** Answers /meta with the given body and every other endpoint from the fixtures: the home page now draws the map too. */
const withMeta = (meta: unknown) => (request: Request) => (new URL(request.url).pathname === '/v1/meta' ? jsonResponse(meta) : districtsApi(request))

test('starts in Polish, with the skip link as the first focusable element', async () => {
  mockFetch(withMeta(metaFixture))

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
  const fetchMock = mockFetch(withMeta(metaFixture))
  renderApp()
  await screen.findByText('Test credit line B')
  // Every page asks for /meta (header, footer) and /districts (menu, footer, the map on the home page), in the chosen language.
  expect(requestedUrls(fetchMock).filter((url) => /\/v1\/(meta|districts)\?/.test(url)).sort()).toEqual(['http://api.test/v1/districts?lang=pl', 'http://api.test/v1/meta?lang=pl'])

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
  mockFetch(withMeta(metaFixture))

  renderApp()

  expect(await screen.findByText('Miasto: Testowo')).toBeInTheDocument()
  expect(screen.getAllByText('Test credit line A')).toHaveLength(1)
  expect(screen.getByText('Test credit line B')).toBeInTheDocument()
})

test('shows the stale notice when the API sends X-Data-Warning, and keeps it after an answer without the header', async () => {
  let calls = 0
  mockFetch((request) => {
    if (new URL(request.url).pathname !== '/v1/meta') return districtsApi(request)
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
  mockFetch(withMeta({ ...metaFixture, stale: { is_stale: true, reasons: ['Test stale reason.'] } }))

  renderApp()

  expect(await screen.findByText(/Część danych może być nieaktualna/)).toBeInTheDocument()
  expect(screen.getByText('Test stale reason.')).toBeInTheDocument()
})

test('shows no stale notice when nothing reports stale data', async () => {
  mockFetch(withMeta(metaFixture))

  renderApp()

  await screen.findByText('Test credit line B')
  expect(screen.queryByText(/Część danych może być nieaktualna/)).not.toBeInTheDocument()
})

test('an API error shows what to do next and a retry button that loads the data', async () => {
  let fail = true
  mockFetch((request) => (fail ? jsonResponse(problemFixture, 503) : withMeta(metaFixture)(request)))
  renderApp()

  // The footer and the map on the home page each say what went wrong and offer a retry.
  const alerts = await screen.findAllByRole('alert')
  alerts.forEach((alert) => expect(alert).toHaveTextContent('Serwis z danymi jest chwilowo niedostępny. Spróbuj ponownie za chwilę.'))

  fail = false
  screen.getAllByRole('button', { name: 'Spróbuj ponownie' }).forEach((button) => fireEvent.click(button))

  expect(await screen.findByText('Test credit line B')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an unknown address shows the not-found page, and going back moves focus to the main region', async () => {
  mockFetch(withMeta(metaFixture))
  renderApp('/no-such-page')

  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Nie znaleziono strony')
  expect(document.title).toBe('Nie znaleziono strony – GdzieZamieszkać')

  fireEvent.click(screen.getByRole('link', { name: 'Wróć na stronę główną' }))

  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Porównaj dzielnice')
  expect(screen.getByRole('main')).toHaveFocus()
})

test.each(['pl', 'en'] as const)('the home and not-found pages have no automated accessibility violation in %s', async (language) => {
  mockFetch(withMeta({ ...metaFixture, stale: { is_stale: true, reasons: ['Test stale reason.'] } }))

  for (const path of ['/', '/no-such-page']) {
    const { container, unmount } = renderApp(path)
    if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
    await screen.findByText('Test credit line B')
    expect(document.documentElement.lang).toBe(language)
    expect((await axe(container)).violations).toEqual([])
    unmount()
  }
})

test('the menu button opens a card of links under it, keeps the focus, and leaves the page in use', async () => {
  mockFetch(districtsApi)
  renderApp()
  const button = await screen.findByRole('button', { name: 'Menu' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  // Closed, the menu is hidden from assistive software and cannot be reached.
  expect(screen.queryByRole('navigation', { name: 'Nawigacja główna' })).not.toBeInTheDocument()

  button.focus()
  fireEvent.click(button)

  const menu = screen.getByRole('navigation', { name: 'Nawigacja główna' })
  expect(button).toHaveAttribute('aria-expanded', 'true')
  // A card under a button, not a dialog: the focus stays on the button, the menu comes next, and the page is not inert.
  expect(button).toHaveFocus()
  expect(button.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(document.querySelector('main')?.closest('[inert]')).toBeNull()
  expect(within(menu).getByRole('link', { name: 'Strona główna' })).toHaveAttribute('aria-current', 'page')
  expect(within(menu).getByRole('link', { name: 'Dzielnice na mapie' })).toHaveAttribute('href', '/districts')
  // There is no search field in the menu.
  expect(within(menu).queryByRole('searchbox')).not.toBeInTheDocument()

  // Escape from inside the menu closes it and gives the focus back to the button.
  within(menu).getByRole('link', { name: 'Dzielnice na mapie' }).focus()
  fireEvent.keyDown(document, { key: 'Escape' })

  expect(screen.queryByRole('navigation', { name: 'Nawigacja główna' })).not.toBeInTheDocument()
  expect(button).toHaveFocus()

  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'false')
})

test('a mouse over the menu button opens the menu, a click pins it, and a press outside closes it', async () => {
  mockFetch(districtsApi)
  renderApp()
  const button = await screen.findByRole('button', { name: 'Menu' })
  const wrap = button.parentElement as HTMLElement

  // A touch does not hover: only a mouse opens the menu by resting on it.
  fireEvent.pointerEnter(wrap, { pointerType: 'touch' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  fireEvent.pointerEnter(wrap, { pointerType: 'mouse' })
  expect(button).toHaveAttribute('aria-expanded', 'true')

  // The pointer leaves: the menu closes after a short wait.
  fireEvent.pointerLeave(wrap, { pointerType: 'mouse' })
  await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'))

  // Opened by the pointer and then clicked: it is pinned, and stays when the pointer leaves.
  fireEvent.pointerEnter(wrap, { pointerType: 'mouse' })
  fireEvent.click(button)
  fireEvent.pointerLeave(wrap, { pointerType: 'mouse' })
  await new Promise((resolve) => setTimeout(resolve, 400))
  expect(button).toHaveAttribute('aria-expanded', 'true')

  fireEvent.pointerDown(screen.getByRole('main'))
  expect(button).toHaveAttribute('aria-expanded', 'false')
})

test('the header holds the menu, the site name and the languages, and no second row of page links', async () => {
  mockFetch(districtsApi)
  renderApp('/find')

  const header = await screen.findByRole('banner')
  // Closed, the menu is the only way to the pages, and it is one press away.
  expect(within(header).queryByRole('navigation')).not.toBeInTheDocument()
  expect(within(header).getAllByRole('link').map((link) => link.textContent)).toEqual(['GdzieZamieszkać'])
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

test('the footer is small print: every credit line once, as plain text, with no links and no list of pages', async () => {
  mockFetch(districtsApi)
  renderApp()

  const footer = await screen.findByRole('contentinfo')
  expect(within(footer).getByRole('heading', { name: 'Źródła danych' })).toBeInTheDocument()
  // Each credit line of /meta appears once, as the API gives it.
  expect(await within(footer).findByText('Test credit line A')).toBeInTheDocument()
  expect(within(footer).getByText('Test credit line B')).toBeInTheDocument()
  expect(within(footer).getByText('Test listings credit')).toBeInTheDocument()
  expect(within(footer).getAllByRole('listitem')).toHaveLength(3)
  // The pages are in the menu, and the links to the sources are on the sources page: the footer has no link at all.
  expect(within(footer).queryByRole('navigation')).not.toBeInTheDocument()
  expect(within(footer).queryByRole('link')).not.toBeInTheDocument()
})

test.each(['pl', 'en'] as const)('the home page marks official notices as a concept and calls no endpoint for them in %s', async (language) => {
  const fetchMock = mockFetch(withMeta(metaFixture))
  renderApp('/')
  if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
  const section = (await screen.findByRole('heading', { level: 2, name: language === 'pl' ? /Oficjalne komunikaty miasta/ : /Official notices/ })).closest('section')!
  expect(section).toHaveTextContent(language === 'pl' ? 'Koncepcja' : 'Concept')
  expect(section).toHaveTextContent(language === 'pl' ? 'po zatwierdzeniu przez miasto' : 'after city approval')
  // Nothing is asked for notices, and nothing goes to the city service.
  const paths = fetchMock.mock.calls.map(([input]) => new URL((input as Request).url).pathname)
  expect(paths.some((path) => /notice/i.test(path) || path === '/v1/ai-report' || path.startsWith('/v1/feedback'))).toBe(false)
})
