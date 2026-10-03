import { useEffect, useRef } from 'react'
import type { Pixel } from '../lib/geo'
import { cssRgb, themeRgb, type Rgb } from '../theme/canvas'

export type PixelView = { x: number; y: number; w: number; h: number }

type Props = {
  size: number
  cells: Pixel[]
  /** One kind per cell: c1 to c5 for a step of the ramp, or loading / none for a plain light square. */
  kinds: string[]
  /** What part of the drawing is shown, in the units of the drawing. */
  view: PixelView
  /** SVG path data of the outline of the whole city: the pixels stay inside it. */
  cityPath: string
  /** The time the wave takes to cross the map, in milliseconds. */
  wave: number
}

const CSS_COLOUR: Record<string, string> = {
  c1: '--color-map-ramp1',
  c2: '--color-map-ramp2',
  c3: '--color-map-ramp3',
  c4: '--color-map-ramp4',
  c5: '--color-map-ramp5',
  loading: '--color-surface-raised',
  none: '--color-surface-raised',
}
const GLIDE = 650

/**
 * The colours of the districts as small squares, drawn on a canvas under the map. Purely visual: the districts above it, as SVG, carry the
 * meaning and take the clicks, and this layer is hidden from assistive technology. When the measure changes, each square glides to its new
 * colour in a wave from the middle of the map. With reduced motion the colours change at once. The colours come from the theme's CSS variables.
 */
export function PixelLayer({ size, cells, kinds, view, cityPath, wave }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  // What is on the screen now, per cell (red, green, blue), where it came from, and where it is going.
  const state = useRef({ current: new Float32Array(0), from: new Float32Array(0), target: new Float32Array(0), start: 0, frame: 0 })
  const latest = useRef({ view, size, cells, cityPath })

  function draw() {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const { view: v, size: s, cells: list, cityPath: outline } = latest.current
    const { current } = state.current
    const ratio = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(element.clientWidth * ratio))
    const height = Math.max(1, Math.round(element.clientHeight * ratio))
    if (element.width !== width || element.height !== height) {
      element.width = width
      element.height = height
    }
    const scale = width / v.w
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, width, height)
    context.setTransform(scale, 0, 0, scale, -v.x * scale, -v.y * scale)
    // Stay inside the city, and leave a hairline gap between the squares so they read as pixels.
    context.clip(new Path2D(outline), 'evenodd')
    const gap = 0.7
    list.forEach((cell, index) => {
      context.fillStyle = cssRgb(current[index * 3] ?? 0, current[index * 3 + 1] ?? 0, current[index * 3 + 2] ?? 0)
      context.fillRect(cell.x + gap / 2, cell.y + gap / 2, s - gap, s - gap)
    })
  }

  // The drawing reads the newest props from a ref. This effect is first, so the others see them.
  useEffect(() => {
    latest.current = { view, size, cells, cityPath }
  })

  // The measure changed: the squares glide from their colour now to the new one.
  useEffect(() => {
    const s = state.current
    const target = new Float32Array(kinds.length * 3)
    // Seven colours at most: read each from the theme once, not once per square.
    const colours = new Map<string, Rgb>()
    for (const kind of new Set(kinds)) colours.set(kind, themeRgb(CSS_COLOUR[kind] ?? CSS_COLOUR.none ?? ''))
    kinds.forEach((kind, index) => target.set(colours.get(kind) ?? [0, 0, 0], index * 3))
    const first = s.current.length !== target.length
    s.from = first ? target : Float32Array.from(s.current)
    s.target = target
    if (first) s.current = Float32Array.from(target)
    s.start = performance.now()
    cancelAnimationFrame(s.frame)

    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (first || calm) {
      s.current = Float32Array.from(target)
      s.frame = requestAnimationFrame(draw)
      return
    }
    const step = () => {
      const now = performance.now()
      let running = false
      latest.current.cells.forEach((cell, index) => {
        const k = Math.min(1, Math.max(0, (now - s.start - cell.distance * wave) / GLIDE))
        const e = k * k * (3 - 2 * k)
        if (k < 1) running = true
        for (let c = 0; c < 3; c += 1)
          s.current[index * 3 + c] = (s.from[index * 3 + c] ?? 0) + ((s.target[index * 3 + c] ?? 0) - (s.from[index * 3 + c] ?? 0)) * e
      })
      draw()
      if (running) s.frame = requestAnimationFrame(step)
    }
    s.frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(s.frame)
  }, [kinds, wave])

  // The view moved (zoom, pan) or the box was resized: draw again.
  useEffect(() => {
    const frame = requestAnimationFrame(draw)
    const observer = typeof ResizeObserver === 'undefined' || !canvas.current ? undefined : new ResizeObserver(() => draw())
    if (canvas.current) observer?.observe(canvas.current)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [view.x, view.y, view.w, view.h, cells, size, cityPath])

  return <canvas ref={canvas} className="map-pixels-canvas" aria-hidden="true" />
}
