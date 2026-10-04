import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { Link } from 'react-router'
import { SCORED_CATEGORIES, useAllCategoryScores } from '../api/useDistrictsData'
import { CLASS_COUNT, classify } from '../lib/classes'
import type { MapView, ViewValue } from '../lib/mapView'
import { plainNumber } from '../lib/plainNumber'
import { AreaReport } from './AreaReport'
import { DataKindBadge } from './DataKindBadge'

type District = components['schemas']['DistrictListItem']

type Props = {
  district: District | undefined
  view: MapView
  value: ViewValue | undefined
  classNumber: number | undefined
  categoryLabels: Map<string, string>
  onBack: () => void
}

/** The details of the chosen district: its value in the current view, its category profile and its area report. */
export function DistrictDetails({ district, view, value, classNumber, categoryLabels, onBack }: Props) {
  const { t, i18n } = useTranslation()
  const profile = useAllCategoryScores(Boolean(district))

  if (!district) return null

  return (
    <div className="district-details">
      <h3>{district.name}</h3>

      <dl className="provenance">
        <div>
          <dt>{view.label}</dt>
          <dd>
            {value ? (
              <>
                {value.display} {value.dataKind && <DataKindBadge kind={value.dataKind} />}
              </>
            ) : (
              <span className="no-data">{view.unavailableReason ?? t('districts.noData')}</span>
            )}
          </dd>
        </div>
        {value?.rank && (
          <div>
            <dt>{t('districts.table.rank')}</dt>
            <dd>
              {t('districts.rank', { position: value.rank.position, of: value.rank.of })}
              {value.rank.direction && ` (${t(value.rank.direction === 'higher is better' ? 'districts.higherIsBetter' : 'districts.lowerIsBetter')})`}
            </dd>
          </div>
        )}
        {classNumber && (
          <div>
            <dt>{t('districts.table.class')}</dt>
            <dd>{t('districts.classOf', { number: classNumber, count: CLASS_COUNT })}</dd>
          </div>
        )}
      </dl>

      <table>
        <caption>{t('districts.details.profile')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('districts.details.category')}</th>
            <th scope="col">{t('districts.details.score')}</th>
            <th scope="col">{t('districts.table.class')}</th>
          </tr>
        </thead>
        <tbody>
          {SCORED_CATEGORIES.map((category, index) => {
            const ranking = profile[index]?.data?.ranking
            const entry = ranking?.find((item) => item.code === district.code)
            const classOf = ranking ? classify(ranking.map((item) => ({ district: item.code, value: item.score, display: '' }))).classOf : undefined
            return (
              <tr key={category}>
                <th scope="row">{categoryLabels.get(category) ?? category}</th>
                <td>{entry ? plainNumber(entry.score, i18n.language) : profile[index]?.isPending ? '…' : <span className="no-data">{t('districts.noData')}</span>}</td>
                <td>{entry && classOf ? t('districts.details.classShort', { number: classOf.get(district.code), count: CLASS_COUNT }) : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {profile[0]?.data?.note && <p className="note">{profile[0].data.note}</p>}

      <AreaReport code={district.code} headingLevel="h4" />

      <p>
        <Link className="button-primary" to={`/districts/${district.code}`}>
          {t('detail.fullProfile')}
        </Link>
      </p>
      <p>
        <button type="button" className="button-secondary" onClick={onBack}>
          {t('districts.details.close')}
        </button>
      </p>
    </div>
  )
}
