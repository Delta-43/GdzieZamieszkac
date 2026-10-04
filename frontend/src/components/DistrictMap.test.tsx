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

test('the zoom buttons come before the map, name what they do, and are limited at the ends', async () => {
  serve()
  renderApp('/districts')
  const controls = await screen.findByRole('group', { name: 'Przybliżanie i przesuwanie mapy' })
  // First in the tab order: before the districts of the map.
  expect(controls.compareDocumentPosition(svg()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // At the whole-city view there is nothing to zoom out to or to move.
  for (const name of ['Oddal', 'Przesuń mapę w lewo', 'Przesuń mapę w prawo', 'Przesuń mapę w górę', 'Przesuń mapę w dół', 'Całe miasto']) {
    expect(within(controls).getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true')
  }
  expect(within(controls).getByRole('button', { name: 'Przybliż' })).not.toHaveAttribute('aria-disabled')
})

test('a control that reaches its limit keeps the keyboard focus', async () => {
  serve()
  renderApp('/districts')
  const controls = await screen.findByRole('group', { name: 'Przybliżanie i przesuwanie mapy' })
  fireEvent.click(within(controls).getByRole('button', { name: 'Przybliż' }))
  const out = within(controls).getByRole('button', { name: 'Oddal' })
  await waitFor(() => expect(out).not.toHaveAttribute('aria-disabled'))

  out.focus()
  fireEvent.click(out)

  // Back at the whole city there is nothing to zoom out to. The button says so and is still the focused element.
  await waitFor(() => expect(out).toHaveAttribute('aria-disabled', 'true'))
  expect(out).toHaveFocus()
  expect(out).not.toBeDisabled()
})

test('zooming in narrows the view, moving shifts it, and "whole city" brings it back, with each step said politely', async () => {
  serve()
  renderApp('/districts')
  const controls = await screen.findByRole('group', { name: 'Przybliżanie i przesuwanie mapy' })
  const whole = viewBox()
  const width = (box: string | null) => Number(box?.split(' ')[2])

  fireEvent.click(within(controls).getByRole('button', { name: 'Przybliż' }))
  await waitFor(() => expect(width(viewBox())).toBeLessThan(width(whole) * 0.7))
  expect(await screen.findByText(/Powiększenie 1,6 razy|Powiększenie 1.6 razy/)).toBeInTheDocument()
  const zoomed = viewBox()
  expect(within(controls).getByRole('button', { name: 'Przesuń mapę w prawo' })).not.toHaveAttribute('aria-disabled')

  fireEvent.click(within(controls).getByRole('button', { name: 'Przesuń mapę w prawo' }))
  await waitFor(() => expect(viewBox()).not.toBe(zoomed))

  fireEvent.click(within(controls).getByRole('button', { name: 'Całe miasto' }))
  await waitFor(() => expect(viewBox()).toBe(whole))
  expect(screen.getByText('Widać całe miasto.')).toBeInTheDocument()
})

test('?district= selects that district, opens its details and zooms the map to it', async () => {
  serve()
  renderApp('/districts?district=delta')
  expect(await screen.findByText('Przybliżono do dzielnicy: Delta.')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Szczegóły' })).toHaveAttribute('aria-selected', 'true')
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
  const controls = screen.getByRole('group', { name: 'Przybliżanie i przesuwanie mapy' })
  fireEvent.click(within(controls).getByRole('button', { name: 'Przybliż' }))
  fireEvent.click(within(controls).getByRole('button', { name: 'Przybliż' }))
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
