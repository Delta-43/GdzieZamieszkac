#!/usr/bin/env node
// One-time download of the 18 district boundaries of Kraków from OpenStreetMap (Overpass), for the demo build.
// Usage: node scripts/build-demo-boundaries.mjs [overpass-response.json]
// Writes src/demo/data/boundaries.json (simplified GeoJSON, with the area in km2 of each district).
// The data is (c) OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright. The demo shows that credit.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'demo', 'data', 'boundaries.json')
const ENDPOINT = 'https://overpass-api.de/api/interpreter'
const QUERY = '[out:json][timeout:100];area["name"="Kraków"]["admin_level"="6"]->.a;rel(area.a)["boundary"="administrative"]["admin_level"="9"];out geom;'
const TOLERANCE = 0.00018 // degrees, about 20 m
const DECIMALS = 4

export function slug(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function load() {
  const input = process.argv[2]
  if (input) return JSON.parse(readFileSync(input, 'utf8'))
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'User-Agent': 'gdziezamieszkac-pages-demo/1.0 (github.com/Delta-43/GdzieZamieszkac)', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: QUERY }),
  })
  if (!response.ok) throw new Error(`Overpass answered ${response.status}`)
  return response.json()
}

/** Joins the outer ways of a relation into closed rings. */
function rings(relation) {
  const ways = relation.members.filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry?.length > 1).map((m) => m.geometry.map((p) => [p.lon, p.lat]))
  const closed = []
  const same = (a, b) => a[0] === b[0] && a[1] === b[1]
  while (ways.length) {
    let ring = ways.shift()
    let grew = true
    while (grew && !same(ring[0], ring[ring.length - 1])) {
      grew = false
      for (let i = 0; i < ways.length; i++) {
        const w = ways[i]
        const end = ring[ring.length - 1]
        const start = ring[0]
        if (same(end, w[0])) ring = ring.concat(w.slice(1))
        else if (same(end, w[w.length - 1])) ring = ring.concat(w.slice(0, -1).reverse())
        else if (same(start, w[w.length - 1])) ring = w.concat(ring.slice(1))
        else if (same(start, w[0])) ring = w.slice(1).reverse().concat(ring)
        else continue
        ways.splice(i, 1)
        grew = true
        break
      }
    }
    if (same(ring[0], ring[ring.length - 1]) && ring.length >= 4) closed.push(ring)
  }
  return closed
}

function simplify(points, tol) {
  if (points.length < 3) return points
  const [x1, y1] = points[0]
  const [x2, y2] = points[points.length - 1]
  const dx = x2 - x1
  const dy = y2 - y1
  const norm = Math.hypot(dx, dy)
  let far = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const d = norm === 0 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
    if (d > far) {
      far = d
      index = i
    }
  }
  if (far <= tol) return [points[0], points[points.length - 1]]
  return simplify(points.slice(0, index + 1), tol).slice(0, -1).concat(simplify(points.slice(index), tol))
}

/** Area of a ring in km2, on a plane around latitude 50 N (good enough for a label). */
function areaKm2(ring) {
  const k = Math.cos((50.06 * Math.PI) / 180) * 111.32
  const m = 110.574
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * k * ring[i + 1][1] * m - ring[i + 1][0] * k * ring[i][1] * m
  return Math.abs(sum) / 2
}

const round = (p) => [Number(p[0].toFixed(DECIMALS)), Number(p[1].toFixed(DECIMALS))]
const data = await load()
const features = data.elements
  .filter((e) => e.type === 'relation')
  .map((relation) => {
    const polygons = rings(relation)
      .map((ring) => ({ ring, area: areaKm2(ring) }))
      .sort((a, b) => b.area - a.area)
    const total = polygons.reduce((sum, p) => sum + p.area, 0)
    const kept = polygons.filter((p) => p.area > total * 0.002)
    const simple = kept.map((p) => [simplify(p.ring, TOLERANCE).map(round)]).filter((poly) => poly[0].length >= 4)
    return {
      type: 'Feature',
      properties: { code: slug(relation.tags.name), name: relation.tags.name, area_km2: Number(total.toFixed(1)), number: relation.tags.official_name?.match(/\b[IVX]+\b/)?.[0] ?? '' },
      geometry: { type: 'MultiPolygon', coordinates: simple },
    }
  })
  .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'pl'))
writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features }))
console.log(features.map((f) => `${f.properties.code} ${f.properties.area_km2}`).join('\n'))
