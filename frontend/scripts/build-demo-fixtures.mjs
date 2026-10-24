#!/usr/bin/env node
// Builds src/demo/data/model.json, the data of the GitHub Pages demo. Offline and deterministic: run it again and the file is identical.
//
// WHAT IS REAL AND WHAT IS SAMPLE
//  - Real, from this repository: the metric catalogue (labels, descriptions, units and directions, read from the SQL migrations in
//    server/migrations/krakow), the reasons for the four gaps (backend/app/data/unavailable_metrics.json), the source list
//    (docs/DATA_SOURCES.md), the district shapes (build-demo-boundaries.mjs, OpenStreetMap) and the school sports grounds and
//    public defibrillators per district (migration 0020, loaded data).
//  - Sample, made up here: every other value. The measured database of the event is not in the repository, so these numbers
//    come from a rough profile of each district and a seeded random number. They look plausible and they are NOT measurements.
//    The demo says so on every page. Never present them as findings about Kraków.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const MIGRATIONS = join(repo, 'server', 'migrations', 'krakow')
const OUT = join(here, '..', 'src', 'demo', 'data', 'model.json')

// ---------------------------------------------------------------------------------------------------------------- SQL reading
/** Reads the SQL values in `text` from `start`: returns the rows of a `values (...), (...)` list and the index after it. */
function readTuples(text, start) {
  const rows = []
  let i = start
  const skip = () => {
    while (i < text.length && /[\s,]/.test(text[i])) i++
  }
  skip()
  while (text[i] === '(') {
    i++
    const row = []
    for (;;) {
      while (/\s/.test(text[i])) i++
      if (text[i] === "'") {
        let s = ''
        i++
        for (;;) {
          if (text[i] === "'" && text[i + 1] === "'") {
            s += "'"
            i += 2
          } else if (text[i] === "'") {
            i++
            break
          } else s += text[i++]
        }
        row.push(s)
      } else {
        const m = /^[^,)]+/.exec(text.slice(i))
        const raw = m[0].trim()
        i += m[0].length
        row.push(/^null$/i.test(raw) ? null : Number.isNaN(Number(raw)) ? raw : Number(raw))
      }
      while (/\s/.test(text[i])) i++
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === ')') {
        i++
        break
      }
      throw new Error(`SQL not understood near: ${text.slice(i, i + 60)}`)
    }
    rows.push(row)
    skip()
  }
  return { rows, end: i }
}

/** `a = 'x', b = v.b` into a list of [column, literal or null for "from v"]. */
function readAssignments(text) {
  const out = []
  const re = /(\w+)\s*=\s*(?:'((?:[^']|'')*)'|(v\.\w+))/g
  let m
  while ((m = re.exec(text))) out.push([m[1], m[3] ? null : m[2].replace(/''/g, "'"), m[3]?.slice(2)])
  return out
}

function readCatalogue() {
  const metrics = new Map()
  const unitPl = new Map()
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  const realValues = []
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
    const get = (key) => {
      if (!metrics.has(key)) metrics.set(key, { key })
      return metrics.get(key)
    }
    // insert ... (cols) values ...
    for (const m of sql.matchAll(/insert into krakow\.metric_definitions\s*\(([^)]*)\)\s*values/g)) {
      const cols = m[1].split(',').map((c) => c.trim())
      const { rows } = readTuples(sql, m.index + m[0].length)
      for (const row of rows) {
        const o = get(row[0])
        cols.forEach((c, i) => (o[c === 'metric_key' ? 'key' : c] = row[i]))
      }
    }
    // update ... m set ... from (values ...) as v(cols)
    for (const m of sql.matchAll(/update krakow\.metric_definitions m\s+set([\s\S]*?)from \(values/g)) {
      const { rows, end } = readTuples(sql, m.index + m[0].length)
      const alias = /\)\s*as v\(([^)]*)\)/.exec(sql.slice(end, end + 200))
      const cols = alias[1].split(',').map((c) => c.trim())
      const sets = readAssignments(m[1])
      for (const row of rows) {
        const o = get(row[cols.indexOf('metric_key')])
        for (const [col, literal, from] of sets) o[col] = from ? row[cols.indexOf(from)] : literal
      }
    }
    // update ... set ... where metric_key = 'k'
    for (const m of sql.matchAll(/update krakow\.metric_definitions\s+set([\s\S]*?)where metric_key = '([^']+)'/g)) {
      const o = get(m[2])
      for (const [col, literal] of readAssignments(m[1])) o[col] = literal
    }
    // The two metrics of 0021 keep their direction.
    if (file.startsWith('0021')) {
      get('amenity_open_sports_grounds').higher_is = 'better'
      get('amenity_aed_public').higher_is = 'better'
    }
    // English-to-Polish pairs for units and short texts.
    for (const m of sql.matchAll(/\) as v\(en, pl\)/g)) {
      const open = sql.lastIndexOf('(values', m.index)
      for (const [en, pl] of readTuples(sql, open + '(values'.length).rows) unitPl.set(en, pl)
    }
    // Loaded data: school sports grounds and public defibrillators (the only measured rows in the repository).
    for (const m of sql.matchAll(/\) as v\(code, k, val, n, unit/g)) {
      const open = sql.lastIndexOf('(values', m.index)
      for (const row of readTuples(sql, open + '(values'.length).rows) realValues.push({ code: row[0], key: row[1], value: row[2], n: row[3], as_of: row[12] })
    }
  }
  return { metrics, unitPl, realValues }
}

// ------------------------------------------------------------------------------------------------------------------ random
function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
/** A number in [-1, 1], the same for the same text. */
const noise = (...parts) => (hash(parts.join('|')) % 20001) / 10000 - 1

// ---------------------------------------------------------------------------------------------- district profiles (sample)
// c centre, g green, a affluence, t transit, q quiet, s safety, d density: 0 to 1, rough and made up for the demo.
const PROFILE = {
  'stare-miasto': { c: 0.98, g: 0.25, a: 0.95, t: 0.98, q: 0.15, s: 0.3, d: 0.7 },
  grzegorzki: { c: 0.85, g: 0.3, a: 0.75, t: 0.9, q: 0.35, s: 0.5, d: 0.9 },
  'pradnik-czerwony': { c: 0.6, g: 0.45, a: 0.55, t: 0.6, q: 0.55, s: 0.6, d: 0.85 },
  'pradnik-bialy': { c: 0.5, g: 0.6, a: 0.6, t: 0.5, q: 0.65, s: 0.65, d: 0.55 },
  krowodrza: { c: 0.75, g: 0.4, a: 0.75, t: 0.8, q: 0.5, s: 0.55, d: 0.85 },
  bronowice: { c: 0.55, g: 0.5, a: 0.6, t: 0.6, q: 0.5, s: 0.6, d: 0.7 },
  zwierzyniec: { c: 0.6, g: 0.95, a: 0.8, t: 0.55, q: 0.8, s: 0.75, d: 0.25 },
  debniki: { c: 0.55, g: 0.75, a: 0.7, t: 0.55, q: 0.6, s: 0.65, d: 0.3 },
  'lagiewniki-borek-falecki': { c: 0.6, g: 0.62, a: 0.6, t: 0.65, q: 0.6, s: 0.8, d: 0.6 },
  swoszowice: { c: 0.2, g: 0.85, a: 0.6, t: 0.25, q: 0.85, s: 0.75, d: 0.12 },
  'podgorze-duchackie': { c: 0.5, g: 0.5, a: 0.5, t: 0.6, q: 0.5, s: 0.55, d: 0.8 },
  'biezanow-prokocim': { c: 0.35, g: 0.5, a: 0.45, t: 0.55, q: 0.6, s: 0.6, d: 0.6 },
  podgorze: { c: 0.75, g: 0.5, a: 0.8, t: 0.8, q: 0.45, s: 0.5, d: 0.6 },
  czyzyny: { c: 0.5, g: 0.45, a: 0.5, t: 0.65, q: 0.45, s: 0.55, d: 0.6 },
  mistrzejowice: { c: 0.4, g: 0.4, a: 0.4, t: 0.55, q: 0.6, s: 0.5, d: 1.0 },
  bienczyce: { c: 0.4, g: 0.4, a: 0.4, t: 0.55, q: 0.6, s: 0.5, d: 1.0 },
  'wzgorza-krzeslawickie': { c: 0.15, g: 0.65, a: 0.3, t: 0.3, q: 0.8, s: 0.7, d: 0.15 },
  'nowa-huta': { c: 0.35, g: 0.6, a: 0.35, t: 0.6, q: 0.55, s: 0.45, d: 0.45 },
}

const AIRPORT = { lon: 19.7848, lat: 50.0777 }
const km = (a, b) => {
  const k = Math.cos((50.06 * Math.PI) / 180) * 111.32
  return Math.hypot((a.lon - b.lon) * k, (a.lat - b.lat) * 110.574)
}

function centroid(feature) {
  // The centre of the largest part, by the mean of its corner points: enough for a distance between districts.
  const polygons = feature.geometry.coordinates
  const ring = polygons.map((p) => p[0]).sort((x, y) => y.length - x.length)[0]
  const sum = ring.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0])
  return { lon: sum[0] / ring.length, lat: sum[1] / ring.length }
}

// ------------------------------------------------------------------------------------------------------- the sample values
// Each entry: value from the profile (f), area (A) and noise (n, in [-1, 1]); dec = decimals kept.
const GENERATORS = {
  transit_stops_total: { dec: 0, f: (p, A, n) => A * (1.5 + 9 * p.t) * (1 + 0.1 * n) },
  transit_stops_bus: { dec: 0, f: (p, A, n, v) => v.transit_stops_total * (0.88 - 0.1 * p.t) * (1 + 0.04 * n) },
  transit_stops_tram: { dec: 0, f: (p, A, n, v) => v.transit_stops_total * 0.2 * p.t ** 1.6 * (1 + 0.1 * n) },
  transit_routes_count: { dec: 0, f: (p, A, n) => (8 + 52 * p.t) * (1 + 0.08 * n) },
  transit_departures_weekday: { dec: 0, f: (p, A, n) => A * (120 + 2600 * p.t) * (1 + 0.1 * n) },
  transit_night_departures: { dec: 0, f: (p, A, n) => A * (2 + 55 * p.t) * (1 + 0.15 * n) },
  airport_distance_km: { dec: 1, f: (p, A, n, v, ctx) => km(ctx.centre, AIRPORT) },
  residents_registered: { dec: 0, f: (p, A, n) => A * (1100 + 9800 * p.d) * (1 + 0.05 * n) },
  population_density: { dec: 0, f: (p, A, n, v) => v.residents_registered / A },
  age_mean: { dec: 1, f: (p, A, n) => 39.5 + 5 * (1 - p.d) + 1.5 * p.g + 0.8 * n },
  share_age_65_plus: { dec: 1, f: (p, A, n) => 15 + 9 * (1 - p.d) + 3 * p.q + n },
  share_female: { dec: 1, f: (p, A, n) => 52.3 + 1.2 * p.c + 0.3 * n },
  amenity_schools: { dec: 0, f: (p, A, n) => A * (0.8 + 2.2 * p.c) * (1 + 0.1 * n) },
  amenity_hospitals_clinics: { dec: 0, f: (p, A, n) => A * (1 + 5 * p.c) * (1 + 0.15 * n) },
  amenity_parks_share: { dec: 1, f: (p, A, n) => 1 + 17 * p.g + 1.5 * n },
  amenity_supermarkets: { dec: 0, f: (p, A, n) => A * (0.4 + 1.6 * p.c) * (1 + 0.1 * n) },
  amenity_malls: { dec: 0, f: (p, A, n) => A * p.c * 0.22 * (1 + 0.3 * n) },
  amenity_gyms: { dec: 0, f: (p, A, n) => A * (0.5 + 3.5 * p.c) * (1 + 0.12 * n) },
  amenity_parking: { dec: 0, f: (p, A, n) => A * (2 + 8 * p.c) * (1 + 0.15 * n) },
  amenity_nursery_places: { dec: 0, f: (p, A, n) => A * (8 + 55 * p.d) * (1 + 0.15 * n) },
  amenity_restaurants_cafes: { dec: 0, f: (p, A, n) => A * (2 + 90 * p.c ** 2) * (1 + 0.1 * n) },
  air_pm10_mean: { dec: 1, f: (p, A, n) => 25 + 11 * (1 - p.q) + 1.2 * n },
  air_pm25_mean: { dec: 1, f: (p, A, n) => 16 + 8 * (1 - p.q) + n },
  air_no2_mean: { dec: 1, f: (p, A, n) => 17 + 15 * p.c + n },
  air_quality_index: { dec: 1, f: (p, A, n) => 1.1 + 1.4 * (1 - p.q) + 0.15 * n },
  tree_cover_share: { dec: 1, f: (p, A, n) => 7 + 38 * p.g + 1.5 * n },
  green_space_share: { dec: 1, f: (p, A, n) => 5 + 45 * p.g + 2 * n },
  heat_exposure_index: { dec: 0, f: (p, A, n) => 22 + 60 * (1 - p.g) * (0.5 + 0.5 * p.c) + 3 * n },
  noise_share_above_55db: { dec: 1, f: (p, A, n) => 8 + 72 * (1 - p.q) + 3 * n },
  night_noise_estimate: { dec: 0, f: (p, A, n) => 18 + 62 * p.c + 4 * n },
  nightlife_density: { dec: 1, f: (p, A, n) => 0.1 + 10 * p.c ** 2.5 + 0.2 * n },
  busyness_index: { dec: 0, f: (p, A, n) => 15 + 80 * p.c + 3 * n },
  walkability_index: { dec: 0, f: (p, A, n) => 20 + 70 * p.c + 8 * p.t + 3 * n },
  family_friendliness_index: { dec: 0, f: (p, A, n) => 28 + 48 * (0.35 * p.q + 0.3 * p.g + 0.35 * p.s) + 4 * n },
  sale_price_median_m2: { dec: 0, f: (p, A, n) => 9800 + 11200 * p.a + 250 * n },
  sale_transactions_count: { dec: 0, f: (p, A, n) => A * (28 + 80 * p.d) * (1 + 0.1 * n) },
  rent_price_median_m2: { dec: 1, f: (p, A, n) => 45 + 22 * p.a + 0.8 * n },
  rent_listings_count: { dec: 0, f: (p, A, n) => A * (5 + 25 * p.c) * (1 + 0.1 * n) },
  nursery_fee_median: { dec: 0, f: (p, A, n) => 520 + 380 * p.a + 20 * n },
  road_accidents_per_km: { dec: 2, f: (p, A, n) => 0.2 + 1.3 * p.c + 0.06 * n },
  road_ped_cyc_casualties_per_km: { dec: 2, f: (p, A, n) => 0.05 + 0.5 * p.c + 0.04 * n },
  lit_street_share: { dec: 0, f: (p, A, n) => 48 + 45 * p.c + 3 * n },
  emergency_services_distance_km: { dec: 1, f: (p, A, n) => 0.8 + 6 * (1 - p.c) + 0.3 * n },
}
// Computed in the browser from the other values: the safety index and the livability score.
const COMPUTED = new Set(['safety_index', 'livability_score_default'])

// ------------------------------------------------------------------------------------------------------------------ sources
const SRC = {
  gtfs: { name: 'Public transport timetable feeds (GTFS), ZTP Kraków', url: 'https://gtfs.ztp.krakow.pl/', licence: 'No licence text on the feed page', attribution: 'ZTP Kraków, MPK S.A. w Krakowie, R&G Plus (GTFS)', as_of: '2026-09-30', pl: { name: 'Rozkłady jazdy komunikacji miejskiej (GTFS), ZTP Kraków', licence: 'Brak tekstu licencji na stronie źródła' } },
  osm: { name: 'OpenStreetMap, through Overpass', url: 'https://www.openstreetmap.org/copyright', licence: 'ODbL 1.0', attribution: '© OpenStreetMap contributors', as_of: '2026-09-30', pl: { name: 'OpenStreetMap, przez Overpass', licence: 'ODbL 1.0' } },
  gios: { name: 'GIOŚ air quality, stations and index', url: 'https://powietrze.gios.gov.pl/', licence: 'Open data, attribution required', attribution: 'Główny Inspektorat Ochrony Środowiska (GIOŚ), Państwowy Monitoring Środowiska', as_of: '2026-09-30', pl: { name: 'GIOŚ: jakość powietrza, stacje i indeks', licence: 'Dane otwarte, wymagane podanie źródła' } },
  tcd: { name: 'Copernicus Tree Cover Density 2024', url: 'https://land.copernicus.eu/', licence: 'Free, full and open access', attribution: 'Copernicus Land Monitoring Service, European Environment Agency', as_of: '2024-01-01', pl: { name: 'Copernicus: gęstość pokrycia drzewami 2024', licence: 'Bezpłatny, pełny i otwarty dostęp' } },
  ua: { name: 'Copernicus Urban Atlas 2018', url: 'https://land.copernicus.eu/', licence: 'Free, full and open access', attribution: 'Copernicus Land Monitoring Service, European Environment Agency', as_of: '2018-12-31', pl: { name: 'Copernicus: Urban Atlas 2018', licence: 'Bezpłatny, pełny i otwarty dostęp' } },
  noise: { name: 'Kraków strategic noise map 2022', url: 'https://otwartedane.um.krakow.pl/', licence: 'Open data of the city. Check the reuse terms before redistribution.', attribution: 'Miasto Kraków, Strategiczna mapa hałasu 2022', as_of: '2022-12-31', pl: { name: 'Strategiczna mapa hałasu Krakowa 2022', licence: 'Dane otwarte miasta. Przed ponownym udostępnieniem sprawdź warunki ponownego użycia.' } },
  bip: { name: 'BIP Kraków, residents by district', url: 'https://www.bip.krakow.pl/', licence: 'Public information', attribution: 'Biuletyn Informacji Publicznej Miasta Krakowa; Centrum Obsługi Informatycznej UMK; Wydział Geodezji UMK', as_of: '2025-12-31', pl: { name: 'BIP Kraków: mieszkańcy według dzielnic', licence: 'Informacja publiczna' } },
  age: { name: 'Kraków open data, registered residents by age and sex', url: 'https://otwartedane.um.krakow.pl/', licence: 'Open data of the city. Check the dataset page before redistribution.', attribution: 'Urząd Miasta Krakowa, Wydział Spraw Administracyjnych, otwartedane.um.krakow.pl', as_of: '2024-12-31', pl: { name: 'Otwarte dane Krakowa: zameldowani według wieku i płci', licence: 'Dane otwarte miasta. Przed ponownym udostępnieniem sprawdź stronę zbioru.' } },
  sports: { name: 'Kraków open data, sports infrastructure of schools 2023/2024', url: 'https://otwartedane.um.krakow.pl/', licence: 'Open data of Gmina Miejska Kraków: free reuse with the credit. Districts found from street addresses with OpenStreetMap address points (ODbL 1.0).', attribution: 'Gmina Miejska Kraków, otwartedane.um.krakow.pl (sports infrastructure of schools 2023/2024); © OpenStreetMap contributors', as_of: '2023-12-31', pl: { name: 'Otwarte dane Krakowa: infrastruktura sportowa szkół 2023/2024', licence: 'Dane otwarte Gminy Miejskiej Kraków: swobodne ponowne użycie z podaniem źródła. Dzielnice ustalono z adresów na podstawie punktów adresowych OpenStreetMap (ODbL 1.0).' } },
  nursery: { name: "National register of nurseries and children's clubs", url: 'https://dane.gov.pl/', licence: 'CC0 1.0', attribution: 'Ministerstwo Rodziny, Pracy i Polityki Społecznej, dane.gov.pl', as_of: '2026-09-30', pl: { name: 'Rejestr żłobków i klubów dziecięcych', licence: 'CC0 1.0' } },
  rcn: { name: 'Rejestr Cen Nieruchomości (RCN), GUGiK', url: 'https://www.geoportal.gov.pl/', licence: 'Open data, no access constraints', attribution: 'Rejestr Cen Nieruchomości, GUGiK', as_of: '2026-09-30', pl: { name: 'Rejestr Cen Nieruchomości (RCN), GUGiK', licence: 'Dane otwarte, bez ograniczeń dostępu' } },
  sewik: { name: 'Police SEWiK accident register, through the Polish Road Safety Observatory', url: 'https://sewik.pl/', licence: 'Free for non-commercial use, credit required. Commercial use needs written approval.', attribution: 'Instytut Transportu Samochodowego – Polskie Obserwatorium Bezpieczeństwa Ruchu Drogowego', as_of: '2024-12-31', pl: { name: 'Policyjny rejestr wypadków SEWiK, przez Polskie Obserwatorium Bezpieczeństwa Ruchu Drogowego', licence: 'Bezpłatnie do użytku niekomercyjnego, wymagane podanie źródła. Użycie komercyjne wymaga pisemnej zgody.' } },
  rent: { name: 'Otodom and OLX flat rent listings', licence: 'A one-time snapshot for internal analysis, not redistributed. Only district medians are shown.', attribution: 'Otodom and OLX (asking rents, snapshot)', as_of: '2026-09-30', pl: { name: 'Oferty najmu mieszkań z Otodom i OLX', licence: 'Jednorazowy zrzut do analizy wewnętrznej, nieudostępniany dalej. Pokazujemy tylko mediany dla dzielnic.' } },
  nbp: { name: 'National Bank of Poland, quarterly city prices', url: 'https://nbp.pl/', licence: 'Reuse terms accepted by the team, not independently reviewed', attribution: 'National Bank of Poland', as_of: '2026-06-30', pl: { name: 'Narodowy Bank Polski, kwartalne ceny w miastach', licence: 'Warunki ponownego użycia zaakceptowane przez zespół, bez niezależnej weryfikacji' } },
  derived: { name: 'Derived metrics and the livability score', licence: 'Inherits the licences of its inputs', attribution: 'GdzieZamieszkać, computed from the sources above', as_of: '2026-09-30', pl: { name: 'Miary pochodne i wskaźnik jakości życia', licence: 'Dziedziczy licencje swoich danych wejściowych' } },
}
const SOURCE_OF = {
  transit_: 'gtfs', airport_distance_km: 'gtfs',
  residents_registered: 'bip', population_density: 'bip', population_total: 'bip',
  age_mean: 'age', share_age_65_plus: 'age', share_female: 'age',
  amenity_open_sports_grounds: 'sports', amenity_aed_public: 'osm', amenity_nursery_places: 'nursery', nursery_fee_median: 'nursery',
  amenity_: 'osm', nightlife_density: 'osm', lit_street_share: 'osm', emergency_services_distance_km: 'osm',
  air_: 'gios', tree_cover_share: 'tcd', green_space_share: 'ua', noise_share_above_55db: 'noise',
  sale_: 'rcn', rent_: 'rent', road_: 'sewik',
}
function sourceKey(key) {
  const exact = SOURCE_OF[key]
  if (exact) return exact
  const prefix = Object.keys(SOURCE_OF).find((p) => p.endsWith('_') && key.startsWith(p))
  return prefix ? SOURCE_OF[prefix] : 'derived'
}

// ----------------------------------------------------------------------------------------------------------------- build
const boundaries = JSON.parse(readFileSync(join(here, '..', 'src', 'demo', 'data', 'boundaries.json'), 'utf8'))
const { metrics, unitPl, realValues } = readCatalogue()
const unavailable = JSON.parse(readFileSync(join(repo, 'backend', 'app', 'data', 'unavailable_metrics.json'), 'utf8')).krakow

const districts = boundaries.features.map((f) => ({ code: f.properties.code, name: f.properties.name, number: f.properties.number, area_km2: f.properties.area_km2, ...centroid(f) }))
for (const d of districts) if (!PROFILE[d.code]) throw new Error(`No profile for ${d.code}`)

const catalogue = [...metrics.values()]
  .filter((m) => m.category && m.label_en)
  .sort((a, b) => a.sort_order - b.sort_order)
  .map((m) => {
    const gap = unavailable[m.key]
    const generated = GENERATORS[m.key] || COMPUTED.has(m.key) || realValues.some((r) => r.key === m.key)
    if (!gap && !generated) throw new Error(`No sample generator for ${m.key}`)
    return {
      key: m.key,
      category: m.category,
      label: { en: m.label_en, pl: m.label_pl },
      description: { en: m.description_en ?? '', pl: m.description_pl ?? m.description_en ?? '' },
      unit: { en: m.unit ?? '', pl: unitPl.get(m.unit) ?? m.unit ?? '' },
      higher_is: m.higher_is,
      refresh_cadence: m.refresh_cadence,
      data_kind: m.default_data_kind,
      available: !gap,
      reason: gap ?? null,
      has_series: m.key === 'sale_price_median_m2',
      source: sourceKey(m.key),
      decimals: GENERATORS[m.key]?.dec ?? 0,
      real: realValues.some((r) => r.key === m.key),
    }
  })

const values = {}
const round = (x, dec) => Number(x.toFixed(dec))
for (const m of catalogue) {
  if (!m.available || COMPUTED.has(m.key)) continue
  values[m.key] = {}
}
for (const d of districts) {
  const profile = PROFILE[d.code]
  const centre = { lon: d.lon, lat: d.lat }
  const done = {}
  for (const m of catalogue) {
    if (!values[m.key]) continue
    const real = realValues.find((r) => r.key === m.key && r.code === d.code)
    if (real) {
      values[m.key][d.code] = { value: real.value, n: real.n }
      continue
    }
    const gen = GENERATORS[m.key]
    const raw = gen.f(profile, d.area_km2, noise(m.key, d.code), done, { centre })
    done[m.key] = raw
    values[m.key][d.code] = { value: round(Math.max(0, raw), gen.dec) }
    done[m.key] = values[m.key][d.code].value
  }
  // Sample sizes where a count of observations is part of the value.
  values.sale_price_median_m2[d.code].n = values.sale_transactions_count[d.code].value
  values.rent_price_median_m2[d.code].n = values.rent_listings_count[d.code].value
}

// Quarterly sale price history, 2021 Q1 to 2026 Q2.
const GROWTH = [0, 1.5, 2.5, 3, 3, 3, 2.5, 2, 1, 0.5, 0.5, 0.5, 1, 1.5, 2.5, 3, 3, 2.5, 2, 1.5, 1.5, 1.5]
const series = {}
for (const d of districts) {
  const profile = PROFILE[d.code]
  const tilt = 0.85 + 0.3 * ((noise('tilt', d.code) + 1) / 2) + 0.1 * profile.c
  let index = 1
  const raw = GROWTH.map((g, i) => {
    index *= 1 + (g * tilt + 0.6 * noise('q', d.code, i)) / 100
    return index
  })
  const now = values.sale_price_median_m2[d.code].value
  const total = values.sale_transactions_count[d.code].value
  series[d.code] = raw.map((x, i) => {
    const year = 2021 + Math.floor(i / 4)
    const quarter = i % 4
    const n = Math.max(6, Math.round((total / 8) * (0.45 + 0.35 * ((noise('n', d.code, i) + 1) / 2) + i / 40)))
    return { year, quarter, value: Math.round((now * x) / raw[raw.length - 1] / 10) * 10, n }
  })
}

// Minutes by public transport between district centres (sample): distance, slowed down where the service is thin.
const commute = {}
for (const a of districts) {
  commute[a.code] = {}
  for (const b of districts) {
    if (a.code === b.code) {
      commute[a.code][b.code] = 0
      continue
    }
    const distance = km(a, b)
    const service = 0.6 + 0.4 * ((PROFILE[a.code].t + PROFILE[b.code].t) / 2)
    const minutes = 7 + (distance * 2.6) / service + 3 * noise('commute', [a.code, b.code].sort().join())
    commute[a.code][b.code] = minutes > 110 ? null : Math.round(minutes)
  }
}

const personas = JSON.parse(readFileSync(join(repo, 'backend', 'app', 'data', 'personas.json'), 'utf8')).personas
const backtest = JSON.parse(readFileSync(join(repo, 'backend', 'app', 'data', 'outlook_backtest.json'), 'utf8'))
writeFileSync(OUT, JSON.stringify({ districts, metrics: catalogue, values, series, commute, sources: SRC, personas, backtest }))
console.log(`${districts.length} districts, ${catalogue.length} metrics (${catalogue.filter((m) => m.available).length} with data), real: ${realValues.length} rows`)
