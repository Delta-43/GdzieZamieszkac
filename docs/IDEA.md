# The idea

GdzieZamieszkać ("where to live") helps people choose a district before they start looking at flats. It is not a listings site. It holds no offers, brokers or links to flats.
This edition covers Kraków's 18 districts. Updated 3 October 2026.

## Positioning

We pitch the project as a public service that a city could host. The free tier needs no login. A city is the natural owner because it can hold official records,
publish official notices, and later collect verified feedback from residents. A city also needs a demand signal that shows where people want to live.

The data and the backend exist today. The frontend is built during HackYeah. The city-facing features are concepts.

## Who it is for

- **Residents and newcomers** who choose where to live: a single person, a couple, newly married partners, a family with children, a multigenerational household, a senior, a student.
- **The city**, as the host and the owner of official content.

## What exists today

- 18 districts with 45 metrics in seven categories: transport, demographics, livability, amenities, environment, cost and safety indicators.
- A livability score computed in code from percentile ranks. A user can weight the categories, and personas give presets.
- Provenance on every value: the data kind (`observed`, `estimated`, `proxy`), the source, the licence, the credit line, the date, the method and the caveat.
- Quarterly sale price history, price momentum and the city's historical range, public transport time between districts, and a rent-versus-buy estimate.
- A report per district in Polish and English, written by a language model from stored facts and checked by a guard. The report is stored, not generated at request time.
- No forecast. We tested two methods against naive baselines and neither won, so the API publishes history and the backtest only.

## The household profile (planned, in the browser)

The user describes their situation: household type, children's ages, work place and how they commute, and rent or buy with a budget.
The profile only sets weights and filters on public metrics. It stays in the browser. It never filters by who lives in a district, because steering by demographics is a legal risk.

## Concepts for a city service

These are not built. Each needs a contract change and a separate service first, because the backend is read-only and has no internet access by design.

1. **Personalised AI report.** The user types requirements and gets a summary. A language model only narrates computed facts under the existing guards: cite only supplied numbers, flag estimates and proxies, make no safety verdict.
   Every report carries an AI label.
2. **Official notices.** The city publishes planned projects and infrastructure. They are labelled official, dated and sourced, published at a fixed time, and never presented as price forecasts.
3. **Resident feedback.** Residents report the rent they actually pay, or a data problem. Identity is checked through the national login node, and only a salted per-person token is kept, so a landlord cannot trace a report to a tenant.
   Feedback is verified before use and kept out of the score until then. Crime sightings are not collected. People are pointed to the police's national threat map.
   A fixed, non-chance reward per verified contribution is considered. A lottery was rejected for launch because it needs a permit and invites spam.
4. **Demand counts.** Aggregate, anonymous counts by district, with a minimum count before a number is shown. Interest is a demand signal, not proof of need.

A developer or investor tier is not planned. No forecast passes our backtest, and a public body publishing return forecasts carries risk.

## What makes it different

Products already exist in Poland: MiejscoMetr scores a single address in 13 categories, Locumo writes property reports, Dobra Lokacja is a free map, and PolandRent and Otodom Analytics cover prices. As of 3 October 2026, our edge is:

- A district-level recommender with a household profile.
- A provenance label on every number.
- Sale prices from actual deeds, not asking prices.
- A commute matrix, and Polish and English text.
- A city behind it, with official notices and a verified feedback channel.

We chose district level on purpose. A district score is honest where an address score implies a precision the data does not have.

## Known limits

- Rents are asking rents from a one-time snapshot. A city product should use data-sharing agreements or verified resident reports.
- Kraków has no recorded crime data. Safety uses road accidents and proxies.
- Commute times on long trips run fast. Treat times above about 60 minutes as lower bounds.
- The road accident data is free for non-commercial use only.

## Open questions

- A Polish legal opinion on fees for a city service, municipal economic activity, a reward for feedback, and AI transparency duties (EU AI Act, Article 50).
- Who operates the service, and who pays.
- Whether the national login node can serve this use.
