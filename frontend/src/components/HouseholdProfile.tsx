import { useId } from 'react'
import { useTranslation } from 'react-i18next'

export const MIN_SIZE = 15
export const MAX_SIZE = 250

/** What a household sets for itself. It lives in the page's memory only: never stored, never sent. */
export type Profile = {
  /** The district of the work place, or '' for none. */
  work: string
  tenure: 'none' | 'buy' | 'rent'
  /** The highest price or monthly rent, as typed. */
  amount: string
  /** The size of the flat in square metres, as typed. */
  size: string
}

export const EMPTY_PROFILE: Profile = { work: '', tenure: 'none', amount: '', size: '50' }

/** The typed text as a number, or null when it is not one. A decimal comma is accepted. */
export function typedNumber(text: string): number | null {
  const value = Number(text.trim().replace(/\s/g, '').replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) ? value : null
}

type Props = {
  profile: Profile
  onChange: (next: Profile) => void
  districts: { code: string; name: string }[]
}

/**
 * The household's own conditions for the ranking: where it works, and what it can pay for a flat of a given size.
 * Nothing here changes the score. The work place adds a column of travel times; the budget hides the districts whose
 * median price or rent, times the size, is above the amount. A field that cannot be read says so in text and switches
 * the budget off until it is put right.
 */
export function HouseholdProfile({ profile, onChange, districts }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const amount = typedNumber(profile.amount)
  const size = typedNumber(profile.size)
  const amountWrong = profile.tenure !== 'none' && profile.amount.trim() !== '' && (amount === null || amount <= 0)
  const sizeWrong = profile.tenure !== 'none' && (size === null || size < MIN_SIZE || size > MAX_SIZE)

  return (
    <section className="card" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{t('profile.heading')}</h2>
      <p className="note">{t('profile.private')}</p>

      <div className="field">
        <label htmlFor={`${id}-work`}>{t('profile.work')}</label>
        <select id={`${id}-work`} value={profile.work} onChange={(event) => onChange({ ...profile, work: event.target.value })}>
          <option value="">{t('profile.noWork')}</option>
          {districts.map((district) => (
            <option key={district.code} value={district.code}>
              {district.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="importance">
        <legend>{t('profile.budget')}</legend>
        <div className="importance__choices">
          {(['none', 'buy', 'rent'] as const).map((tenure) => (
            <label key={tenure}>
              <input type="radio" name={`${id}-tenure`} checked={profile.tenure === tenure} onChange={() => onChange({ ...profile, tenure })} />
              {t(`profile.tenure.${tenure}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {profile.tenure !== 'none' && (
        <>
          <div className="field">
            <label htmlFor={`${id}-amount`}>{t(profile.tenure === 'buy' ? 'profile.maxPrice' : 'profile.maxRent')}</label>
            <input
              id={`${id}-amount`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={profile.amount}
              onChange={(event) => onChange({ ...profile, amount: event.target.value })}
              aria-invalid={amountWrong ? true : undefined}
              aria-describedby={amountWrong ? `${id}-amount-error` : undefined}
            />
            {amountWrong && (
              <p className="error-message" id={`${id}-amount-error`}>
                {t('profile.amountInvalid')}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor={`${id}-size`}>{t('rentBuy.size')}</label>
            <input
              id={`${id}-size`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={profile.size}
              onChange={(event) => onChange({ ...profile, size: event.target.value })}
              aria-invalid={sizeWrong ? true : undefined}
              aria-describedby={sizeWrong ? `${id}-size-error ${id}-size-hint` : `${id}-size-hint`}
            />
            <p className="note" id={`${id}-size-hint`}>
              {t('rentBuy.sizeHint', { min: MIN_SIZE, max: MAX_SIZE })}
            </p>
            {sizeWrong && (
              <p className="error-message" id={`${id}-size-error`}>
                {t('rentBuy.invalid', { min: MIN_SIZE, max: MAX_SIZE })}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
