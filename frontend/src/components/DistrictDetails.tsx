import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { Link } from 'react-router'
import { SCORED_CATEGORIES, useAllCategoryScores } from '../api/useDistrictsData'
import type { MapView, ViewValue } from '../lib/mapView'
import { AreaReport } from './AreaReport'
import { DataKindBadge } from './DataKindBadge'
import { ScoreValue } from './ScoreValue'

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
  const { t } = useTranslation()
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
              {/* The place: 1 is always the best. Whether more or less of the measure is better is a sentence of its own. */}
              {t('districts.rank', { position: value.rank.position, of: value.rank.of })}
              {value.rank.direction && `. ${t(value.rank.direction === 'higher is better' ? 'districts.higherIsBetter' : 'districts.lowerIsBetter')}`}
            </dd>
          </div>
        )}
        {/* A measure that is not ranked (more is neither better nor worse) says how large the value is, in words. */}
        {value && !value.rank && classNumber && (
          <div>
            <dt>{t('districts.compared')}</dt>
            <dd>{t('districts.stepOf', { step: t(`districts.step.${classNumber}`) })}</dd>
          </div>
        )}
      </dl>

      <table>
        <caption>{t('districts.details.profile')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('districts.details.category')}</th>
            <th scope="col">
              {t('districts.details.score')} ({t('score.placeHeader')})
            </th>
          </tr>
        </thead>
        <tbody>
          {SCORED_CATEGORIES.map((category, index) => {
            const ranking = profile[index]?.data?.ranking
            const entry = ranking?.find((item) => item.code === district.code)
            return (
              <tr key={category}>
                <th scope="row">{categoryLabels.get(category) ?? category}</th>
                <td>
                  {entry && ranking ? (
                    <ScoreValue score={entry.score} rank={{ position: entry.rank, of: ranking.length }} />
                  ) : profile[index]?.isPending ? (
                    '…'
                  ) : (
                    <span className="no-data">{t('districts.noData')}</span>
                  )}
                </td>
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
