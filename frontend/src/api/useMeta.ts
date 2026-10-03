import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from './client'

/** City name, staleness and the credit line of every source. The language is part of the key, so a toggle refetches. */
export function useMeta() {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['meta', i18n.language],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/meta')
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}
