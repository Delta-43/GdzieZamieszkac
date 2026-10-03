"""Helpers to compare the English and Polish answers of the API."""
import re

POLISH_LETTERS = re.compile("[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]")
MARKDOWN = re.compile(r"\*\*|^#|\n#|^- |\n- ")
TECHNICAL_NOTE = re.compile(r"^OSM [a-z_]+=[a-z_]+\.$")  # an OpenStreetMap tag expression: nothing to translate


def shape(x):
    """The structure of a JSON value: keys and types, with a list described by its first element."""
    if isinstance(x, dict):
        return {k: shape(v) for k, v in sorted(x.items())}
    if isinstance(x, list):
        return [shape(x[0])] if x else []
    return "number" if isinstance(x, (int, float)) and not isinstance(x, bool) else type(x).__name__


def walk(x, path=""):
    """Yield (path, leaf) for every leaf of a JSON value; list items share their parent's path."""
    if isinstance(x, dict):
        for k, v in x.items():
            yield from walk(v, f"{path}.{k}")
    elif isinstance(x, list):
        for v in x:
            yield from walk(v, path + "[]")
    else:
        yield path, x


def displays(body):
    return [v for p, v in walk(body) if p.endswith(".display") and isinstance(v, str)]


def metrics_of(detail):
    return {m["key"]: m for g in detail["categories"] for m in g["metrics"]}


def format_problems(en_displays, pl_displays):
    """Number-format mistakes: a decimal point or comma thousands in Polish; a space inside a number or a decimal comma in English."""
    bad = [("pl decimal point", v) for v in pl_displays if re.search(r"\d\.\d", v)]
    bad += [("pl comma thousands", v) for v in pl_displays if re.search(r"\d,\d{3}\b", v)]
    bad += [("en space in number", v) for v in en_displays if re.search(r"\d[  ]\d{3}\b", v)]
    bad += [("en decimal comma", v) for v in en_displays if re.search(r"\d,\d{1,2}(?!\d)", v) and not re.search(r"\d,\d{3}", v)]
    return bad
