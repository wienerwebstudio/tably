import type { LoyaltyCardData } from '@tapperl/ui';

export const DASHBOARD_URL = (process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
export const LOGIN_URL = `${DASHBOARD_URL}/login`;
export const REGISTER_URL = `${DASHBOARD_URL}/register`;

export const NAV = [
  { href: '/funktionen', label: 'Funktionen' },
  { href: '/branchen', label: 'Branchen' },
  { href: '/hardware', label: 'Hardware' },
  { href: '/preise', label: 'Preise' },
  { href: '/faq', label: 'FAQ' },
] as const;

export interface IndustryExample {
  id: string;
  label: string;
  /** Kurzform für Auswahl-Chips */
  short: string;
  headline: string;
  text: string;
  ideas: string[];
  card: LoyaltyCardData;
}

/** Alle Betriebe sind frei erfundene Beispiele – so auch auf den Seiten gekennzeichnet. */
export const INDUSTRIES: IndustryExample[] = [
  {
    id: 'cafe',
    label: 'Cafés & Kaffeebars',
    short: 'Café',
    headline: 'Der zehnte Kaffee geht aufs Haus',
    text: 'Die klassische Kaffeekarte, nur ohne Papier im Portemonnaie. Der Stempel steht neben der Siebträgermaschine und ist im Stoßgeschäft genauso schnell zur Hand wie früher.',
    ideas: ['Bonus-Stempel an ruhigen Nachmittagen', 'Geburtstagsgruß mit Gratis-Getränk', 'Eigene Karte für Bohnen zum Mitnehmen'],
    card: { organizationName: 'Café Morgenrot', cardTitle: 'Kaffeekarte', stampsRequired: 10, balance: 7, stampIcon: 'coffee', rewardName: 'Gratis Kaffee', backgroundColor: '#F6F1E7', textColor: '#1F3A2E', accentColor: '#C98A2B' },
  },
  {
    id: 'bakery',
    label: 'Bäckereien',
    short: 'Bäckerei',
    headline: 'Stammkundschaft, die morgens wiederkommt',
    text: 'An der Brottheke zählt jede Sekunde. Der Stempel wird gereicht wie das Wechselgeld – kein Tablet, das zwischen Mehl und Kasse eingeloggt bleiben muss.',
    ideas: ['Brotkarte mit acht Stempeln', 'Angebot zum Wochenende per E-Mail', 'Getrennte Karte für den Mittagstisch'],
    card: { organizationName: 'Backstube Lindner', cardTitle: 'Brotkarte', stampsRequired: 8, balance: 5, stampIcon: 'croissant', rewardName: 'Ein Brot nach Wahl', backgroundColor: '#3A2A1F', textColor: '#F8ECDD', accentColor: '#E6AE5C' },
  },
  {
    id: 'restaurant',
    label: 'Restaurants & Imbisse',
    short: 'Restaurant',
    headline: 'Mittagsgäste zu Stammgästen machen',
    text: 'Der Stempel kommt mit der Rechnung an den Tisch oder liegt an der Ausgabe. Wer sicher gehen will, lässt jeden Tap kurz vom Service freigeben.',
    ideas: ['Mittagskarte: das sechste Gericht gratis', 'Rückgewinnung nach längerer Pause', 'Freigabe durch das Team bei hohen Prämien'],
    card: { organizationName: 'Trattoria Da Enzo', cardTitle: 'Mittagskarte', stampsRequired: 6, balance: 4, stampIcon: 'utensils', rewardName: 'Ein Mittagsgericht', backgroundColor: '#7A2E22', textColor: '#FBEFE6', accentColor: '#F2C580' },
  },
  {
    id: 'hairdresser',
    label: 'Friseursalons',
    short: 'Friseur',
    headline: 'Treue, die zum Termin passt',
    text: 'Bei wenigen, dafür wertvolleren Besuchen genügt eine kurze Karte. Der Stempel liegt am Empfang und wird beim Bezahlen kurz ans Handy gehalten.',
    ideas: ['Sechs Besuche, dann ein Rabatt', 'Erinnerung, wenn der letzte Besuch lange her ist', 'Karte in der Farbe des Salons'],
    card: { organizationName: 'Salon Haarwerk', cardTitle: 'Treuekarte', stampsRequired: 6, balance: 3, stampIcon: 'scissors', rewardName: '20 % auf den nächsten Schnitt', backgroundColor: '#1E1F24', textColor: '#F2EEE8', accentColor: '#CDAA72' },
  },
  {
    id: 'barbershop',
    label: 'Barbershops',
    short: 'Barber',
    headline: 'Ein Stempel, der zum Laden gehört',
    text: 'Ein Werkzeug auf der Ablage statt eines Aufstellers mit QR-Code. Die Logo-Scheibe im Griff trägt das Zeichen des Shops.',
    ideas: ['Der achte Schnitt mit Bartpflege', 'Bonus-Stempel für Termine unter der Woche', 'Eigene Karte je Standort'],
    card: { organizationName: 'Kante Barbershop', cardTitle: 'Stammkarte', stampsRequired: 8, balance: 6, stampIcon: 'scissors', rewardName: 'Bartpflege gratis', backgroundColor: '#16223B', textColor: '#F4F1EA', accentColor: '#F2A93B' },
  },
  {
    id: 'beauty',
    label: 'Kosmetikstudios',
    short: 'Kosmetik',
    headline: 'Kleine Aufmerksamkeit, großer Effekt',
    text: 'Die Karte lebt im Smartphone der Kundin und erinnert auf Wunsch per E-Mail – ausschließlich mit Einwilligung, die sich jederzeit widerrufen lässt.',
    ideas: ['Fünf Behandlungen, eine Zusatzleistung', 'Geburtstagsangebot', 'Wallet-Karte für den schnellen Zugriff'],
    card: { organizationName: 'Studio Hautnah', cardTitle: 'Pflegekarte', stampsRequired: 5, balance: 3, stampIcon: 'sparkles', rewardName: 'Augenbrauen-Styling', backgroundColor: '#F4E4E0', textColor: '#5A2A35', accentColor: '#B4536B' },
  },
  {
    id: 'nails',
    label: 'Nagelstudios',
    short: 'Nägel',
    headline: 'Auffüllen, stempeln, wiederkommen',
    text: 'Regelmäßige Termine sind ideal für eine Stempelkarte. Gestempelt wird beim Bezahlen, die Karte bleibt auch mit frischem Lack griffbereit – im Handy.',
    ideas: ['Jede sechste Behandlung vergünstigt', 'Bonus-Stempel-Aktion in ruhigen Wochen', 'Angebote für freie Termine'],
    card: { organizationName: 'Nagelatelier Fein', cardTitle: 'Bonuskarte', stampsRequired: 6, balance: 2, stampIcon: 'heart', rewardName: 'Nageldesign gratis', backgroundColor: '#FBEAF0', textColor: '#6A1E3E', accentColor: '#D4487A' },
  },
  {
    id: 'fitness',
    label: 'Fitnessstudios',
    short: 'Fitness',
    headline: 'Dranbleiben wird belohnt',
    text: 'Der Stempel am Empfang macht jeden Besuch sichtbar. Mit einem Tageslimit je Mitglied bleibt die Karte fair.',
    ideas: ['Zwölf Besuche im Monat, ein Shake gratis', 'Ein Stempel pro Tag als Limit', 'Rückgewinnung für pausierende Mitglieder'],
    card: { organizationName: 'Kraftraum Nord', cardTitle: 'Trainingskarte', stampsRequired: 12, balance: 9, stampIcon: 'dumbbell', rewardName: 'Proteinshake', backgroundColor: '#11161A', textColor: '#EAF2EC', accentColor: '#B7EE72' },
  },
  {
    id: 'florist',
    label: 'Blumenläden',
    short: 'Blumen',
    headline: 'Für alle, die öfter Blumen mitbringen',
    text: 'Eine Karte, die so sorgfältig gestaltet ist wie der Laden selbst – mit eigenen Farben, eigenem Symbol und eigener Prämie.',
    ideas: ['Der achte Strauß als Geschenk', 'Hinweis vor Muttertag und Valentinstag', 'Geburtstagsgruß mit kleiner Überraschung'],
    card: { organizationName: 'Blumen Wiesengrund', cardTitle: 'Blumenkarte', stampsRequired: 8, balance: 5, stampIcon: 'flower', rewardName: 'Strauß der Woche', backgroundColor: '#E9F1E4', textColor: '#24452F', accentColor: '#D4603F' },
  },
  {
    id: 'retail',
    label: 'Einzelhandel',
    short: 'Laden',
    headline: 'Die Kundenkarte ohne Plastik',
    text: 'Vom Feinkostladen bis zur Buchhandlung: Die Karte entsteht beim ersten Tap, ohne Formular an der Kasse. Mit der Kassen-Schnittstelle lässt sich ein Stempel an einen Bon knüpfen.',
    ideas: ['Ein Stempel pro Einkauf', 'Buchung nur mit Kassen-Ereignis', 'Mehrere Programme parallel'],
    card: { organizationName: 'Feinkost Albrecht', cardTitle: 'Genusskarte', stampsRequired: 10, balance: 6, stampIcon: 'shopping-bag', rewardName: '10 € Einkaufsguthaben', backgroundColor: '#22324D', textColor: '#F3EFE6', accentColor: '#E0B15E' },
  },
  {
    id: 'carwash',
    label: 'Autowaschanlagen',
    short: 'Autowäsche',
    headline: 'Die sechste Wäsche geht aufs Haus',
    text: 'Der Stempel hängt an der Kasse oder beim Einweiser. Er braucht weder Strom noch Akku und lässt sich im Dashboard sperren, falls er verloren geht.',
    ideas: ['Sechs Wäschen, eine Premiumwäsche gratis', 'Bonus-Stempel an Regentagen', 'Mehrere Stempel für mehrere Kassen'],
    card: { organizationName: 'Glanzpunkt Autowäsche', cardTitle: 'Waschkarte', stampsRequired: 6, balance: 4, stampIcon: 'car', rewardName: 'Premiumwäsche', backgroundColor: '#0F3C5A', textColor: '#EAF6FB', accentColor: '#63C9F0' },
  },
  {
    id: 'services',
    label: 'Dienstleister',
    short: 'Service',
    headline: 'Wiederkehrende Aufträge sichtbar machen',
    text: 'Fahrradwerkstatt, Änderungsschneiderei, Hundesalon: Überall, wo Menschen regelmäßig wiederkommen, ersetzt Tapperl die Papierkarte.',
    ideas: ['Fünf Services, ein Check gratis', 'Freigabe durch das Team vor der Buchung', 'Notiz zur Kundin direkt am Profil'],
    card: { organizationName: 'Radwerkstatt Speiche', cardTitle: 'Servicekarte', stampsRequired: 5, balance: 2, stampIcon: 'star', rewardName: 'Sicherheitscheck', backgroundColor: '#F2EFE6', textColor: '#2B2F36', accentColor: '#D4572E' },
  },
];

export const HERO_CARD: LoyaltyCardData = INDUSTRIES[0]!.card;

export const CONTACT_TOPICS = [
  { value: 'Demo & Beratung', key: 'demo' },
  { value: 'Stempel vorbestellen', key: 'hardware' },
  { value: 'Preise & Tarife', key: 'preise' },
  { value: 'Technische Frage', key: 'technik' },
  { value: 'Kassen-Schnittstelle', key: 'kasse' },
  { value: 'Sonstiges', key: 'sonstiges' },
] as const;
