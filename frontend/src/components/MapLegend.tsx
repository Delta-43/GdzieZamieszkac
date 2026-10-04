import { useTranslation } from 'react-i18next'
import type { ClassInfo } from '../lib/classes'

type Props = {
  classes: ClassInfo[]
  hasGaps: boolean
  /** The same choice as on the map: steps of one blue for a measure, red to green for a score. */
  palette?: 'measure' | 'score'
}

/**
 * The key of the map in one line: the colours in order from the lowest class to the highest, with words at both ends,
 * and the pattern for "no data". The range of each class is in the card of a district and in the list.
 */
export function MapLegend({ classes, hasGaps, palette = 'measure' }: Props) {
  const { t } = useTranslation()
  return (
    <p className="map-legend">
      <span>{t(palette === 'score' ? 'districts.legend.lowerScore' : 'districts.legend.lower')}</span>
      <span className="map-legend__scale" aria-hidden="true">
        {classes.map((item) => (
          <span key={item.number} className={`map-legend__swatch map-legend__swatch--${palette} map-legend__swatch--c${item.number}`} />
        ))}
      </span>
      <span>{t(palette === 'score' ? 'districts.legend.higherScore' : 'districts.legend.higher')}</span>
      {hasGaps && (
        <span className="map-legend__gap">
          <span className="map-legend__swatch map-legend__swatch--none" aria-hidden="true" />
          {t('districts.legend.noData')}
        </span>
      )}
    </p>
  )
}
