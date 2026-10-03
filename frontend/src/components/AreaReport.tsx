import { useTranslation } from 'react-i18next'
import { useDistrictReport } from '../api/useDistrictsData'
import { Loading } from './Loading'

/** The stored area report of a district, with the required label that artificial intelligence wrote it. */
export function AreaReport({ code, headingLevel }: { code: string; headingLevel: 'h2' | 'h4' }) {
  const { t } = useTranslation()
  const report = useDistrictReport(code)
  const Heading = headingLevel

  if (report.isPending) return <Loading />
  // A district without a stored report shows no report section.
  if (!report.data) return null

  return (
    <section className="report" aria-labelledby={`report-${code}`}>
      <Heading id={`report-${code}`}>{t('report.heading')}</Heading>
      {/* Required label (EU AI Act, Article 50): visible text, not only an icon. */}
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
  )
}
