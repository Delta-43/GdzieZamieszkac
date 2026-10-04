import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useBasemap } from '../api/useBasemap'
import { useScoreMap } from '../api/useScoreMap'
import { DistrictMap } from '../components/DistrictMap'
import { DistrictSearch } from '../components/DistrictSearch'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { MapLegend } from '../components/MapLegend'
import { usePageTitle } from '../lib/usePageTitle'

/** The home page: what the portal is, a search by district name, and the map, which is what the portal is about. */
export function HomePage() {
  const { t } = useTranslation()
  usePageTitle(t('home.title'))
  const navigate = useNavigate()
  const basemap = useBasemap()
  const map = useScoreMap()
  // Both the search and the map lead to the same place: the map page, with that district chosen and zoomed to.
  const open = (code: string) => navigate(`/districts?district=${encodeURIComponent(code)}`)

  return (
    <>
      <div className="home-hero">
        <div className="home-hero__intro">
          <h1>{t('home.heading')}</h1>
          <p>{t('home.what')}</p>

          {map.districts.length > 0 && <DistrictSearch districts={map.districts} onChoose={open} />}

          <p className="find-actions">
            <Link className="button-primary" to="/districts">
              {t('home.cta')}
            </Link>
            <Link className="button-secondary" to="/find">
              {t('nav.findDistrict')}
            </Link>
          </p>
        </div>

        <section className="card map-card home-map" aria-labelledby="home-map-heading">
          <h2 id="home-map-heading">{t('home.map.heading', { metric: map.metricLabel })}</h2>
          <p className="note">{t('home.map.hint')}</p>
          {map.error && <ErrorMessage error={map.error} onRetry={map.retry} />}
          {!map.boundaries && !map.error && <Loading />}
          {map.boundaries && (
            <>
              <div className="map-stage">
                <DistrictMap
                  boundaries={map.boundaries}
                  values={map.mapValues}
                  classCount={map.classCount}
                  metricLabel={map.metricLabel}
                  loading={map.loading}
                  selected={null}
                  onSelect={open}
                  basemap={basemap}
                  classes={map.classes}
                  extras={map.extras}
                />
              </div>
              {map.classes.length > 0 && <MapLegend classes={map.classes} hasGaps={map.hasGaps && !map.loading} />}
            </>
          )}
        </section>
      </div>

      <p>{t('home.notListings')}</p>

      {/* A concept, not a feature: the city has not approved it, so there is no endpoint and no data (../../TODO.md, P2). */}
      <section className="concept-note" aria-labelledby="notices-heading">
        <h2 id="notices-heading">
          {t('home.notices.heading')} <span className="concept-note__badge">{t('home.notices.badge')}</span>
        </h2>
        <p>{t('home.notices.text')}</p>
      </section>
    </>
  )
}
