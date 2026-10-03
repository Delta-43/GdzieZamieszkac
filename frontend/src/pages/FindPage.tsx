import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  SCORED_CATEGORIES,
  useCategoryLabels,
  useMetrics,
  usePersonas,
  useRecommend,
  type CategoryWeights,
  type ScoredCategory,
} from '../api/useDistrictsData'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { plainNumber } from '../lib/plainNumber'
import { usePageTitle } from '../lib/usePageTitle'

const MAX_WEIGHT = 5

// A category that is not mentioned counts as 1 in the API, so 1 everywhere is the default score.
function defaults(): CategoryWeights {
  return Object.fromEntries(SCORED_CATEGORIES.map((category) => [category, 1])) as CategoryWeights
}

/** Find a district: the user picks a preset or sets a weight per category, and the API ranks the districts. */
export function FindPage() {
  const { t, i18n } = useTranslation()
  usePageTitle(t('find.title'))
  const formId = useId()
  const [weights, setWeights] = useState<CategoryWeights>(defaults)
  // The weights of the ranking on screen. Null means no weights were sent: the default score.
  const [applied, setApplied] = useState<CategoryWeights | null>(null)
  const [persona, setPersona] = useState<string | null>(null)
  const [allZero, setAllZero] = useState(false)

  const personas = usePersonas()
  const labels = useCategoryLabels()
  const metrics = useMetrics()
  const result = useRecommend(applied)
  const metricLabel = new Map(metrics.data?.map((metric) => [metric.key, metric.label]))

  function setWeight(category: ScoredCategory, value: number) {
    setWeights((current) => ({ ...current, [category]: value }))
    setPersona(null)
    setAllZero(false)
  }

  function choosePersona(key: string, preset: Partial<Record<string, number>> | undefined) {
    // A category the preset does not mention counts as 1, as in the API.
    setWeights(Object.fromEntries(SCORED_CATEGORIES.map((category) => [category, preset?.[category] ?? 1])) as CategoryWeights)
    setPersona(key)
    setAllZero(false)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    // The API rejects a request in which every weight is zero, so the form says so first.
    if (SCORED_CATEGORIES.every((category) => weights[category] === 0)) {
      setAllZero(true)
      return
    }
    setApplied({ ...weights })
  }

  function reset() {
    setWeights(defaults())
    setApplied(null)
    setPersona(null)
    setAllZero(false)
  }

  const ranking = result.data?.ranking ?? []
  const top = ranking[0]

  return (
    <>
      <h1>{t('find.heading')}</h1>
      <p>{t('find.intro')}</p>

      <div className="find-layout">
        <form className="card" onSubmit={onSubmit} aria-labelledby={`${formId}-heading`}>
          <h2 id={`${formId}-heading`}>{t('find.priorities')}</h2>

          <div role="group" aria-labelledby={`${formId}-presets`} className="map-picker__group">
            <span id={`${formId}-presets`} className="map-picker__label">
              {t('find.presets')}
            </span>
            {personas.isPending && <Loading />}
            {personas.isError && <ErrorMessage error={personas.error} onRetry={() => void personas.refetch()} />}
            <div className="map-picker__pills">
              {personas.data?.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="pill reserve-bold"
                  data-label={item.label}
                  aria-pressed={persona === item.key}
                  onClick={() => choosePersona(item.key, item.weights.category)}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            {/* The description of the chosen preset, as the API sends it. */}
            {personas.data?.find((item) => item.key === persona)?.description && (
              <p className="note">{personas.data.find((item) => item.key === persona)?.description}</p>
            )}
          </div>

          <p className="note" id={`${formId}-hint`}>
            {t('find.hint')}
          </p>

          {SCORED_CATEGORIES.map((category) => (
            <div className="slider" key={category}>
              <label htmlFor={`${formId}-${category}`}>{labels.get(category) ?? category}</label>
              <input
                id={`${formId}-${category}`}
                type="range"
                min={0}
                max={MAX_WEIGHT}
                step={1}
                value={weights[category]}
                aria-describedby={`${formId}-hint`}
                aria-valuetext={weights[category] === 0 ? t('find.left_out') : t('find.weight', { value: weights[category], max: MAX_WEIGHT })}
                onChange={(event) => setWeight(category, Number(event.target.value))}
              />
              {/* The value as text, beside the slider. */}
              <output htmlFor={`${formId}-${category}`}>
                {weights[category] === 0 ? t('find.left_out') : t('find.weight', { value: weights[category], max: MAX_WEIGHT })}
              </output>
            </div>
          ))}

          {allZero && (
            <p className="error-message" role="alert">
              {t('find.allZero')}
            </p>
          )}

          <p className="find-actions">
            <button type="submit" className="button-primary">
              {t('find.submit')}
            </button>
            <button type="button" className="button-secondary" onClick={reset}>
              {t('find.reset')}
            </button>
          </p>
        </form>

        <section className="card" aria-labelledby={`${formId}-result`}>
          <h2 id={`${formId}-result`}>{t('find.ranking')}</h2>
          {/* Announced politely to screen readers when a ranking arrives. */}
          <p role="status" className="note">
            {result.isPending ? t('states.loading') : top ? t(applied ? 'find.ready' : 'find.readyDefault', { name: top.name }) : ''}
          </p>
          {result.isError && <ErrorMessage error={result.error} onRetry={() => void result.refetch()} />}

          {result.data && (
            <>
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be focusable */}
              <div className="table-scroll" role="region" aria-label={t('find.table.region')} tabIndex={0}>
                <table>
                  <caption>{t(applied ? 'find.table.caption' : 'find.table.captionDefault')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('find.table.rank')}</th>
                      <th scope="col">{t('districts.table.district')}</th>
                      <th scope="col">{t('find.table.score')}</th>
                      <th scope="col">{t('find.table.drivers')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((item) => (
                      <tr key={item.code}>
                        <td>{item.rank}</td>
                        <th scope="row">
                          <Link to={`/districts/${item.code}`}>{item.name}</Link>
                        </th>
                        {/* The score and the percentile have no display string in the contract yet: shown as sent. */}
                        <td>{plainNumber(item.score, i18n.language)}</td>
                        <td>
                          <ul className="drivers">
                            {item.top_drivers.map((driver) => (
                              <li key={driver.key}>
                                {driver.label ?? driver.key}: {t('find.percentile', { value: plainNumber(driver.percentile, i18n.language) })}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* The API's own note: scores compare the districts of this city only. */}
              <p className="note">{result.data.note}</p>
              <p className="note">{t('find.used', { count: result.data.metrics_used })}</p>
              {result.data.missing_metrics.length > 0 && (
                <div className="notice">
                  <p>{t('find.missing')}</p>
                  <ul>
                    {result.data.missing_metrics.map((key) => (
                      <li key={key}>{metricLabel.get(key) ?? key}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}
