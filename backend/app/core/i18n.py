"""Language choice and the few fixed strings the API owns.

Data text (labels, notes, reports) is stored in both languages and only selected here. The strings below are the small fixed set
that the database does not hold; the Polish ones need a native-speaker check (translation verification).
"""
from __future__ import annotations

LANGS = ("en", "pl")
DEFAULT_LANG = "en"
NBSP = " "

CATEGORY_LABELS = {
    "transport": {"en": "Transport", "pl": "Transport"},
    "demographics": {"en": "Demographics", "pl": "Demografia"},
    "livability": {"en": "Livability", "pl": "Jakość życia"},
    "amenities": {"en": "Amenities", "pl": "Udogodnienia"},
    "environment": {"en": "Environment", "pl": "Środowisko"},
    "cost": {"en": "Cost", "pl": "Koszty"},
    "safety": {"en": "Safety", "pl": "Bezpieczeństwo"},
}
CATEGORIES = tuple(CATEGORY_LABELS)

TEXT = {
    "score_note": {"en": "Scores compare districts of this city only.", "pl": "Wyniki porównują wyłącznie dzielnice tego miasta."},
    "no_value": {"en": "No value for this district in the source data.", "pl": "Brak wartości dla tej dzielnicy w danych źródłowych."},
    "no_city_data": {"en": "No data for this city.", "pl": "Brak danych dla tego miasta."},
    "yield_label": {"en": "Gross rental yield", "pl": "Roczna stopa zwrotu z najmu (brutto)"},
    "payback_label": {"en": "Years of rent to pay the price", "pl": "Lata najmu potrzebne do pokrycia ceny"},
    "yield_method": {"en": "Median asking rent per m² times 12, divided by the median sale price per m².",
                     "pl": "Mediana ofertowego czynszu za m² razy 12, podzielona przez medianę ceny sprzedaży za m²."},
    "payback_method": {"en": "Median sale price per m² divided by the median asking rent per m² times 12.",
                       "pl": "Mediana ceny sprzedaży za m² podzielona przez medianę ofertowego czynszu za m² razy 12."},
    "yield_caveat": {"en": "Asking rent over transaction price. No mortgage, tax, costs, vacancy or price change.",
                     "pl": "Czynsz ofertowy w stosunku do ceny transakcyjnej. Bez kredytu, podatków, kosztów, pustostanów i zmian cen."},
    "similar_method": {"en": "Cosine similarity of the percentile ranks (centred on the city average) of the metrics used in the livability score.",
                       "pl": "Podobieństwo kosinusowe rang percentylowych (względem średniej dla miasta) miar użytych we wskaźniku jakości życia."},
    "series_newest_caveat": {"en": "The newest quarter may be incomplete: the register is filled with a delay, so its median rests on fewer deeds.",
                             "pl": "Najnowszy kwartał może być niepełny: rejestr jest uzupełniany z opóźnieniem, "
                                   "więc jego mediana opiera się na mniejszej liczbie aktów."},
    "series_thin_caveat": {"en": "Quarters marked low confidence rest on fewer than {n} deeds.",
                           "pl": "Kwartały oznaczone jako mało wiarygodne opierają się na mniej niż {n} aktach."},
    "commute_caveat": {"en": "An estimate of typical public transport access between district centres on one weekday morning. It is not a journey plan: "
                       "a real trip depends on where in the district you start and finish.",
                       "pl": "Szacunek typowego dojazdu transportem publicznym między centrami dzielnic w jeden poranek dnia roboczego. "
                             "To nie jest plan podróży: rzeczywisty przejazd zależy od miejsca w dzielnicy, w którym zaczynasz i kończysz podróż."},
    "outlook_reason": {"en": "No forward price scenario is published. It was tested against past data and did not do better than two simple rules: "
                            "no change, and last year's growth continuing.",
                       "pl": "Nie publikujemy prognozy cen na przyszłość. Przetestowano ją na danych historycznych i nie była lepsza od dwóch prostych reguł: "
                             "braku zmiany oraz kontynuacji wzrostu z ostatniego roku."},
    "outlook_method": {"en": "Momentum is the change of the median deed price per m² in the district between two quarters of the stored history. "
                             "Quarters with fewer than half the city's usual number of deeds are not used, because the register fills with a delay. "
                             "The historical range is the 10th, 50th and 90th percentile of past one-year and two-year price changes in the whole city.",
                       "pl": "Tempo zmian to zmiana mediany ceny transakcyjnej za m² w dzielnicy między dwoma kwartałami zapisanej historii. "
                             "Kwartały z mniej niż połową zwykłej liczby aktów w mieście nie są używane, bo rejestr jest uzupełniany z opóźnieniem. "
                             "Zakres historyczny to 10., 50. i 90. percentyl dawnych rocznych i dwuletnich zmian cen w całym mieście."},
    "outlook_caveat": {"en": "This describes the past. It is not a forecast and not financial advice. Quarterly district medians are noisy, "
                             "they mix new and existing flats, and the history covers one market cycle.",
                       "pl": "To opis przeszłości. Nie jest to prognoza ani porada finansowa. Kwartalne mediany dzielnic są niestabilne, "
                             "łączą mieszkania nowe i z rynku wtórnego, a historia obejmuje jeden cykl rynkowy."},
    "window_4": {"en": "One year", "pl": "Rok"},
    "window_8": {"en": "Two years", "pl": "Dwa lata"},
    "per_month": {"en": "per month", "pl": "miesięcznie"},
    "years": {"en": "years", "pl": "lat"},
    "and": {"en": "and", "pl": "i"},
}


def t(key: str, lang: str) -> str:
    """A fixed string of the API in the given language."""
    return TEXT[key][lang]


def parse_accept_language(header: str | None) -> str | None:
    """First supported language of an Accept-Language header, by quality then order. None if none is supported."""
    if not header:
        return None
    ranked = []
    for i, part in enumerate(header.split(",")):
        tag, _, q = part.strip().partition(";q=")
        try:
            weight = float(q) if q else 1.0
        except ValueError:
            weight = 0.0
        primary = tag.strip().lower().split("-")[0]
        if primary in LANGS and weight > 0:
            ranked.append((-weight, i, primary))
    return min(ranked)[2] if ranked else None


def resolve_lang(query_lang: str | None, accept_language: str | None) -> str:
    """`?lang=` first, then Accept-Language, then English. The caller validates `query_lang` against LANGS."""
    return query_lang or parse_accept_language(accept_language) or DEFAULT_LANG


def fmt_number(value: float, decimals: int, lang: str) -> str:
    """English 12,346.5 and Polish 12 346,5 (no-break space), matching the stored display strings."""
    s = f"{value:,.{decimals}f}"
    if lang == "pl":
        s = s.replace(",", NBSP).replace(".", ",")
    return s
