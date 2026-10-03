import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { SCORED_CATEGORIES, type ScoredCategory } from '../api/useDistrictsData'

type MetricDefinition = components['schemas']['MetricDefinition']

export type Choice = { kind: 'overall' } | { kind: 'category'; category: ScoredCategory } | { kind: 'metric'; key: string }

type Props = {
  choice: Choice
  onChange: (choice: Choice) => void
  /** The category names as the API sends them. A category without a label yet shows its key. */
  categoryLabels: Map<string, string>
  metrics: MetricDefinition[]
}

/** Chooses what colours the map: the overall score, the score of one category, or one single measure. */
export function MapPicker({ choice, onChange, categoryLabels, metrics }: Props) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="map-picker">
      <div role="group" aria-labelledby={`${id}-label`} className="map-picker__group">
        <span id={`${id}-label`} className="map-picker__label">
          {t('districts.colourBy')}
        </span>
        <div className="map-picker__pills">
          <button type="button" className="pill" aria-pressed={choice.kind === 'overall'} onClick={() => onChange({ kind: 'overall' })}>
            {t('districts.overall')}
          </button>
          {SCORED_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className="pill"
              aria-pressed={choice.kind === 'category' && choice.category === category}
              onClick={() => onChange({ kind: 'category', category })}
            >
              {categoryLabels.get(category) ?? category}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-select`}>{t('districts.moreMeasures')}</label>
        <select
          id={`${id}-select`}
          value={choice.kind === 'metric' ? choice.key : ''}
          onChange={(event) => onChange(event.target.value ? { kind: 'metric', key: event.target.value } : { kind: 'overall' })}
        >
          <option value="">{t('districts.chooseMeasure')}</option>
          {metrics.map((metric) => (
            <option key={metric.key} value={metric.key}>
              {metric.available ? metric.label : t('districts.optionNoData', { label: metric.label })}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
