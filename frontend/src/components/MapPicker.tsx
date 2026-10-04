import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { SCORED_CATEGORIES, type ScoredCategory } from '../api/useDistrictsData'
import { searchKey } from '../lib/pages'

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
  // The text typed to narrow the list of measures. Accents and capitals do not matter.
  const [query, setQuery] = useState('')
  const wanted = searchKey(query)
  // The chosen measure stays in the list even when it does not match, so the select never shows a value it does not hold.
  const listed = metrics.filter((metric) => !wanted || searchKey(metric.label).includes(wanted) || (choice.kind === 'metric' && choice.key === metric.key))
  const matches = metrics.filter((metric) => searchKey(metric.label).includes(wanted)).length
  return (
    <div className="map-picker">
      <div role="group" aria-labelledby={`${id}-label`} className="map-picker__group">
        <span id={`${id}-label`} className="map-picker__label">
          {t('districts.colourBy')}
        </span>
        <div className="map-picker__pills">
          <button
            type="button"
            className="pill reserve-bold"
            data-label={t('districts.overall')}
            aria-pressed={choice.kind === 'overall'}
            onClick={() => onChange({ kind: 'overall' })}
          >
            <span>{t('districts.overall')}</span>
          </button>
          {SCORED_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className="pill reserve-bold"
              data-label={categoryLabels.get(category) ?? category}
              aria-pressed={choice.kind === 'category' && choice.category === category}
              onClick={() => onChange({ kind: 'category', category })}
            >
              <span>{categoryLabels.get(category) ?? category}</span>
            </button>
          ))}
        </div>
      </div>
      {/* A plain field narrows the long list of measures; the choice itself stays a native select. */}
      <div className="field">
        <label htmlFor={`${id}-search`}>{t('districts.measureSearch')}</label>
        <input
          id={`${id}-search`}
          type="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          aria-describedby={`${id}-search-hint`}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="note" id={`${id}-search-hint`}>
          {t('districts.measureSearchHint')}
        </p>
        {/* How many measures match, said politely while the person types. */}
        <p className="note" role="status">
          {wanted ? (matches > 0 ? t('districts.measureCount', { count: matches }) : t('districts.measureNone')) : ''}
        </p>
      </div>
      <div className="field">
        <label htmlFor={`${id}-select`}>{t('districts.moreMeasures')}</label>
        <select
          id={`${id}-select`}
          value={choice.kind === 'metric' ? choice.key : ''}
          onChange={(event) => onChange(event.target.value ? { kind: 'metric', key: event.target.value } : { kind: 'overall' })}
        >
          <option value="">{t('districts.chooseMeasure')}</option>
          {listed.map((metric) => (
            <option key={metric.key} value={metric.key}>
              {metric.available ? metric.label : t('districts.optionNoData', { label: metric.label })}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
