const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const rel = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' });

export function formatDate(value: string | Date | null | undefined): string {
  return value ? dateFmt.format(new Date(value)) : '–';
}
export function formatDateTime(value: string | Date | null | undefined): string {
  return value ? dateTimeFmt.format(new Date(value)) : '–';
}
export function formatTime(value: string | Date | null | undefined): string {
  return value ? timeFmt.format(new Date(value)) : '–';
}

/** „vor 3 Tagen“, „gestern“, „in 2 Stunden“ */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return 'nie';
  const diff = (new Date(value).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'gerade eben';
  if (abs < 3600) return rel.format(Math.round(diff / 60), 'minute');
  if (abs < 86_400) return rel.format(Math.round(diff / 3600), 'hour');
  if (abs < 86_400 * 30) return rel.format(Math.round(diff / 86_400), 'day');
  if (abs < 86_400 * 365) return rel.format(Math.round(diff / (86_400 * 30)), 'month');
  return rel.format(Math.round(diff / (86_400 * 365)), 'year');
}

export function formatMoney(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

export function formatNumber(value: number): string {
  return value.toLocaleString('de-DE');
}

export function fullName(person: { firstName: string; lastName?: string | null }): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}
