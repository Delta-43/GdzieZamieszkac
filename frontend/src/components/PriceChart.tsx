import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dateInWords } from '../lib/dates'
import type { components } from '../api/schema'

type Series = components['schemas']['Series']
type Point = Series['points'][number]

const WIDTH = 640
const HEIGHT = 260
const PAD = { top: 28, right: 16, bottom: 30, left: 16 }

/**
 * A single line for one series, with a marker on every quarter. A quarter with low confidence has a hollow, larger
 * marker, so the mark differs in shape and not in colour. No number is formatted here: the two gridlines are labelled
 * with the API's display strings of the lowest and highest value, and the table beside the chart holds every value.
 */
export function PriceChart({ series }: { series: Series }) {
  const { t, i18n } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  const points = series.points
  if (points.length === 0) return null

  const values = points.map((p) => p.value)
  const [min, max] = [Math.min(...values), Math.max(...values)]
  const span = max - min || 1
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth)
  const y = (value: number) => PAD.top + (1 - (value - min) / span) * innerHeight
  const lowest = points[values.indexOf(min)] as Point
  const highest = points[values.indexOf(max)] as Point
  const first = points[0] as Point
  const last = points[points.length - 1] as Point
  const shown = active === null ? null : (points[active] as Point)

  function onMove(clientX: number, target: SVGSVGElement) {
    const box = target.getBoundingClientRect()
    const ratio = (((clientX - box.left) / box.width) * WIDTH - PAD.left) / innerWidth
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))))
  }

  return (
    <figure className="price-chart">
      {/* The picture is described by the summary sentence and the table, so it is hidden from screen readers. */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        aria-hidden="true"
        focusable="false"
        onPointerMove={(event) => onMove(event.clientX, event.currentTarget)}
        onPointerLeave={() => setActive(null)}
      >
        <line className="chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(max)} y2={y(max)} />
        <line className="chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(min)} y2={y(min)} />
        <text className="chart-label" x={PAD.left} y={y(max) - 8}>
          {t('series.highest', { value: highest.display })}
        </text>
        <text className="chart-label" x={PAD.left} y={y(min) + 20}>
          {t('series.lowest', { value: lowest.display })}
        </text>
        <text className="chart-label chart-label--end" x={WIDTH - PAD.right} y={y(min) + 20}>
          {dateInWords(first.period_start, i18n.language)} – {dateInWords(last.period_end, i18n.language)}
        </text>
        {shown && active !== null && <line className="chart-crosshair" x1={x(active)} x2={x(active)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />}
        <polyline className="chart-line" points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} />
        {points.map((p, i) => (
          <circle
            key={p.period_start}
            className={`chart-marker${p.low_confidence ? ' chart-marker--low' : ''}${i === active ? ' chart-marker--active' : ''}`}
            cx={x(i)}
            cy={y(p.value)}
            r={p.low_confidence ? 5.5 : 4}
          />
        ))}
      </svg>
      {/* The value under the pointer. The same values are in the table, so nothing is shown on hover only. */}
      <p className="chart-readout" aria-hidden="true">
        {shown
          ? t('series.readout', {
              from: dateInWords(shown.period_start, i18n.language),
              to: dateInWords(shown.period_end, i18n.language),
              value: shown.display,
              n: shown.n_obs,
            }) +
            (shown.low_confidence ? ` ${t('series.lowMark')}` : '')
          : t('series.hint')}
      </p>
      <figcaption>
        {t('series.summary', {
          from: dateInWords(first.period_start, i18n.language),
          to: dateInWords(last.period_end, i18n.language),
          first: first.display,
          last: last.display,
          count: points.length,
        })}{' '}
        {points.some((p) => p.low_confidence) && t('series.lowKey')}
      </figcaption>
    </figure>
  )
}
