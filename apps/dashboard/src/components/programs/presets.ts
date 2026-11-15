/** Startvorschläge je Branche – nur Voreinstellungen, alles bleibt änderbar. */
export interface IndustryPreset {
  cardTitle: string;
  stampIcon: string;
  stampsRequired: number;
  reward: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

export const INDUSTRY_PRESETS: Record<string, IndustryPreset> = {
  cafe: { cardTitle: 'Kaffeekarte', stampIcon: 'coffee', stampsRequired: 10, reward: 'Gratis Kaffee', backgroundColor: '#1F3A2E', textColor: '#FFFFFF', accentColor: '#E8B86D' },
  bakery: { cardTitle: 'Brotkarte', stampIcon: 'croissant', stampsRequired: 10, reward: 'Gratis Gebäck', backgroundColor: '#F6EBD9', textColor: '#3B2A1A', accentColor: '#B5651D' },
  restaurant: { cardTitle: 'Stammgastkarte', stampIcon: 'utensils', stampsRequired: 8, reward: 'Gratis Hauptgericht', backgroundColor: '#2B1D1A', textColor: '#FFFFFF', accentColor: '#E07A5F' },
  hairdresser: { cardTitle: 'Salonkarte', stampIcon: 'scissors', stampsRequired: 6, reward: '50 % auf einen Haarschnitt', backgroundColor: '#F4EDEA', textColor: '#2A2224', accentColor: '#A4506C' },
  barbershop: { cardTitle: 'Barber Card', stampIcon: 'scissors', stampsRequired: 8, reward: 'Gratis Haarschnitt', backgroundColor: '#16181D', textColor: '#FFFFFF', accentColor: '#C9A227' },
  beauty: { cardTitle: 'Beauty Card', stampIcon: 'sparkles', stampsRequired: 6, reward: 'Gratis Pflegebehandlung', backgroundColor: '#FBEFF1', textColor: '#40282E', accentColor: '#C2577A' },
  fitness: { cardTitle: 'Trainingskarte', stampIcon: 'dumbbell', stampsRequired: 12, reward: 'Gratis Shake', backgroundColor: '#101820', textColor: '#FFFFFF', accentColor: '#3DDC97' },
  florist: { cardTitle: 'Blumenkarte', stampIcon: 'flower', stampsRequired: 8, reward: 'Gratis Strauß', backgroundColor: '#EEF4EC', textColor: '#24382B', accentColor: '#4C8C5A' },
  retail: { cardTitle: 'Kundenkarte', stampIcon: 'shopping-bag', stampsRequired: 10, reward: '10 € Gutschein', backgroundColor: '#1D2A44', textColor: '#FFFFFF', accentColor: '#F2B441' },
  carwash: { cardTitle: 'Waschkarte', stampIcon: 'car', stampsRequired: 6, reward: 'Gratis Wäsche', backgroundColor: '#0E3A5B', textColor: '#FFFFFF', accentColor: '#5CC8F0' },
  nails: { cardTitle: 'Nagelkarte', stampIcon: 'sparkles', stampsRequired: 6, reward: 'Gratis Maniküre', backgroundColor: '#FFF1EC', textColor: '#42282A', accentColor: '#E0676B' },
  services: { cardTitle: 'Treuekarte', stampIcon: 'star', stampsRequired: 8, reward: 'Gratis Leistung', backgroundColor: '#22313F', textColor: '#FFFFFF', accentColor: '#E8B86D' },
  other: { cardTitle: 'Treuekarte', stampIcon: 'star', stampsRequired: 10, reward: 'Gratis Prämie', backgroundColor: '#1F3A2E', textColor: '#FFFFFF', accentColor: '#E8B86D' },
};

export const STAMP_ICON_LABELS: Record<string, string> = {
  coffee: 'Kaffee',
  croissant: 'Gebäck',
  utensils: 'Besteck',
  scissors: 'Schere',
  sparkles: 'Glanz',
  dumbbell: 'Hantel',
  flower: 'Blume',
  'shopping-bag': 'Tasche',
  car: 'Auto',
  star: 'Stern',
  heart: 'Herz',
  check: 'Haken',
};

/** Kontrastverhältnis nach WCAG zwischen zwei Hex-Farben. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}
