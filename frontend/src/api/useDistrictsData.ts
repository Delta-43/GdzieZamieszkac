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

/**
 * Estimated minutes by public transport from each of the given districts to one work district, in the morning.
 * One answer per home district (the API estimates from a district to all the others), cached, and asked only once a
 * work district is chosen. A district is missing from the map while its answer is on the way or has failed.
 */
export function useCommuteTo(work: string, homes: string[]): Map<string, number | null> {
  const { i18n } = useTranslation()
  const answers = useQueries({
    queries: homes.map((home) => ({
      queryKey: ['commute', home, i18n.language],
      enabled: work !== '',
      retry: false,
      queryFn: async () => {
        const { data, error, response } = await api.GET('/commute', { params: { query: { from: home } } })
        if (error) throw new ApiError(response.status, error.title)
        return data
      },
    })),
  })
  const minutes = new Map<string, number | null>()
  answers.forEach((answer, index) => {
    const home = homes[index]
    const to = answer.data?.destinations.find((destination) => destination.code === work)
    if (home !== undefined && to) minutes.set(home, to.minutes)
  })
  return minutes
}

/** The price and the rent of a flat of the given size, estimated from the district's medians. A 501 answer hides the section. */
export function useRentVsBuy(code: string | undefined, areaM2: number) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['rentVsBuy', code, areaM2, i18n.language],
    enabled: Boolean(code),
    retry: false,
    // The result of the last size stays on the page while the next one is on the way.
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/districts/{code}/rent-vs-buy', { params: { path: { code: code ?? '' }, query: { area_m2: areaM2 } } })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}

/** The districts most like this one, by the measures of the score. A 501 answer hides the section. */
export function useSimilar(code: string | undefined) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['similar', code, i18n.language],
    enabled: Boolean(code),
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/districts/{code}/similar', { params: { path: { code: code ?? '' } } })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}

/** How prices changed in the past, in the district and in the whole city. History, never a forecast. A 501 answer hides the section. */
export function useOutlook(code: string | undefined) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['outlook', code, i18n.language],
    enabled: Boolean(code),
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/districts/{code}/outlook', { params: { path: { code: code ?? '' } } })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}

/**
 * Estimated minutes by public transport from one district to every other one. A 501 answer means the feature is
 * switched off: the caller hides the section.
 */
export function useCommute(code: string | undefined) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['commute', code, i18n.language],
    enabled: Boolean(code),
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/commute', { params: { query: { from: code ?? '' } } })
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

/** Two to four districts side by side, in the order asked for. Not asked until the choice is complete. */
export function useCompare(codes: string[]) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['compare', codes, i18n.language],
    enabled: codes.length >= 2 && codes.length <= 4,
    // An unknown district answers 404 and a wrong count 422. Asking again would not help.
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/compare', { params: { query: { codes: codes.join(',') } } })
      if (error) throw new ApiError(response.status, error.title)
      return data
    },
  })
}
