import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { SCORED_CATEGORIES, useAllCategoryScores, useDistrictReport } from '../api/useDistrictsData'
import { CLASS_COUNT, classify } from '../lib/classes'
import type { MapView, ViewValue } from '../lib/mapView'
import { plainNumber } from '../lib/plainNumber'
import { DataKindBadge } from './DataKindBadge'
import { Loading } from './Loading'

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
  const report = useDistrictReport(district?.code)

  if (!district) return <p>{t('districts.details.none')}</p>

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

      {report.isPending && <Loading />}
      {/* A district without a stored report shows no report section. */}
      {report.data && (
        <section className="report" aria-labelledby={`report-${district.code}`}>
          <h4 id={`report-${district.code}`}>{t('report.heading')}</h4>
          {/* Required label: the text was written by artificial intelligence from the data. */}
          <p className="ai-label">{t('report.label')}</p>
          {report.data.lang_fallback && (
            <p className="notice" role="status">
              {t('report.fallback')}
            </p>
          )}
          {/* The body is plain text. Paragraphs are split on blank lines and it is never inserted as HTML. */}
          <div lang={report.data.lang}>
            {report.data.body.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <p className="note">{t('report.generated', { date: report.data.generated_at.slice(0, 10) })}</p>
        </section>
      )}

      <p>
        <button type="button" className="button-secondary" onClick={onBack}>
          {t('districts.details.backToList')}
        </button>
      </p>
    </div>
  )
}
