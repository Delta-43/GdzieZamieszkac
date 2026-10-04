"""The in-memory data store.

The audited data of one city is small (18 districts, about 900 metric rows) and changes only after an ingestion run, so the backend
loads a snapshot once, serves every request from memory, and reloads when the data version changes. The database is read only by
`load_snapshot` and `probe_version`; a request never waits for it, and if it goes away the API keeps serving the last snapshot.

Read patterns follow docs/DATA_DICTIONARY.md section 5 (latest `as_of_date` per district and metric; Polish notes from
translation_cache; PostGIS functions live in the `extensions` schema).
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import pandas as pd
import psycopg
from psycopg import sql
from psycopg.rows import dict_row

from . import scoring
from .config import CITIES, Settings
from .i18n import CATEGORIES

STATEMENT_TIMEOUT_MS = 15_000
SIMPLIFY_TOLERANCE = 0.0002  # degrees; about 20 m, plenty for a city map of 18 polygons
WEEKLY_MAX_AGE = timedelta(days=14)
# Metrics with Kraków data that are shown and ranked but not part of the score. Adding them to the score would move every stored score, every
# ranking and the numbers in the stored reports. They join the score when the scores and the reports are recomputed together (the data pipeline).
SHOWN_NOT_SCORED = frozenset({"amenity_open_sports_grounds", "amenity_aed_public"})


class StoreUnavailable(RuntimeError):
    """No snapshot could be loaded (the database was never reachable)."""


@dataclass
class Snapshot:
    """Everything read from the database for one city, plus the version fingerprint it was built from."""
    districts: list[dict]            # code, name, area_km2, geometry (GeoJSON dict or None)
    metric_defs: list[dict]          # the catalogue rows
    rows: list[dict]                 # latest row per district and metric, with `code`
    reports: dict[tuple[str, str], dict]   # (code, locale) -> row
    notes_pl: dict[str, str]         # English note -> Polish note
    runs: list[dict]                 # latest ingestion run per source
    version: str
    fetched_max: datetime | None = None
    loaded_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    series: list[dict] = field(default_factory=list)   # history rows (code, metric_key, period, value, display, n_obs, provenance)
    commute: list[dict] = field(default_factory=list)  # (from_code, to_code, minutes, method, computed_at); empty until the matrix is loaded
    city_series: list[dict] = field(default_factory=list)  # city-level history (NBP quarterly price), oldest first


# ---------------------------------------------------------------- database

def _connect(settings: Settings) -> psycopg.Connection:
    """A short-lived, read-only session with a statement timeout, even if the credentials could write."""
    if not settings.db_url:
        raise StoreUnavailable("no database URL is set (API_DB_URL or SUPABASE_DB_URL)")
    conn = psycopg.connect(settings.db_url, autocommit=True, connect_timeout=10, row_factory=dict_row)
    conn.execute("set default_transaction_read_only = on")
    conn.execute(f"set statement_timeout = {STATEMENT_TIMEOUT_MS}")
    return conn


def _q(settings: Settings, text: str) -> sql.Composed:
    return sql.SQL(text).format(s=sql.Identifier(settings.schema))


def _version(fetched_max, n_rows, generated_max, n_reports, *, series_max=None, n_series=0, commute_max=None, n_commute=0,
             city_max=None, n_city=0) -> str:
    raw = f"{fetched_max}|{n_rows}|{generated_max}|{n_reports}"
    if n_series:  # appended only when the table has rows, so versions of data without them stay as they were
        raw += f"|{series_max}|{n_series}"
    if n_commute:
        raw += f"|{commute_max}|{n_commute}"
    if n_city:
        raw += f"|{city_max}|{n_city}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


def probe_version(settings: Settings) -> str:
    """A cheap fingerprint of what the snapshot is built from."""
    with _connect(settings) as conn:
        m = conn.execute(_q(settings, "select max(fetched_at) f, count(*) n from {s}.district_metrics")).fetchone()
        r = conn.execute(_q(settings, "select max(generated_at) g, count(*) n from {s}.district_reports")).fetchone()
        h = conn.execute(_q(settings, "select max(fetched_at) f, count(*) n from {s}.district_series")).fetchone()
        k = conn.execute(_q(settings, "select max(computed_at) f, count(*) n from {s}.commute_matrix")).fetchone()
        cs = conn.execute(_q(settings, "select max(fetched_at) f, count(*) n from {s}.city_series")).fetchone()
    return _version(m["f"], m["n"], r["g"], r["n"], series_max=h["f"], n_series=h["n"], commute_max=k["f"], n_commute=k["n"],
                    city_max=cs["f"], n_city=cs["n"])


def load_snapshot(settings: Settings) -> Snapshot:
    """Read the whole city from the database (read-only) and fingerprint it."""
    assert settings.schema in CITIES  # the schema name is interpolated as an identifier; only known cities pass
    with _connect(settings) as conn:
        def run(text: str, args: tuple = ()) -> list[dict]:
            return conn.execute(_q(settings, text), args).fetchall()

        districts = run("""select code, name_pl as name, area_km2::float8 as area_km2,
            extensions.st_asgeojson(extensions.st_simplifypreservetopology(boundary, %s), 5)::json as geometry
            from {s}.districts order by code""", (SIMPLIFY_TOLERANCE,))
        defs = run("select * from {s}.metric_definitions order by sort_order, metric_key")
        rows = run("""select distinct on (d.code, m.metric_key) d.code, m.metric_key, m.value_num, m.value_en, m.value_pl, m.unit, m.data_kind,
            m.n_obs, m.source, m.source_url, m.licence, m.attribution, m.as_of_date, m.method, m.coverage_note, m.fetched_at
            from {s}.district_metrics m join {s}.districts d on d.id = m.district_id
            order by d.code, m.metric_key, m.as_of_date desc, m.fetched_at desc""")
        reports = run("""select d.code, r.locale, r.body, r.livability_score::float8 as livability_score, r.model, r.generated_at, r.data_version
            from {s}.district_reports r join {s}.districts d on d.id = r.district_id""")
        notes = run("select source_text, translated_text from {s}.translation_cache where target_lang = 'pl' order by created_at")
        runs = run("""select distinct on (source) source, status, finished_at, started_at from {s}.ingestion_runs
            order by source, coalesce(finished_at, started_at) desc""")
        series = run("""select d.code, s.metric_key, s.period_start, s.period_end, s.value_num, s.value_en, s.value_pl, s.n_obs, s.data_kind, s.method,
            s.source, s.source_url, s.licence, s.attribution
            from {s}.district_series s join {s}.districts d on d.id = s.district_id order by d.code, s.metric_key, s.period_start""")
        m = conn.execute(_q(settings, "select max(fetched_at) f, count(*) n from {s}.district_metrics")).fetchone()
        r = conn.execute(_q(settings, "select max(generated_at) g, count(*) n from {s}.district_reports")).fetchone()
        h = conn.execute(_q(settings, "select max(fetched_at) f, count(*) n from {s}.district_series")).fetchone()
        k = conn.execute(_q(settings, "select max(computed_at) f, count(*) n from {s}.commute_matrix")).fetchone()
        commute = run("""select a.code as from_code, b.code as to_code, c.minutes, c.method, c.computed_at
            from {s}.commute_matrix c join {s}.districts a on a.id = c.from_district_id join {s}.districts b on b.id = c.to_district_id
            order by a.code, b.code""")
        city_series = run("""select metric_key, period_start, period_end, value_num, value_en, value_pl, data_kind, method, source, source_url,
            licence, attribution
            from {s}.city_series order by metric_key, period_start""")
        cs = conn.execute(_q(settings, "select max(fetched_at) f, count(*) n from {s}.city_series")).fetchone()
    for d in districts:
        d["geometry"] = d["geometry"] if isinstance(d["geometry"], dict) else (json.loads(d["geometry"]) if d["geometry"] else None)
    return Snapshot(districts=districts, metric_defs=defs, rows=[x for x in rows if x["value_num"] is not None],
                    reports={(x["code"], x["locale"]): x for x in reports}, notes_pl={n["source_text"]: n["translated_text"] for n in notes},
                    runs=runs, version=_version(m["f"], m["n"], r["g"], r["n"], series_max=h["f"], n_series=h["n"],
                                    commute_max=k["f"], n_commute=k["n"], city_max=cs["f"], n_city=cs["n"]),
                    fetched_max=m["f"], series=series, commute=commute, city_series=city_series)


# ---------------------------------------------------------------- derived tables

class Derived:
    """Everything computed from a snapshot once: lookups, the wide table, ranks, default scores and yields."""

    def __init__(self, snap: Snapshot, now: datetime | None = None):
        self.snap = snap
        self.districts = {d["code"]: d for d in snap.districts}
        self.codes = [d["code"] for d in snap.districts]
        self.defs = {d["metric_key"]: d for d in snap.metric_defs}
        self.rows = {(r["code"], r["metric_key"]): r for r in snap.rows}
        self.available = {r["metric_key"] for r in snap.rows}
        self.meta = {k: (d["category"], d["higher_is"]) for k, d in self.defs.items()}
        self.area = pd.Series({c: float(d["area_km2"]) for c, d in self.districts.items()})
        wide = pd.DataFrame({k: pd.Series({c: self.rows[(c, k)]["value_num"] for c in self.codes if (c, k) in self.rows}, dtype="float64")
                             for k in sorted(self.available)}).reindex(self.codes)
        self.wide = wide
        # Shown and ranked, but not scored: they keep their direction (so every metric's share of its category stays as the stored scores were made),
        # and are only left out of the table the score is computed from. See SHOWN_NOT_SCORED.
        self.scorable = wide.drop(columns=[c for c in ("livability_score_default", *SHOWN_NOT_SCORED) if c in wide])
        self.base_weights = scoring.category_weights(self.meta)
        self.default_score, self.default_table = scoring.weighted_score(self.scorable, self.area, self.meta)
        self.ranks = self._ranks()
        self.yields = self._yields()
        self.series: dict[tuple[str, str], list[dict]] = {}
        for x in snap.series:
            self.series.setdefault((x["code"], x["metric_key"]), []).append(x)
        self.series_keys = {k for _, k in self.series}
        self.commute: dict[str, dict[str, float | None]] = {}
        for x in snap.commute:
            self.commute.setdefault(x["from_code"], {})[x["to_code"]] = x["minutes"]
        self.commute_method = snap.commute[0]["method"] if snap.commute else None
        self.category_order = self._category_order()
        self.stale = self._stale(now or datetime.now(UTC))

    # ranks: 1 is the best district after applying the metric's direction (counts are ranked per km², as in the score)
    def _ranks(self) -> dict[str, pd.Series]:
        out = {}
        for k in self.wide.columns:
            direction = self.meta[k][1]
            if direction not in ("better", "worse"):
                continue
            v = scoring.normalise(self.wide[k], self.area, k)
            out[k] = v.rank(ascending=(direction == "worse"), method="min")
        return out

    def rank_of(self, code: str, key: str) -> dict | None:
        """The rank of a district for a metric (1 = best after the metric's direction), or None for neutral or missing values."""
        r = self.ranks.get(key)
        if r is None or pd.isna(r.get(code)):
            return None
        return {"position": int(r[code]), "of": int(r.notna().sum()),
                "direction": "higher is better" if self.meta[key][1] == "better" else "lower is better"}

    def _yields(self) -> dict[str, dict]:
        out = {}
        for c in self.codes:
            sale, rent = self.rows.get((c, "sale_price_median_m2")), self.rows.get((c, "rent_price_median_m2"))
            if sale and rent and sale["value_num"] > 0 and rent["value_num"] > 0:
                y = rent["value_num"] * 12 / sale["value_num"]
                out[c] = {"yield": y, "payback": 1 / y, "sale": sale, "rent": rent}
        return out

    def _category_order(self) -> list[str]:
        first: dict[str, int] = {}
        for d in self.snap.metric_defs:
            first.setdefault(d["category"], d["sort_order"])
        return sorted(first, key=lambda c: (first[c], CATEGORIES.index(c) if c in CATEGORIES else 99))

    def _stale(self, now: datetime) -> dict:
        """Reasons the data may be out of date (served with a warning, never refused): a failed run, reports that no longer match the
        stored score, or a weekly source that has not refreshed."""
        reasons: list[dict[str, str]] = []
        for run in self.snap.runs:
            if run["status"] == "failed":
                reasons.append({"en": f"The last ingestion run of source '{run['source']}' failed.",
                                "pl": f"Ostatnie pobranie danych ze źródła '{run['source']}' nie powiodło się."})
        stored = self.wide.get("livability_score_default")
        if stored is not None:
            bad = sorted({c for (c, loc), r in self.snap.reports.items()
                          if c in stored.index and pd.notna(stored[c]) and r["livability_score"] is not None
                          and abs(float(r["livability_score"]) - float(stored[c])) > 0.05})
            if bad:
                reasons.append({"en": f"Reports are out of date for {len(bad)} district(s).",
                                "pl": f"Raporty są nieaktualne dla {len(bad)} dzielnic."})
        weekly = [r["fetched_at"] for r in self.snap.rows if self.defs.get(r["metric_key"], {}).get("refresh_cadence") == "weekly" and r["fetched_at"]]
        if weekly and now - max(weekly) > WEEKLY_MAX_AGE:
            reasons.append({"en": "Weekly-refresh metrics have not been refreshed for more than 14 days.",
                            "pl": "Miary odświeżane co tydzień nie były aktualizowane od ponad 14 dni."})
        return {"is_stale": bool(reasons), "reasons": reasons}


# ---------------------------------------------------------------- the store

class DataStore:
    """Holds the current snapshot and reloads it when the data version changes (checked at most every `refresh_seconds`)."""

    def __init__(self, loader: Callable[[], Snapshot], probe: Callable[[], str], refresh_seconds: int = 60,
                 clock: Callable[[], float] = time.monotonic):
        self._loader, self._probe, self._refresh, self._clock = loader, probe, refresh_seconds, clock
        self._derived: Derived | None = None
        self._checked = float("-inf")
        self._lock = threading.Lock()
        self.database_reachable: bool | None = None

    def get(self) -> Derived:
        """The current derived data. Loads on first use; later checks for a new version without blocking other requests."""
        if self._derived is None:
            with self._lock:
                if self._derived is None:
                    self._load()
            if self._derived is None:
                raise StoreUnavailable("data could not be loaded")
        elif self._clock() - self._checked >= self._refresh and self._lock.acquire(blocking=False):
            try:
                self._checked = self._clock()
                try:
                    if self._probe() != self._derived.snap.version:
                        self._load()
                    self.database_reachable = True
                except Exception:  # keep serving the last snapshot; /health reports "degraded"
                    self.database_reachable = False
            finally:
                self._lock.release()
        return self._derived

    def _load(self) -> None:
        try:
            self._derived = Derived(self._loader())
            self.database_reachable = True
        except Exception as e:  # first load failed: nothing to serve yet
            self.database_reachable = False
            if self._derived is None:
                raise StoreUnavailable(str(e)) from e
        finally:
            self._checked = self._clock()

    def current_version(self) -> str | None:
        """The data version of the loaded snapshot, or None before the first load."""
        return self._derived.snap.version if self._derived else None

    def is_stale(self) -> dict | None:
        """The staleness verdict of the loaded snapshot, or None before the first load."""
        return self._derived.stale if self._derived else None


def make_store(settings: Settings) -> DataStore:
    """A DataStore wired to the real database for these settings."""
    return DataStore(lambda: load_snapshot(settings), lambda: probe_version(settings), settings.refresh_seconds)
