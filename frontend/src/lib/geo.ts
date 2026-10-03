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
}

export type MapGeometry = { width: number; height: number; shapes: Shape[] }

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
export function buildMap(features: { geometry: unknown; properties: { code: string; name: string } }[]): MapGeometry {
  const districts = features.map((feature) => ({ ...feature.properties, rings: ringsOf(feature.geometry) })).filter((d) => d.rings.length > 0)
  const all = districts.flatMap((d) => d.rings.flat())
  if (all.length === 0) return { width: WIDTH, height: WIDTH, shapes: [] }

  const lons = all.map(([lon]) => lon)
  const lats = all.map(([, lat]) => lat)
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
  const squeeze = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const scale = WIDTH / ((maxLon - minLon) * squeeze || 1)
  const project = ([lon, lat]: Position): Position => [(lon - minLon) * squeeze * scale, (maxLat - lat) * scale]

  const shapes = districts.map((district) => {
    const rings = district.rings.map((ring) => ring.map(project))
    const largest = rings.reduce((a, b) => (Math.abs(area(b)) > Math.abs(area(a)) ? b : a))
    const [x, y] = labelPoint(largest)
    const path = rings.map((ring) => `M${ring.map(([px, py]) => `${round(px)} ${round(py)}`).join('L')}Z`).join('')
    return { code: district.code, name: district.name, path, label: { x: round(x), y: round(y) } }
  })

  return { width: WIDTH, height: Math.ceil((maxLat - minLat) * scale), shapes }
}
