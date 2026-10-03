import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { plainNumber } from '../lib/plainNumber'
import { DataKindBadge } from './DataKindBadge'

type District = components['schemas']['DistrictListItem']
type MetricDefinition = components['schemas']['MetricDefinition']
type MetricValue = components['schemas']['MetricValues']['values'][number]

type Props = {
  districts: District[]
  metricsByKey: Map<string, MetricDefinition>
  scoreKey: string
  /** The measure shown on the map, its value per district, and the map class per district. */
  metric: MetricDefinition
  valueOf: Map<string, MetricValue>
  classOf: Map<string, number>
  selected: string | null
}

/** The full equivalent of the map: every district with its score, area, highlight values and the chosen measure. */
export function DistrictsTable({ districts, metricsByKey, scoreKey, metric, valueOf, classOf, selected }: Props) {
  const { t, i18n } = useTranslation()
  const highlightKeys = [...new Set(districts.flatMap((district) => district.highlights.map((h) => h.key)))]
  const scoreKind = metricsByKey.get(scoreKey)?.data_kind
  const noData = <span className="no-data">{t('districts.noData')}</span>

  return (
    // A wide table scrolls inside its own region. The region is focusable and labelled, so the keyboard can scroll it.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="table-scroll" role="region" aria-label={t('districts.table.region')} tabIndex={0}>
      <table>
        <caption>{t('districts.table.caption', { metric: metric.label })}</caption>
        <thead>
          <tr>
            <th scope="col">{t('districts.table.district')}</th>
            <th scope="col">{t('districts.table.score')}</th>
            <th scope="col">{t('districts.table.area')}</th>
            {highlightKeys.map((key) => (
              // The list endpoint sends the key only; the label comes from the metric catalogue.
              <th scope="col" key={key}>
                {metricsByKey.get(key)?.label ?? key}
              </th>
            ))}
            <th scope="col">{metric.label}</th>
            <th scope="col">{t('districts.table.rank')}</th>
            <th scope="col">{t('districts.table.class')}</th>
          </tr>
        </thead>
        <tbody>
          {districts.map((district) => {
            const value = valueOf.get(district.code)
            const classNumber = classOf.get(district.code)
            const isSelected = district.code === selected
            return (
              <tr key={district.code} aria-current={isSelected ? 'true' : undefined}>
                <th scope="row">
                  {district.name}
                  {isSelected && <span className="selected-mark"> ({t('districts.table.selected')})</span>}
                </th>
                <td>
                  {district.livability_score === null ? (
                    noData
                  ) : (
                    <>
                      {plainNumber(district.livability_score, i18n.language)} {scoreKind && <DataKindBadge kind={scoreKind} />}
                    </>
                  )}
                </td>
                <td>{plainNumber(district.area_km2, i18n.language)}</td>
                {highlightKeys.map((key) => {
                  const highlight = district.highlights.find((h) => h.key === key)
                  return (
                    <td key={key}>
                      {highlight ? (
                        <>
                          {highlight.display} <DataKindBadge kind={highlight.data_kind} />
                        </>
                      ) : (
                        noData
                      )}
                    </td>
                  )
                })}
                <td>
                  {value ? (
                    <>
                      {value.display} {value.data_kind && <DataKindBadge kind={value.data_kind} />}
                    </>
                  ) : (
                    noData
                  )}
                </td>
                <td>{value?.rank ? t('districts.rank', { position: value.rank.position, of: value.rank.of }) : '–'}</td>
                <td>{classNumber ?? '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
