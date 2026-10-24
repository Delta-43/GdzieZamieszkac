import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/** The strip above every page of the demo: the figures are samples, and nothing is sent anywhere. */
export function DemoBanner() {
  const { t } = useTranslation()
  return (
    <aside className="demo-banner" aria-label={t('demo.heading')}>
      <p>
        {t('demo.banner')} <Link to="/sources">{t('demo.bannerLink')}</Link>
      </p>
    </aside>
  )
}

/** What the demo is and what is made up, at the top of the page Sources and how it works. */
export function DemoAbout() {
  const { t } = useTranslation()
  return (
    <section className="notice demo-about" aria-labelledby="demo-about-heading">
      <h2 id="demo-about-heading">{t('demo.heading')}</h2>
      <p>{t('demo.what')}</p>
      <p>{t('demo.sample')}</p>
      <p>{t('demo.ai')}</p>
      <p>{t('demo.forms')}</p>
      <p>{t('demo.licence')}</p>
    </section>
  )
}
