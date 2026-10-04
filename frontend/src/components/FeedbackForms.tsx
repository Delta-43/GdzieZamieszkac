import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'
import { noteText, useSendFeedback, type FeedbackBody } from '../api/useFeedback'
import { useDistricts, useMetrics } from '../api/useDistrictsData'

// The limits in city-service/openapi.yaml.
const RENT_MIN = 100
const RENT_MAX = 50_000
const MESSAGE_MIN = 10
const MESSAGE_MAX = 500
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const SIZE_BANDS = ['up_to_30', '31_50', '51_70', 'over_70'] as const

type Errors = Record<string, string>

function sendError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 413) return 'feedback.error.tooLarge' as const
    if (error.status === 422) return 'feedback.error.invalid' as const
    if (error.status === 429) return error.retryAfter ? ('feedback.error.tooManySeconds' as const) : ('feedback.error.tooMany' as const)
    if (error.status === 503) return 'feedback.error.unavailable' as const
  }
  return 'feedback.error.generic' as const
}

/** One labelled control with its hint and, when it is wrong, its error in text, tied to the control. */
function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: (describedBy: string) => ReactNode }) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(describedBy)}
      {hint && (
        <p className="note" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="error-message" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

/** The shared part of both forms: the send button, the result and the error. `ready` is false until the service has said what happens to a report. */
function useForm(ready: boolean) {
  const send = useSendFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<Errors>({})

  /** Shows the errors in text and puts the focus on the first control that is wrong. */
  function reject(next: Errors, order: string[], id: string) {
    setErrors(next)
    const first = order.find((field) => next[field])
    if (first) formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-${first}`)}`)?.focus()
  }

  function submit(event: FormEvent, validate: () => FeedbackBody | null) {
    event.preventDefault()
    // One request at a time, and nothing before the person has been told what happens to a report.
    if (send.isPending || !ready) return
    const body = validate()
    if (body) send.mutate(body, { onSuccess: () => formRef.current?.reset() })
  }

  return { send, formRef, errors, setErrors, reject, submit }
}

function Result({ send }: { send: ReturnType<typeof useSendFeedback> }) {
  const { t, i18n } = useTranslation()
  return (
    <>
      {/* Announced politely: while it is sent and when the answer arrives. */}
      <p role="status" className="note">
        {send.isPending ? t('feedback.sending') : ''}
      </p>
      {send.isSuccess && (
        <div role="status" className="notice" lang={i18n.language}>
          <p>
            <strong>{t('feedback.sent')}</strong>
          </p>
          <p>{noteText(send.data.note)}</p>
        </div>
      )}
      {send.isError && (
        <p className="error-message" role="alert">
          {t(sendError(send.error), { seconds: send.error instanceof ApiError ? send.error.retryAfter : undefined })}
        </p>
      )}
    </>
  )
}

function DistrictSelect({ id, error, describedBy }: { id: string; error?: string; describedBy: string }) {
  const { t } = useTranslation()
  const districts = useDistricts()
  return (
    <select id={id} name="district" aria-required="true" defaultValue="" aria-invalid={error ? true : undefined} aria-describedby={describedBy || undefined}>
      <option value="">{t('feedback.choose')}</option>
      {districts.data?.districts.map((district) => (
        <option key={district.code} value={district.code}>
          {district.name}
        </option>
      ))}
    </select>
  )
}

export function RentPaidForm({ ready }: { ready: boolean }) {
  const { t } = useTranslation()
  const id = useId()
  const { send, formRef, errors, reject, submit } = useForm(ready)

  function validate(): FeedbackBody | null {
    const data = new FormData(formRef.current ?? undefined)
    const district = String(data.get('district') ?? '')
    const rent = Number(String(data.get('rent') ?? '').replace(',', '.'))
    const size = String(data.get('size') ?? '')
    const month = String(data.get('month') ?? '').trim()
    const next: Errors = {}
    if (!district) next.district = t('feedback.errors.district')
    if (!Number.isInteger(rent) || rent < RENT_MIN || rent > RENT_MAX) next.rent = t('feedback.errors.rent', { min: RENT_MIN, max: RENT_MAX })
    if (!SIZE_BANDS.includes(size as (typeof SIZE_BANDS)[number])) next.size = t('feedback.errors.size')
    if (!MONTH.test(month)) next.month = t('feedback.errors.month')
    if (Object.keys(next).length) {
      reject(next, ['district', 'rent', 'size', 'month'], id)
      return null
    }
    reject({}, [], id)
    return { type: 'rent_paid', district, rent_pln: rent, size_band: size as (typeof SIZE_BANDS)[number], month }
  }

  return (
    <section className="card" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{t('feedback.rent.heading')}</h2>
      <p>{t('feedback.rent.intro')}</p>
      <p className="note">{t('feedback.required')}</p>
      <form ref={formRef} onSubmit={(event) => submit(event, validate)} noValidate>
        <Field id={`${id}-district`} label={t('feedback.fields.district')} error={errors.district}>
          {(describedBy) => <DistrictSelect id={`${id}-district`} error={errors.district} describedBy={describedBy} />}
        </Field>
        <Field id={`${id}-rent`} label={t('feedback.fields.rent')} hint={t('feedback.hints.rent', { min: RENT_MIN, max: RENT_MAX })} error={errors.rent}>
          {(describedBy) => (
            <input id={`${id}-rent`} aria-required="true" name="rent" type="text" inputMode="numeric" autoComplete="off" aria-invalid={errors.rent ? true : undefined} aria-describedby={describedBy} />
          )}
        </Field>
        <Field id={`${id}-size`} label={t('feedback.fields.size')} error={errors.size}>
          {(describedBy) => (
            <select id={`${id}-size`} aria-required="true" name="size" defaultValue="" aria-invalid={errors.size ? true : undefined} aria-describedby={describedBy || undefined}>
              <option value="">{t('feedback.choose')}</option>
              {SIZE_BANDS.map((band) => (
                <option key={band} value={band}>
                  {t(`feedback.sizes.${band}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id={`${id}-month`} label={t('feedback.fields.month')} hint={t('feedback.hints.month')} error={errors.month}>
          {(describedBy) => (
            <input id={`${id}-month`} aria-required="true" name="month" type="text" inputMode="numeric" autoComplete="off" placeholder="2026-09" aria-invalid={errors.month ? true : undefined} aria-describedby={describedBy} />
          )}
        </Field>
        <p className="find-actions">
          <button type="submit" className="button-primary" disabled={!ready} aria-disabled={send.isPending || undefined}>
            {t('feedback.submit')}
          </button>
        </p>
      </form>
      <Result send={send} />
    </section>
  )
}

export function DataProblemForm({ ready }: { ready: boolean }) {
  const { t } = useTranslation()
  const id = useId()
  const metrics = useMetrics()
  const { send, formRef, errors, reject, submit } = useForm(ready)

  function validate(): FeedbackBody | null {
    const data = new FormData(formRef.current ?? undefined)
    const district = String(data.get('district') ?? '')
    const metric = String(data.get('metric') ?? '')
    const message = String(data.get('message') ?? '').trim()
    const next: Errors = {}
    if (!district) next.district = t('feedback.errors.district')
    if (!metric) next.metric = t('feedback.errors.metric')
    if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) next.message = t('feedback.errors.message', { min: MESSAGE_MIN, max: MESSAGE_MAX })
    if (Object.keys(next).length) {
      reject(next, ['district', 'metric', 'message'], id)
      return null
    }
    reject({}, [], id)
    return { type: 'data_problem', district, metric_key: metric, message }
  }

  return (
    <section className="card" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{t('feedback.problem.heading')}</h2>
      <p>{t('feedback.problem.intro')}</p>
      <p className="note">{t('feedback.required')}</p>
      <form ref={formRef} onSubmit={(event) => submit(event, validate)} noValidate>
        <Field id={`${id}-district`} label={t('feedback.fields.district')} error={errors.district}>
          {(describedBy) => <DistrictSelect id={`${id}-district`} error={errors.district} describedBy={describedBy} />}
        </Field>
        <Field id={`${id}-metric`} label={t('feedback.fields.metric')} error={errors.metric}>
          {(describedBy) => (
            <select id={`${id}-metric`} aria-required="true" name="metric" defaultValue="" aria-invalid={errors.metric ? true : undefined} aria-describedby={describedBy || undefined}>
              <option value="">{t('feedback.choose')}</option>
              {metrics.data
                ?.filter((metric) => metric.available)
                .map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.label}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field id={`${id}-message`} label={t('feedback.fields.message')} hint={t('feedback.hints.message', { min: MESSAGE_MIN, max: MESSAGE_MAX })} error={errors.message}>
          {(describedBy) => (
            <textarea id={`${id}-message`} aria-required="true" name="message" rows={4} maxLength={MESSAGE_MAX} aria-invalid={errors.message ? true : undefined} aria-describedby={describedBy} />
          )}
        </Field>
        <p className="find-actions">
          <button type="submit" className="button-primary" disabled={!ready} aria-disabled={send.isPending || undefined}>
            {t('feedback.submit')}
          </button>
        </p>
      </form>
      <Result send={send} />
    </section>
  )
}
