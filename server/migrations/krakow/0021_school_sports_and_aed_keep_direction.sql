-- 0020 set higher_is = 'neutral' for the two metrics that gain Kraków data (school sports grounds, public defibrillators), to keep them out of the score.
-- That moved every default score, because each directional metric of a category counts in the share the others get, whether it has data or not.
-- They keep their direction ("more is better", so they get a rank), and the backend leaves them out of the scoring table (SHOWN_NOT_SCORED in
-- backend/app/core/store.py). The stored scores, the rankings and the stored reports stay valid. Safe to re-run; the update is in krakow.audit_log.

update krakow.metric_definitions
   set higher_is = 'better'
 where metric_key in ('amenity_open_sports_grounds', 'amenity_aed_public') and higher_is is distinct from 'better';
