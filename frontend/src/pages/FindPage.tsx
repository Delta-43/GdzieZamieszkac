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
import { useMeta } from '../api/useMeta'
import { AiReportCard } from '../components/AiReportCard'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { ScoreValue } from '../components/ScoreValue'
import { betterThan, IMPORTANCE_WEIGHTS, MAX_WEIGHT } from '../lib/score'
import { usePageTitle } from '../lib/usePageTitle'

// Every category starts as "important". Equal weights give the default score, whatever the number is.
const DEFAULT_WEIGHT = 3

function defaults(): CategoryWeights {
  return Object.fromEntries(SCORED_CATEGORIES.map((category) => [category, DEFAULT_WEIGHT])) as CategoryWeights
}

/**
 * Find a district: the user picks a preset or says how much each category matters (not important, important, very
 * important), and the API ranks the districts. The exact weights, 0 to 5, are under "Advanced". The request is the same.
 */
export function FindPage() {
  const { t, i18n } = useTranslation()
  usePageTitle(t('find.title'))
  const meta = useMeta()
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

          {SCORED_CATEGORIES.map((category) => (
            <fieldset className="importance" key={category}>
              <legend>{labels.get(category) ?? category}</legend>
              {/* A short question says what the category is about. Only reviewed questions are shown. */}
              {i18n.exists(`find.question.${category}`) && <p className="note">{t(`find.question.${category}`)}</p>}
              <div className="importance__choices">
                {IMPORTANCE_WEIGHTS.map((weight) => (
                  <label key={weight}>
                    <input
                      type="radio"
                      name={`${formId}-importance-${category}`}
                      checked={weights[category] === weight}
                      onChange={() => setWeight(category, weight)}
                    />
                    {t(`find.importance.${weight}`)}
                  </label>
                ))}
              </div>
              {/* A preset or the sliders can set a weight between the three choices: it is said in words, not rounded. */}
              {!(IMPORTANCE_WEIGHTS as readonly number[]).includes(weights[category]) && (
                <p className="note">{t('find.otherWeight', { value: weights[category], max: MAX_WEIGHT })}</p>
              )}
            </fieldset>
          ))}

          {/* The exact weights, 0 to 5, for those who want them. The three choices above set the same values. */}
          <details className="find-advanced">
            <summary>{t('find.advanced')}</summary>
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
          </details>

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
                      <th scope="col">{t('score.placeHeader')}</th>
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
                        <td>
                          <ScoreValue score={item.score} />
                        </td>
                        <td>
                          <ul className="drivers">
                            {item.top_drivers.map((driver) => (
                              <li key={driver.key}>
                                {/* The position among the other districts, in words. "Better" holds for every measure: the API has applied the direction. */}
                                {driver.label ?? driver.key}: {t('find.better', { count: betterThan(driver.percentile, ranking.length), of: ranking.length - 1 })}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* What the score is and is not, in one sentence. The city name comes from /meta. */}
              {meta.data && <p className="note">{t('score.explain', { city: meta.data.city_name })}</p>}
              {/* The API's own note: scores compare the districts of this city only. */}
              <p className="note">{result.data.note}</p>
              <details>
                <summary>{t('score.how')}</summary>
                <p>{t('score.howText')}</p>
                <p>
                  <Link to="/sources">{t('nav.sources')}</Link>
                </p>
              </details>
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

      {/* The report narrates the ranking on screen, so it gets the weights of that ranking, not the sliders' current values. */}
      <AiReportCard weights={applied} />
    </>
  )
}
