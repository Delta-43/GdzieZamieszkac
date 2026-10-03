import { useMutation, useQuery } from '@tanstack/react-query'
import { currentLanguage } from '../i18n'
import { cityApi } from './cityClient'
import { ApiError } from './client'
import type { components } from './citySchema'

export type FeedbackBody = components['schemas']['RentPaid'] | components['schemas']['DataProblem']

/** The whole seconds of a Retry-After header, when the service sends one. */
function retryAfter(response: Response): number | undefined {
  const seconds = Number(response.headers.get('Retry-After'))
  return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined
}

/** What happens to a report today. The note is fixed text in both languages from the city service: it is shown before anything is sent. */
export function useFeedbackStatus() {
  return useQuery({
    queryKey: ['feedbackStatus'],
    queryFn: async () => {
      const { data, response } = await cityApi.GET('/feedback/status')
      // The contract lists no error answer for this endpoint, so a failure is read from the status line.
      if (!data) throw new ApiError(response.status, response.statusText)
      return data
    },
  })
}

/** Sends one report. A mutation, so nothing is sent, retried or cached unless the person presses the button. Nothing is kept in the browser. */
export function useSendFeedback() {
  return useMutation({
    mutationFn: async (body: FeedbackBody) => {
      const { data, error, response } = await cityApi.POST('/feedback', { body })
      if (error) throw new ApiError(response.status, error.title, retryAfter(response))
      return data
    },
  })
}

/** The note of the city service in the language on screen. */
export function noteText(note: components['schemas']['Note']): string {
  return note[currentLanguage()]
}
