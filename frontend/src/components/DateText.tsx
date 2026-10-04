import { useTranslation } from 'react-i18next'
import { dateInWords, machineDate } from '../lib/dates'

/** A date from the API, in words for people and as an ISO date for machines. */
export function DateText({ value }: { value: string }) {
  const { i18n } = useTranslation()
  return <time dateTime={machineDate(value)}>{dateInWords(value, i18n.language)}</time>
}
