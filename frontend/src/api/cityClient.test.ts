import { expect, test } from 'vitest'
import { jsonResponse } from '../test/fixtures'
import { mockFetch } from '../test/render'
import { cityApi } from './cityClient'

test('calls the city service under /v1 and sends the language in the body, as its contract asks', async () => {
  const fetchMock = mockFetch(() => jsonResponse({ accepting: true, identity_check: 'not_yet', stored_as: 'unverified', published: false, affects_scores: false, note: { pl: 'Test', en: 'Test' } }))

  const { data } = await cityApi.GET('/feedback/status')
  await cityApi.POST('/ai-report', { body: { requirements: 'TEST only', lang: 'pl' } })

  expect(data?.identity_check).toBe('not_yet')
  const requests = fetchMock.mock.calls.map(([input]) => input as Request)
  expect(requests.map((request) => request.url)).toEqual(['http://city.test/v1/feedback/status', 'http://city.test/v1/ai-report'])
  expect(await requests[1]?.clone().json()).toEqual({ requirements: 'TEST only', lang: 'pl' })
})
