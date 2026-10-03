import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { aiReportFixture, districtsApi, jsonResponse } from '../test/fixtures'
import { mockFetch, renderApp } from '../test/render'

const REPORT_PATH = '/v1/ai-report'

/** Answers the AI report from the city service with `answer`, and everything else from the data API fixtures. */
function withReport(answer: () => Response) {
  return mockFetch((request) => (new URL(request.url).pathname === REPORT_PATH ? answer() : districtsApi(request)))
}

function reportRequests(fetchMock: ReturnType<typeof mockFetch>): Request[] {
  return fetchMock.mock.calls.map(([input]) => input as Request).filter((request) => new URL(request.url).pathname === REPORT_PATH)
}

async function card() {
  return within((await screen.findByRole('heading', { level: 2, name: 'Podsumowanie dla Twoich potrzeb' })).closest('section') as HTMLElement)
}

function write(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Co jest dla Ciebie ważne?' }), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Napisz podsumowanie' }))
}

test('nothing is sent before the button, and the notice about the model provider is on the page first', async () => {
  const fetchMock = withReport(() => jsonResponse(aiReportFixture))
  renderApp('/find')
  const section = await card()

  expect(section.getByText(/zostanie wysłany do zewnętrznego dostawcy modelu językowego\. Nie zapisujemy go\./)).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Co jest dla Ciebie ważne?' })).toHaveAccessibleDescription(/zewnętrznego dostawcy/)
  await screen.findByRole('table')
  expect(reportRequests(fetchMock)).toHaveLength(0)
  expect(window.localStorage).toHaveLength(0)
})

test('the button sends the text to the city service with the language and no weights, and shows the answer as given', async () => {
  const fetchMock = withReport(() => jsonResponse(aiReportFixture))
  renderApp('/find')
  const section = await card()

  write('  TEST quiet and green  ')

  expect(section.getByText('Piszemy podsumowanie. To trwa kilka sekund…')).toHaveAttribute('role', 'status')
  // The AI label is the API's text.
  expect(await section.findByText('Test AI label from the API.')).toBeInTheDocument()
  expect(section.getByText('Podsumowanie jest gotowe.')).toHaveAttribute('role', 'status')
  const requests = reportRequests(fetchMock)
  expect(requests.map((request) => request.url)).toEqual(['http://city.test/v1/ai-report'])
  expect(await requests[0]?.clone().json()).toEqual({ requirements: 'TEST quiet and green', lang: 'pl' })
  // Plain text in paragraphs: markup in the text is shown as characters, never as HTML.
  expect(section.getByText('Test AI report first paragraph.')).toBeInTheDocument()
  expect(section.getByText('Test AI report <b>second</b> paragraph.')).toBeInTheDocument()
  expect(section.getByText('Model: test-model. Wygenerowano: 2026-10-01.')).toBeInTheDocument()
  // The three districts and their order are the API's.
  const items = section.getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toEqual(['Miejsce 1: Delta, wynik 80,5 (0–100)', 'Miejsce 2: Gamma, wynik 60 (0–100)', 'Miejsce 3: Beta, wynik 40 (0–100)'])
  expect(section.getByRole('link', { name: 'Delta' })).toHaveAttribute('href', '/districts/delta')
  expect(section.getByText('Test AI report note from the API.')).toBeInTheDocument()
  // The facts arrive in English for Polish (issue #38), so the Polish view leaves them out.
  expect(section.queryByText('Test fact one.')).not.toBeInTheDocument()
})

test('the report is asked for the ranking on screen: the weights that were applied', async () => {
  const fetchMock = withReport(() => jsonResponse(aiReportFixture))
  renderApp('/find')
  await card()
  fireEvent.click(await screen.findByRole('button', { name: 'Test persona one' }))
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż ranking' }))
  await screen.findByRole('table', { name: 'Ranking dla Twoich priorytetów' })

  write('TEST close to work')

  await screen.findByText('Test AI label from the API.')
  expect(await reportRequests(fetchMock)[0]?.clone().json()).toEqual({
    requirements: 'TEST close to work',
    lang: 'pl',
    weights: { category: { transport: 4, livability: 1, amenities: 1, environment: 1, cost: 5, safety: 0 } },
  })
})

test('the English view sends lang=en and lists the facts given to the model', async () => {
  const fetchMock = withReport(() => jsonResponse({ ...aiReportFixture, lang: 'en' }))
  renderApp('/find')
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  const heading = await screen.findByRole('heading', { level: 2, name: 'A summary for your needs' })
  fireEvent.change(screen.getByRole('textbox', { name: 'What matters to you?' }), { target: { value: 'TEST parks' } })
  fireEvent.click(screen.getByRole('button', { name: 'Write the summary' }))

  const section = within(heading.closest('section') as HTMLElement)
  expect(await section.findByRole('heading', { level: 3, name: 'Facts given to the model' })).toBeInTheDocument()
  expect(section.getByText('Test fact one.')).toBeInTheDocument()
  expect(section.getByText('Test fact two.')).toBeInTheDocument()
  expect(await reportRequests(fetchMock)[0]?.clone().json()).toEqual({ requirements: 'TEST parks', lang: 'en' })
})

test('a text that is too short is named in text and nothing is sent', async () => {
  const fetchMock = withReport(() => jsonResponse(aiReportFixture))
  renderApp('/find')
  const section = await card()

  write(' a ')

  expect(section.getByRole('alert')).toHaveTextContent('Opis jest za krótki. Wpisz co najmniej 3 znaki.')
  expect(screen.getByRole('textbox', { name: 'Co jest dla Ciebie ważne?' })).toHaveAttribute('aria-invalid', 'true')
  expect(reportRequests(fetchMock)).toHaveLength(0)
})

test.each([
  [502, {}, 'Nie udało się napisać podsumowania. Ranking na tej stronie działa bez zmian. Spróbuj ponownie.'],
  [503, {}, 'Podsumowania są chwilowo niedostępne. Ranking na tej stronie działa bez zmian.'],
  [429, { 'Retry-After': '30' }, 'Zbyt wiele podsumowań w krótkim czasie. Spróbuj ponownie za 30 s.'],
  [429, {}, 'Zbyt wiele podsumowań w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.'],
] as const)('a %i answer shows a message and the ranking keeps working', async (status, headers, message) => {
  const fetchMock = withReport(() => jsonResponse({ type: 'about:blank', title: 'Test problem', status }, status, headers))
  renderApp('/find')
  const section = await card()

  write('TEST quiet and green')

  await waitFor(() => expect(section.getByRole('alert')).toHaveTextContent(message))
  // One request, never retried: each report costs model budget.
  expect(reportRequests(fetchMock)).toHaveLength(1)
  expect(screen.getByRole('table', { name: 'Ranking domyślny: wskaźnik jakości życia' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż ranking' }))
  expect(await screen.findByRole('table', { name: 'Ranking dla Twoich priorytetów' })).toBeInTheDocument()
})

test.each(['pl', 'en'] as const)('the find page with a report has no automated accessibility violation in %s', async (language) => {
  withReport(() => jsonResponse({ ...aiReportFixture, lang: language }))
  const { container } = renderApp('/find')
  if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
  await screen.findByRole('table')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'TEST parks' } })
  fireEvent.click(screen.getByRole('button', { name: language === 'en' ? 'Write the summary' : 'Napisz podsumowanie' }))
  await screen.findByText('Test AI label from the API.')

  expect((await axe(container)).violations).toEqual([])
})
