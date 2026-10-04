import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import type { MapView, ViewValue } from '../lib/mapView'
import { DataKindBadge } from './DataKindBadge'
import { ScoreValue } from './ScoreValue'

type District = components['schemas']['DistrictListItem']
type MetricDefinition = components['schemas']['MetricDefinition']

type Props = {
  districts: District[]
  metricsByKey: Map<string, MetricDefinition>
  scoreKey: string
  view: MapView
  /** False while the map shows the overall score itself: the list then needs no second value column. */
  showView: boolean
  valueOf: Map<string, ViewValue>
  /** The place of each district by the overall score, where the API sends one. */
  rankOf: Map<string, { position: number; of: number } | undefined>
  selected: string | null
  onSelect: (code: string) => void
}

/**
 * The list beside the map, kept short: each district with its place and its overall score (a whole number and a bar),
 * and the value shown on the map when the map shows something else. Everything else about a district is on its details tab and its page.
 */
export function DistrictsTable({ districts, metricsByKey, scoreKey, view, showView, valueOf, rankOf, selected, onSelect }: Props) {
  const { t } = useTranslation()
  const scoreKind = metricsByKey.get(scoreKey)?.data_kind
  const noData = <span className="no-data">{t('districts.noData')}</span>

  return (
    // The table scrolls inside its own region when it is wider than its card. The region is focusable and labelled.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="table-scroll" role="region" aria-label={t('districts.table.region')} tabIndex={0}>
      <table>
        <caption>{t(showView ? 'districts.table.caption' : 'districts.table.captionScore', { metric: view.label })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('districts.table.district')}</th>
            <th scope="col">
              {/* The data kind of the score is the same for every row, so it is shown once, in the column header. */}
              {t('districts.table.score')} {scoreKind && <DataKindBadge kind={scoreKind} />}
            </th>
            {showView && <th scope="col">{view.label}</th>}
          </tr>
        </thead>
        <tbody>
          {districts.map((district) => {
            const value = valueOf.get(district.code)
            const isSelected = district.code === selected
            return (
              <tr key={district.code} aria-current={isSelected ? 'true' : undefined}>
                <th scope="row">
                  {/* Choosing a district here does the same as choosing it on the map. */}
                  <button type="button" className="link-button" onClick={() => onSelect(district.code)}>
                    {district.name}
                  </button>
                  {isSelected && <span className="selected-mark"> ({t('districts.table.selected')})</span>}
                </th>
                <td>{district.livability_score === null ? noData : <ScoreValue score={district.livability_score} rank={rankOf.get(district.code)} />}</td>
                {showView && (
                  <td>
                    {value ? (
                      <>
                        {value.display} {value.dataKind && <DataKindBadge kind={value.dataKind} />}
                      </>
                    ) : (
                      noData
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
