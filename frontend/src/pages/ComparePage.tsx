import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import type { components } from '../api/schema'
import { useCompare, useDistricts } from '../api/useDistrictsData'
import { DataKindBadge } from '../components/DataKindBadge'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { usePageTitle } from '../lib/usePageTitle'

type District = components['schemas']['DistrictDetail']
type MetricEntry = components['schemas']['MetricEntry']

const MIN_DISTRICTS = 2
const MAX_DISTRICTS = 4

/** One group of rows: a category of the API, or the two rental values that sit outside the categories. */
type Group = { id: string; label: string; rows: { key: string; cells: (MetricEntry | undefined)[] }[] }

/** Lines the districts up metric by metric. A district that lacks a metric keeps an empty place in the row. */
function rowsOf(perDistrict: MetricEntry[][]): Group['rows'] {
  const keys = [...new Set(perDistrict.flatMap((metrics) => metrics.map((metric) => metric.key)))]
  return keys.map((key) => ({ key, cells: perDistrict.map((metrics) => metrics.find((metric) => metric.key === key)) }))
}

function groupsOf(districts: District[], rentalLabel: string): Group[] {
  const first = districts[0]
  if (!first) return []
  const groups = first.categories.map((category) => ({
    id: category.category as string,
    label: category.label,
    rows: rowsOf(districts.map((district) => district.categories.find((other) => other.category === category.category)?.metrics ?? [])),
  }))
  const rental = rowsOf(districts.map((district) => [district.yield_gross, district.payback_years].filter((metric) => metric != null)))
  return [...groups, { id: 'rental', label: rentalLabel, rows: rental }].filter((group) => group.rows.length > 0)
}

/**
 * Compare: the user ticks two to four districts and the API's values are shown side by side, one table per category.
 * The choice lives in the page address (?codes=a,b), so a comparison can be shared and nothing is stored.
 * No cell is marked as better or worse: the page shows values, never a verdict.
 */
export function ComparePage() {
  const { t } = useTranslation()
  usePageTitle(t('compare.title'))
  const id = useId()
  const [params, setParams] = useSearchParams()
  const codes = (params.get('codes') ?? '').split(',').filter(Boolean)
  const districts = useDistricts()
  const compare = useCompare(codes)
  const full = codes.length >= MAX_DISTRICTS
  const unknown = compare.error instanceof ApiError && (compare.error.status === 404 || compare.error.status === 422)

  function toggle(code: string, chosen: boolean) {
    const next = chosen ? [...codes, code] : codes.filter((other) => other !== code)
    setParams(next.length > 0 ? { codes: next.join(',') } : {}, { replace: true })
  }

  const chosen = compare.data?.districts ?? []
  const groups = groupsOf(chosen, t('detail.rental'))

  return (
    <>
      <h1>{t('compare.heading')}</h1>
      <p>{t('compare.intro')}</p>

      <fieldset className="card compare-picker">
        <legend>{t('compare.choose', { min: MIN_DISTRICTS, max: MAX_DISTRICTS })}</legend>
        {districts.isPending && <Loading />}
        {districts.isError && <ErrorMessage error={districts.error} onRetry={() => void districts.refetch()} />}
        <ul className="compare-picker__list">
          {districts.data?.districts?.map((district) => {
            const checked = codes.includes(district.code)
            return (
              <li key={district.code}>
                <label>
                  {/* At four districts the others cannot be added. They stay focusable, and the line below says why. */}
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-disabled={(full && !checked) || undefined}
                    aria-describedby={`${id}-count`}
                    onChange={(event) => {
                      if (event.target.checked && full) return
                      toggle(district.code, event.target.checked)
                    }}
                  />
                  <span>{district.name}</span>
                </label>
              </li>
            )
          })}
        </ul>
        <p className="note" id={`${id}-count`}>
          {t(full ? 'compare.countFull' : 'compare.count', { count: codes.length, max: MAX_DISTRICTS })}
        </p>
        {codes.length > 0 && (
          <p className="find-actions">
            <button type="button" className="button-secondary" onClick={() => setParams({}, { replace: true })}>
              {t('compare.clear')}
            </button>
          </p>
        )}
      </fieldset>

      {/* Announced politely to screen readers when the choice changes and when the tables arrive. */}
      <p role="status" className="note">
        {codes.length < MIN_DISTRICTS
          ? t('compare.tooFew', { min: MIN_DISTRICTS })
          : codes.length > MAX_DISTRICTS
            ? t('compare.tooMany', { max: MAX_DISTRICTS })
            : compare.isPending
              ? t('states.loading')
              : compare.data
                ? t('compare.ready', { names: chosen.map((district) => district.name).join(', ') })
                : ''}
      </p>
      {unknown && (
        <p className="error-message" role="alert">
          {t('compare.unknown')}
        </p>
      )}
      {compare.isError && !unknown && <ErrorMessage error={compare.error} onRetry={() => void compare.refetch()} />}

      {groups.map((group) => (
        <section key={group.id} className="card" aria-labelledby={`${id}-${group.id}`}>
          <h2 id={`${id}-${group.id}`}>{group.label}</h2>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be focusable */}
          <div className="table-scroll" role="region" aria-label={t('compare.region', { label: group.label })} tabIndex={0}>
            <table className="compare-table" aria-labelledby={`${id}-${group.id}`}>
              <thead>
                <tr>
                  <th scope="col">{t('compare.metric')}</th>
                  {chosen.map((district) => (
                    <th scope="col" key={district.code}>
                      <Link to={`/districts/${district.code}`}>{district.name}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const named = row.cells.find((cell) => cell?.label)
                  const source = row.cells.find((cell) => cell && cell.available !== false)
                  return (
                    <tr key={row.key}>
                      <th scope="row">
                        {named?.label ?? row.key}
                        {source && source.available !== false && (
                          <span className="note compare-table__source">
                            {t('provenance.source')}: {source.source.name}
                          </span>
                        )}
                      </th>
                      {row.cells.map((cell, index) => (
                        <td key={chosen[index]?.code ?? index}>
                          {!cell ? (
                            <span className="no-data">{t('metric.noData')}</span>
                          ) : cell.available === false ? (
                            // A metric without data shows the API's reason, never a zero.
                            <>
                              <span className="no-data">{t('metric.noData')}</span> {cell.reason}
                            </>
                          ) : (
                            <>
                              <span className="compare-table__value">{cell.display}</span> <DataKindBadge kind={cell.data_kind} />
                              <span className="note compare-table__source">
                                {t('provenance.asOf')}: {cell.as_of}
                              </span>
                            </>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {compare.data && (
        <>
          {/* The API's own note: scores compare the districts of this city only. */}
          {chosen[0]?.score_note && <p className="note">{chosen[0].score_note}</p>}
          <p className="note">{t('compare.more')}</p>
        </>
      )}
    </>
  )
}
