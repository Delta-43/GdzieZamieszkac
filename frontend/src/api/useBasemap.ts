import { useQuery } from '@tanstack/react-query'
import { parseBasemap, type Basemap } from '../lib/geo'
import { useMeta } from './useMeta'

/**
 * The context layers of the map (rivers, lakes, main roads, railways, a few landmarks), a file served with the app at
 * /basemap/<city>.json, made once from OpenStreetMap by scripts/build_basemap.py. The browser never asks a map server.
 * The city code comes from /meta. A missing or wrong file is not an error: the map then shows the districts alone.
 */
export function useBasemap(): Basemap | null {
  const city = useMeta().data?.city
  const basemap = useQuery({
    queryKey: ['basemap', city],
    enabled: Boolean(city),
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      // A Request, like every other call of the app, so the file is asked for the same way and shows in the same place in a test.
      const response = await fetch(new Request(new URL(`${import.meta.env.BASE_URL}basemap/${city}.json`, window.location.href)))
      if (!response.ok || !(response.headers.get('Content-Type') ?? '').includes('json')) return null
      return parseBasemap(await response.json())
    },
  })
  return basemap.data ?? null
}
