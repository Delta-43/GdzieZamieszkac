import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi, feedbackReceiptFixture, feedbackStatusFixture, jsonResponse } from '../test/fixtures'
import { mockFetch, renderApp } from '../test/render'

type Handler = (request: Request) => Response | undefined

/** The data API from the fixtures, plus the city service. `post` answers POST /v1/feedback. */
function withService({ status, post }: { status?: Handler; post?: Handler } = {}) {
  return mockFetch((request) => {
    const { pathname } = new URL(request.url)
    if (pathname === '/v1/feedback/status') return status?.(request) ?? jsonResponse(feedbackStatusFixture)
    if (pathname === '/v1/feedback') return post?.(request) ?? jsonResponse(feedbackReceiptFixture, 201)
    return districtsApi(request)
  })
}

function posts(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls.map(([input]) => input as Request).filter((request) => request.method === 'POST')
}

/** The JSON body of the n-th POST. */
async function bodyOf(fetchMock: ReturnType<typeof mockFetch>, index = 0): Promise<unknown> {
  const request = posts(fetchMock)[index]
  if (!request) throw new Error('no POST was made')
  return request.clone().json()
}

const rentForm = () => screen.getByRole('region', { name: 'Czynsz, który płacisz' })
const problemForm = () => screen.getByRole('region', { name: 'Problem w danych' })

async function ready() {
  expect(await screen.findByText('Test notatka o zgłoszeniach.')).toBeInTheDocument()
  await waitFor(() => expect(within(rentForm()).getByRole('button', { name: 'Wyślij zgłoszenie' })).toBeEnabled())
  // The districts and the metrics fill the lists.
  await within(rentForm()).findByRole('option', { name: 'Alpha' })
  await within(problemForm()).findByRole('option', { name: 'Test sale label' })
}

test('the note of the service is shown first, and nothing can be sent until it has loaded', async () => {
  // The status never answers, so the page stays in its first state.
  const fetchMock = mockFetch((request) => districtsApi(request))
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request
    return new URL(request.url).pathname === '/v1/feedback/status' ? new Promise<Response>(() => undefined) : districtsApi(request)
  })
  renderApp('/feedback')
  expect(await screen.findByRole('heading', { level: 1, name: 'Zgłoszenia od mieszkańców' })).toBeInTheDocument()
  expect(within(rentForm()).getByRole('button', { name: 'Wyślij zgłoszenie' })).toBeDisabled()
  expect(within(problemForm()).getByRole('button', { name: 'Wyślij zgłoszenie' })).toBeDisabled()
  expect(posts(fetchMock)).toHaveLength(0)
})

test('the note and the identity line are shown, in the language on screen', async () => {
  withService()
  renderApp('/feedback')
  await ready()
  expect(screen.getByText(/Dziś nie pytamy o tożsamość/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  expect(await screen.findByText('Test note about reports.')).toBeInTheDocument()
  expect(document.title).toBe('Share feedback – GdzieZamieszkać')
})

test('wrong rent fields are named in text, tied to their fields, focus moves to the first, and nothing is sent', async () => {
  const fetchMock = withService()
  renderApp('/feedback')
  await ready()
  fireEvent.change(within(rentForm()).getByLabelText('Miesięczny czynsz (zł)'), { target: { value: '5' } })
  fireEvent.click(within(rentForm()).getByRole('button', { name: 'Wyślij zgłoszenie' }))

  const district = within(rentForm()).getByLabelText('Dzielnica')
  expect(district).toHaveFocus()
  expect(district).toHaveAccessibleDescription('Wybierz dzielnicę.')
  expect(within(rentForm()).getByLabelText('Miesięczny czynsz (zł)')).toHaveAccessibleDescription(/Wpisz liczbę całkowitą od 100 do 50000/)
  expect(within(rentForm()).getByLabelText('Wielkość mieszkania')).toBeInvalid()
  expect(within(rentForm()).getByLabelText('Miesiąc, za który zapłacono')).toBeInvalid()
  expect(posts(fetchMock)).toHaveLength(0)
})

test('a rent report is sent with the contract fields, and the answer says unverified and not published', async () => {
  const fetchMock = withService()
  renderApp('/feedback')
  await ready()
  const form = within(rentForm())
  fireEvent.change(form.getByLabelText('Dzielnica'), { target: { value: 'alpha' } })
  fireEvent.change(form.getByLabelText('Miesięczny czynsz (zł)'), { target: { value: '2800' } })
  fireEvent.change(form.getByLabelText('Wielkość mieszkania'), { target: { value: '31_50' } })
  fireEvent.change(form.getByLabelText('Miesiąc, za który zapłacono'), { target: { value: '2026-09' } })
  fireEvent.click(form.getByRole('button', { name: 'Wyślij zgłoszenie' }))

  expect(await form.findByText('Zgłoszenie zostało wysłane.')).toBeInTheDocument()
  expect(form.getByText('Test notatka po wysłaniu.')).toBeInTheDocument()
  expect(posts(fetchMock)).toHaveLength(1)
  expect(await bodyOf(fetchMock)).toEqual({ type: 'rent_paid', district: 'alpha', rent_pln: 2800, size_band: '31_50', month: '2026-09' })
  // The form is empty again, and nothing about the report is kept in the browser.
  expect(form.getByLabelText('Miesięczny czynsz (zł)')).toHaveValue('')
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toMatch(/2800|alpha|rent/)
})

test('a data problem lists only figures that have data, checks the message length, and is sent with the contract fields', async () => {
  const fetchMock = withService()
  renderApp('/feedback')
  await ready()
  const form = within(problemForm())
  expect(form.queryByRole('option', { name: 'Test gap label' })).not.toBeInTheDocument()

  fireEvent.change(form.getByLabelText('Dzielnica'), { target: { value: 'beta' } })
  fireEvent.change(form.getByLabelText('Liczba'), { target: { value: 'test_sale' } })
  fireEvent.change(form.getByLabelText('Co jest nie tak?'), { target: { value: 'za krótko' } })
  fireEvent.click(form.getByRole('button', { name: 'Wyślij zgłoszenie' }))
  expect(form.getByLabelText('Co jest nie tak?')).toHaveFocus()
  expect(form.getByLabelText('Co jest nie tak?')).toHaveAccessibleDescription(/Napisz od 10 do 500 znaków/)
  expect(posts(fetchMock)).toHaveLength(0)

  fireEvent.change(form.getByLabelText('Co jest nie tak?'), { target: { value: '  TEST: ta cena wygląda na za wysoką.  ' } })
  fireEvent.click(form.getByRole('button', { name: 'Wyślij zgłoszenie' }))
  expect(await form.findByText('Zgłoszenie zostało wysłane.')).toBeInTheDocument()
  expect(await bodyOf(fetchMock)).toEqual({ type: 'data_problem', district: 'beta', metric_key: 'test_sale', message: 'TEST: ta cena wygląda na za wysoką.' })
})

test.each([
  [413, undefined, 'Zgłoszenie jest za duże'],
  [422, undefined, 'Zgłoszenie nie zostało przyjęte'],
  [429, '7', 'Spróbuj za 7 s'],
  [429, undefined, 'Poczekaj chwilę'],
  [503, undefined, 'nie mogą teraz być przyjęte'],
  [500, undefined, 'Sprawdź połączenie z internetem'],
])('a %i answer gets a message in text and the page keeps working', async (status, retryAfter, message) => {
  withService({
    post: () => jsonResponse({ type: 'about:blank', title: 'Test error', status }, status, retryAfter ? { 'Retry-After': retryAfter, 'Content-Type': 'application/problem+json' } : { 'Content-Type': 'application/problem+json' }),
  })
  renderApp('/feedback')
  await ready()
  const form = within(problemForm())
  fireEvent.change(form.getByLabelText('Dzielnica'), { target: { value: 'beta' } })
  fireEvent.change(form.getByLabelText('Liczba'), { target: { value: 'test_sale' } })
  fireEvent.change(form.getByLabelText('Co jest nie tak?'), { target: { value: 'TEST: ta cena wygląda źle.' } })
  fireEvent.click(form.getByRole('button', { name: 'Wyślij zgłoszenie' }))
  expect(await form.findByRole('alert')).toHaveTextContent(message)
  // Nothing was reset, so the person can correct the text and send again.
  expect(form.getByLabelText('Co jest nie tak?')).toHaveValue('TEST: ta cena wygląda źle.')
  expect(form.getByRole('button', { name: 'Wyślij zgłoszenie' })).toBeEnabled()
})

test('when the status cannot be read the page says so, offers a retry, and sends nothing', async () => {
  const fetchMock = withService({ status: () => jsonResponse({ type: 'about:blank', title: 'Down', status: 503 }, 503) })
  renderApp('/feedback')
  expect(await screen.findByRole('alert')).toHaveTextContent('Serwis z danymi jest chwilowo niedostępny')
  expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument()
  expect(within(rentForm()).getByRole('button', { name: 'Wyślij zgłoszenie' })).toBeDisabled()
  expect(posts(fetchMock)).toHaveLength(0)
})

test.each(['pl', 'en'] as const)('the feedback page has no automated accessibility violation in %s, with errors shown', async (language) => {
  withService()
  const { container } = renderApp('/feedback')
  if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
  await screen.findByText(language === 'pl' ? 'Test notatka o zgłoszeniach.' : 'Test note about reports.')
  const buttons = screen.getAllByRole('button', { name: language === 'pl' ? 'Wyślij zgłoszenie' : 'Send the report' })
  await waitFor(() => expect(buttons[0]).toBeEnabled())
  buttons.forEach((button) => fireEvent.click(button))
  expect(document.documentElement.lang).toBe(language)
  expect((await axe(container)).violations).toEqual([])
})
