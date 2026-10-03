import { useQueries, useQuery } from '@tanstack/react-query'
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

/** The six categories that enter the score. Demographics is shown but never scored. */
export const SCORED_CATEGORIES = ['transport', 'livability', 'amenities', 'environment', 'cost', 'safety'] as const
export type ScoredCategory = (typeof SCORED_CATEGORIES)[number]

/** Weights that switch one category on and every other one off, so /recommend returns the score of that category alone. */
function onlyCategory(category: ScoredCategory) {
  const weights: Record<string, number> = { demographics: 0 }
  SCORED_CATEGORIES.forEach((name) => {
    weights[name] = name === category ? 1 : 0
  })
  return { category: weights }
}

function categoryScoresQuery(category: ScoredCategory, language: string) {
  return {
    queryKey: ['categoryScores', category, language],
    queryFn: async () => {
      const { data, error, response } = await api.POST('/recommend', { body: { weights: onlyCategory(category) } })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  }
}

/** The score of one category for every district, computed by the API. The answer is cached, because /recommend is rate limited. */
export function useCategoryScores(category: ScoredCategory | null) {
  const { i18n } = useTranslation()
  return useQuery({ ...categoryScoresQuery(category ?? 'cost', i18n.language), enabled: category !== null })
}

/** The scores of all six categories, for the district profile. Asked only when the profile is shown. */
export function useAllCategoryScores(enabled: boolean) {
  const { i18n } = useTranslation()
  return useQueries({
    queries: SCORED_CATEGORIES.map((category) => ({ ...categoryScoresQuery(category, i18n.language), enabled })),
  })
}

/** Everything about one district, grouped by category. Also the only place the API sends the category labels. */
export function useDistrictDetail(code: string | undefined) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['district', code, i18n.language],
    enabled: Boolean(code),
    // An unknown district answers 404. Asking again would not help.
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/districts/{code}', { params: { path: { code: code ?? '' } } })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}

/** The stored area report of a district. A district without a report answers 404, which is not retried. */
export function useDistrictReport(code: string | undefined) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['report', code, i18n.language],
    enabled: Boolean(code),
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/districts/{code}/report', { params: { path: { code: code ?? '' } } })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}

/** The quarterly history of one metric for a district. A metric without history answers 404, which is not retried. */
export function useDistrictSeries(code: string | undefined, key: string) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['series', code, key, i18n.language],
    enabled: Boolean(code),
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/districts/{code}/series/{key}', { params: { path: { code: code ?? '', key } } })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}

/** The category names as the API sends them. They arrive only inside a district's detail, so the first district is read for them. */
export function useCategoryLabels(): Map<string, string> {
  const districts = useDistricts()
  const detail = useDistrictDetail(districts.data?.districts?.[0]?.code)
  return new Map(detail.data?.categories.map((category) => [category.category as string, category.label]))
}

/** The named weight presets of the recommender. */
export function usePersonas() {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['personas', i18n.language],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/personas')
      if (error) throw new ApiError(response.status, error.title)
      return data.personas
    },
  })
}

export type CategoryWeights = Record<ScoredCategory, number>

/**
 * The ranking of the districts for the given category weights. With no weights the API returns the default
 * livability score. Each set of weights is cached, because the endpoint is rate limited.
 */
export function useRecommend(weights: CategoryWeights | null) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['recommend', weights, i18n.language],
    queryFn: async () => {
      const { data, error, response } = await api.POST('/recommend', { body: weights ? { weights: { category: weights } } : {} })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}
