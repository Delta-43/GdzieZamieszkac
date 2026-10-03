-- Childcare from the national register of nurseries and children's clubs (dane.gov.pl, Ministry of Family, Labour and Social Policy, CC0):
-- places in active institutions, and the median basic monthly fee parents pay. Added to both catalogues (same rows in each city).
insert into krakow.metric_definitions (metric_key, category, label_en, label_pl, description_en, description_pl, unit, higher_is, refresh_cadence, default_data_kind, sort_order)
values
  ('amenity_nursery_places', 'amenities', 'Nursery and children''s club places', 'Miejsca w żłobkach i klubach dziecięcych',
   'Places in active nurseries and children''s clubs inside the district (national register of nurseries and children''s clubs).',
   'Miejsca w działających żłobkach i klubach dziecięcych w dzielnicy (krajowy Rejestr żłobków i klubów dziecięcych).',
   'count', 'better', 'static', 'observed', 216),
  ('nursery_fee_median', 'cost', 'Median monthly nursery fee', 'Mediana miesięcznej opłaty za żłobek',
   'Median basic monthly fee paid by parents (without discounts and meals) across active nurseries and children''s clubs in the district, as reported to the national register. Shown for information; not part of the livability score.',
   'Mediana podstawowej miesięcznej opłaty ponoszonej przez rodziców (bez zniżek i wyżywienia) w działających żłobkach i klubach dziecięcych w dzielnicy, według zgłoszeń do krajowego rejestru. Pokazywana informacyjnie; nie wchodzi do wskaźnika jakości życia.',
   'PLN/month', 'neutral', 'static', 'observed', 385)
on conflict (metric_key) do update set category = excluded.category, label_en = excluded.label_en, label_pl = excluded.label_pl,
  description_en = excluded.description_en, description_pl = excluded.description_pl, unit = excluded.unit, higher_is = excluded.higher_is,
  refresh_cadence = excluded.refresh_cadence, default_data_kind = excluded.default_data_kind, sort_order = excluded.sort_order;

-- the family friendliness proxy now also uses nursery place density
update krakow.metric_definitions
   set description_en = 'Proxy from school and nursery place density, green space, tree cover, low noise and few pedestrian and cyclist casualties. Compares districts of one city only (0-100).',
       description_pl = 'Wskaźnik zastępczy z gęstości szkół i miejsc w żłobkach, terenów zielonych, pokrycia drzewami, niskiego hałasu i małej liczby poszkodowanych pieszych i rowerzystów. Porównuje tylko dzielnice jednego miasta (0-100).'
 where metric_key = 'family_friendliness_index';
