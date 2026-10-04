# Design

Status: **accepted by the coordinator, 4 October 2026.** The app follows the look of the city's own website, krakow.pl. The earlier proposal (Field Journal: moss green, Literata and IBM Plex Sans) was dropped, and its files were removed. They stay in the git history (the last commit that had them is the one before this change).
Owner of the decision: `Delta-43`. Builder: the frontend team.

## Changes since acceptance (4 October 2026)

Two later decisions changed the look. `frontend/README.md` holds the detail and `frontend/HANDOFF.md` the reasons.

- **Shapes and sizes follow the Gov.pl design system** (buttons, fields, messages, the type scale), with Kraków's colours and Lato kept (pull request #75).
- **The map has no pixel canvas and no zoom buttons.** The districts are one blue ramp, and the colours change in a short wave by CSS. The map moves with the wheel, drag, double click and the keyboard (`+`, `-`, arrows, `0`), and a hint line says so (pull requests #73 and #89).
- Where the component table below says "five classes with a legend", the legend is now one line that says what darker means and whether more is better for that measure. Class numbers are never shown: the five steps are named in words.

## The look

- A white page, grey panels, one blue (`#0063af`), dark navy text (`#071f32`). The colours are the ones that site's stylesheet uses most. Colours and a typeface only: no logo, crest or photo of the city.
- **Lato**, regular and bold, bundled from the `@fontsource/lato` package (SIL Open Font Licence 1.1) with the Latin Extended range for the Polish letters. No font loads from a third party.
- All values are in `frontend/src/theme/tokens.ts`. Nothing else writes a colour, a font or a size. `frontend/src/theme/theme.test.ts` checks the contrast of every pair in use: 4.5:1 for text and 3:1 for the parts of a control. To put a colour on a new background, add the pair there first.
- The header is a white bar with the menu button at its left, over a blue rule. Section headings carry a short dark bar.

## Rules our project forces

1. **No theme toggle.** `AGENTS.md` allows the browser to store only the language choice. The app is light only, and stores nothing else.
2. **No third-party request.** Fonts, icons and map shapes are served with the app.
3. **Contrast.** Use the hairline border for decorative dividers only. Use the strong border for inputs, sliders, buttons and the edge of every control. Warning text uses its own darker colour. The icons and rules next to a warning use the plain warning colour.

## Layout

- Phone first, 320 CSS pixels, with no sideways scroll (WCAG 1.4.10). Text column up to 68 characters. Content up to 1200 px. Below 26rem the header wraps and the language buttons take a row of their own.
- Flat surfaces. Depth from tone and hairline borders, not from shadows. The only shadow is for menus.
- Targets at least 44 by 44 pixels (our rule is 24 at minimum; we use 44).
- Focus ring: 2 px, with an offset, visible on every control. Nothing sticky may cover a focused element.
- Motion is quiet. Every duration is 0 under `prefers-reduced-motion`.

## Components for our data


These are what makes the product different. Each one carries the data rules from `AGENTS.md`.

| Component | Design |
|---|---|
| **Data kind badge** | A pill with an icon **and** a word: observed, estimated or proxy (Polish and English from the interface strings). The three differ by icon and shape, not by colour alone. It always sits next to the value. |
| **Metric row** | Label (sans), value as the API's `display` string (tabular figures), the badge, the as-of date, the source, and the caveat. The method sits in a collapsible detail. The rank is a small text, for example "3 of 18". |
| **Metric without data** | The label and the API's `reason` in the muted text colour, with a dashed border. No value and no zero. |
| **Score** | The number, and always the note that it compares the districts of one city only. |
| **AI label** | A visible chip next to every area report: written by artificial intelligence from the data. It is text, not only an icon. |
| **Stale-data notice** | A callout with a warning rule and the warning text colour. It is polite, not blocking, and it never hides the content. |
| **Low-confidence point** | A hollow marker on the price chart, a note in words under the chart, and a column in the data table. |
| **Choropleth map** | One hue: the blue ramp from light to dark in five classes, with a legend that shows the scale, the unit and the data kind. Districts have a 1 px outline in `text`. The selected or focused district has a 3 px outline plus the focus ring. The table beside it holds the same values. The F3 test must check that the district outline has 3:1 against every fill. |
| **Price history** | A single line in the accent blue, with a table beside it. One series needs no chart palette. |
| **Icons** | Inline SVG from an icon package bundled in the build. Never loaded from a CDN. |

## Voice

The interface text is patient, concrete, honest about limits, warm and not chatty. Avoid "journey", "simply", "just", "easy", "seamless", "powerful". Polish text is `unicorn-alex`'s, and "wskaźnik jakości życia" and "ofertowa cena najmu" stay as defined in `frontend/REVIEW_CHECKLIST.md`.
Never write "safe" or "dangerous" about a district.

## What this does not decide

- A logo, a favicon or a crest of the city. The city would provide them if it hosted the service.
- The Warsaw look. The product shows one city.

## To check before each release

- [ ] The font files are served with the app, and the `README.md` disclosure lists Lato.
- [ ] All nine Polish letters render in Lato.
- [ ] The contrast test passes for every pair.
- [ ] The map outline and the five ramp classes pass the checks in `frontend/ACCESSIBILITY.md`.
- [ ] No request goes to a third party (check the Network tab).
