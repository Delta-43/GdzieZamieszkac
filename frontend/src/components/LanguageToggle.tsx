import { useTranslation } from 'react-i18next'
import { LANGUAGES, type Language } from '../i18n'

// Each language is named in itself and marked with its own lang attribute, so a screen reader pronounces it correctly.
const NAMES: Record<Language, string> = { pl: 'Polski', en: 'English' }

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  return (
    <div role="group" aria-label={t('language.label')} className="language-toggle">
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-pressed={i18n.language === language}
          onClick={() => void i18n.changeLanguage(language)}
        >
          {NAMES[language]}
        </button>
      ))}
    </div>
  )
}
