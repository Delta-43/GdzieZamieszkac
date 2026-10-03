import { expect, test } from 'vitest'
import i18n from '../i18n'
import { jsonResponse, metaFixture, problemFixture } from '../test/fixtures'
import { mockFetch, requestedUrls } from '../test/render'
import { api } from './client'

test('calls the API under /v1 and sends the chosen language on every request', async () => {
  const fetchMock = mockFetch(() => jsonResponse(metaFixture))

  const { data } = await api.GET('/meta')
  await api.GET('/districts/{code}/similar', { params: { path: { code: 'alpha' }, query: { limit: 5 } } })
  await api.POST('/recommend', { body: { weights: { category: { cost: 3 } } } })
  await i18n.changeLanguage('en')
  await api.GET('/meta')

  expect(data?.district_count).toBe(4)
  expect(requestedUrls(fetchMock)).toEqual([
    'http://api.test/v1/meta?lang=pl',
    'http://api.test/v1/districts/alpha/similar?limit=5&lang=pl',
    'http://api.test/v1/recommend?lang=pl',
    'http://api.test/v1/meta?lang=en',
  ])
})

test('returns a problem+json error as the error value', async () => {
  mockFetch(() => jsonResponse(problemFixture, 503))

  const { data, error, response } = await api.GET('/meta')

  expect(data).toBeUndefined()
  expect(error?.title).toBe('Data unavailable')
  expect(response.status).toBe(503)
})
