// Draws the district shapes from /districts.geojson as SVG paths. No map tiles and no map library.

type Position = [number, number]
type Ring = Position[]

export type Shape = {
  code: string
  name: string
  /** SVG path data for all rings of the district. */
  path: string
  /** A point inside the largest ring, for the class number label. */
  label: { x: number; y: number }
  /** The extent of the district in the drawing, to zoom to it. */
  box: { x0: number; y0: number; x1: number; y1: number }
  /** How far the district is from the middle of the map, 0 to 1: its place in the wave of colour when the measure changes. */
  wave: number
}

/** The context layers of the map, as the app's own file gives them: lines and rings of [lon, lat]. */
export type Basemap = {
  roads: { class: string; line: Position[] }[]
  rail: { line: Position[] }[]
  rivers: { line: Position[] }[]
  lakes: { ring: Position[] }[]
  places: { name: string; lon: number; lat: number }[]
  attribution: string
}

/** The context drawn in the same projection as the districts. Paths are SVG path data. */
export type MapContext = {
  /** Motorways and trunk roads, and the other main roads. */
  roadsMajor: string
  roadsMinor: string
  rail: string
  rivers: string
  lakes: string
  places: { name: string; x: number; y: number }[]
  attribution: string
}

export type MapGeometry = { width: number; height: number; shapes: Shape[]; context: MapContext | null }


const WIDTH = 1000

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number'
}

function isRing(value: unknown): value is Ring {
  return Array.isArray(value) && value.length > 0 && value.every(isPosition)
}

/** The rings of a GeoJSON Polygon or MultiPolygon. The contract types the geometry as a plain object, so it is checked here. */
function ringsOf(geometry: unknown): Ring[] {
  if (typeof geometry !== 'object' || geometry === null) return []
  const { type, coordinates } = geometry as { type?: unknown; coordinates?: unknown }
  if (!Array.isArray(coordinates)) return []
  if (type === 'Polygon') return coordinates.filter(isRing)
  if (type === 'MultiPolygon') return coordinates.flatMap((polygon) => (Array.isArray(polygon) ? polygon.filter(isRing) : []))
  return []
}

function area(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i] as Position
    const [x2, y2] = ring[(i + 1) % ring.length] as Position
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

function centroid(ring: Ring): Position {
  const a = area(ring)
  if (a === 0) return ring[0] as Position
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i] as Position
    const [x2, y2] = ring[(i + 1) % ring.length] as Position
    const cross = x1 * y2 - x2 * y1
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  return [cx / (6 * a), cy / (6 * a)]
}

/**
 * A point that is surely inside the ring, for the label. The centroid of a bent shape can fall outside it,
 * so take the horizontal line through the centroid and use the middle of its widest stretch inside the shape.
 */
function labelPoint(ring: Ring): Position {
  const [cx, cy] = centroid(ring)
  const crossings: number[] = []
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i] as Position
    const [x2, y2] = ring[(i + 1) % ring.length] as Position
    if (y1 > cy !== y2 > cy) crossings.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1))
  }
  crossings.sort((a, b) => a - b)
  let best: Position = [cx, cy]
  let widest = 0
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const [from, to] = [crossings[i] as number, crossings[i + 1] as number]
    if (to - from > widest) {
      widest = to - from
      best = [(from + to) / 2, cy]
    }
  }
  return best
}

const round = (value: number) => Math.round(value * 10) / 10

/**
 * Projects longitude and latitude onto a flat drawing. At the size of one city a simple projection is enough:
 * longitude is shrunk by the cosine of the city's latitude, so the shapes are not stretched sideways.
 */
export function buildMap(features: { geometry: unknown; properties: { code: string; name: string } }[], basemap: Basemap | null = null): MapGeometry {
  const districts = features.map((feature) => ({ ...feature.properties, rings: ringsOf(feature.geometry) })).filter((d) => d.rings.length > 0)
  const all = districts.flatMap((d) => d.rings.flat())
  if (all.length === 0) return { width: WIDTH, height: WIDTH, shapes: [], context: null }

  const lons = all.map(([lon]) => lon)
  const lats = all.map(([, lat]) => lat)
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
  const squeeze = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const scale = WIDTH / ((maxLon - minLon) * squeeze || 1)
  const project = ([lon, lat]: Position): Position => [(lon - minLon) * squeeze * scale, (maxLat - lat) * scale]

  const height = Math.ceil((maxLat - minLat) * scale)
  const [cx, cy] = [WIDTH / 2, height / 2]
  const reach = Math.hypot(cx, cy) || 1
  const shapes = districts.map((district) => {
    const rings = district.rings.map((ring) => ring.map(project))
    const largest = rings.reduce((a, b) => (Math.abs(area(b)) > Math.abs(area(a)) ? b : a))
    const [x, y] = labelPoint(largest)
    const path = rings.map((ring) => `M${ring.map(([px, py]) => `${round(px)} ${round(py)}`).join('L')}Z`).join('')
    const flat = rings.flat()
    const xs = flat.map(([px]) => px)
    const ys = flat.map(([, py]) => py)
    const box = { x0: round(Math.min(...xs)), y0: round(Math.min(...ys)), x1: round(Math.max(...xs)), y1: round(Math.max(...ys)) }
    const wave = Math.round(Math.min(1, Math.hypot(x - cx, y - cy) / reach) * 100) / 100
    return { code: district.code, name: district.name, path, label: { x: round(x), y: round(y) }, box, wave }
  })

  const lines = (list: Position[][]) => list.map((line) => `M${line.map((point) => project(point)).map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}`).join('')
  const context: MapContext | null = basemap && {
    roadsMajor: lines(basemap.roads.filter((road) => road.class === 'motorway' || road.class === 'trunk').map((road) => road.line)),
    roadsMinor: lines(basemap.roads.filter((road) => road.class !== 'motorway' && road.class !== 'trunk').map((road) => road.line)),
    rail: lines(basemap.rail.map((item) => item.line)),
    rivers: lines(basemap.rivers.map((river) => river.line)),
    lakes: basemap.lakes.map((lake) => `${lines([lake.ring])}Z`).join(''),
    places: basemap.places.map((place) => {
      const [x, y] = project([place.lon, place.lat])
      return { name: place.name, x: round(x), y: round(y) }
    }),
    attribution: basemap.attribution,
  }

  return { width: WIDTH, height, shapes, context }
}

function isLine(value: unknown): value is Position[] {
  return Array.isArray(value) && value.every(isPosition)
}

/** Checks the file of context layers, which comes from the app's own server but is still outside the code: a wrong file shows no context. */
export function parseBasemap(value: unknown): Basemap | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const list = (key: string): Record<string, unknown>[] => (Array.isArray(v[key]) ? (v[key] as unknown[]).filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [])
  if (typeof v.attribution !== 'string') return null
  return {
    attribution: v.attribution,
    roads: list('roads').filter((r): r is { class: string; line: Position[] } => typeof r.class === 'string' && isLine(r.line)),
    rail: list('rail').filter((r): r is { line: Position[] } => isLine(r.line)),
    rivers: list('rivers').filter((r): r is { line: Position[] } => isLine(r.line)),
    lakes: list('lakes').filter((r): r is { ring: Position[] } => isLine(r.ring)),
    places: list('places').filter((r): r is { name: string; lon: number; lat: number } => typeof r.name === 'string' && typeof r.lon === 'number' && typeof r.lat === 'number'),
  }
}
