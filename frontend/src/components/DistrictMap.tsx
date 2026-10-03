import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { buildMap } from '../lib/geo'

type Boundaries = components['schemas']['BoundaryCollection']

export type MapValue = { display: string; classNumber: number }

type Props = {
  boundaries: Boundaries
  /** Value and class per district code. A district that is missing here has no data and is drawn hatched. */
  values: Map<string, MapValue>
  classCount: number
  metricLabel: string
  /** True while the values are on their way. Districts are then drawn plain: "no data" would be a false claim. */
  loading: boolean
  selected: string | null
  onSelect: (code: string) => void
}

/**
 * The choropleth map: district shapes drawn as SVG, filled by class. Each district is a button with a name that
 * includes its value, and it prints its class number, so nothing depends on colour or on hover.
 */
export function DistrictMap({ boundaries, values, classCount, metricLabel, loading, selected, onSelect }: Props) {
  const { t } = useTranslation()
  const map = useMemo(() => buildMap(boundaries.features), [boundaries])
  // Draw the selected district last, so its thick outline is not covered by its neighbours.
  const shapes = [...map.shapes].sort((a, b) => Number(a.code === selected) - Number(b.code === selected))

  return (
    <svg className="district-map" viewBox={`-6 -6 ${map.width + 12} ${map.height + 12}`} role="group" aria-label={t('districts.map.label', { metric: metricLabel })}>
      <defs>
        <pattern id="map-no-data" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect className="map-no-data__ground" width="16" height="16" />
          <line className="map-no-data__line" x1="0" y1="0" x2="0" y2="16" />
        </pattern>
      </defs>
      {shapes.map((shape) => {
        const value = values.get(shape.code)
        const name = value
          ? t('districts.map.district', { name: shape.name, value: value.display, class: value.classNumber, count: classCount })
          : t(loading ? 'districts.map.districtLoading' : 'districts.map.districtNoData', { name: shape.name })
        return (
          <g
            key={shape.code}
            role="button"
            tabIndex={0}
            aria-label={name}
            aria-pressed={shape.code === selected}
            className={`map-district map-district--${value ? `c${value.classNumber}` : loading ? 'loading' : 'none'}`}
            onClick={() => onSelect(shape.code)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(shape.code)
              }
            }}
          >
            {/* A light halo under a dark line: one of the two shows against every fill of the ramp. */}
            <path className="map-district__fill" d={shape.path} fillRule="evenodd" />
            <path className="map-district__line" d={shape.path} />
            {value && (
              <text x={shape.label.x} y={shape.label.y} aria-hidden="true">
                {value.classNumber}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
