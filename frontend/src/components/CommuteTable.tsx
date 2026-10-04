import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { useCommute, useDistricts } from '../api/useDistrictsData'
import { plainNumber } from '../lib/plainNumber'
import { DataKindBadge } from './DataKindBadge'
import { DateText } from './DateText'
import { ErrorMessage } from './ErrorMessage'
import { Loading } from './Loading'

/**
 * Minutes by public transport from this district to every other one, nearest first, as the API estimates them.
 * The numbers are an estimate between the middles of districts, not a journey plan: the API's caveat is always
 * on the page, beside the table, and the method is one press away. The section is hidden when the API answers 501.
 */
export function CommuteTable({ code }: { code: string }) {
  const { t, i18n } = useTranslation()
  const commute = useCommute(code)
  const districts = useDistricts()

  if (commute.error instanceof ApiError && commute.error.status === 501) return null
  if (commute.isPending) return <Loading />
  if (commute.isError) return <ErrorMessage error={commute.error} onRetry={() => void commute.refetch()} />
  const data = commute.data

  const names = new Map(districts.data?.districts.map((district) => [district.code, district.name]))
  // The other districts, nearest first. A district with no connection found comes last. The API lists the district
  // itself too, at 0 minutes: that row says nothing and is left out. No number is worked out here.
  const rows = data.destinations.filter((row) => row.code !== data.from).sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity))
  if (rows.length === 0) return null

  return (
    <section aria-labelledby="commute-heading">
      <h2 id="commute-heading">{t('commute.heading')}</h2>
      <div className="history-layout">
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be focusable */}
        <div className="card table-scroll" role="region" aria-label={t('commute.region')} tabIndex={0}>
          <table>
            <caption>{t('commute.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('commute.to')}</th>
                <th scope="col">{t('commute.time')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code}>
                  <th scope="row">
                    <Link to={`/districts/${row.code}`}>{names.get(row.code) ?? row.code}</Link>
                  </th>
                  {/* The minutes have no display string in the contract yet: shown as sent. A missing connection is said in words, never as a zero. */}
                  <td>
                    {row.minutes === null ? (
                      <span className="no-data">{t('commute.none')}</span>
                    ) : (
                      t('commute.minutes', { value: plainNumber(row.minutes, i18n.language) })
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          {data.caveat && (
            <p className="metric__caveat">
              <strong>{t('metric.caveat')}:</strong> {data.caveat}
            </p>
          )}
          <p className="note">{t('commute.longTrips')}</p>
          <dl className="provenance">
            {data.data_kind && (
              <div>
                <dt>{t('provenance.dataKind')}</dt>
                <dd>
                  <DataKindBadge kind={data.data_kind} />
                </dd>
              </div>
            )}
            <div>
              <dt>{t('commute.day')}</dt>
              <dd>
                <DateText value={data.as_of} />
              </dd>
            </div>
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
      </div>
    </section>
  )
}
