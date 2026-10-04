import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { useAiReport } from '../api/useAiReport'
import type { CategoryWeights } from '../api/useDistrictsData'

// The limits of `requirements` in the city service contract.
const MIN_LENGTH = 3
const MAX_LENGTH = 1000

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) return error.retryAfter ? ('aiReport.error.tooManySeconds' as const) : ('aiReport.error.tooMany' as const)
    if (error.status === 502) return 'aiReport.error.failed' as const
    if (error.status === 503) return 'aiReport.error.unavailable' as const
  }
  return 'aiReport.error.generic' as const
}

/**
 * The personalised AI report: the person describes what matters to them, and the city service narrates the top three
 * districts of the ranking on screen. `weights` are the weights of that ranking; null means the default ranking.
 */
export function AiReportCard({ weights }: { weights: CategoryWeights | null }) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const [text, setText] = useState('')
  const [tooShort, setTooShort] = useState(false)
  const report = useAiReport()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    // One request at a time: each report costs model budget.
    if (report.isPending) return
    const requirements = text.trim()
    if (requirements.length < MIN_LENGTH) {
      setTooShort(true)
      return
    }
    setTooShort(false)
    report.mutate({ requirements, weights })
  }

  return (
    <section className="card ai-report-card" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{t('aiReport.heading')}</h2>
      <p>{t('aiReport.intro')}</p>

      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-text`}>{t('aiReport.field')}</label>
          <textarea
            id={`${id}-text`}
            rows={4}
            maxLength={MAX_LENGTH}
            value={text}
            aria-describedby={`${id}-hint ${id}-privacy${tooShort ? ` ${id}-error` : ''}`}
            aria-invalid={tooShort || undefined}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="note" id={`${id}-hint`}>
            {t('aiReport.hint', { min: MIN_LENGTH, max: MAX_LENGTH })}
          </p>
        </div>
        {tooShort && (
          <p className="error-message" role="alert" id={`${id}-error`}>
            {t('aiReport.tooShort', { min: MIN_LENGTH })}
          </p>
        )}
        {/* Said before the first request: the typed text leaves our servers. */}
        <p className="notice" id={`${id}-privacy`}>
          {t('aiReport.privacy')}
        </p>
        <p className="find-actions">
          {/* While a report is written the button is dimmed and does nothing. It stays focusable. */}
          <button type="submit" className="button-primary" aria-disabled={report.isPending || undefined}>
            {t('aiReport.submit')}
          </button>
        </p>
      </form>

      {/* Announced politely to screen readers while the report is written and when it arrives. */}
      <p role="status" className="note">
        {report.isPending ? t('aiReport.loading') : report.isSuccess ? t('aiReport.ready') : ''}
      </p>
      {report.isError && (
        <p className="error-message" role="alert">
          {t(errorMessage(report.error), { seconds: report.error instanceof ApiError ? report.error.retryAfter : undefined })}
        </p>
      )}

      {report.data && (
        <div className="ai-report-card__answer report" lang={report.data.lang}>
          <h3>{t('aiReport.answer')}</h3>
          {/* Required label (EU AI Act, Article 50): the API's own text, shown as given. */}
          <p className="ai-label">{report.data.label}</p>
          {/* The report is plain text. Paragraphs are split on blank lines and it is never inserted as HTML. */}
          {report.data.report.split(/\n\s*\n/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <p className="note" lang={i18n.language}>
            {t('aiReport.generated', { model: report.data.model, date: report.data.generated_at.slice(0, 10) })}
          </p>

          <h3 lang={i18n.language}>{t('aiReport.districts')}</h3>
          <ul>
            {report.data.districts.map((district) => (
              <li key={district.code}>
                <span lang={i18n.language}>{t('aiReport.district', { rank: district.rank })}</span>{' '}
                {/* The score is the API's display string, shown as given. */}
                <Link to={`/districts/${district.code}`}>{district.name}</Link>, {district.score_display}
              </li>
            ))}
          </ul>
          {/* The API's own note: scores compare the districts of this city only. */}
          <p className="note">{report.data.basis.note}</p>

          {/* The facts the model was given, in the language of the report: the basis of the text. */}
          {report.data.facts.length > 0 && (
            <>
              <h3 lang={i18n.language}>{t('aiReport.facts')}</h3>
              <ul>
                {report.data.facts.map((fact, index) => (
                  <li key={index}>{fact}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
