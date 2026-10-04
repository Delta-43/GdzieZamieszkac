/**
 * The pages of the portal, in one place for the header, the menu and the footer. A page is listed here only when it
 * exists. The pages marked `quick` are the steps of the main flow: they are also shortcuts in the header on a wide screen.
 */
export const PAGES = [
  { to: '/', labelKey: 'nav.home', end: true, quick: false },
  { to: '/districts', labelKey: 'nav.districts', end: true, quick: true },
  { to: '/find', labelKey: 'nav.findDistrict', end: true, quick: true },
  { to: '/compare', labelKey: 'nav.compare', end: true, quick: true },
  { to: '/feedback', labelKey: 'nav.feedback', end: true, quick: false },
  { to: '/sources', labelKey: 'nav.sources', end: true, quick: false },
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
