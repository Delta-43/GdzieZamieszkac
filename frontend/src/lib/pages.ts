/** The pages of the portal, in one place for the menu. A page is listed here only when it exists. */
export const PAGES = [
  { to: '/', labelKey: 'nav.home', end: true },
  { to: '/districts', labelKey: 'nav.districts', end: true },
  { to: '/find', labelKey: 'nav.findDistrict', end: true },
  { to: '/compare', labelKey: 'nav.compare', end: true },
  { to: '/feedback', labelKey: 'nav.feedback', end: true },
  { to: '/sources', labelKey: 'nav.sources', end: true },
] as const

/** Lower case and without diacritics, so "lagiewniki" finds "Łagiewniki". */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .trim()
}
