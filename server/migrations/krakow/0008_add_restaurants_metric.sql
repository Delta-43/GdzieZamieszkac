-- Dining options from OpenStreetMap: restaurants, cafes and fast-food places per district. Informational (not part of the livability
-- score); used by the walkability proxy. No price information exists in OpenStreetMap for these places.
insert into krakow.metric_definitions (metric_key, category, label_en, label_pl, description_en, description_pl, unit, higher_is, refresh_cadence, default_data_kind, sort_order)
values
  ('amenity_restaurants_cafes', 'amenities', 'Restaurants, cafes and fast food', 'Restauracje, kawiarnie i fast foody',
   'Restaurants, cafes and fast-food places mapped in OpenStreetMap inside the district; counts reflect mapping completeness. Shown for information, not part of the livability score.',
   'Restauracje, kawiarnie i punkty typu fast food zmapowane w OpenStreetMap w granicach dzielnicy; liczba zależy od kompletności mapowania. Pokazywane informacyjnie; nie wchodzą do wskaźnika jakości życia.',
   'count', 'neutral', 'static', 'observed', 217)
on conflict (metric_key) do update set category = excluded.category, label_en = excluded.label_en, label_pl = excluded.label_pl,
  description_en = excluded.description_en, description_pl = excluded.description_pl, unit = excluded.unit, higher_is = excluded.higher_is,
  refresh_cadence = excluded.refresh_cadence, default_data_kind = excluded.default_data_kind, sort_order = excluded.sort_order;
