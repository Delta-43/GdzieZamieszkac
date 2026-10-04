import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { districtsApi, jsonResponse } from '../test/fixtures'
import { mockFetch, renderApp } from '../test/render'

const BASEMAP = {
  attribution: '© Test map credit',
  roads: [
    {
      class: 'motorway',
      line: [
        [19.9, 50.0],
        [19.95, 50.05],
      ],
    },
  ],
  rail: [],
  rivers: [
    {
      line: [
        [19.9, 50.02],
        [19.95, 50.03],
      ],
    },
  ],
  lakes: [],
  places: [{ name: 'Test landmark', lon: 19.93, lat: 50.03 }],
}

/** The districts fixtures, plus the context layers file when `basemap` is given. */
function serve(basemap: unknown = null) {
  return mockFetch((request) => {
    if (new URL(request.url).pathname === '/basemap/testcity.json')
      return basemap ? jsonResponse(basemap) : jsonResponse({ type: 'about:blank', title: 'Not found', status: 404 }, 404)
    return districtsApi(request)
  })
}

const svg = () => screen.getByRole('group', { name: /^Mapa dzielnic\./ })
const viewBox = () => svg().getAttribute('viewBox')

test('the map has no buttons: a line under it says how the mouse and the keyboard move it', async () => {
  serve()
  renderApp('/districts')
  await within(await screen.findByRole('group', { name: /^Mapa dzielnic\./ })).findByRole('button', { name: /^Delta/ })

  expect(screen.queryByRole('button', { name: 'Przybliż' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Całe miasto' })).not.toBeInTheDocument()
  const hint = screen.getByText(/Mapę przybliża i oddala kółko myszy/)
  expect(hint).toHaveTextContent('klawisze + i − przybliżają i oddalają, strzałki przesuwają, a 0 pokazuje całe miasto')
  // The hint is tied to the map, so a screen reader reads it with the map.
  expect(svg()).toHaveAttribute('aria-describedby', hint.id)
})

test('the keyboard zooms and moves the map from a focused district, and each step is said politely', async () => {
  serve()
  renderApp('/districts')
  const delta = await within(await screen.findByRole('group', { name: /^Mapa dzielnic\./ })).findByRole('button', { name: /^Delta/ })
  const whole = viewBox()
  const width = (box: string | null) => Number(box?.split(' ')[2])
  delta.focus()

  // At the whole city the arrow keys are left to the page: nothing moves.
  fireEvent.keyDown(delta, { key: 'ArrowRight' })
  expect(viewBox()).toBe(whole)

  fireEvent.keyDown(delta, { key: '+' })
  await waitFor(() => expect(width(viewBox())).toBeLessThan(width(whole) * 0.7))
  expect(await screen.findByText(/Powiększenie 1,6 razy|Powiększenie 1.6 razy/)).toBeInTheDocument()
  const zoomed = viewBox()

  fireEvent.keyDown(delta, { key: 'ArrowRight' })
  await waitFor(() => expect(viewBox()).not.toBe(zoomed))
  // The focus stays where it was the whole time.
  expect(delta).toHaveFocus()

  fireEvent.keyDown(delta, { key: '-' })
  await waitFor(() => expect(viewBox()).toBe(whole))

  fireEvent.keyDown(delta, { key: '+' })
  await waitFor(() => expect(viewBox()).not.toBe(whole))
  fireEvent.keyDown(delta, { key: '0' })
  await waitFor(() => expect(viewBox()).toBe(whole))
  expect(screen.getByText('Widać całe miasto.')).toBeInTheDocument()
})

test('the wheel over the map zooms it; turned out at the whole city, it is left to the page', async () => {
  serve()
  renderApp('/districts')
  await within(await screen.findByRole('group', { name: /^Mapa dzielnic\./ })).findByRole('button', { name: /^Delta/ })
  const whole = viewBox()
  const width = (box: string | null) => Number(box?.split(' ')[2])

  // Out at the whole city: the map does not take the wheel, so the page scrolls on.
  expect(fireEvent.wheel(svg(), { deltaY: 100 })).toBe(true)
  expect(viewBox()).toBe(whole)

  // In: the map zooms and keeps the wheel from the page.
  expect(fireEvent.wheel(svg(), { deltaY: -100 })).toBe(false)
  await waitFor(() => expect(width(viewBox())).toBeLessThan(width(whole)))
})

test('?district= selects that district, opens its details and zooms the map to it', async () => {
  serve()
  renderApp('/districts?district=delta')
  expect(await screen.findByText('Przybliżono do dzielnicy: Delta.')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Szczegóły wybranej dzielnicy' })).getByRole('heading', { level: 3, name: 'Delta' })).toBeInTheDocument()
  const map = within(svg())
  expect(map.getByRole('button', { name: /^Delta/ })).toHaveAttribute('aria-pressed', 'true')
})

test('with the context file the map draws it, names it only when zoomed in, and gives the credit in text; the file is asked for from the same server', async () => {
  const fetchMock = serve(BASEMAP)
  renderApp('/districts')
  expect(await screen.findByText('© Test map credit')).toBeInTheDocument()
  // The context is hidden from assistive technology and cannot take a click.
  const context = svg().querySelector('.map-context')
  expect(context).toHaveAttribute('aria-hidden', 'true')
  expect(context?.querySelectorAll('path').length).toBeGreaterThan(0)
  // A landmark name would crowd the whole-city view: it appears from the second zoom step.
  expect(screen.queryByText('Test landmark')).not.toBeInTheDocument()
  fireEvent.keyDown(svg(), { key: '+' })
  fireEvent.keyDown(svg(), { key: '+' })
  expect(await screen.findByText('Test landmark')).toBeInTheDocument()
  const asked = fetchMock.mock.calls.map(([input]) => new URL((input as Request).url))
  expect(asked.some((url) => url.pathname === '/basemap/testcity.json' && url.origin === window.location.origin)).toBe(true)
})

test('without the context file, or with a wrong one, the map still shows the districts and no credit', async () => {
  serve(null)
  const first = renderApp('/districts')
  await screen.findByRole('group', { name: /^Mapa dzielnic\./ })
  expect(within(svg()).getByRole('button', { name: /^Alpha/ })).toBeInTheDocument()
  expect(svg().querySelector('.map-context')).toBeNull()
  expect(screen.queryByText(/Test map credit/)).not.toBeInTheDocument()
  first.unmount()

  serve({ nonsense: true })
  renderApp('/districts')
  await screen.findByRole('group', { name: /^Mapa dzielnic\./ })
  expect(within(svg()).getByRole('button', { name: /^Alpha/ })).toBeInTheDocument()
  expect(svg().querySelector('.map-context')).toBeNull()
})
