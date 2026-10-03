import createClient, { createQuerySerializer } from 'openapi-fetch'
import { currentLanguage } from '../i18n'
import { markDataWarning } from '../lib/staleWarning'
import type { paths } from './schema'

// Empty VITE_API_URL means the same origin as the page. The client adds the /v1 prefix.
const origin = import.meta.env.VITE_API_URL ?? ''
const serializeQuery = createQuerySerializer()

export const api = createClient<paths>({
  baseUrl: `${origin}/v1`,
  // Look up fetch on each call. openapi-fetch otherwise keeps the fetch it saw when this module loaded,
  // and a test could not replace it afterwards.
  fetch: (request) => globalThis.fetch(request),
  // The API default is English and the portal default is Polish, so every request carries the language.
  querySerializer: (query) => serializeQuery({ ...query, lang: currentLanguage() }),
})

api.use({
  onResponse({ response }) {
    if (response.headers.has('X-Data-Warning')) markDataWarning()
  },
})

/** An error answer from the API. The API's own error text is English only, so the interface shows its own message per status. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, title: string) {
    super(title)
    this.name = 'ApiError'
    this.status = status
  }
}
