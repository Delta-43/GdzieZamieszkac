import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import './i18n'
// Self-hosted font: the Lato files are bundled with the app, so nothing loads from a third party.
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import './styles.css'
import { applyTheme } from './theme'

// The API sends Cache-Control: max-age=300, so five minutes of stale time matches it.
// One retry: the API is rate limited, and an error message with a retry button is better than a long wait.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
})

applyTheme()

const root = document.getElementById('root')
if (!root) throw new Error('The #root element is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
