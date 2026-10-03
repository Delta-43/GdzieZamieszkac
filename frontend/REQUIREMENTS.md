# Requirements: frontend

This file says what to build, in what order, and when a task is done. Rules that never change are in `AGENTS.md`.
The visual design is not decided yet. The coordinator will send design requirements. Until then, use one plain placeholder theme.

## Context

- The product is a free public portal for comparing the districts of one city. The pitch is that the city hosts it.
- The free tier needs no login. It shows public data with its source, date and caveat.
- This edition is for the Kraków hackathon on 3 and 4 October 2026. It covers Kraków's 18 districts.
- It is not a listings site. It never shows offers, brokers or links to flats.

## Users

The main users are people choosing where to live in Kraków. They are not data experts.
Examples: a single person, a couple, newly married partners, a family with children, a multigenerational household, a senior, and a newcomer or student.
Design for a phone first, at 320 CSS pixels wide. Many users will also use a screen reader, a keyboard, or a zoomed screen.

## Phases

| Phase | What | Needs a backend change? |
|---|---|---|
| **1. Demo slice** | Districts list and map, district detail, compare, find a district, sources, accessibility statement | No. Everything is in the contract today. |
| **2. Household profile** | Intake of household type, children's ages, work place and budget, mapped to weights and filters in the browser | No for the mapping. Extra persona presets are a small data change. |
| **3. Public-service features** | Personalised AI report, official notices, resident feedback with identity checks, aggregate demand counts | Yes. Each needs a contract change and a new service first. |

Build phase 1 first. Start phase 2 only when phase 1 passes review. Do not build phase 3 screens against imaginary endpoints.

## Shared elements (every page)

- A **skip link** to the main content, as the first focusable element.
- A **header** with the site name, the main navigation and the **language toggle** (Polski, English).
- A **notice** when the API reports stale data (`X-Data-Warning` header, or `/meta` `stale.is_stale`). Make it polite and not blocking.
- A **footer** with the required credit line of every source from `/meta`, and links to the sources page and the accessibility statement.
- A **page title** that says what the page is. Set the page language attribute to follow the toggle.
- After navigation, move focus to the main region.

## Phase 1 screens

### Home

- Heading, one sentence on what the portal does, and one sentence that it is not a listings site.
- One button: "See the districts".
- Acceptance: a visitor understands in ten seconds what the site is and what to do next.

### Districts (list and map)

- An SVG **choropleth map** from `/districts.geojson`. Colour each district by a metric the user chooses.
  Values come from `/metrics/{key}/values`. Do not load map tiles.
- A **legend** that shows the scale, the unit and the data kind.
- A **table** of all districts with the livability score, area and the two highlight values. The table is the full accessible equivalent of the map.
- Each district name links to its detail page.
- Show `score_note`, which says that scores compare the districts of this city only.
- Acceptance: every district is reachable with the keyboard. No information exists only in the map. Colour is never the only signal.

### District detail

- Heading with the district name, the area and the livability score with its note.
- The **area report** from `/districts/{code}/report`. Show the label that artificial intelligence wrote it. Show a note when `lang_fallback` is true.
  The body is plain text. Split paragraphs on blank lines. Never insert it as HTML.
- One section per category from `/districts/{code}`. Each metric shows the label, the `display` string, the data kind badge, the as-of date, the source, the rank, the sample size when present, and the caveat.
  The method goes in a collapsible detail. A metric without data shows its `reason`.
- The gross rental yield and the payback period, when present.
- **Price history** from `/districts/{code}/series/sale_price_median_m2`: a line chart with a data table beside it.
  Mark each point that has `low_confidence: true`, and explain the mark in words.
- **Outlook** from `/districts/{code}/outlook`: the momentum, the city's historical range and the backtest.
  This is history, not a forecast. Never show a single predicted number or rank districts by predicted growth.
  Hide the section when the endpoint answers `501`.
- **Commute** from `/commute?from={code}`: minutes by public transport to the other districts. Show the API's caveat.
- **Similar districts** from `/districts/{code}/similar`.
- **Rent versus buy** from `/districts/{code}/rent-vs-buy`, with a flat size input from 15 to 250 square metres. Label the result as an estimate.
- Acceptance: a reader can tell for every number where it comes from, when, and how reliable it is.

### Compare

- The user picks two to four districts. Call `/compare?codes=a,b,c`.
- Show a table with one column per district and one row per metric. Each cell shows the `display` string and the data kind.
- Acceptance: the table has proper headers. Do not mark a "winner" in a way that implies a safety verdict.

### Find a district

- The user picks a persona preset from `/personas`, or sets category weights from 0 to 5 with sliders.
- Offer the six scored categories: `amenities`, `cost`, `environment`, `livability`, `safety` and `transport`. Zero leaves a category out.
- Send the weights to `POST /recommend`. Show the ranking, the score and the top drivers of each district.
- Show `note` and the `missing_metrics`. Say in words that a metric without data is left out.
- Announce the result to screen readers with a polite live region.
- Acceptance: with no weights, the ranking equals the default livability score. A slider has a visible label and a text value.

### Sources

- Every source from `/meta`: name, credit line, licence, as-of date and link.
- A short explanation of the three data kinds: `observed`, `estimated` and `proxy`.

### Accessibility statement

- A draft page. The city must complete it: scope, compliance status, contact details and the complaints procedure.
- Do not publish the draft as the final statement.

### Error and empty pages

- A "page not found" page. A district that does not exist shows a clear message.
- Every empty state says what goes there and gives the one action that fills it.

## Phase 2: household profile

The profile helps the user set weights and filters. It stays in the browser's memory. Do not store it. Do not send it anywhere except as weights to `/recommend`.

| Field | Values | What it changes |
|---|---|---|
| Household type | single, couple, newly married, family with children, multigenerational, senior | Starting weights. Reuse a persona preset where one fits. |
| Children's ages | 0 to 2, 3 to 6, 7 to 12, 13 to 18 | Weights for amenities, safety and environment. |
| Work place | A district, plus public transport | Commute time from `/commute`, shown next to each result. |
| Budget and tenure | Rent or buy, a maximum amount, a flat size | A filter that compares the amount with the district medians. |

- Persona presets exist for `student`, `family`, `remote_worker`, `senior` and `budget`. Couple and newly married need new presets. Ask the coordinator to add them to the backend data file.
- For the budget filter, use the numeric `value` from `/metrics/{key}/values`, not the highlight text. Multiply the price per square metre by the flat size.
  Label the result an estimate. The rent is an asking rent, not a signed lease.
- The weights each household type gets are a proposal. The coordinator decides them.
- Never filter by who lives in a district.

## Phase 3: later features

These need a contract change and a backend service first. Do not build them yet. They are here so you can leave room in the layout.

- **Personalised AI report.** The user enters requirements and a profile and gets a summary. It must carry the artificial intelligence label.
- **Official notices.** Official notices of planned projects and infrastructure, set by the city. Show them as official, dated and sourced. Never present them as price forecasts.
- **Resident feedback.** Residents report the rent they pay or bad data. Identity is checked through the national login node. The form must meet WCAG 2.2 accessible authentication.
  Crime reports are not collected. Point people to the police's national threat map.
- **Demand counts.** Aggregate and anonymous. The browser sends no personal data.

## States

| State | What to show |
|---|---|
| Loading | A short status message. Keep the layout stable. |
| Error | What happened and what to do next, with a retry button. No blame. |
| Not found (`404`) | A clear message and a link back. |
| Not available (`501`) | Hide the feature. Do not show an error page. |
| Stale data | The small notice. Keep showing the data. |
| Language fallback | A note that the text is in English. |
| Low confidence | A mark and a sentence in words. Never colour alone. |

## Kraków data notes

These notes describe the data on 2 October 2026. The API is the source of truth. It carries each caveat and each reason, so show those and do not copy this list into the interface.

- 45 of the 51 catalogue metrics have data. The others come with a reason from the API.
- There is no recorded crime data for Kraków. Safety uses road accidents and proxies.
- The Kraków transit feeds contain no rail or metro stops.
- Resident figures are people registered for permanent residence. They are not the total population.
- Rents are asking rents from Otodom and OLX, pooled. A district with few listings carries a low confidence mark.
- Sale prices come from the national register of real estate prices. The quarterly history starts in 2021.
- Commute times above about 60 minutes are lower bounds. The matrix runs 9 to 19 minutes too fast on long trips.
- The noise figure is a lower bound of the combined noise level.

## Visual design

- Use one placeholder theme for Kraków. Keep the colours as tokens in one file. Never hard-code a colour in a component.
- Every text and interface colour pair must meet the contrast ratios in `ACCESSIBILITY.md`. Add a test that checks the tokens.
- Use the system font stack, or a self-hosted font.
- The coordinator will send the real design requirements. Plan for the tokens to change.

## Performance and browsers

- Aim for under 250 KB of JavaScript, compressed, on first load.
- Support the current and previous major version of Chrome, Firefox, Safari and Edge, and the matching mobile browsers.
- Use responsive layout from 320 CSS pixels. Respect the user's text size and reduced-motion setting.

## Out of scope

Accounts, saved searches, any request that writes data, listings, address-level answers, price forecasts, a city switcher, third-party fonts, tiles or scripts, and analytics.

## Definition of done

A task is done when all of these hold.

- [ ] It meets the acceptance criteria above.
- [ ] Types come from the current `openapi.yaml`.
- [ ] It works in Polish and in English.
- [ ] It works with the keyboard only, and at 320 pixels and 200 percent zoom.
- [ ] Automated accessibility checks pass, and you tested a screen reader pass on the main flow.
- [ ] Every value shows its provenance. A missing metric shows its reason.
- [ ] No request goes to a third party.
- [ ] The pull request is small and `unicorn-alex` has reviewed it.
