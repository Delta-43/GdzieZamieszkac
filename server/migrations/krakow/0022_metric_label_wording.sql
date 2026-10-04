-- Label wording from the reviewer (unicorn-alex, 2026-10-04), applied on top of the plain-language catalogue of 0019.
-- Polish: the stop metrics start with "Liczba", the 65+ share says "powyżej 65 lat", the busyness estimate is "Natężenie ruchu (szacunek)".
-- English: "Train stations" and "Criminal offender detection rate". The rail metric keeps its description. Descriptions and units are not changed.
-- Not changed on purpose: the three air metrics keep their 0019 labels ("Smog: ...", "Exhaust fumes: ...").
-- Safe to re-run. UPDATEs are recorded in krakow.audit_log (old and new row), so the earlier labels can be restored. Polish text came from the reviewer.

update krakow.metric_definitions m
   set label_en = v.label_en, label_pl = v.label_pl
  from (values
    ('transit_stops_total', 'Stops in the district', 'Liczba przystanków w dzielnicy'),
    ('transit_stops_bus', 'Bus stops', 'Liczba przystanków autobusowych'),
    ('transit_stops_tram', 'Tram stops', 'Liczba przystanków tramwajowych'),
    ('transit_stops_rail_metro', 'Train stations', 'Liczba stacji kolejowych'),
    ('share_age_65_plus', 'Residents aged 65 or older', 'Mieszkańcy powyżej 65 lat'),
    ('crime_detection_rate', 'Criminal offender detection rate', 'Wskaźnik wykrywalności sprawców przestępstw'),
    ('busyness_index', 'Crowds and traffic (estimate)', 'Natężenie ruchu (szacunek)')
  ) as v(metric_key, label_en, label_pl)
 where m.metric_key = v.metric_key
   and (m.label_en, m.label_pl) is distinct from (v.label_en, v.label_pl);
