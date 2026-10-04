import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'
import { useMetrics, useRentVsBuy } from '../api/useDistrictsData'
import { DataKindBadge } from './DataKindBadge'
import { ErrorMessage } from './ErrorMessage'
import { Loading } from './Loading'

// The sizes the API accepts (the contract's minimum and maximum), and the size the section opens with.
const MIN_SIZE = 15
const MAX_SIZE = 250
const START_SIZE = 50

type Props = {
  code: string
  /** The API's own names for the two derived figures, from the district's detail. */
  yieldLabel?: string
  paybackLabel?: string
}

/**
 * Rent versus buy for a flat of a chosen size: the price and the monthly rent the API estimates from the district's
 * medians, with the yield and the payback period. Every figure is the API's display string. The result is marked as an
 * estimate, the API's caveat is always on the page, and the medians behind it are listed. The API is asked only when the
 * form is sent. The section is hidden when the API answers 501.
 */
export function RentVsBuy({ code, yieldLabel, paybackLabel }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [typed, setTyped] = useState(String(START_SIZE))
  const [size, setSize] = useState(START_SIZE)
  const [invalid, setInvalid] = useState(false)
  const result = useRentVsBuy(code, size)
  const metrics = useMetrics()
  const labels = new Map(metrics.data?.map((metric) => [metric.key, metric.label]))

  if (result.error instanceof ApiError && result.error.status === 501) return null

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(typed.replace(',', '.'))
    if (typed.trim() === '' || !Number.isFinite(value) || value < MIN_SIZE || value > MAX_SIZE) {
      setInvalid(true)
      // The focus goes to the field the message is about.
      event.currentTarget.querySelector('input')?.focus()
      return
    }
    setInvalid(false)
    setSize(value)
  }

  const data = result.data

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{t('rentBuy.heading')}</h2>
      <div className="card">
        <form className="rent-buy__form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor={`${id}-size`}>{t('rentBuy.size')}</label>
            <input
              id={`${id}-size`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={invalid ? `${id}-error ${id}-hint` : `${id}-hint`}
            />
            <p className="note" id={`${id}-hint`}>
              {t('rentBuy.sizeHint', { min: MIN_SIZE, max: MAX_SIZE })}
            </p>
            {invalid && (
              <p className="error-message" id={`${id}-error`}>
                {t('rentBuy.invalid', { min: MIN_SIZE, max: MAX_SIZE })}
              </p>
            )}
          </div>
          <button type="submit" className="button-primary" aria-busy={result.isFetching || undefined}>
            {t('rentBuy.submit')}
          </button>
        </form>

        {/* Announced politely when the figures for a new size arrive. */}
        <div role="status">
          {result.isPending && <Loading />}
          {result.isError && <ErrorMessage error={result.error} onRetry={() => void result.refetch()} />}
          {data && (
            <>
              <p className="rent-buy__for">
                {t('rentBuy.resultFor', { size: String(data.area_m2).replace('.', ',') })} <DataKindBadge kind={data.data_kind} />
              </p>
              <dl className="metrics">
                <div className="metric">
                  <dt>{t('rentBuy.price')}</dt>
                  <dd>
                    <p className="metric__value">{data.price.display}</p>
                  </dd>
                </div>
                <div className="metric">
                  <dt>{t('rentBuy.rent')}</dt>
                  <dd>
                    <p className="metric__value">{data.monthly_rent.display}</p>
                  </dd>
                </div>
                {data.yield_display && (
                  <div className="metric">
                    <dt>{yieldLabel ?? t('rentBuy.yield')}</dt>
                    <dd>
                      <p className="metric__value">{data.yield_display}</p>
                    </dd>
                  </div>
                )}
                {data.payback_display && (
                  <div className="metric">
                    <dt>{paybackLabel ?? t('rentBuy.payback')}</dt>
                    <dd>
                      <p className="metric__value">{data.payback_display}</p>
                    </dd>
                  </div>
                )}
              </dl>
              <p className="metric__caveat">
                <strong>{t('metric.caveat')}:</strong> {data.caveat}
              </p>
              {data.based_on && data.based_on.length > 0 && (
                <>
                  <p className="note rent-buy__based">{t('rentBuy.basedOn')}</p>
                  <ul className="rent-buy__based-list">
                    {data.based_on.map((item) => (
                      <li key={item.key}>
                        {labels.get(item.key) ?? item.key}: {item.display} <DataKindBadge kind={item.data_kind} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
