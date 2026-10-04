-- Wording changes to four metric labels, from the reviewer (unicorn-alex), at the coordinator's request.
-- Polish: "Liczba ..." for the two counts, a longer name for the detection rate, and "Natężenie ruchu (szacunek)" for the busyness estimate.
-- English: only the rail stations and the detection rate change. Descriptions are not touched.
-- Safe to re-run. UPDATEs are recorded in krakow.audit_log (old and new row), so the earlier texts can be restored.

update krakow.metric_definitions set label_pl = 'Liczba przystanków w dzielnicy'
 where metric_key = 'transit_stops_total' and label_pl is distinct from 'Liczba przystanków w dzielnicy';

update krakow.metric_definitions set label_pl = 'Liczba stacji kolejowych', label_en = 'Train stations'
 where metric_key = 'transit_stops_rail_metro'
   and (label_pl is distinct from 'Liczba stacji kolejowych' or label_en is distinct from 'Train stations');

update krakow.metric_definitions set label_pl = 'Wskaźnik wykrywalności sprawców przestępstw', label_en = 'Criminal offender detection rate'
 where metric_key = 'crime_detection_rate'
   and (label_pl is distinct from 'Wskaźnik wykrywalności sprawców przestępstw' or label_en is distinct from 'Criminal offender detection rate');

update krakow.metric_definitions set label_pl = 'Natężenie ruchu (szacunek)'
 where metric_key = 'busyness_index' and label_pl is distinct from 'Natężenie ruchu (szacunek)';
