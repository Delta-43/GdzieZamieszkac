import { useQuery } from '@tanstack/react-query'
import { api } from './api/client'

// Task F1 placeholder: it only proves that the app reaches the API through the dev server.
// Task F2 replaces it with the layout, the language toggle and the translation files,
// so the Polish text below is temporary and lives here instead of pl.json.
export function App() {
  const meta = useQuery({
    queryKey: ['meta', 'pl'],
    queryFn: async () => {
      const { data, error } = await api.GET('/meta', { params: { query: { lang: 'pl' } } })
      if (error) throw new Error(error.title)
      return data
    },
  })

  return (
    <main>
      <h1>GdzieZamieszkać</h1>
      {meta.isPending && <p role="status">Trwa łączenie z API…</p>}
      {meta.isError && (
        <p role="alert">Nie udało się połączyć z API. Sprawdź, czy serwer API działa, i odśwież stronę.</p>
      )}
      {meta.isSuccess && (
        <p role="status">
          Połączono z API. Miasto: {meta.data.city_name ?? meta.data.city}. Liczba dzielnic: {meta.data.district_count}.
        </p>
      )}
    </main>
  )
}
