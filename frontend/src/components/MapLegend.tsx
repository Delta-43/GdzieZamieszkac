import { useTranslation } from 'react-i18next'
import type { ClassInfo } from '../lib/classes'

type Props = {
  classes: ClassInfo[]
  hasGaps: boolean
  /** The measure on the map, and whether more of it is better: both from the catalogue of the API. */
  label: string
  higherIs?: 'better' | 'worse' | 'neutral'
}

/**
 * The key of the map: the colours in one line, from the lowest step to the highest, with words at both ends and the
 * pattern for "no data"; then a sentence that says what darker means for this measure and whether more is better.
 * Colour means more or less, never good or bad. The range of each step is in the card of a district and in the list.
 */
export function MapLegend({ classes, hasGaps, label, higherIs }: Props) {
  const { t } = useTranslation()
  return (
    <>
      <p className="map-legend">
        <span>{t('districts.legend.lower')}</span>
        <span className="map-legend__scale" aria-hidden="true">
          {classes.map((item) => (
            <span key={item.number} className={`map-legend__swatch map-legend__swatch--c${item.number}`} />
          ))}
        </span>
        <span>{t('districts.legend.higher')}</span>
        {hasGaps && (
          <span className="map-legend__gap">
            <span className="map-legend__swatch map-legend__swatch--none" aria-hidden="true" />
            {t('districts.legend.noData')}
          </span>
        )}
      </p>
      <p className="note map-legend__direction">
        {t('districts.legend.darker', { label })} {higherIs && t(`districts.legend.${higherIs}`)}
      </p>
    </>
  )
}
