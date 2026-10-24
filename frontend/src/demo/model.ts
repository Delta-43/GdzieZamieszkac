import type { Language } from '../i18n'

/** A text in both languages. */
export type Bilingual = { en: string; pl: string }

export type DemoDistrict = { code: string; name: string; number: string; area_km2: number; lon: number; lat: number }

export type DemoMetric = {
  key: string
  category: string
  label: Bilingual
  description: Bilingual
  unit: Bilingual
  higher_is: 'better' | 'worse' | 'neutral'
  refresh_cadence: 'weekly' | 'static'
  data_kind: 'observed' | 'estimated' | 'proxy'
  available: boolean
  reason: Bilingual | null
  has_series: boolean
  source: string
  decimals: number
  /** True for the few values that are real rows of the project database (school sports grounds, public defibrillators). */
  real: boolean
}

export type DemoSource = {
  name: string
  url?: string
  licence: string
  attribution: string
  as_of: string
  pl: { name: string; licence: string }
}

export type DemoPersona = { key: string; label: Bilingual; description: Bilingual; weights: { category: Record<string, number> } }

type BacktestMethod = { origins: number; mae_method: number; mae_no_change: number; mae_last_year_continues: number; coverage_80: number; passes: boolean; krakow?: { origins: number; mae_method: number; mae_no_change: number; mae_last_year_continues: number; coverage_80: number } }

/** The data of the demo, made by scripts/build-demo-fixtures.mjs. */
export type DemoModel = {
  districts: DemoDistrict[]
  metrics: DemoMetric[]
  /** metric key -> district code -> value and, where it has one, the number of observations behind it. */
  values: Record<string, Record<string, { value: number; n?: number }>>
  series: Record<string, { year: number; quarter: number; value: number; n: number }[]>
  /** Minutes by public transport, from district to district. Null: no connection found. */
  commute: Record<string, Record<string, number | null>>
  sources: Record<string, DemoSource>
  personas: DemoPersona[]
  backtest: { period: [string, string]; cities: number; horizons: Record<string, Record<string, BacktestMethod>> }
}

export type Lang = Language
