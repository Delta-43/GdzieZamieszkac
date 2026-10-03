# Design requirements (proposal)

Status: **proposal, waiting for the coordinator's yes.** Until it is accepted, the frontend keeps the placeholder theme (`frontend/REQUIREMENTS.md`, "Visual design").
Owner of the decision: `Delta-43`. Builder: `unicorn-alex` (task F3 and every screen after it).

## Decision proposed

Use the **Field Journal** design system from the team's design library as the base, with three changes that our rules force.

| | |
|---|---|
| **Why Field Journal** | The users are residents who are not data experts. The system is calm, warm and made for reading. Its copy voice has a trait "Honest about limits", which is our data rule. Tables with right-aligned tabular figures, flat surfaces and hairline borders suit a data portal. It has light and dark themes. |
| **What we take from Midnight Instrument** | The status chip pattern (icon plus label, never colour alone) for the data kind badges, and tabular figures for numbers. Nothing else. It is dark-first and written for operators. |
| **Why not a stock look** | A city service must feel trustworthy and plain. A decorative or playful system would work against the pitch. |

The tokens are in `docs/design/field-journal.tokens.css`. They are the library's tokens with the changes below, each marked in the file.

## Changes our rules force

1. **No theme toggle.** `AGENTS.md` allows the browser to store only the language choice. The app follows the system setting (`prefers-color-scheme`) and stores nothing. Do not use the `data-theme` attribute.
2. **Fonts are self-hosted.** No font is loaded from a third party. Copy the font files into `frontend/public/fonts/` with each `LICENSE.txt`, and list the fonts in the `README.md` disclosure. Literata and JetBrains Mono are under the SIL OFL. General Sans is under the ITF Free Font License. Check that its terms allow bundling in a public product before the first release.
3. **Stronger colours where the library is too weak.** Two library tokens fail WCAG 2.2 AA for our uses (measured on 3 October 2026 with the library's contrast tool):

| Pair | Library value | Result | Our fix |
|---|---|---|---|
| `border` on `bg`, light | 1.41:1 | Fails 3:1 for the edge of a control | New `--color-border-strong` = `paper-500`: 3.76:1 on `bg`, 4.10:1 on `surface` |
| `border` on `bg`, dark | 1.85:1 | Fails 3:1 | `--color-border-strong` = `paper-500`: 4.50:1 on `bg`, 4.23:1 on `surface` |
| `warning` text on `surface`, light | 3.91:1 | Fails 4.5:1 for small text | New `--color-warning-text` = `ochre-600`: 4.77:1 on `surface` |

Use `--color-border` only for decorative dividers. Use `--color-border-strong` for inputs, sliders, buttons and the edge of every control. Use `--color-warning-text` for any warning text. The `warning` colour itself is for icons and rules next to text.

Pairs that already pass: `text` on `bg` 16.9:1, `text-muted` on `bg` 5.99:1, `accent-contrast` on `accent` 6.27:1, `info` on `surface` 5.7:1 (all light), and `link` on `bg` 10.64:1 (dark). The F3 contrast test must check every pair in both themes, including the new tokens, and not only these.

## Type

- **Literata** for headings and body text, 18 px body on a 1.65 line, headings at weight 500. Use old-style figures in prose.
- **General Sans** for the interface: navigation, buttons, labels, table headers. Use tabular figures, so numbers line up.
- **JetBrains Mono** only where a code or an ID is shown. It is optional for the MVP, so leave it out if it costs weight.
- **Polish letters.** Literata's Latin Extended file covers ą, ć, ę, ł, ń, ś, ź and ż. Check the same in General Sans on the first Polish page, because its font file is not split by range. Fix a gap with a fallback font in the stack.
- Subset the files to Latin and Latin Extended, and keep the payload small (`REQUIREMENTS.md` sets the budget for JavaScript only; measure the fonts too).

## Layout

- Phone first, 320 CSS pixels. Text column up to 68 characters. Content up to 1200 px.
- Flat surfaces. Depth from tone and hairline borders, not from shadows. The only shadow is for menus.
- Targets at least 44 by 44 pixels (our rule is 24 at minimum; the library uses 44, and so do we).
- Focus ring: 2 px, `--color-focus`, with an offset, visible on every control. Nothing sticky may cover a focused element.
- Motion is quiet. Every duration is 0 under `prefers-reduced-motion`.

## Components for our data

These are what makes the product different. Each one carries the data rules from `AGENTS.md`.

| Component | Design |
|---|---|
| **Data kind badge** | A pill with an icon **and** a word: observed, estimated or proxy (Polish and English from the interface strings). The three differ by icon and shape, not by colour alone. It always sits next to the value. |
| **Metric row** | Label (sans), value as the API's `display` string (tabular figures), the badge, the as-of date, the source, and the caveat. The method sits in a collapsible detail. The rank is a small text, for example "3 of 18". |
| **Metric without data** | The label and the API's `reason` in `text-muted`, with a dashed border. No value and no zero. |
| **Score** | The number, and always the note that it compares the districts of one city only. |
| **AI label** | A visible chip next to every area report: written by artificial intelligence from the data. It is text, not only an icon. |
| **Stale-data notice** | A callout with a `warning` rule and `--color-warning-text`. It is polite, not blocking, and it never hides the content. |
| **Low-confidence point** | A hollow marker on the price chart, a note in words under the chart, and a column in the data table. |
| **Choropleth map** | One hue: the moss ramp from light to dark in five classes, with a legend that shows the scale, the unit and the data kind. Districts have a 1 px outline in `text`. The selected or focused district has a 3 px outline plus the focus ring. The table beside it holds the same values. The F3 test must check that the district outline has 3:1 against every fill. |
| **Price history** | A single line in `accent`, with a table beside it. One series needs no chart palette. |
| **Icons** | Inline SVG from an icon package bundled in the build (the library uses Tabler outline). Never loaded from a CDN. |

## Voice

The library's copy rules for Field Journal apply to the interface text: patient, concrete, honest about limits, warm and not chatty. Avoid "journey", "simply", "just", "easy", "seamless", "powerful". Polish text is `unicorn-alex`'s, and "wskaźnik jakości życia" and "ofertowa cena najmu" stay as defined in `frontend/REVIEW_CHECKLIST.md`.
Never write "safe" or "dangerous" about a district.

## What this does not decide

- A logo, a Kraków colour identity or a favicon. The moss and paper palette is neutral, and those come later, as tokens that replace the palette.
- The Warsaw look. The product shows one city.

## To check before the first release

- [ ] The coordinator accepts this proposal (or replaces it).
- [ ] The font files are in `frontend/public/fonts/` with their licences, and the README lists them.
- [ ] General Sans shows all nine Polish letters.
- [ ] The F3 contrast test passes for every pair in both themes.
- [ ] The map outline and the five ramp classes pass the checks above.
- [ ] No request goes to a third party (check the Network tab).
