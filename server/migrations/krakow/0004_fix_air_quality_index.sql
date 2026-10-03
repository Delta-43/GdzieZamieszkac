-- The GIOŚ air quality index runs from 0 (very good) to 5 (very bad), so a higher value is worse. The catalogue
-- had it as 'better' and had no description. Mirrors the corrected seed row in 0002. Safe to re-run.
update krakow.metric_definitions
   set higher_is = 'worse',
       unit = 'index 0-5',
       description_en = 'GIOŚ index from 0 (very good) to 5 (very bad), latest reading, interpolated between stations.',
       description_pl = 'Indeks GIOŚ od 0 (bardzo dobry) do 5 (bardzo zły), ostatni odczyt, interpolowany między stacjami.'
 where metric_key = 'air_quality_index';
