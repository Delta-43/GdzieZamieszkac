// TEMPORARY, for a known contract gap (API.md, "Contract gaps"): the district score and area have no display string yet.
// Until the API sends one, show the number as the API sends it. In Polish the decimal point becomes a comma.
// No rounding and no grouping. Delete this file when the contract adds the *_display fields (backend task B2).
export function plainNumber(value: number, language: string): string {
  const text = String(value)
  return language === 'pl' ? text.replace('.', ',') : text
}
