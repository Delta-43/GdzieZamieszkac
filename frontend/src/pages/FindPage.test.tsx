import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { districtsApi, jsonResponse, recommendFixture } from '../test/fixtures'
import { mockFetch, renderApp } from '../test/render'

async function postBodies(fetchMock: ReturnType<typeof mockFetch>): Promise<unknown[]> {
  const posts = fetchMock.mock.calls.map(([input]) => input as Request).filter((request) => request.method === 'POST')
  return Promise.all(posts.map((request) => request.clone().json()))
}

test('with no weights the page asks for the default ranking and shows it with drivers, the API note and a live message', async () => {
  const fetchMock = mockFetch((request) =>
    new URL(request.url).pathname === '/v1/recommend'
      ? jsonResponse({
          ...recommendFixture,
          missing_metrics: ['test_gap'],
          ranking: recommendFixture.ranking.map((item) => ({ ...item, top_drivers: [{ key: 'test_sale', label: 'Test sale label', percentile: 76.5 }] })),
        })
      : districtsApi(request),
  )
  renderApp('/find')

  const table = await screen.findByRole('table', { name: 'Ranking domyślny: wynik ogólny' })
  // No weights are sent, so the API answers with the default livability score.
  expect(await postBodies(fetchMock)).toEqual([{}])
  const rows = within(table).getAllByRole('row')
  expect(rows).toHaveLength(5)
  expect(within(table).getByRole('columnheader', { name: 'Miejsce (1 = najlepsze)' })).toBeInTheDocument()
  expect(rows[1]).toHaveTextContent('1')
  expect(rows[1]).toHaveTextContent('Delta')
  // The score is a whole number with "pkt", never a decimal.
  expect(rows[1]).toHaveTextContent('81 pkt')
  expect(rows[1]).not.toHaveTextContent('80,5')
  // The position among the other districts, in words: 76.5 of 100 among 4 districts is 2 of the other 3.
  expect(rows[1]).toHaveTextContent('Test sale label: lepszy niż w 2 z 3 pozostałych dzielnic')
  expect(screen.getByRole('main')).not.toHaveTextContent(/percentyl/i)
  // What the score is and is not, with the city name from /meta, and how it is worked out, one press away.
  expect(screen.getByText('Wynik porównuje ze sobą dzielnice miasta Testowo. Nie ocenia, jak się tam żyje. Wysokie ceny mieszkań go obniżają.')).toBeInTheDocument()
  expect(screen.getByText('Jak to liczymy?').closest('details')).toHaveTextContent('Wynik to średnia z tych porównań')
  expect(within(table).getByRole('link', { name: 'Delta' })).toHaveAttribute('href', '/districts/delta')
  expect(screen.getByText('Test recommend note from the API.')).toBeInTheDocument()
  expect(screen.getByText('Liczba miar w wyniku: 2.')).toBeInTheDocument()
  // A measure without data is named, with its label from the catalogue, and the page says it is left out.
  expect(screen.getByText('Miary bez danych w tym mieście są pominięte w wyniku:')).toBeInTheDocument()
  expect(await screen.findByText('Test gap label')).toBeInTheDocument()
  expect(screen.getByText('Ranking domyślny, bez wag. Pierwsze miejsce: Delta.')).toHaveAttribute('role', 'status')
})

test('each slider has a visible label from the API, a text value and the range 0 to 5', async () => {
  mockFetch(districtsApi)
  renderApp('/find')

  const cost = await screen.findByRole('slider', { name: 'Test cost label' })
  expect(screen.getAllByRole('slider')).toHaveLength(6)
  expect(cost).toHaveAttribute('min', '0')
  expect(cost).toHaveAttribute('max', '5')
  // Every category starts as "important", which is 3.
  expect(cost).toHaveValue('3')
  expect(cost.parentElement).toHaveTextContent('3 z 5')
  // The sliders are the advanced way: they sit in a disclosure that starts closed.
  expect(cost.closest('details')).not.toHaveAttribute('open')
  expect(cost.closest('details')?.querySelector('summary')).toHaveTextContent('Zaawansowane')

  fireEvent.change(cost, { target: { value: '0' } })

  expect(cost.parentElement).toHaveTextContent('0 – kategoria pominięta')
  expect(cost).toHaveAttribute('aria-valuetext', '0 – kategoria pominięta')
})

test('each category has three choices in words, and they send the weights 0, 3 and 5', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp('/find')

  const cost = await screen.findByRole('group', { name: 'Test cost label' })
  expect(within(cost).getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual(['Nieważne', 'Ważne', 'Bardzo ważne'])
  expect(within(cost).getByRole('radio', { name: 'Ważne' })).toBeChecked()
  // A reviewed question says what the category is about. A category without one shows none.
  expect(within(cost).getByText('Ile to kosztuje?')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Test safety label' }).querySelector('.note')).toBeNull()

  fireEvent.click(within(cost).getByRole('radio', { name: 'Bardzo ważne' }))
  fireEvent.click(within(screen.getByRole('group', { name: 'Test safety label' })).getByRole('radio', { name: 'Nieważne' }))
  // The slider under "Advanced" holds the same value.
  expect(screen.getByRole('slider', { name: 'Test cost label' })).toHaveValue('5')
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż ranking' }))

  await screen.findByRole('table', { name: 'Ranking dla Twoich priorytetów' })
  expect(await postBodies(fetchMock)).toContainEqual({
    weights: { category: { transport: 3, livability: 3, amenities: 3, environment: 3, cost: 5, safety: 0 } },
  })
})

test('a preset fills the sliders, and "show the ranking" sends those weights and announces the result', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp('/find')

  fireEvent.click(await screen.findByRole('button', { name: 'Test persona one' }))

  expect(screen.getByRole('button', { name: 'Test persona one' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Test persona one description.')).toBeInTheDocument()
  expect(await screen.findByRole('slider', { name: 'Test cost label' })).toHaveValue('5')
  expect(screen.getByRole('slider', { name: 'Test transport label' })).toHaveValue('4')
  expect(screen.getByRole('slider', { name: 'Test safety label' })).toHaveValue('0')
  // A weight that is one of the three choices shows as that choice. Any other is said in words and is not rounded.
  expect(within(screen.getByRole('group', { name: 'Test cost label' })).getByRole('radio', { name: 'Bardzo ważne' })).toBeChecked()
  const transport = screen.getByRole('group', { name: 'Test transport label' })
  within(transport).getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked())
  expect(transport).toHaveTextContent('Waga 4 z 5. Dokładną wartość zmienisz w części Zaawansowane.')
  // A category the preset does not mention counts as 1.
  expect(screen.getByRole('slider', { name: 'Test environment label' })).toHaveValue('1')

  fireEvent.click(screen.getByRole('button', { name: 'Pokaż ranking' }))

  expect(await screen.findByText('Ranking gotowy. Pierwsze miejsce: Delta.')).toHaveAttribute('role', 'status')
  expect(screen.getByRole('table', { name: 'Ranking dla Twoich priorytetów' })).toBeInTheDocument()
  expect(await postBodies(fetchMock)).toContainEqual({
    weights: { category: { transport: 4, livability: 1, amenities: 1, environment: 1, cost: 5, safety: 0 } },
  })
})

test('moving a slider clears the chosen preset, and the reset button returns to the default ranking', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp('/find')
  fireEvent.click(await screen.findByRole('button', { name: 'Test persona two' }))
  fireEvent.change(await screen.findByRole('slider', { name: 'Test cost label' }), { target: { value: '4' } })
  expect(screen.getByRole('button', { name: 'Test persona two' })).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż ranking' }))
  await screen.findByRole('table', { name: 'Ranking dla Twoich priorytetów' })

  fireEvent.click(screen.getByRole('button', { name: 'Przywróć domyślne' }))

  expect(await screen.findByRole('table', { name: 'Ranking domyślny: wynik ogólny' })).toBeInTheDocument()
  expect(screen.getByRole('slider', { name: 'Test cost label' })).toHaveValue('3')
  // The default answer was cached, so no third request was made.
  expect(await postBodies(fetchMock)).toHaveLength(2)
})

test('when every category is zero the form says how to fix it and sends nothing', async () => {
  const fetchMock = mockFetch(districtsApi)
  renderApp('/find')
  await screen.findByRole('slider', { name: 'Test cost label' })
  screen.getAllByRole('slider').forEach((slider) => fireEvent.change(slider, { target: { value: '0' } }))

  fireEvent.click(screen.getByRole('button', { name: 'Pokaż ranking' }))

  expect(screen.getByRole('alert')).toHaveTextContent('Wszystkie kategorie są nieważne. Wybierz co najmniej jedną jako ważną.')
  await waitFor(async () => expect(await postBodies(fetchMock)).toEqual([{}]))
})

test('the menu and the home page link to the find page', async () => {
  mockFetch(districtsApi)
  renderApp('/')

  fireEvent.click(await within(screen.getByRole('main')).findByRole('link', { name: 'Znajdź dzielnicę' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Znajdź dzielnicę dla siebie' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  const menu = screen.getByRole('navigation', { name: 'Nawigacja główna' })
  expect(within(menu).getByRole('link', { name: 'Znajdź dzielnicę' })).toHaveAttribute('aria-current', 'page')
})

test.each(['pl', 'en'] as const)('the find page has no automated accessibility violation in %s', async (language) => {
  mockFetch(districtsApi)
  const { container } = renderApp('/find')
  if (language === 'en') fireEvent.click(screen.getByRole('button', { name: 'English' }))
  await screen.findByRole('table')
  await screen.findByRole('slider', { name: 'Test cost label' })

  expect(document.documentElement.lang).toBe(language)
  expect((await axe(container)).violations).toEqual([])
})
