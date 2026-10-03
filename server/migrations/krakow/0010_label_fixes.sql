-- The unit display of '% of district' already reads "% of district area" / "% powierzchni dzielnicy", so the labels of the two share metrics
-- must not repeat "district area": back to the shorter labels. Found while reviewing the generated translation tables in the deck.
update krakow.metric_definitions set label_en = 'Area above 55 dB', label_pl = 'Powierzchnia powyżej 55 dB' where metric_key = 'noise_share_above_55db';
update krakow.metric_definitions set label_en = 'Park area', label_pl = 'Powierzchnia parków' where metric_key = 'amenity_parks_share';
