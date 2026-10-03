import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import pl from './locales/pl.json'

export const LANGUAGES = ['pl', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

const DEFAULT_LANGUAGE: Language = 'pl'
// The language choice is the only thing the app stores in the browser.
const STORAGE_KEY = 'lang'

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language)
}

function storedLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    // Storage can be blocked (private window). The app then starts in Polish every time.
    return DEFAULT_LANGUAGE
  }
}

void i18n.use(initReactI18next).init({
  resources: { pl: { translation: pl }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
})

function applyLanguage(language: string) {
  document.documentElement.lang = language
}

applyLanguage(i18n.language)
i18n.on('languageChanged', (language) => {
  applyLanguage(language)
  try {
    window.localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Not stored. The choice still holds until the page is closed.
  }
})

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
}

export default i18n
