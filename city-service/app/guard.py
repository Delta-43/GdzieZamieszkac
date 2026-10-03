"""The number guard: a report may only contain numbers that are in the facts the model was given.

The model narrates. It never computes the score. If the text holds a number that is not a supplied fact, the report is dropped.
"""
from __future__ import annotations

import re

NUMBER = re.compile(r"\d+(?:[  ,.]\d+)*")


THOUSANDS = re.compile(r"^\d{1,3}(?:[ ,.]\d{3})+$")


def _canon(token: str) -> str:
    """One spelling for a number: no thousands separators, a dot for the decimal mark, no trailing zeros."""
    t = token.replace("\u00a0", " ")
    if THOUSANDS.match(t):
        return re.sub(r"[ ,.]", "", t)
    t = t.replace(",", ".").replace(" ", "")
    return t.rstrip("0").rstrip(".") if "." in t else t


def numbers_in(text: str) -> set[str]:
    return {_canon(m.group(0)) for m in NUMBER.finditer(text)}


def unsupported_numbers(report: str, facts: list[str]) -> set[str]:
    """Numbers in `report` that no fact contains."""
    allowed: set[str] = set()
    for fact in facts:
        allowed |= numbers_in(fact)
    return numbers_in(report) - allowed
