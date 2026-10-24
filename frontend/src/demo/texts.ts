import type { Bilingual } from './model'

// Texts of the demo. The sample reports and the sample AI summary are written in advance; the figures in them are filled in by the code
// from the sample data (see handler.ts), so a text never disagrees with the page. Nothing here is generated while the page is open.

/** One short paragraph per district: what the place is like, in general terms. It holds no figures. */
export const CHARACTER: Record<string, Bilingual> = {
  'stare-miasto': {
    en: 'Stare Miasto is the historic centre: the Main Market Square, Wawel Castle, Kazimierz and the Planty park ring are all inside it. Almost everything is within walking distance, and it is busy with visitors all year.',
    pl: 'Stare Miasto to historyczne centrum: Rynek Główny, Wawel, Kazimierz i park Planty leżą w jego granicach. Prawie wszystko jest tu w zasięgu spaceru, a przez cały rok jest tłoczno od odwiedzających.',
  },
  grzegorzki: {
    en: 'Grzegórzki lies just east of the centre. It mixes older tenement streets with newer office and housing blocks, and tram and bus lines cross it on their way to the centre.',
    pl: 'Grzegórzki leżą tuż na wschód od centrum. Łączą starsze kamienice z nowszymi biurowcami i blokami, a przez dzielnicę przebiegają linie tramwajowe i autobusowe w stronę centrum.',
  },
  'pradnik-czerwony': {
    en: 'Prądnik Czerwony is a large residential district north of the centre, with the Rakowicki Cemetery, housing estates from several decades and good tram links.',
    pl: 'Prądnik Czerwony to duża dzielnica mieszkaniowa na północ od centrum, z Cmentarzem Rakowickim, osiedlami z różnych dziesięcioleci i dobrym dojazdem tramwajem.',
  },
  'pradnik-bialy': {
    en: 'Prądnik Biały stretches along the Prądnik valley in the north-west. It is greener and calmer than the districts nearer the centre, with a mix of houses and blocks.',
    pl: 'Prądnik Biały rozciąga się wzdłuż doliny Prądnika na północnym zachodzie. Jest zieleńszy i spokojniejszy niż dzielnice bliżej centrum, z mieszanką domów i bloków.',
  },
  krowodrza: {
    en: 'Krowodrza lies north-west of the centre and holds the AGH university campus and Nowy Kleparz. It is a lively residential area with many students and good public transport.',
    pl: 'Krowodrza leży na północny zachód od centrum i obejmuje kampus AGH oraz Nowy Kleparz. To ruchliwa dzielnica mieszkaniowa z wieloma studentami i dobrą komunikacją.',
  },
  bronowice: {
    en: 'Bronowice, in the west, grew out of old villages such as Bronowice Małe and Bronowice Wielkie. Today it is a residential district with shops, services and links to the centre by tram.',
    pl: 'Bronowice na zachodzie wyrosły ze starych wsi, takich jak Bronowice Małe i Bronowice Wielkie. Dziś to dzielnica mieszkaniowa ze sklepami, usługami i dojazdem do centrum tramwajem.',
  },
  zwierzyniec: {
    en: 'Zwierzyniec is the green west of the city: the Błonia meadow, the Wolski Forest and the Kościuszko Mound are all here. It is quiet, leafy and popular for walks and sport.',
    pl: 'Zwierzyniec to zielony zachód miasta: Błonia, Las Wolski i Kopiec Kościuszki leżą w jego granicach. Jest cicho i zielono, a dzielnica jest popularna wśród spacerowiczów i sportowców.',
  },
  debniki: {
    en: 'Dębniki lies on the south bank of the Vistula, opposite Wawel, and reaches out to the Tyniec abbey. Its northern part is urban, and the southern part is calmer and greener.',
    pl: 'Dębniki leżą na lewym brzegu Wisły, naprzeciw Wawelu, i sięgają aż do opactwa w Tyńcu. Część północna jest miejska, a południowa spokojniejsza i zieleńsza.',
  },
  'lagiewniki-borek-falecki': {
    en: 'Łagiewniki-Borek Fałęcki lies south of the centre. It is known for the Divine Mercy Sanctuary, and around it are housing estates, allotments and green pockets. Trams and buses link it to the centre.',
    pl: 'Łagiewniki-Borek Fałęcki leży na południe od centrum. Znane jest z Sanktuarium Bożego Miłosierdzia, a wokół są osiedla, ogródki działkowe i zielone enklawy. Tramwaje i autobusy łączą go z centrum.',
  },
  swoszowice: {
    en: 'Swoszowice is a large district on the southern edge of the city, with a spa tradition, hills and woods. It is the quietest and greenest part of Kraków, and it is farther from the centre.',
    pl: 'Swoszowice to duża dzielnica na południowym skraju miasta, z uzdrowiskową tradycją, wzgórzami i lasami. To najcichsza i najzieleńsza część Krakowa, ale dalej od centrum.',
  },
  'podgorze-duchackie': {
    en: 'Podgórze Duchackie, in the south, is a district of large housing estates such as Kurdwanów and Wola Duchacka, with shopping centres, schools and a good bus and tram network.',
    pl: 'Podgórze Duchackie na południu to dzielnica dużych osiedli, takich jak Kurdwanów i Wola Duchacka, z centrami handlowymi, szkołami i gęstą siecią autobusową i tramwajową.',
  },
  'biezanow-prokocim': {
    en: 'Bieżanów-Prokocim lies in the south-east. It has big housing estates, the University Hospital in Prokocim, a railway station, and older village centres that kept their own character.',
    pl: 'Bieżanów-Prokocim leży na południowym wschodzie. Ma duże osiedla, Szpital Uniwersytecki w Prokocimiu, stację kolejową i starsze centra dawnych wsi, które zachowały własny charakter.',
  },
  podgorze: {
    en: 'Podgórze is on the south bank of the Vistula, close to the centre. It has the Podgórze market square, the former industrial area of Zabłocie, now full of new housing and offices, and the Krakus Mound.',
    pl: 'Podgórze leży na lewym brzegu Wisły, blisko centrum. Ma rynek podgórski, dawny przemysłowy Zabłocie, dziś pełne nowych mieszkań i biur, oraz Kopiec Krakusa.',
  },
  czyzyny: {
    en: 'Czyżyny, in the east, is where the old Kraków airfield was. The Polish Aviation Museum and a large arena stand there now, among new housing and older estates.',
    pl: 'Czyżyny na wschodzie to miejsce dawnego lotniska. Stoją tu dziś Muzeum Lotnictwa Polskiego i duża hala widowiskowa, wśród nowych mieszkań i starszych osiedli.',
  },
  mistrzejowice: {
    en: 'Mistrzejowice is a district of housing estates built from the 1970s in the north-east, with their own shops, schools and green courtyards, and a tram line to the centre.',
    pl: 'Mistrzejowice to dzielnica osiedli budowanych od lat 70. na północnym wschodzie, z własnymi sklepami, szkołami i zielonymi podwórzami oraz linią tramwajową do centrum.',
  },
  bienczyce: {
    en: 'Bieńczyce is a district of housing estates in Nowa Huta, with the Ark of the Lord church and many green courtyards. Everyday needs are close by, and a tram line leads to the centre.',
    pl: 'Bieńczyce to dzielnica osiedli w Nowej Hucie, z kościołem Arka Pana i wieloma zielonymi podwórzami. Codzienne sprawy załatwia się blisko domu, a linia tramwajowa prowadzi do centrum.',
  },
  'wzgorza-krzeslawickie': {
    en: 'Wzgórza Krzesławickie is on the eastern edge of the city. It has a village feel, with houses, fields and woods, and it is much farther from the centre than most districts.',
    pl: 'Wzgórza Krzesławickie leżą na wschodnim skraju miasta. Mają wiejski charakter: domy, pola i lasy, a do centrum jest znacznie dalej niż z większości dzielnic.',
  },
  'nowa-huta': {
    en: 'Nowa Huta is the largest district, planned as a model town in the 1950s around the Central Square. It has wide avenues, a lot of greenery and a mix of green estates and industrial areas.',
    pl: 'Nowa Huta to największa dzielnica, zaplanowana w latach 50. jako miasto wzorcowe wokół Placu Centralnego. Ma szerokie aleje, dużo zieleni oraz mieszankę zielonych osiedli i terenów przemysłowych.',
  },
}

export const REPORT_PARTS = {
  figures: {
    en: 'In the sample data of this demo, {name} scores {score} points out of 100 and is in place {rank} of {of} districts. A typical flat costs about {price}. The measures that help the score most are {best}. The ones that pull it down most are {worst}.',
    pl: 'W przykładowych danych tej wersji demonstracyjnej dzielnica {name} ma {score} pkt na 100 i zajmuje {rank}. miejsce wśród {of} dzielnic. Typowe mieszkanie kosztuje około {price}. Najbardziej podnoszą wynik: {best}. Najbardziej go obniżają: {worst}.',
  },
  disclaimer: {
    en: 'This text is a sample. It was written in advance for the demo from sample figures, not generated live, and it is not a statement about the real district.',
    pl: 'Ten tekst jest przykładowy. Napisano go z wyprzedzeniem na potrzeby wersji demonstracyjnej z przykładowych liczb, nie powstał na żywo i nie jest stwierdzeniem o prawdziwej dzielnicy.',
  },
}

export const AI_LABEL: Bilingual = {
  en: 'Sample text, written in advance with the help of artificial intelligence. It is not generated live, and the figures come from the sample data.',
  pl: 'Tekst przykładowy, napisany z wyprzedzeniem z pomocą sztucznej inteligencji. Nie powstaje na żywo, a liczby pochodzą z przykładowych danych.',
}

export const AI_REPORT = {
  profile: {
    en: 'For the profile “{label}” ({description}) the sample ranking puts {n1} first with {s1} points, then {n2} with {s2} and {n3} with {s3}.',
    pl: 'Dla profilu „{label}” ({description}) przykładowy ranking stawia na pierwszym miejscu dzielnicę {n1} z wynikiem {s1} pkt, potem {n2} z {s2} pkt i {n3} z {s3} pkt.',
  },
  custom: {
    en: 'For the priorities you set, the sample ranking puts {n1} first with {s1} points, then {n2} with {s2} and {n3} with {s3}.',
    pl: 'Dla ustawionych przez Ciebie priorytetów przykładowy ranking stawia na pierwszym miejscu dzielnicę {n1} z wynikiem {s1} pkt, potem {n2} z {s2} pkt i {n3} z {s3} pkt.',
  },
  drivers: {
    en: '{n1} gets the highest score mainly because of {d1}.',
    pl: 'Dzielnica {n1} ma najwyższy wynik głównie dzięki: {d1}.',
  },
  note: {
    en: 'The scores compare the districts of Kraków only, and they are made from sample figures. Look at the district pages before you decide anything, and check the real data and your own needs.',
    pl: 'Wyniki porównują tylko dzielnice Krakowa i powstały z przykładowych liczb. Zanim cokolwiek zdecydujesz, zajrzyj na strony dzielnic oraz sprawdź prawdziwe dane i własne potrzeby.',
  },
}

export const FEEDBACK_NOTE: Bilingual = {
  en: 'This is a demo with sample data. The forms are switched off here: nothing you type is sent or stored anywhere. In the live service a report is stored as unverified, is never published, and never changes a score.',
  pl: 'To wersja demonstracyjna z przykładowymi danymi. Formularze są tu wyłączone: nic, co wpiszesz, nie jest nigdzie wysyłane ani zapisywane. W działającej usłudze zgłoszenie jest zapisywane jako niezweryfikowane, nigdy nie jest publikowane i nigdy nie zmienia wyniku.',
}

export const DEMO_CAVEAT: Bilingual = {
  en: 'Demo: this is an illustrative sample value, not a measurement.',
  pl: 'Demo: to przykładowa wartość poglądowa, a nie pomiar.',
}
export const DEMO_CAVEAT_REAL: Bilingual = {
  en: 'Demo: this value is taken from the project database.',
  pl: 'Demo: ta wartość pochodzi z bazy danych projektu.',
}
export const DEMO_METHOD: Bilingual = {
  en: 'In the demo the value is made up from a rough profile of the district. The live service uses the source named here.',
  pl: 'W wersji demonstracyjnej wartość jest wymyślona na podstawie zgrubnego profilu dzielnicy. Działająca usługa korzysta ze źródła wskazanego tutaj.',
}

/** Put before the name of a source whose value is made up in the demo, so the provenance of the value never reads as a real source. */
export const SAMPLE_SOURCE: Bilingual = {
  en: 'Sample data, modelled on: ',
  pl: 'Dane przykładowe, wzorowane na: ',
}
