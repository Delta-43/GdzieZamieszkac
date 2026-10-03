import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { buildMap } from '../lib/geo'

type Boundaries = components['schemas']['BoundaryCollection']

export type MapValue = { display: string; classNumber: number }

// Line height of a name on the map, in the units of the drawing.
const LINE = 17

/** A long name is split at its spaces and hyphens, so it fits inside its district. */
function nameLines(name: string): string[] {
  return name.split(/(?<=-)|\s+/).filter(Boolean)
}

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
 * The choropleth map: district shapes drawn as SVG, filled by class, with one even outline and the district's name.
 * Each district is a button whose accessible name includes its value and class, so nothing depends on colour or on hover.
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
            <path d={shape.path} fillRule="evenodd" />
          </g>
        )
      })}
      {/* The names are drawn after every shape, so no district covers the name of its neighbour. They are hidden on a narrow screen, where the list carries them. */}
      <g className="map-labels" aria-hidden="true">
        {map.shapes.map((shape) => {
          const lines = nameLines(shape.name)
          const classNumber = values.get(shape.code)?.classNumber
          return (
            <text key={shape.code} className={classNumber && classNumber >= 4 ? 'map-label map-label--light' : 'map-label'} x={shape.label.x} y={shape.label.y - ((lines.length - 1) * LINE) / 2}>
              {lines.map((line, index) => (
                <tspan key={line + index} x={shape.label.x} dy={index === 0 ? 0 : LINE}>
                  {line}
                </tspan>
              ))}
            </text>
          )
        })}
      </g>
    </svg>
  )
}
