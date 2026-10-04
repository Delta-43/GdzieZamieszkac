#!/usr/bin/env python3
# ruff: noqa: E501
"""Builds migration 0020: school sports grounds and public defibrillators for Kraków, per district.

Run from the repository root, with SUPABASE_DB_URL in server/config/.env (it only READS the district boundaries):

    backend/.venv/bin/python server/scripts/build_krakow_school_sports_and_aed.py

1. School sports grounds. The city's open data (otwartedane.um.krakow.pl) lists, for every school, the pitches, courts and running tracks it
   has (municipal schools and private schools are two datasets). The data has no district, so each school is placed from its street address
   with the address points of OpenStreetMap (one Overpass request for the whole city, kept in server/cache/, which is not committed) and put in
   the district whose boundary holds that point. A school whose address is not found is left out and counted in the note.
2. Defibrillators. OpenStreetMap (Overpass) points tagged emergency=defibrillator with access=yes or permissive, counted per district.
The result is written to server/migrations/krakow/0020_school_sports_and_aed.sql: only the numbers per district, no school or address.
"""
from __future__ import annotations

import datetime
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.core.config import _read_env_file  # noqa: E402

CACHE = ROOT / "server" / "cache"
OUT = ROOT / "server" / "migrations" / "krakow" / "0020_school_sports_and_aed.sql"
UA = "GdzieZamieszkac/1 (+https://github.com/Delta-43/GdzieZamieszkac)"
BOX = (49.95, 19.78, 50.14, 20.23)  # south, west, north, east: a school outside it is a wrong match
DATASETS = {
    "municipal": "https://api.um.krakow.pl/opendata-sport-infrastruktura-placowki-samorzadowe-2023-2024/v1/tereny-sportowe-infrastruktura-placowki-samorzadowe-2023-2024",
    "private": "https://api.um.krakow.pl/opendata-sport-infrastruktura-placowki-niesamorzadowe-2023-2024/v1/tereny-sportowe-infrastruktura-placowki-niesamorzadowe-2023-2024",
}
NOT_GROUNDS = {"Lp", "Numer RSPO"}


def http(url: str, data: bytes | None = None, timeout: int = 60):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def fetch_dataset(url: str) -> list[dict]:
    """All rows of one city dataset. The service pages with a cursor: the `$after` token of each answer's nextLink."""
    rows, next_url = [], url
    while next_url:
        page = http(next_url)
        rows += page["value"]
        link = page.get("nextLink")
        next_url = f"{url}?$after={urllib.parse.quote(urllib.parse.parse_qs(urllib.parse.urlparse(link).query)['$after'][0])}" if link else None
    return rows


def grounds_in(row: dict) -> int:
    """Pitches, courts, tracks and other sports grounds of one school: the sum of every numeric count column."""
    return int(sum(v for k, v in row.items() if k not in NOT_GROUNDS and isinstance(v, (int, float)) and k[:1].islower() and v))


TITLES = r"ulica|ul|aleja|al|plac|pl|osiedle|os|rondo|bulwar|droga|swietego|sw|ks|gen|prof|dr|bp|kard|abp|im|marszalka|mjr|plk|kpt|por|inz|hm|ojca"


def street_key(text: str) -> str:
    """A street name without accents, titles and punctuation, so 'ks. Józefa Meiera' and 'Józefa Meiera' meet."""
    s = unicodedata.normalize("NFKD", text.lower())
    s = "".join(c for c in s if not unicodedata.combining(c)).replace("ł", "l")
    s = re.sub(rf"\b({TITLES})\b\.?", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def number_keys(text: str) -> list[str]:
    """The ways a house number may be written in the other source: as given, then the number with its letter, then the number alone."""
    t = text.lower()
    full = re.sub(r"[^a-z0-9/-]", "", t)
    lead = re.match(r"\s*(\d+)\s*([a-z])?(?![a-z0-9])", t)
    keys = [full]
    if lead:
        keys += [f"{lead.group(1)}{lead.group(2) or ''}", lead.group(1)]
    return list(dict.fromkeys(keys))


def address_index() -> dict[tuple[str, str], tuple[float, float]]:
    """Every address point of the city in OpenStreetMap: (street key, house number) -> (lon, lat). One request, kept for the next run."""
    path = CACHE / "osm_addresses.tsv"
    if not path.exists():
        south, west, north, east = BOX
        query = ('[out:csv(::lat,::lon,"addr:street","addr:housenumber","addr:place";false;"\t")][timeout:180];'
                 f'nwr["addr:housenumber"]({south},{west},{north},{east});out center;')
        req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=240) as r:
            path.write_bytes(r.read())
    index: dict[tuple[str, str], tuple[float, float]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        f = line.split("\t")
        if len(f) < 5 or not f[0] or not f[3]:
            continue
        index.setdefault((street_key(f[2] or f[4]), re.sub(r"[^a-z0-9/-]", "", f[3].lower())), (float(f[1]), float(f[0])))
    return index


def locate(street: str, number: str, index: dict) -> tuple[float, float] | None:
    key = street_key(street)
    for n in number_keys(number):
        point = index.get((key, n))
        if point:
            lat, lon = point[1], point[0]
            return point if BOX[0] <= lat <= BOX[2] and BOX[1] <= lon <= BOX[3] else None
    return None


def inside(point, polygons) -> bool:
    x, y = point
    hit = False
    for polygon in polygons:
        for ring in polygon:
            for i in range(len(ring)):
                (x1, y1), (x2, y2) = ring[i - 1], ring[i]
                if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                    hit = not hit
    return hit


def sql_text(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> int:
    import psycopg
    from psycopg.rows import dict_row

    url = _read_env_file().get("SUPABASE_DB_URL")
    with psycopg.connect(url, connect_timeout=15, row_factory=dict_row) as conn:
        conn.read_only = True
        shapes = conn.execute("select code, ST_AsGeoJSON(boundary)::json as g from krakow.districts order by code").fetchall()
    districts = {s["code"]: s["g"]["coordinates"] for s in shapes}

    def district_of(point) -> str | None:
        return next((code for code, polys in districts.items() if inside(point, polys)), None)

    CACHE.mkdir(parents=True, exist_ok=True)
    index = address_index()

    # ---- school sports grounds
    schools = []
    for name, endpoint in DATASETS.items():
        rows = fetch_dataset(endpoint)
        kept = [r for r in rows if (r.get("Miejscowość") or "").strip() == "Kraków"]
        print(f"{name}: {len(rows)} rows, {len(kept)} in Kraków", file=sys.stderr)
        schools += kept
    per_school: dict[object, dict] = {}
    for r in schools:  # one entry per school (RSPO number), in case a school is listed twice
        per_school.setdefault(r.get("Numer RSPO") or id(r), r)
    grounds = {c: 0 for c in districts}
    sites = {c: 0 for c in districts}
    placed = missed = 0
    for r in per_school.values():
        street, number = (r.get("Ulica") or "").strip(), str(r.get("Nr domu") or "").strip()
        point = locate(street, number, index) if street and number else None
        code = district_of(point) if point else None
        if not code:
            missed += 1
            continue
        placed += 1
        g = grounds_in(r)
        grounds[code] += g
        sites[code] += 1 if g else 0
    total_schools = len(per_school)
    print(f"schools: {total_schools}, placed {placed}, not placed {missed}; grounds total {sum(grounds.values())}", file=sys.stderr)

    # ---- defibrillators
    south, west, north, east = BOX
    overpass = f'[out:json][timeout:90];nwr["emergency"="defibrillator"]({south},{west},{north},{east});out center tags;'
    elements = http("https://overpass-api.de/api/interpreter", urllib.parse.urlencode({"data": overpass}).encode(), 120)["elements"]
    aed = {c: 0 for c in districts}
    mapped = open_count = 0
    for e in elements:
        centre = e if e["type"] == "node" else e.get("center")
        if not centre:
            continue
        code = district_of((centre["lon"], centre["lat"]))
        if not code:
            continue
        mapped += 1
        if e.get("tags", {}).get("access") in ("yes", "permissive"):
            open_count += 1
            aed[code] += 1
    print(f"AED: {mapped} points in the city, {open_count} tagged public", file=sys.stderr)

    today = datetime.date.today().isoformat()
    now = datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
    pct_missed = f"{missed} of {total_schools}"
    school_note_en = f"{pct_missed} schools in the register could not be placed in a district from their address and are left out."
    school_note_pl = f"{missed} z {total_schools} szkół z rejestru nie udało się przypisać do dzielnicy na podstawie adresu, więc ich nie liczymy."
    aed_note_en = (f"Only points tagged as publicly accessible are counted ({open_count} of {mapped} mapped in the city). Volunteers map them, so the real "
                   "number may be higher. Some are inside buildings with opening hours.")
    aed_note_pl = (f"Liczymy tylko punkty oznaczone jako publicznie dostępne ({open_count} z {mapped} zmapowanych w mieście). Mapują je wolontariusze, "
                   "więc prawdziwa liczba może być wyższa. Część jest w budynkach, z godzinami otwarcia.")
    school_method_en = ("Pitches, courts, running tracks and other sports grounds of the schools in the city's register, added up per district. "
                        "A school belongs to the district its address is in.")
    school_method_pl = ("Boiska, korty, bieżnie i inne tereny sportowe szkół z rejestru miasta, zsumowane w dzielnicach. "
                        "Szkoła należy do dzielnicy, w której leży jej adres.")
    aed_method_en = "OpenStreetMap emergency=defibrillator with access=yes or permissive."
    aed_method_pl = "OpenStreetMap emergency=defibrillator z access=yes lub permissive."
    school = {"source": "Kraków open data: sports infrastructure of schools 2023/2024",
              "url": "https://otwartedane.um.krakow.pl/zbiory-danych/infrastruktura-sportowa-szkol-i-oplacowek-samorzadowych-w-roku-szkolnym-2023-2024 ; "
                     "https://otwartedane.um.krakow.pl/zbiory-danych/infrastruktura-sportowa-szkol-i-placowek-niesamorzadowych-w-roku-szkolnym-2023-2024",
              "licence": "Open data of Gmina Miejska Kraków (otwartedane.um.krakow.pl): free reuse with the credit and the dates of creation and acquisition; "
                         "addresses located with OpenStreetMap address points (ODbL 1.0)",
              "attribution": "Gmina Miejska Kraków, otwartedane.um.krakow.pl; © OpenStreetMap contributors (addresses located with address points)",
              "as_of": "2023-12-31"}
    pl = {  # English text -> Polish text, for the translation cache
        school["source"]: "Otwarte dane Krakowa: infrastruktura sportowa szkół 2023/2024",
        school["licence"]: "Dane otwarte Gminy Miejskiej Kraków (otwartedane.um.krakow.pl): swobodne wykorzystanie z podaniem źródła oraz dat wytworzenia i pozyskania; "
                           "adresy zlokalizowano w punktach adresowych OpenStreetMap (ODbL 1.0)",
        school["attribution"]: "Gmina Miejska Kraków, otwartedane.um.krakow.pl; © współtwórcy OpenStreetMap (adresy zlokalizowano w punktach adresowych)",
        school_method_en: school_method_pl, school_note_en: school_note_pl, aed_method_en: aed_method_pl, aed_note_en: aed_note_pl,
        "pitches, courts and tracks": "boiska, korty i bieżnie",
    }

    out = [f"""-- School sports grounds and publicly accessible defibrillators for Kraków, per district (generated by server/scripts/build_krakow_school_sports_and_aed.py on {today}).
-- amenity_open_sports_grounds changes meaning: it was "school grounds open to residents" (a Warsaw source Kraków does not have); it now counts the
-- pitches, courts and running tracks of the schools in the city's open register. amenity_aed_public counts defibrillators OpenStreetMap marks as public.
-- Both are shown, not scored (higher_is = neutral), so the default score, every ranking and the stored reports stay as they are.
-- Only numbers per district are stored: no school, no address, no coordinates. Safe to re-run (upsert). The update of metric_definitions is in krakow.audit_log.
-- Polish text needs a native check.

update krakow.metric_definitions m
   set label_en = v.label_en, label_pl = v.label_pl, description_en = v.description_en, description_pl = v.description_pl, unit = v.unit, higher_is = 'neutral'
  from (values
    ('amenity_open_sports_grounds', 'School sports grounds', 'Szkolne boiska, korty i bieżnie',
     'How many pitches, courts and running tracks the schools in the district have (municipal and private schools, school year 2023/2024). A school ground is not always open to everyone. The district is found from each school''s address. Not used in the overall score.',
     'Ile boisk, kortów i bieżni mają szkoły w dzielnicy (szkoły samorządowe i niesamorządowe, rok szkolny 2023/2024). Teren szkoły nie zawsze jest otwarty dla wszystkich. Dzielnicę ustalono z adresu szkoły. Nie wchodzi do wyniku ogólnego.',
     'pitches, courts and tracks'),
    ('amenity_aed_public', 'Public defibrillators (AED)', 'Publicznie dostępne defibrylatory (AED)',
     'How many defibrillators (AED) in the district are marked in OpenStreetMap as open to the public. Volunteers map them, so the real number may be higher. Some are inside buildings with opening hours. Not used in the overall score.',
     'Ile defibrylatorów (AED) w dzielnicy jest oznaczonych w OpenStreetMap jako dostępne publicznie. Mapują je wolontariusze, więc prawdziwa liczba może być wyższa. Część jest w budynkach, z godzinami otwarcia. Nie wchodzi do wyniku ogólnego.',
     'defibrillators')
  ) as v(metric_key, label_en, label_pl, description_en, description_pl, unit)
 where m.metric_key = v.metric_key;
"""]
    vals = []
    for code in sorted(districts):
        vals.append(f"    ({sql_text(code)}, 'amenity_open_sports_grounds', {grounds[code]}, {sites[code]}, 'pitches, courts and tracks', {sql_text(school['source'])}, "
                    f"{sql_text(school['url'])}, {sql_text(school['licence'])}, {sql_text(school['attribution'])}, 'observed', {sql_text(school_method_en)}, "
                    f"{sql_text(school_note_en)}, date {sql_text(school['as_of'])})")
        vals.append(f"    ({sql_text(code)}, 'amenity_aed_public', {aed[code]}, {aed[code]}, 'defibrillators', 'OpenStreetMap via Overpass', "
                    f"'https://overpass-api.de/api/interpreter', 'ODbL 1.0', '© OpenStreetMap contributors', 'observed', {sql_text(aed_method_en)}, "
                    f"{sql_text(aed_note_en)}, date {sql_text(today)})")
    out.append("""insert into krakow.district_metrics (district_id, metric_key, value_num, value_en, value_pl, unit, as_of_date, source, source_url, licence, attribution,
                                      data_kind, method, coverage_note, n_obs, fetched_at)
select d.id, v.k, v.val, v.val::text, v.val::text, v.unit, v.as_of, v.source, v.url, v.licence, v.attr, v.kind, v.method, v.note, v.n, now()
  from (values""")
    out.append(",\n".join(vals))
    out.append("""  ) as v(code, k, val, n, unit, source, url, licence, attr, kind, method, note, as_of)
  join krakow.districts d on d.code = v.code
on conflict (district_id, metric_key, as_of_date) do update
  set value_num = excluded.value_num, value_en = excluded.value_en, value_pl = excluded.value_pl, unit = excluded.unit, source = excluded.source,
      source_url = excluded.source_url, licence = excluded.licence, attribution = excluded.attribution, data_kind = excluded.data_kind,
      method = excluded.method, coverage_note = excluded.coverage_note, n_obs = excluded.n_obs, fetched_at = excluded.fetched_at;
""")
    out.append("""insert into krakow.ingestion_runs (source, status, started_at, finished_at, rows_written, git_sha, notes)
values ('krakow_school_sports', 'ok', now(), now(), 18, null, 'Loaded by 0020_school_sports_and_aed.sql'),
       ('krakow_aed_osm', 'ok', now(), now(), 18, null, 'Loaded by 0020_school_sports_and_aed.sql');
""")
    out.append("""insert into krakow.translation_cache (cache_key, source_lang, target_lang, source_text, translated_text, engine, model, glossary_version)
select encode(sha256(convert_to('manual|en|pl|' || v.en, 'UTF8')), 'hex'), 'en', 'pl', v.en, v.pl, 'manual', 'manual', '1'
  from (values""")
    out.append(",\n".join(f"    ({sql_text(en)}, {sql_text(p)})" for en, p in pl.items()))
    out.append("""  ) as v(en, pl)
on conflict (cache_key) do update set translated_text = excluded.translated_text, engine = excluded.engine, model = excluded.model;
""")
    OUT.write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
