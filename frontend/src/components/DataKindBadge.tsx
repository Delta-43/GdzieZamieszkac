import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'

type DataKind = components['schemas']['DataKind']

// A shape and a word for each kind, so the badge never relies on colour.
const SHAPES: Record<DataKind, string> = { observed: '●', estimated: '◐', proxy: '○' }

/** Shown beside every value: observed (measured or officially reported), estimated (calculated) or proxy (indirect). */
export function DataKindBadge({ kind }: { kind: DataKind }) {
  const { t } = useTranslation()
  return (
    <span className="data-kind">
      <span aria-hidden="true">{SHAPES[kind]} </span>
      {t(`dataKind.${kind}`)}
    </span>
  )
}
