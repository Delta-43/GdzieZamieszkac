import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import type { ClassInfo } from '../lib/classes'
import { buildMap, type Basemap } from '../lib/geo'

type Boundaries = components['schemas']['BoundaryCollection']

/** A district's value on the map. The class number picks the colour and is never shown or spoken: a place or a step in words is. */
export type MapValue = { display: string; classNumber: number; rank?: { position: number; of: number } }

// Text sizes on the screen at the whole-city view. They are divided by the zoom, so a name keeps its size on the screen while the map grows.
const PLACE_SIZE = 13
const MAX_ZOOM = 6
// From this zoom on, the landmarks are named.
const LABEL_ZOOM = 2

const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/** The view that is drawn: it glides to the view that was asked for. With reduced motion it jumps. */
function useGlide(target: View, instant: boolean): View {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  useEffect(() => {
    const from = shownRef.current
    // Already there (the first draw, or a view that did not change): nothing to glide, and nothing to draw again.
    if (from.x === target.x && from.y === target.y && from.w === target.w && from.h === target.h) return
    const start = performance.now()
    // A view that follows the hand (a drag, the wheel) must not lag behind it.
    const duration = instant || reducedMotion() ? 0 : 320
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
  }, [target.x, target.y, target.w, target.h, instant])
  return shown
}

type View = { x: number; y: number; w: number; h: number }

/** Keeps the view inside the drawing. */
function clampView(view: View, full: View): View {
  return { ...view, x: Math.min(Math.max(view.x, full.x), full.x + full.w - view.w), y: Math.min(Math.max(view.y, full.y), full.y + full.h - view.h) }
}

type Props = {
  boundaries: Boundaries
  /** Value and class per district code. A district that is missing here has no data and is drawn hatched. */
  values: Map<string, MapValue>
  metricLabel: string
  /** True while the values are on their way. Districts are then drawn plain: "no data" would be a false claim. */
  loading: boolean
  selected: string | null
  onSelect: (code: string) => void
  /** Rivers, lakes, main roads and railways to find one's way by. Optional: without them the districts are drawn alone. */
  basemap?: Basemap | null
  /** A district to zoom to, for example the one a search found. */
  focusCode?: string | null
  /** The classes of the map with their ranges, for the card of a district. */
  classes?: ClassInfo[]
  /** A few more values per district for its card, for example the two prices. Label and the API's display string. */
  extras?: Map<string, { label: string; display: string }[]>
  /** Whether a district under the pointer or the focus shows its card. Off on the home page, where the map only leads on. */
  card?: boolean
}

/**
 * The choropleth map: district shapes drawn as SVG, filled by class, with one even outline. Each district is a button
 * whose accessible name includes its name, value and class, so nothing depends on colour or on hover. A small card
 * with the same facts can appear over a district under the pointer or the keyboard focus. The view moves with the
 * mouse (the wheel, a drag, a double click) and with the keyboard (+, −, the arrow keys, 0). A touch screen shows
 * the whole city: it has no zoom, so it needs no gesture.
 */
export function DistrictMap({
  boundaries,
  values,
  metricLabel,
  loading,
  selected,
  onSelect,
  basemap = null,
  focusCode = null,
  classes = [],
  extras,
  card = false,
}: Props) {
  const hintId = useId()
  const { t } = useTranslation()
  const map = useMemo(() => buildMap(boundaries.features, basemap), [boundaries, basemap])
  const full: View = { x: -6, y: -6, w: map.width + 12, h: map.height + 12 }
  // null is the whole city.
  const [view, setView] = useState<View | null>(null)
  const [note, setNote] = useState('')
  // True while the view follows the hand: it then moves at once, without the glide.
  const [byHand, setByHand] = useState(false)
  const asked = view ?? full
  const current = useGlide(asked, byHand)
  const zoom = full.w / current.w
  const svgRef = useRef<SVGSVGElement>(null)
  // The district whose card is shown: the one under the pointer or with the keyboard focus.
  const [hover, setHover] = useState<string | null>(null)
  const hoverTimer = useRef(0)
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null)
  const justDragged = useRef(false)

  function showCard(code: string) {
    window.clearTimeout(hoverTimer.current)
    setHover(code)
  }
  // A short wait, so the pointer can cross from the district onto its card without the card going away.
  function hideCard() {
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setHover(null), 120)
  }
  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  function show(next: View | null, message: string) {
    setView(next && next.w >= full.w - 1 ? null : next && clampView(next, full))
    setNote(message)
  }
  /** Zooms by `factor`, keeping the point (`fx`, `fy`) of the view, 0 to 1, where it is. The middle by default. */
  function zoomBy(factor: number, fx = 0.5, fy = 0.5, hand = false) {
    const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, asked.w / factor))
    const h = (w / full.w) * full.h
    const next = clampView({ x: asked.x + (asked.w - w) * fx, y: asked.y + (asked.h - h) * fy, w, h }, full)
    setByHand(hand)
    show(next, t('districts.map.zoomLevel', { zoom: Math.round((full.w / next.w) * 10) / 10 }))
  }

  /** Where a pointer is in the drawing, as a share of its width and height. */
  function shareOf(clientX: number, clientY: number) {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return { fx: 0.5, fy: 0.5, width: 1, height: 1 }
    return { fx: (clientX - box.left) / box.width, fy: (clientY - box.top) / box.height, width: box.width, height: box.height }
  }

  // The wheel over the map zooms it, at the place of the pointer. One case is left to the page: the wheel turned
  // "out" while the whole city is already shown, so the page can still be scrolled down past the map.
  // React's wheel listener cannot stop the page from scrolling, so this one is set by hand.
  const wheel = useRef<(event: WheelEvent) => void>(() => {})
  useEffect(() => {
    wheel.current = (event: WheelEvent) => {
      if (!view && event.deltaY > 0) return
      event.preventDefault()
      const { fx, fy } = shareOf(event.clientX, event.clientY)
      zoomBy(Math.exp(-event.deltaY * 0.01), fx, fy, true)
    }
  })
  useEffect(() => {
    const element = svgRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => wheel.current(event)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  // A mouse drags the map when it is zoomed in. A touch scrolls the page as usual and uses the buttons.
  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !view) return
    drag.current = { x: event.clientX, y: event.clientY, view, moved: false }
  }
  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const start = drag.current
    if (!start) return
    const [dx, dy] = [event.clientX - start.x, event.clientY - start.y]
    if (!start.moved && Math.hypot(dx, dy) < 5) return
    if (!start.moved) {
      start.moved = true
      event.currentTarget.setPointerCapture?.(event.pointerId)
      setHover(null)
    }
    const { width, height } = shareOf(0, 0)
    setByHand(true)
    setView(clampView({ ...start.view, x: start.view.x - (dx / width) * start.view.w, y: start.view.y - (dy / height) * start.view.h }, full))
  }
  function onPointerEnd() {
    // The click that ends a drag must not choose the district under the pointer.
    if (drag.current?.moved) {
      justDragged.current = true
      window.setTimeout(() => (justDragged.current = false), 0)
    }
    drag.current = null
  }
  function pan(dx: number, dy: number) {
    setByHand(false)
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

  // Draw the selected district last, so its thick outline is not covered by its neighbours.
  const shapes = [...map.shapes].sort((a, b) => Number(a.code === selected) - Number(b.code === selected))

  // The card of the district under the pointer or the focus: where it goes, and what it says.
  const hoverShape = card && hover ? map.shapes.find((shape) => shape.code === hover) : undefined
  const tip = hoverShape && (() => {
    const value = values.get(hoverShape.code)
    const info = value && classes.find((item) => item.number === value.classNumber)
    const y = ((hoverShape.label.y - current.y) / current.h) * 100
    return {
      name: hoverShape.name,
      value,
      range:
        info &&
        (info.minDisplay === info.maxDisplay
          ? t('districts.legend.single', { step: t(`districts.step.${info.number}`), value: info.minDisplay })
          : t('districts.legend.range', { step: t(`districts.step.${info.number}`), min: info.minDisplay, max: info.maxDisplay })),
      extras: extras?.get(hoverShape.code) ?? [],
      // Kept away from the side edges, and under the district when there is no room above it.
      x: Math.min(80, Math.max(20, ((hoverShape.label.x - current.x) / current.w) * 100)),
      y: Math.min(100, Math.max(0, y)),
      below: y < 42,
    }
  })()

  // The keyboard moves the map as the mouse does: + and − zoom, the arrow keys move a zoomed map, and 0 shows the
  // whole city again. The keys work while a district of the map has the focus, and the hint under the map names them.
  function onMapKey(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const step = 0.3
    const moves: Record<string, () => void> = {
      '+': () => zoomBy(1.6),
      '=': () => zoomBy(1.6),
      '-': () => zoomBy(1 / 1.6),
      '0': () => {
        setByHand(false)
        show(null, t('districts.map.wholeCity'))
      },
      ArrowLeft: () => pan(-step, 0),
      ArrowRight: () => pan(step, 0),
      ArrowUp: () => pan(0, -step),
      ArrowDown: () => pan(0, step),
    }
    const move = moves[event.key]
    // At the whole city there is nothing to move to: the arrow keys are left to the page.
    if (!move || (event.key.startsWith('Arrow') && !view)) return
    event.preventDefault()
    setHover(null)
    move()
  }

  return (
    <div className="district-map-frame">
      <p className="visually-hidden" role="status">
        {note}
      </p>
      <div className="district-map-stack">
        <svg
          ref={svgRef}
          className={`district-map${zoom >= LABEL_ZOOM ? ' district-map--zoomed' : ''}${view ? ' district-map--movable' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onMapKey}
          aria-describedby={hintId}
          onDoubleClick={(event) => {
            const { fx, fy } = shareOf(event.clientX, event.clientY)
            zoomBy(1.6, fx, fy)
          }}
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
              ? value.rank
                ? t('districts.map.district', { name: shape.name, value: value.display, position: value.rank.position, of: value.rank.of })
                : t('districts.map.districtStep', { name: shape.name, value: value.display, step: t(`districts.step.${value.classNumber}`) })
              : t(loading ? 'districts.map.districtLoading' : 'districts.map.districtNoData', { name: shape.name })
            return (
              <g
                key={shape.code}
                role="button"
                tabIndex={0}
                aria-label={name}
                aria-pressed={shape.code === selected}
                className={`map-district map-district--${value ? `c${value.classNumber}` : loading ? 'loading' : 'none'}`}
                // The district's place in the wave: when the measure changes, the colour reaches the middle of the map first.
                style={{ '--wave': shape.wave } as CSSProperties}
                onClick={() => {
                  if (!justDragged.current) onSelect(shape.code)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(shape.code)
                  }
                  // The card can be put away without moving the focus (WCAG 1.4.13).
                  if (event.key === 'Escape') setHover(null)
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') showCard(shape.code)
                }}
                onPointerLeave={hideCard}
                onFocus={() => showCard(shape.code)}
                onBlur={hideCard}
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
        {tip && (
          // The same facts as the name of the district's button, for the eye: hidden from assistive technology, which has them already.
          <div
            className={`map-tip${tip.below ? ' map-tip--below' : ''}`}
            aria-hidden="true"
            style={{ '--tip-x': `${tip.x}%`, '--tip-y': `${tip.y}%` } as CSSProperties}
            onPointerEnter={() => window.clearTimeout(hoverTimer.current)}
            onPointerLeave={hideCard}
          >
            <p className="map-tip__name">{tip.name}</p>
            {tip.value ? (
              <>
                <p className="map-tip__value">
                  <span className={`map-tip__swatch map-legend__swatch--c${tip.value.classNumber}`} />
                  {tip.value.display}
                </p>
                <p className="map-tip__line">{metricLabel}</p>
                {tip.range && <p className="map-tip__line">{tip.range}</p>}
              </>
            ) : (
              <p className="map-tip__line">{t(loading ? 'states.loading' : 'districts.noData')}</p>
            )}
            {tip.extras.length > 0 && (
              <dl className="map-tip__extras">
                {tip.extras.map((extra) => (
                  <div key={extra.label}>
                    <dt>{extra.label}</dt>
                    <dd>{extra.display}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
      {/* The credit the licence of the context layers asks for. It is the text of the file itself. */}
      {map.context && <p className="note map-attribution">{map.context.attribution}</p>}
      {/* The map has no buttons: this line says how it moves, for the mouse and for the keyboard. */}
      <p className="note map-hint" id={hintId}>
        {t('districts.map.hint')}
      </p>
    </div>
  )
}
