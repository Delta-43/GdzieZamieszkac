#!/usr/bin/env python3
"""Append the fragments in changelog/ to ON_SITE_CHANGELOG.md, oldest first, and delete them. `--check` only lists them (exit 1 if any)."""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRAGMENTS = ROOT / "changelog"
TARGET = ROOT / "ON_SITE_CHANGELOG.md"
NAME = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-[a-z0-9][a-z0-9-]*\.md$")


def heading(day: date) -> str:
    return f"## {day.day} {day.strftime('%B %Y')}"


def fragments() -> list[tuple[date, Path, str]]:
    found = []
    for path in sorted(FRAGMENTS.glob("*.md")):
        if path.name == "README.md":
            continue
        m = NAME.match(path.name)
        if not m:
            sys.exit(f"{path.name}: the name must be YYYY-MM-DD-<area>-<slug>.md (lower case, digits, hyphens)")
        text = path.read_text(encoding="utf-8").strip()
        if not text.startswith("- "):
            sys.exit(f"{path.name}: the entry must start with '- '")
        found.append((date(int(m[1]), int(m[2]), int(m[3])), path, text))
    return sorted(found, key=lambda f: (f[0], f[1].name))


def main() -> int:
    items = fragments()
    if "--check" in sys.argv:
        for _, path, _text in items:
            print(path.relative_to(ROOT))
        return 1 if items else 0
    if not items:
        print("No fragments to build.")
        return 0
    body = TARGET.read_text(encoding="utf-8").rstrip("\n")
    headings = re.findall(r"^## .*$", body, flags=re.M)
    last = headings[-1] if headings else ""
    for day, path, text in items:
        if heading(day) != last:
            body += f"\n\n{heading(day)}\n"
            last = heading(day)
        body += "\n" + text
        path.unlink()
    TARGET.write_text(body + "\n", encoding="utf-8")
    print(f"Appended {len(items)} fragment(s) to {TARGET.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
