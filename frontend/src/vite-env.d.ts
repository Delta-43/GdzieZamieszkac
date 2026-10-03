/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API. Empty means the same origin as the page. Public, like every VITE_ variable. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
