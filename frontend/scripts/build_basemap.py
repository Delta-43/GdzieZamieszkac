#!/usr/bin/env python3
"""One-time download of the context layers of the map (rivers, lakes, main roads, railways, a few landmarks) from OpenStreetMap.

Usage: python3 frontend/scripts/build_basemap.py [--api http://localhost:8000/v1] [--overpass https://overpass-api.de/api/interpreter]

The extent comes from the district shapes of the data API (GET /districts.geojson), and the city code from GET /meta, so nothing
about one city is written here. The result is frontend/public/basemap/<city>.json: simplified coordinates, served with the app, so the
browser never asks a map server for anything. The data is (c) OpenStreetMap contributors, ODbL 1.0: see frontend/public/basemap/README.md.
The app works without the file; it then shows the district shapes alone.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "basemap"
TOLERANCE = 0.00007  # degrees, about 7 metres: lines are simplified to this (the map is about 25 m per pixel)
MIN_WATER_AREA = 6.0e-6  # square degrees (about 40 000 m2): smaller ponds are left out
DECIMALS = 4

# A few places a reader knows, to find their way on the map. OpenStreetMap names, per city. Add a city here to give it landmarks.
LANDMARKS = {
    "krakow": ["Rynek Główny", "Zamek Królewski na Wawelu", "Kraków Główny", "Kopiec Kościuszki", "Nowa Huta", "Plac Centralny im. Ronalda Reagana"],
}


def get_json(url: str):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GdzieZamieszkac-basemap/1"}), timeout=60) as r:
        return json.load(r)


def overpass(endpoint: str, query: str) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(endpoint, data=data, headers={"User-Agent": "GdzieZamieszkac-basemap/1"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def positions(geometry: dict):
    t, c = geometry["type"], geometry["coordinates"]
    rings = c if t == "Polygon" else [r for poly in c for r in poly] if t == "MultiPolygon" else []
    return [p for ring in rings for p in ring]


def simplify(points: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Douglas-Peucker."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    far, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        x, y = points[i]
        d = math.hypot(x - x1, y - y1) if norm == 0 else abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
        if d > far:
            far, idx = d, i
    if far <= tol:
        return [points[0], points[-1]]
    return simplify(points[: idx + 1], tol)[:-1] + simplify(points[idx:], tol)


def ring_area(ring) -> float:
    return abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring)))) / 2


def trim(points, box):
    """Keep the stretch of a line that is inside the box, with one point of margin on each side."""
    inside = [i for i, (x, y) in enumerate(points) if box[0] <= x <= box[2] and box[1] <= y <= box[3]]
    if not inside:
        return []
    return points[max(inside[0] - 1, 0) : inside[-1] + 2]


def rounded(points):
    return [[round(x, DECIMALS), round(y, DECIMALS)] for x, y in points]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8000/v1")
    ap.add_argument("--overpass", default="https://overpass-api.de/api/interpreter")
    args = ap.parse_args()

    city = get_json(f"{args.api}/meta")["city"]
    shapes = get_json(f"{args.api}/districts.geojson")
    pts = [p for f in shapes["features"] for p in positions(f["geometry"])]
    west, east = min(p[0] for p in pts), max(p[0] for p in pts)
    south, north = min(p[1] for p in pts), max(p[1] for p in pts)
    margin = 0.001
    box = (west - margin, south - margin, east + margin, north + margin)
    bbox = f"{box[1]},{box[0]},{box[3]},{box[2]}"
    print(f"city {city}, box {bbox}", file=sys.stderr)

    names = LANDMARKS.get(city, [])
    landmark_query = "".join(f'  nwr["name"="{n}"]({bbox});\n' for n in names)
    q = f"""[out:json][timeout:150];
(
  way["highway"~"^(motorway|trunk|primary)$"]({bbox});
  way["railway"="rail"]["service"!~"."]({bbox});
  way["waterway"="river"]({bbox});
  way["natural"="water"]({bbox});
  relation["natural"="water"]({bbox});
);
out geom tags;
(
{landmark_query});
out center tags;"""
    data = overpass(args.overpass, q)

    roads, rail, rivers, lakes, places = [], [], [], [], []
    for el in data["elements"]:
        tags = el.get("tags", {})
        if tags.get("name") in LANDMARKS.get(city, []) and tags.get("natural") != "water" and "highway" not in tags and "waterway" not in tags:
            c = el if el["type"] == "node" else el.get("center")
            if c and not any(p["name"] == tags["name"] for p in places):
                places.append({"name": tags["name"], "lon": round(c["lon"], 4), "lat": round(c["lat"], 4)})
            continue
        if el["type"] == "way" and "geometry" in el:
            line = [(g["lon"], g["lat"]) for g in el["geometry"]]
            line = simplify(trim(line, box), TOLERANCE)
            if len(line) < 2:
                continue
            if "highway" in tags:
                roads.append({"class": tags["highway"], "name": tags.get("name"), "line": rounded(line)})
            elif "railway" in tags:
                rail.append({"line": rounded(line)})
            elif "waterway" in tags:
                rivers.append({"name": tags.get("name"), "line": rounded(line)})
            elif tags.get("natural") == "water" and line[0] == line[-1] and ring_area(line) >= MIN_WATER_AREA:
                lakes.append({"name": tags.get("name"), "ring": rounded(line)})
        elif el["type"] == "relation" and tags.get("natural") == "water":
            for member in el.get("members", []):
                if member.get("role") == "outer" and "geometry" in member:
                    ring = [(g["lon"], g["lat"]) for g in member["geometry"]]
                    if len(ring) > 3 and ring[0] == ring[-1] and ring_area(ring) >= MIN_WATER_AREA:
                        lakes.append({"name": tags.get("name"), "ring": rounded(simplify(ring, TOLERANCE))})

    result = {
        "city": city,
        "attribution": "© OpenStreetMap contributors (ODbL 1.0)",
        "downloaded": __import__("datetime").date.today().isoformat(),
        "roads": roads,
        "rail": rail,
        "rivers": rivers,
        "lakes": lakes,
        "places": places,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{city}.json"
    path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{path}: {path.stat().st_size / 1024:.0f} KB; roads {len(roads)}, rail {len(rail)}, rivers {len(rivers)}, lakes {len(lakes)}, places {len(places)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
