import { useTranslation } from 'react-i18next'
import type { ClassInfo } from '../lib/classes'

/** The scale of the map in words: each class with its number, its swatch and its range, plus the "no data" pattern. */
export function MapLegend({ classes, hasGaps }: { classes: ClassInfo[]; hasGaps: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="map-legend">
      <h3>{t('districts.legend.title')}</h3>
      <p>{t('districts.legend.direction')}</p>
      <ul>
        {classes.map((item) => (
          <li key={item.number}>
            <span className={`map-legend__swatch map-legend__swatch--c${item.number}`} aria-hidden="true">
              {item.number}
            </span>
            {item.minDisplay === item.maxDisplay
              ? t('districts.legend.single', { number: item.number, value: item.minDisplay })
              : t('districts.legend.range', { number: item.number, min: item.minDisplay, max: item.maxDisplay })}
          </li>
        ))}
        {hasGaps && (
          <li>
            <span className="map-legend__swatch map-legend__swatch--none" aria-hidden="true" />
            {t('districts.legend.noData')}
          </li>
        )}
      </ul>
    </div>
  )
}
