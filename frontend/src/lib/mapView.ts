import type { components } from '../api/schema'

type DataKind = components['schemas']['DataKind']

/** One district's value in the current view of the map, whatever the view is (a category score or a single measure). */
export type ViewValue = {
  district: string
  value: number
  /** The API's display string, or the number as sent where the contract has no display string yet. */
  display: string
  dataKind?: DataKind
  rank?: { position: number; of: number; direction?: 'higher is better' | 'lower is better' }
}

/** What the map, the legend, the list and the details all show. */
export type MapView = {
  label: string
  description?: string
  unit?: string
  dataKind?: DataKind
  /** Whether more of the measure is better, from the catalogue. A score is always "better". */
  higherIs?: 'better' | 'worse' | 'neutral'
  source?: { name: string; asOf?: string }
  /** The API's note for a score: it compares the districts of one city only. */
  note?: string
  /** Set when the measure has no data in this city: the API's reason. */
  unavailableReason?: string
  values: ViewValue[]
}
