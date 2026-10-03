import { useTranslation } from 'react-i18next'
import { useMetrics } from '../api/useDistrictsData'
import { useMeta } from '../api/useMeta'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { sourceLinks } from '../lib/sourceLinks'
import { usePageTitle } from '../lib/usePageTitle'

/**
 * Sources and how it works (task F8): where the numbers come from, how the score is made, where artificial intelligence is used
 * and where it is not, what the portal does not do, the gaps in the data, and the draft accessibility statement.
 * Names, credit lines, licences, dates and reasons come from the API as given. The explanation is the interface's own text.
 */
export function SourcesPage() {
  const { t } = useTranslation()
  usePageTitle(t('about.title'))
  const meta = useMeta()
  const metrics = useMetrics()
  const labels = new Map((metrics.data ?? []).map((metric) => [metric.key, metric.label]))
  const gaps = (metrics.data ?? []).filter((metric) => !metric.available)

  return (
    <>
      <h1>{t('about.heading')}</h1>
      <p>{t('about.intro')}</p>

      <section aria-labelledby="about-score">
        <h2 id="about-score">{t('about.score.heading')}</h2>
        <p>{t('about.score.text')}</p>
        <p>{t('about.score.limit')}</p>
        {meta.data?.score_note && <p className="note">{meta.data.score_note}</p>}
      </section>

      <section aria-labelledby="about-ai">
        <h2 id="about-ai">{t('about.ai.heading')}</h2>
        <h3>{t('about.ai.used')}</h3>
        <ul>
          <li>{t('about.ai.reports')}</li>
          <li>{t('about.ai.summary')}</li>
          <li>{t('about.ai.translation')}</li>
        </ul>
        <h3>{t('about.ai.notUsed')}</h3>
        <ul>
          <li>{t('about.ai.noScore')}</li>
          <li>{t('about.ai.noNumbers')}</li>
          <li>{t('about.ai.noVerdict')}</li>
        </ul>
        <p>{t('about.ai.guard')}</p>
      </section>

      <section aria-labelledby="about-not">
        <h2 id="about-not">{t('about.not.heading')}</h2>
        <ul>
          <li>{t('about.not.listings')}</li>
          <li>{t('about.not.safety')}</li>
          <li>{t('about.not.forecast')}</li>
          <li>{t('about.not.advice')}</li>
        </ul>
      </section>

      <section aria-labelledby="about-sources">
        <h2 id="about-sources">{t('about.sources.heading')}</h2>
        <p>{t('about.sources.intro')}</p>
        {meta.isPending && <Loading />}
        {meta.isError && <ErrorMessage error={meta.error} onRetry={() => void meta.refetch()} />}
        {meta.isSuccess && (
          <ul className="source-list">
            {meta.data.sources.map((source) => {
              const link = sourceLinks(source.url)[0]
              const used = (source.metric_keys ?? []).map((key) => labels.get(key) ?? key)
              return (
                <li key={`${source.name}|${source.attribution}`}>
                  <p>
                    <strong>{source.name}</strong>
                  </p>
                  {source.attribution && (
                    <p>
                      {t('about.sources.credit')}: {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer">
                          {source.attribution}
                          <span className="visually-hidden"> {t('footer.newTab')}</span>
                        </a>
                      ) : (
                        source.attribution
                      )}
                    </p>
                  )}
                  <p className="note">
                    {t('about.sources.licence')}: {source.licence}
                    {source.as_of && ` · ${t('about.sources.asOf')}: ${source.as_of}`}
                  </p>
                  {used.length > 0 && (
                    <p className="note">
                      {t('about.sources.metrics')}: {used.join(', ')}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="about-gaps">
        <h2 id="about-gaps">{t('about.gaps.heading')}</h2>
        <p>{t('about.gaps.intro')}</p>
        {metrics.isPending && <Loading />}
        {metrics.isError && <ErrorMessage error={metrics.error} onRetry={() => void metrics.refetch()} />}
        {metrics.isSuccess && gaps.length === 0 && <p>{t('about.gaps.none')}</p>}
        {gaps.length > 0 && (
          <ul>
            {gaps.map((metric) => (
              <li key={metric.key}>
                <strong>{metric.label}</strong>: {metric.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="about-a11y">
        <h2 id="about-a11y">{t('about.a11y.heading')}</h2>
        <p className="notice">{t('about.a11y.draft')}</p>
        <p>{t('about.a11y.target')}</p>
        <h3>{t('about.a11y.done')}</h3>
        <ul>
          <li>{t('about.a11y.doneAuto')}</li>
          <li>{t('about.a11y.doneContrast')}</li>
          <li>{t('about.a11y.doneKeyboard')}</li>
        </ul>
        <h3>{t('about.a11y.todo')}</h3>
        <ul>
          <li>{t('about.a11y.todoKeyboard')}</li>
          <li>{t('about.a11y.todoScreenReader')}</li>
          <li>{t('about.a11y.todoZoom')}</li>
          <li>{t('about.a11y.todoMap')}</li>
        </ul>
        <h3>{t('about.a11y.report')}</h3>
        <p>{t('about.a11y.reportText')}</p>
      </section>
    </>
  )
}
