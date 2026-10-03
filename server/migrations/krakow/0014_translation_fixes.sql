-- Polish corrections from the native-speaker review (the native-speaker reviewer, 2026-10-01; edits made in the Supabase dashboard): metric labels and descriptions in the krakow catalogue.
-- Identical in both cities. The Kraków dashboard edits were mirrored to Warsaw so the two catalogues stay identical; updates that change nothing are not logged. The correction record is kept in the private repository.
update krakow.metric_definitions set label_pl = 'Odjazdy w nocy' where metric_key = 'transit_night_departures';
update krakow.metric_definitions set label_pl = 'Łączna powierzchnia parków' where metric_key = 'amenity_parks_share';
update krakow.metric_definitions set label_pl = 'Udział terenów zadrzewionych' where metric_key = 'tree_cover_share';
update krakow.metric_definitions set label_pl = 'Narażenie na letnie upały' where metric_key = 'heat_exposure_index';
update krakow.metric_definitions set label_pl = 'Tereny o natężeniu dźwięku powyżej 55 dB' where metric_key = 'noise_share_above_55db';
update krakow.metric_definitions set label_pl = 'Poziom hałasu w nocy (szacunek)' where metric_key = 'night_noise_estimate';
update krakow.metric_definitions set label_pl = 'Natężenie ruchu' where metric_key = 'busyness_index';
update krakow.metric_definitions set label_pl = 'Dostępność usług dla pieszych' where metric_key = 'walkability_index';
update krakow.metric_definitions set label_pl = 'Przyjazność rodzinom z dziećmi' where metric_key = 'family_friendliness_index';
update krakow.metric_definitions set label_pl = 'Liczba transakcji', label_en = 'Sale transactions' where metric_key = 'sale_transactions_count';
update krakow.metric_definitions set label_pl = 'Mediana ofertowej ceny najmu za m²' where metric_key = 'rent_price_median_m2';
update krakow.metric_definitions set label_pl = 'Liczba ofert najmu' where metric_key = 'rent_listings_count';
update krakow.metric_definitions set label_pl = 'Średnia odległość od policji, straży pożarnej i szpitala' where metric_key = 'emergency_services_distance_km';
update krakow.metric_definitions set label_pl = 'Indeks jakości powietrza (najnowszy)' where metric_key = 'air_quality_index';
update krakow.metric_definitions set description_pl = 'Przestępstwa stwierdzone przez policję na 10 000 mieszkańców w 2024 r. (tylko dla Warszawy). Wyższe w dzielnicach z wieloma odwiedzającymi i dojeżdżającymi; nie jest miarą ryzyka.' where metric_key = 'crimes_per_10k';
update krakow.metric_definitions set description_pl = 'Liczba osób na km² powierzchni dla danej dzielnicy. Warszawa: dane oficjalne. Kraków: zameldowani w przeliczeniu na powierzchnię, więc wartość jest zaniżona.' where metric_key = 'population_density';
update krakow.metric_definitions set description_pl = 'Mediana ofertowej ceny najmu za m² (bez opłat dodatkowych) z ogłoszeń Otodom i OLX, jednorazowy zrzut z września 2026; nie są to zawarte umowy.' where metric_key = 'rent_price_median_m2';
update krakow.metric_definitions set description_pl = 'Udział terenów z poziomem hałasu co najmniej 55 dB Lden w powierzchni danej dzielnicy na strategicznej mapie hałasu 2022 (Warszawa: drogi, kolej, tramwaje, lotnisko i przemysł; Kraków: drogi, kolej i przemysł).' where metric_key = 'noise_share_above_55db';
