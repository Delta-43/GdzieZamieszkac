import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'

type DataKind = components['schemas']['DataKind']

/**
 * A shape for each kind, drawn as SVG in the text colour, so it looks the same in every font:
 * a full disc (observed), a half-filled disc (estimated) and a ring (proxy).
 */
function Mark({ kind }: { kind: DataKind }) {
  return (
    <svg className="data-kind__mark" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      {kind === 'estimated' && <path d="M6 1.5a4.5 4.5 0 0 0 0 9z" fill="currentColor" />}
      <circle cx="6" cy="6" r="4.5" fill={kind === 'observed' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Shown beside every value: observed (measured or officially reported), estimated (calculated) or proxy (indirect). A shape and a word, never colour alone. */
export function DataKindBadge({ kind }: { kind: DataKind }) {
  const { t } = useTranslation()
  return (
    <span className="data-kind">
      <Mark kind={kind} />
      {t(`dataKind.${kind}`)}
    </span>
  )
}
