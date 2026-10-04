import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { buildMap, type Basemap } from '../lib/geo'
import { PixelLayer } from './PixelLayer'

type Boundaries = components['schemas']['BoundaryCollection']

export type MapValue = { display: string; classNumber: number }

// Line height of a name on the map, in the units of the drawing.
const LINE = 17
// Text sizes on the screen at the whole-city view. They are divided by the zoom, so a name keeps its size on the screen while the map grows.
const NAME_SIZE = 15
const PLACE_SIZE = 13
const MAX_ZOOM = 6
// From this zoom on, the landmarks are named.
const LABEL_ZOOM = 2
// How long the wave of colour takes to cross the map when the measure changes, in milliseconds.
const WAVE = 650

const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/** The view that is drawn: it glides to the view that was asked for. With reduced motion it jumps. */
function useGlide(target: View): View {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  useEffect(() => {
    const from = shownRef.current
    // Already there (the first draw, or a view that did not change): nothing to glide, and nothing to draw again.
    if (from.x === target.x && from.y === target.y && from.w === target.w && from.h === target.h) return
    const start = performance.now()
    const duration = reducedMotion() ? 0 : 320
    let frame = 0
    // The clock is read here, not taken from the frame callback: the two can differ in some environments.
    const step = () => {
      const k = duration === 0 ? 1 : Math.min(1, (performance.now() - start) / duration)
      const e = 1 - (1 - k) ** 3
      const next = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      }
      shownRef.current = next
      setShown(next)
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target.x, target.y, target.w, target.h])
  return shown
}

type View = { x: number; y: number; w: number; h: number }

/** Keeps the view inside the drawing. */
function clampView(view: View, full: View): View {
  return { ...view, x: Math.min(Math.max(view.x, full.x), full.x + full.w - view.w), y: Math.min(Math.max(view.y, full.y), full.y + full.h - view.h) }
}

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
  /** Rivers, lakes, main roads and railways to find one's way by. Optional: without them the districts are drawn alone. */
  basemap?: Basemap | null
  /** A district to zoom to, for example the one a search found. */
  focusCode?: string | null
}

/**
 * The choropleth map: district shapes drawn as SVG, filled by class, with one even outline and the district's name.
 * Each district is a button whose accessible name includes its value and class, so nothing depends on colour or on hover.
 */
export function DistrictMap({ boundaries, values, classCount, metricLabel, loading, selected, onSelect, basemap = null, focusCode = null }: Props) {
  const { t } = useTranslation()
  const map = useMemo(() => buildMap(boundaries.features, basemap), [boundaries, basemap])
  const full: View = { x: -6, y: -6, w: map.width + 12, h: map.height + 12 }
  // null is the whole city. The view only changes when a button is pressed or a search asks for a district, never by dragging or by the wheel.
  const [view, setView] = useState<View | null>(null)
  const [note, setNote] = useState('')
  const asked = view ?? full
  const current = useGlide(asked)
  const zoom = full.w / current.w

  function show(next: View | null, message: string) {
    setView(next && next.w >= full.w - 1 ? null : next && clampView(next, full))
    setNote(message)
  }
  function zoomBy(factor: number) {
    const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, asked.w / factor))
    const h = (w / full.w) * full.h
    const next = clampView({ x: asked.x + (asked.w - w) / 2, y: asked.y + (asked.h - h) / 2, w, h }, full)
    show(next, t('districts.map.zoomLevel', { zoom: Math.round((full.w / next.w) * 10) / 10 }))
  }
  function pan(dx: number, dy: number) {
    show({ ...asked, x: asked.x + dx * asked.w, y: asked.y + dy * asked.h }, '')
  }

  // A search asks for a district: zoom to it, with room around it. React's pattern for state that follows a prop:
  // it is adjusted while rendering, not in an effect, so the map never shows the old view first.
  const [appliedFocus, setAppliedFocus] = useState<string | null>(null)
  if (focusCode !== appliedFocus) {
    setAppliedFocus(focusCode)
    const shape = focusCode ? map.shapes.find((candidate) => candidate.code === focusCode) : undefined
    if (shape) {
      const pad = 40
      const w = Math.min(
        full.w,
        Math.max(full.w / MAX_ZOOM, shape.box.x1 - shape.box.x0 + 2 * pad, ((shape.box.y1 - shape.box.y0 + 2 * pad) * full.w) / full.h),
      )
      const h = (w / full.w) * full.h
      setView(clampView({ x: (shape.box.x0 + shape.box.x1) / 2 - w / 2, y: (shape.box.y0 + shape.box.y1) / 2 - h / 2, w, h }, full))
      setNote(t('districts.map.zoomedTo', { name: shape.name }))
    }
  }

  // The colours of the districts as small squares, one kind per square. The canvas under the map draws them and glides them to new colours.
  const pixelKinds = useMemo(
    () =>
      map.pixels.cells.map((cell) => {
        const value = values.get(cell.code)
        return value ? `c${value.classNumber}` : loading ? 'loading' : 'none'
      }),
    [map, values, loading],
  )
  const cityPath = useMemo(() => map.shapes.map((shape) => shape.path).join(''), [map])

  // Draw the selected district last, so its thick outline is not covered by its neighbours.
  const shapes = [...map.shapes].sort((a, b) => Number(a.code === selected) - Number(b.code === selected))

  return (
    <div className="district-map-frame">
      {/* Zoom and pan are buttons, so nothing needs a drag or a pinch (WCAG 2.5.7). They come first in the tab order. */}
      <div className="map-controls" role="group" aria-label={t('districts.map.controls')}>
        <button type="button" onClick={() => zoomBy(1.6)} disabled={full.w / asked.w >= MAX_ZOOM - 0.01} aria-label={t('districts.map.zoomIn')}>
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} disabled={!view} aria-label={t('districts.map.zoomOut')}>
          −
        </button>
        <button type="button" onClick={() => pan(-0.3, 0)} disabled={!view} aria-label={t('districts.map.panLeft')}>
          ←
        </button>
        <button type="button" onClick={() => pan(0.3, 0)} disabled={!view} aria-label={t('districts.map.panRight')}>
          →
        </button>
        <button type="button" onClick={() => pan(0, -0.3)} disabled={!view} aria-label={t('districts.map.panUp')}>
          ↑
        </button>
        <button type="button" onClick={() => pan(0, 0.3)} disabled={!view} aria-label={t('districts.map.panDown')}>
          ↓
        </button>
        <button type="button" className="map-controls__reset" onClick={() => show(null, t('districts.map.wholeCity'))} disabled={!view}>
          {t('districts.map.reset')}
        </button>
      </div>
      <p className="visually-hidden" role="status">
        {note}
      </p>
      <div className="district-map-stack">
        <PixelLayer size={map.pixels.size} cells={map.pixels.cells} kinds={pixelKinds} view={current} cityPath={cityPath} wave={WAVE} />
        <svg
          className={`district-map${zoom >= LABEL_ZOOM ? ' district-map--zoomed' : ''}`}
          viewBox={`${current.x} ${current.y} ${current.w} ${current.h}`}
          role="group"
          aria-label={t('districts.map.label', { metric: metricLabel })}
        >
          <defs>
            <pattern id="map-no-data" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect className="map-no-data__ground" width="16" height="16" />
              <line className="map-no-data__line" x1="0" y1="0" x2="0" y2="16" />
            </pattern>
            <clipPath id="map-city-clip">
              <path d={map.shapes.map((shape) => shape.path).join('')} clipRule="evenodd" />
            </clipPath>
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
          {/* The context is only for finding one's way: it is hidden from assistive technology, cannot be clicked, and stays inside the city. */}
          {map.context && (
            <g className="map-context" aria-hidden="true" clipPath="url(#map-city-clip)">
              <path className="map-context__lake" d={map.context.lakes} />
              <path className="map-context__river" d={map.context.rivers} />
              <path className="map-context__rail" d={map.context.rail} />
              <path className="map-context__road" d={map.context.roadsMinor} />
              <path className="map-context__road map-context__road--major" d={map.context.roadsMajor} />
            </g>
          )}
          {/* The names are drawn after every shape, so no district covers the name of its neighbour. They are hidden on a narrow screen, where the list carries them. */}
          <g className="map-labels" aria-hidden="true">
            {map.shapes.map((shape) => {
              const lines = nameLines(shape.name)
              const classNumber = values.get(shape.code)?.classNumber
              return (
                <text
                  key={shape.code}
                  className={classNumber && classNumber >= 4 ? 'map-label map-label--light' : 'map-label'}
                  x={shape.label.x}
                  y={shape.label.y - ((lines.length - 1) * LINE) / zoom / 2}
                  fontSize={NAME_SIZE / zoom}
                >
                  {lines.map((line, index) => (
                    <tspan key={line + index} x={shape.label.x} dy={index === 0 ? 0 : LINE / zoom}>
                      {line}
                    </tspan>
                  ))}
                </text>
              )
            })}
          </g>
          {map.context && zoom >= LABEL_ZOOM && (
            <g className="map-places" aria-hidden="true">
              {map.context.places.map((place) => (
                <g key={place.name}>
                  <circle className="map-place__dot" cx={place.x} cy={place.y} r={4 / zoom} strokeWidth={2 / zoom} />
                  <text className="map-place__name" x={place.x + 8 / zoom} y={place.y} fontSize={PLACE_SIZE / zoom} strokeWidth={4 / zoom}>
                    {place.name}
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>
      {/* The credit the licence of the context layers asks for. It is the text of the file itself. */}
      {map.context && <p className="note map-attribution">{map.context.attribution}</p>}
    </div>
  )
}
