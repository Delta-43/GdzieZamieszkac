-- Two amenity metrics from the city's open data portal (dane.um.warszawa.pl): open school sports grounds and public
-- defibrillators. Added to the catalogue of both cities so the schemas stay identical; Kraków has no data for them.
insert into krakow.metric_definitions (metric_key, category, label_en, label_pl, description_en, description_pl, unit, higher_is, refresh_cadence, default_data_kind, sort_order)
values
  ('amenity_open_sports_grounds', 'amenities', 'Open school sports grounds', 'Otwarte szkolne tereny sportowe',
   'School sites in the district whose sports grounds (pitches, tracks, courts, outdoor gyms) are open to residents free of charge at set hours (Warsaw open data, Biuro Edukacji).',
   'Placówki oświatowe w dzielnicy, których tereny sportowe (boiska, bieżnie, korty, siłownie zewnętrzne) są bezpłatnie udostępniane mieszkańcom w określonych godzinach (dane otwarte Warszawy, Biuro Edukacji).',
   'count', 'better', 'static', 'observed', 215),
  ('amenity_aed_public', 'safety', 'Public defibrillators (AED)', 'Publicznie dostępne defibrylatory (AED)',
   'Active automated external defibrillators marked as publicly accessible inside the district (Warsaw open data, Stołeczne Centrum Bezpieczeństwa); access hours differ by location.',
   'Aktywne automatyczne defibrylatory zewnętrzne oznaczone jako publicznie dostępne w dzielnicy (dane otwarte Warszawy, Stołeczne Centrum Bezpieczeństwa); godziny dostępu zależą od miejsca.',
   'count', 'better', 'static', 'observed', 445)
on conflict (metric_key) do update set category = excluded.category, label_en = excluded.label_en, label_pl = excluded.label_pl,
  description_en = excluded.description_en, description_pl = excluded.description_pl, unit = excluded.unit, higher_is = excluded.higher_is,
  refresh_cadence = excluded.refresh_cadence, default_data_kind = excluded.default_data_kind, sort_order = excluded.sort_order;
