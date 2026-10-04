import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'
import type { components } from '../api/schema'
import { useOutlook } from '../api/useDistrictsData'
import { dateInWords } from '../lib/dates'
import { plainNumber } from '../lib/plainNumber'
import { DataKindBadge } from './DataKindBadge'
import { DateText } from './DateText'
import { ErrorMessage } from './ErrorMessage'
import { Loading } from './Loading'

type Growth = components['schemas']['Growth']

/** One change of the district's price: the API's display string, the two prices and dates it compares, and the sample sizes. */
function Change({ label, growth }: { label: string; growth: Growth | null }) {
  const { t, i18n } = useTranslation()
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>
        {growth ? (
          <>
            <p className="metric__value">
              {growth.display}
              {growth.low_confidence && <span className="note"> {t('series.lowMark')}</span>}
            </p>
            <p className="metric__facts">
              <span>
                {t('outlook.fromTo', {
                  fromDate: dateInWords(growth.from, i18n.language),
                  from: growth.from_display,
                  toDate: dateInWords(growth.to, i18n.language),
                  to: growth.to_display,
                })}
              </span>
              {growth.annualised_display && <span>{t('outlook.perYear', { value: growth.annualised_display })}</span>}
              <span>{t('outlook.sample', { from: growth.n_obs_from, to: growth.n_obs_to })}</span>
            </p>
          </>
        ) : (
          // Too little history for this comparison: said in words, never a zero.
          <span className="no-data">{t('outlook.noGrowth')}</span>
        )}
      </dd>
    </div>
  )
}

/**
 * How prices changed in the past: in this district, and in the whole city over past periods of one and two years.
 * It is a record, not a forecast: the API's caveat opens the section, no future price is shown, and the districts are
 * not ranked by growth. Where the API publishes no forecast, its reason is shown, with the test behind it one press away.
 * The section is hidden when the API answers 501.
 */
export function OutlookCard({ code }: { code: string }) {
  const { t, i18n } = useTranslation()
  const outlook = useOutlook(code)

  if (outlook.error instanceof ApiError && outlook.error.status === 501) return null
  if (outlook.isPending) return <Loading />
  if (outlook.isError) return <ErrorMessage error={outlook.error} onRetry={() => void outlook.refetch()} />
  const data = outlook.data
  const city = data.city_history
  const backtest = data.scenario.backtest

  return (
    <section aria-labelledby="outlook-heading">
      <h2 id="outlook-heading">{t('outlook.heading')}</h2>
      <p className="notice">{data.caveat}</p>
      <div className="history-layout">
        <div className="card">
          <h3>{t('outlook.district')}</h3>
          <dl className="metrics">
            <Change label={t('outlook.last12')} growth={data.momentum.growth_12m} />
            <Change label={t('outlook.sinceStart')} growth={data.momentum.growth_since_start} />
          </dl>
          <dl className="provenance">
            {data.data_kind && (
              <div>
                <dt>{t('provenance.dataKind')}</dt>
                <dd>
                  <DataKindBadge kind={data.data_kind} />
                </dd>
              </div>
            )}
          </dl>
          <details>
            <summary>{t('metric.more')}</summary>
            <dl className="metric__more">
              <div>
                <dt>{t('metric.method')}</dt>
                <dd>{data.method}</dd>
              </div>
            </dl>
          </details>
        </div>

        {city.available && city.windows && city.windows.length > 0 && (
          <div className="card">
            <h3>{t('outlook.city')}</h3>
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be focusable */}
            <div className="table-scroll" role="region" aria-label={t('outlook.cityRegion')} tabIndex={0}>
              <table>
                <caption>{t('outlook.cityCaption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('outlook.window')}</th>
                    <th scope="col">{t('outlook.median')}</th>
                    <th scope="col">{t('outlook.low')}</th>
                    <th scope="col">{t('outlook.high')}</th>
                  </tr>
                </thead>
                <tbody>
                  {city.windows.map((window) => (
                    <tr key={window.quarters}>
                      <th scope="row">{window.label}</th>
                      <td>{window.median_display}</td>
                      <td>{window.low_display}</td>
                      <td>{window.high_display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {city.period_start && city.period_end && (
              <p className="note">
                {t('outlook.cityPeriod')}: <DateText value={city.period_start} /> – <DateText value={city.period_end} />
              </p>
            )}
            {(city.method || city.source) && (
              <details>
                <summary>{t('metric.more')}</summary>
                <dl className="metric__more">
                  {city.method && (
                    <div>
                      <dt>{t('metric.method')}</dt>
                      <dd>{city.method}</dd>
                    </div>
                  )}
                  {city.source && (
                    <>
                      <div>
                        <dt>{t('provenance.source')}</dt>
                        <dd>{city.source.name}</dd>
                      </div>
                      <div>
                        <dt>{t('metric.licence')}</dt>
                        <dd>{city.source.licence}</dd>
                      </div>
                      <div>
                        <dt>{t('metric.attribution')}</dt>
                        <dd>{city.source.attribution}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </details>
            )}
          </div>
        )}
      </div>

      {/* No forecast is published: the API says why, and the test of the methods is one press away. No future price is ever shown here. */}
      {!data.scenario.published && (
        <div className="card outlook-scenario">
          <h3>{t('outlook.noForecast')}</h3>
          <p>{data.scenario.reason}</p>
          {backtest?.results && backtest.results.length > 0 && (
            <details>
              <summary>{t('outlook.backtest')}</summary>
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be focusable */}
              <div className="table-scroll" role="region" aria-label={t('outlook.backtestRegion')} tabIndex={0}>
                <table>
                  <caption>
                    {t('outlook.backtestCaption', {
                      cities: backtest.cities,
                      from: backtest.period_start ? dateInWords(backtest.period_start, i18n.language) : '',
                      to: backtest.period_end ? dateInWords(backtest.period_end, i18n.language) : '',
                    })}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('outlook.method')}</th>
                      <th scope="col">{t('outlook.quarters')}</th>
                      <th scope="col">{t('outlook.errorMethod')}</th>
                      <th scope="col">{t('outlook.errorNoChange')}</th>
                      <th scope="col">{t('outlook.errorLastYear')}</th>
                      <th scope="col">{t('outlook.coverage')}</th>
                      <th scope="col">{t('outlook.result')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtest.results.map((result) => (
                      <tr key={`${result.method}-${result.quarters}`}>
                        <th scope="row">{result.method}</th>
                        {/* These figures have no display string in the contract: shown as sent. */}
                        <td>{result.quarters}</td>
                        <td>{plainNumber(result.mae_method, i18n.language)}</td>
                        <td>{plainNumber(result.mae_no_change, i18n.language)}</td>
                        <td>{plainNumber(result.mae_last_year_continues, i18n.language)}</td>
                        <td>{plainNumber(result.coverage_80, i18n.language)}</td>
                        <td>{t(result.passes ? 'outlook.passes' : 'outlook.fails')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
