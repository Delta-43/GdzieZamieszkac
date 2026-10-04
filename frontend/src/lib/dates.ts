// Dates arrive from the API as ISO strings ("2026-09-30"). They are shown in words, in the language of the page
// ("30 września 2026"). This is formatting of a date, not translation of API text.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

/** The date in words, or the text as sent when it is not an ISO date. */
export function dateInWords(iso: string, language: string): string {
  const match = ISO_DATE.exec(iso)
  if (!match) return iso
  // Read as UTC, so the day never moves with the reader's time zone.
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) return iso
  // The interface is in British English, so the day comes first in English too.
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

/** The value for the dateTime attribute of <time>: the day alone, or nothing when the text is not an ISO date. */
export function machineDate(iso: string): string | undefined {
  return ISO_DATE.exec(iso)?.[0]
}
