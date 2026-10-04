import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { searchKey } from '../lib/pages'

type Props = {
  districts: { code: string; name: string }[]
  /** Called with the code of the district the person chose. */
  onChoose: (code: string) => void
}

/**
 * Search by district name, as an accessible combobox (WAI-ARIA 1.2, list autocomplete): the field keeps the focus,
 * the arrow keys move through the suggestions, Enter chooses, Escape closes. Accents are ignored. It searches the names
 * the data service gives and nothing else: there is no address search, because that would need a map service.
 */
export function DistrictSearch({ districts, onChoose }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [missed, setMissed] = useState(false)

  const query = searchKey(text)
  const matches = query ? districts.filter((district) => searchKey(district.name).includes(query)) : open ? districts : []
  const optionId = (index: number) => `${id}-option-${index}`
  const example = districts[0]?.name

  function choose(code: string) {
    setOpen(false)
    setMissed(false)
    const name = districts.find((district) => district.code === code)?.name ?? ''
    setText(name)
    onChoose(code)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const chosen = active >= 0 ? matches[active] : matches.length === 1 ? matches[0] : undefined
    if (chosen) return choose(chosen.code)
    // Nothing to choose yet: say so, or show the suggestions so the person can pick one.
    setMissed(matches.length === 0)
    setOpen(matches.length > 0)
    setActive(matches.length > 0 ? 0 : -1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((current) => (matches.length === 0 ? -1 : (current + 1) % matches.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActive((current) => (matches.length === 0 ? -1 : (current - 1 + matches.length) % matches.length))
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setActive(-1)
    }
  }

  const showList = open && matches.length > 0

  return (
    <form className="search" role="search" aria-label={t('search.region')} onSubmit={submit}>
      <label htmlFor={`${id}-input`}>{t('search.label')}</label>
      <p className="note" id={`${id}-hint`}>
        {t('search.hint', { example })}
      </p>
      <div className="search__row">
        <div className="search__field">
          <input
            id={`${id}-input`}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
            aria-describedby={`${id}-hint${missed ? ` ${id}-missed` : ''}`}
            aria-invalid={missed || undefined}
            autoComplete="off"
            spellCheck={false}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setOpen(true)
              setActive(-1)
              setMissed(false)
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
          />
          {/* The ARIA 1.2 combobox pattern: a listbox of options, driven from the field with the keyboard (aria-activedescendant). */}
          <ul
            id={`${id}-list`}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
            role="listbox"
            aria-label={t('search.list')}
            hidden={!showList}
          >
            {matches.map((district, index) => (
              // The keyboard works through the field, so the options need no key handler of their own.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                key={district.code}
                id={optionId(index)}
                // The ARIA 1.2 combobox pattern needs role=option on a list item.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
                role="option"
                aria-selected={index === active}
                // The mouse must not take the focus away from the field before the click is handled.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(district.code)}
              >
                {district.name}
              </li>
            ))}
          </ul>
        </div>
        <button type="submit" className="button-primary">
          {t('search.submit')}
        </button>
      </div>
      {missed && (
        <p className="error-message" id={`${id}-missed`}>
          {t('search.missed')}
        </p>
      )}
      {/* The number of suggestions, said politely while the person types. */}
      <p className="visually-hidden" role="status">
        {showList ? t('search.count', { count: matches.length }) : ''}
      </p>
    </form>
  )
}
