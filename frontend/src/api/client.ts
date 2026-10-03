import createClient from 'openapi-fetch'
import type { paths } from './schema'

// Empty VITE_API_URL means the same origin as the page. The client adds the /v1 prefix.
const origin = import.meta.env.VITE_API_URL ?? ''

export const api = createClient<paths>({
  baseUrl: `${origin}/v1`,
  // Look up fetch on each call. openapi-fetch otherwise keeps the fetch it saw when this module loaded,
  // and a test could not replace it afterwards.
  fetch: (request) => globalThis.fetch(request),
})
