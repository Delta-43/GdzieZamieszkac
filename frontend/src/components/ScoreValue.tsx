import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { wholeScore } from '../lib/score'

type Props = {
  score: number
  /** The district's place among the districts, where the API sends one. It leads, because 1 is always the best. */
  rank?: { position: number; of: number }
}

/** A score for a list: the place first, then the score as a whole number with "pkt". The bar repeats the number and adds nothing. */
export function ScoreValue({ score, rank }: Props) {
  const { t } = useTranslation()
  const whole = wholeScore(score)
  return (
    <span className="score-value">
      {rank && <span className="score-value__place">{t('score.place', { position: rank.position, of: rank.of })}</span>}
      <span className="score-value__points">{t('score.points', { value: whole })}</span>
      <span className="score-value__bar" aria-hidden="true">
        <span style={{ '--share': `${Math.min(100, Math.max(0, whole))}%` } as CSSProperties} />
      </span>
    </span>
  )
}
