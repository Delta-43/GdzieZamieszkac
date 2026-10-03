# Data sources and licences (Kraków)

Every value in the API carries its source, licence and credit line. The backend reports them in `GET /v1/meta` under `sources`. This page summarises them.
The data was collected between 29 September and 2 October 2026, before the event, for research. The API is the source of truth.

The credit lines must be shown wherever the licence requires it. The frontend shows them in the footer and on the sources page.

## Sources

| Source | Metrics | As of | Licence | Credit line |
|---|---|---|---|---|
| Public transport timetable feeds (GTFS) from ZTP Kraków | Stops, routes, weekday and night departures, distance to the airport | 2026-09-30 | No licence text on the feed page | ZTP Kraków, MPK S.A. w Krakowie, R&G Plus (GTFS) |
| OpenStreetMap, through Overpass | Schools, clinics, shops, malls, gyms, parking, parks, nightlife, street lighting, emergency services | 2026-09-30 | ODbL 1.0 | © OpenStreetMap contributors |
| GIOŚ air quality, stations and index | Mean NO2, PM10 and PM2.5, current air quality index | 2026-08-31 and 2026-09-30 | Open data, attribution required | Główny Inspektorat Ochrony Środowiska (GIOŚ), Państwowy Monitoring Środowiska |
| Copernicus Tree Cover Density 2024 | Tree cover share | 2024-01-01 | Free, full and open access | Copernicus Land Monitoring Service, European Environment Agency |
| Copernicus Urban Atlas 2018 | Green space share | 2018-12-31 | Free, full and open access | Copernicus Land Monitoring Service, European Environment Agency |
| Kraków strategic noise map 2022 | Share of district area above 55 dB (Lden) | 2022-12-31 | Open data of the city. Check the reuse terms before redistribution. | Miasto Kraków, Strategiczna mapa hałasu 2022 |
| BIP Kraków, residents by district | People registered for permanent residence, density | 2025-12-31 | Public information | Biuletyn Informacji Publicznej Miasta Krakowa; Centrum Obsługi Informatycznej UMK; Wydział Geodezji UMK |
| Kraków open data, registered residents by age and sex | Mean age, share aged 65 and over, share female | 2024-12-31 | Open data of the city. Check the dataset page before redistribution. | Urząd Miasta Krakowa, Wydział Spraw Administracyjnych, otwartedane.um.krakow.pl |
| National register of nurseries and children's clubs | Nursery places, monthly parent fee | 2026-09-30 | CC0 1.0 | Ministerstwo Rodziny, Pracy i Polityki Społecznej, dane.gov.pl |
| Rejestr Cen Nieruchomości (RCN), GUGiK | Sale price per square metre, number of sales | 2026-09-30 | Open data, no access constraints | Rejestr Cen Nieruchomości, GUGiK |
| Police SEWiK accident register, through the Polish Road Safety Observatory | Road accidents and pedestrian or cyclist casualties per km of road | 2024-12-31 | **Free for non-commercial use, credit required. Commercial use needs written approval.** | Instytut Transportu Samochodowego – Polskie Obserwatorium Bezpieczeństwa Ruchu Drogowego |
| Otodom and OLX flat rent listings | Median asking rent per square metre, number of listings | 2026-09-30 | **A one-time snapshot for internal analysis, not redistributed.** Only district medians are shown. | Otodom and OLX (asking rents, snapshot) |
| National Bank of Poland, quarterly city prices | City price history, for the outlook's historical range | to 2026 Q2 | Reuse terms accepted by the team, not independently reviewed | National Bank of Poland |
| Derived metrics and the livability score | Indices and the score | 2026-09-30 | Inherits the licences of its inputs | GdzieZamieszkać, computed from the sources above |

## How some figures are built

- **Stops.** A stop is one distinct stop name, so platforms of one stop count once. Counts are ranked per square kilometre in the score.
- **Air quality.** Station readings are weighted by distance to the district centre. Kraków has 4 NO2, 8 PM10 and 3 PM2.5 stations. This is an estimate, not an exposure at an address.
- **Sale prices.** Free-market residential sales, 15 to 250 square metres, with a full ownership share and a single price. Deeds dated in the future are dropped.
  The median covers the latest 24 months. The quarterly history starts in 2021. Cells with fewer than 30 deeds are flagged as low confidence.
- **Rents.** Otodom and OLX listings are pooled. A listing with the same district, rent and area on both sites counts once. A district with few listings is flagged as low confidence.
  These are asking rents, not signed leases.
- **Residents.** The figures are people registered for permanent residence. They are not the total population. The density figure is a proxy.
- **Noise.** The figure is a lower bound of the combined noise level, from the union of the road, rail and industry polygons at 55 dB and above.
- **Commute.** Simple routing over the timetable feeds, one weekday morning, between district centres. Long trips run 9 to 19 minutes faster than a real journey planner.
  Treat times above about 60 minutes as lower bounds.
- **Scores.** A score is a weighted percentile rank within Kraków, from 0 to 100. It compares the districts of one city only.

## Gaps for Kraków

45 of the 51 catalogue metrics have data. The API gives a reason for each of the others.

| Metric | Reason |
|---|---|
| Rail and metro stops | The Kraków timetable feeds contain no rail or metro stops. |
| Total population | Kraków publishes registered residents per district, which is not a population count. |
| Recorded crime per 10 000 residents, and detection rate | Recorded crime is not part of the data for this city. |
| Open sports grounds, public defibrillators | These sources exist only for Warsaw. |

## Notes on use

- **Non-commercial use of the accident data.** This project is a hackathon prototype. A commercial product needs written approval from the Observatory.
- **Rent figures.** The listings are a snapshot for internal analysis. Do not republish listings. The medians are derived figures.
- **Timetable feed.** The feed page states no licence. Check before redistributing the feed itself.
