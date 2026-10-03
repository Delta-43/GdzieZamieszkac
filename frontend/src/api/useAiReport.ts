import { useMutation } from '@tanstack/react-query'
import { currentLanguage } from '../i18n'
import { cityApi } from './cityClient'
import { ApiError } from './client'
import type { CategoryWeights } from './useDistrictsData'

/** The whole seconds of a Retry-After header, when the service sends one. */
function retryAfter(response: Response): number | undefined {
  const seconds = Number(response.headers.get('Retry-After'))
  return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined
}

/**
 * Asks the city service for the AI report. It is a mutation, so it runs only when the person presses the button:
 * each report costs model budget and the endpoint allows few requests a minute. Nothing is retried or cached.
 */
export function useAiReport() {
  return useMutation({
    mutationFn: async ({ requirements, weights }: { requirements: string; weights: CategoryWeights | null }) => {
      const { data, error, response } = await cityApi.POST('/ai-report', {
        body: {
          requirements,
          lang: currentLanguage(),
          // The contract gives `weights` no shape ("as in POST /recommend", issue #46), so the value is cast.
          // With no weights the service uses the default ranking.
          ...(weights ? { weights: { category: weights } as unknown as Record<string, never> } : {}),
        },
      })
      if (error) throw new ApiError(response.status, error.title, retryAfter(response))
      return data
    },
  })
}
