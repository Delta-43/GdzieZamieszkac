import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from './client'

/** All districts with the default score and the two highlight values. */
export function useDistricts() {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['districts', i18n.language],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/districts')
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}

/** The district shapes for the map. They hold no text, so the language is not part of the key. */
export function useBoundaries() {
  return useQuery({
    queryKey: ['boundaries'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/districts.geojson')
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}

/** The metric catalogue: labels, units, availability and the reason for each gap. */
export function useMetrics() {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['metrics', i18n.language],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/metrics')
      if (error) throw new ApiError(response.status, error.title)
      return data.metrics
    },
  })
}

/** One metric for every district, with the numeric value. Only asked for a metric that has data in this city. */
export function useMetricValues(key: string, enabled: boolean) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['metricValues', key, i18n.language],
    enabled,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/metrics/{key}/values', { params: { path: { key } } })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}
