import { useMemo } from 'react'
import type { MapValue } from '../components/DistrictMap'
import { CLASS_COUNT, classify } from '../lib/classes'
import { useBoundaries, useDistricts, useMetrics, useMetricValues } from './useDistrictsData'

// The catalogue key of the default livability score.
const SCORE_KEY = 'livability_score_default'

/** What the map on the home page needs: the shapes, the overall score per district and its classes. */
export function useScoreMap() {
  const districts = useDistricts()
  const boundaries = useBoundaries()
  const metrics = useMetrics()
  const metric = metrics.data?.find((candidate) => candidate.key === SCORE_KEY)
  const values = useMetricValues(SCORE_KEY, metric?.available === true)

  const derived = useMemo(() => {
    const list = values.data?.values ?? []
    const { classOf, classes } = classify(list)
    const mapValues = new Map<string, MapValue>()
    list.forEach((item) => mapValues.set(item.district, { display: item.display, classNumber: classOf.get(item.district) ?? 1 }))
    return { mapValues, classes }
  }, [values.data])

  return {
    districts: districts.data?.districts ?? [],
    boundaries: boundaries.data,
    metricLabel: metric?.label ?? '',
    classCount: CLASS_COUNT,
    ...derived,
    hasGaps: (districts.data?.districts ?? []).some((district) => !derived.mapValues.has(district.code)),
    loading: values.isPending && metric?.available === true,
    error: districts.error ?? boundaries.error ?? metrics.error ?? values.error ?? null,
    retry: () => {
      void districts.refetch()
      void boundaries.refetch()
      void metrics.refetch()
      void values.refetch()
    },
  }
}
