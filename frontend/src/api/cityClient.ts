import createClient from 'openapi-fetch'
import type { paths } from './citySchema'

// The city service is a second server of ours, next to the read-only data API: it writes the personalised AI report
// and stores resident feedback. Its contract is ../../../city-service/openapi.yaml.
// Empty VITE_CITY_API_URL means the same origin as the page. The client adds the /v1 prefix.
const origin = import.meta.env.VITE_CITY_API_URL ?? ''

export const cityApi = createClient<paths>({
  baseUrl: `${origin}/v1`,
  // Look up fetch on each call, so a test can replace it (see client.ts).
  fetch: (request) => globalThis.fetch(request),
})
