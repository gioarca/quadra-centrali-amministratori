/**
 * Date in italiano, sempre sul fuso Europe/Rome (anche se il server gira in UTC).
 * Niente abbreviazioni: "mercoledì 14 ottobre alle 10:00" si legge meglio di "mer 14/10 10:00".
 */
export const TZ = "Europe/Rome";
const DAY_MS = 86_400_000;

/** Data ISO, oggetto Date o millisecondi (i dati delle centrali arrivano come timestamp). */
export type DateLike = string | Date | number;

export function toDate(d: DateLike): Date {
  return d instanceof Date ? d : new Date(d);
}

export function iso(d: DateLike): string {
  return toDate(d).toISOString();
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Giorno di calendario a Roma, es. "2026-10-12". */
export function dayKey(d: DateLike): string {
  return dayKeyFmt.format(toDate(d));
}

function keyToUtcMidnight(key: string): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Differenza in giorni di calendario (Roma) tra due istanti: positivo se b è dopo a. */
export function calendarDaysBetween(a: DateLike, b: DateLike): number {
  return Math.round((keyToUtcMidnight(dayKey(b)) - keyToUtcMidnight(dayKey(a))) / DAY_MS);
}

/** Scarto in minuti tra l'ora di Roma e UTC in un dato istante (60 o 120). */
function romeOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Istante corrispondente a un'ora locale di Roma, spostata di `dayOffset` giorni da `base`. */
export function romeAt(base: DateLike, dayOffset: number, hour: number, minute = 0): Date {
  const key = dayKey(base);
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const guess = new Date(Date.UTC(y, m - 1, d + dayOffset, hour, minute));
  const offset = romeOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60_000);
}

export function addMonths(d: DateLike, months: number): Date {
  const date = new Date(toDate(d).getTime());
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date;
}

export function addHours(d: DateLike, hours: number): Date {
  return new Date(toDate(d).getTime() + hours * 3_600_000);
}

const fmtWeekdayDayMonth = new Intl.DateTimeFormat("it-IT", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const fmtDayMonth = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, day: "numeric", month: "long" });
const fmtDayMonthYear = new Intl.DateTimeFormat("it-IT", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});
const fmtHm = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fmtMonthShort = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, month: "long" });

/** "oggi", "domani", "ieri", "mercoledì 14 ottobre", "14 ottobre 2027". */
export function fmtDay(d: DateLike, now: DateLike = new Date()): string {
  const diff = calendarDaysBetween(now, d);
  if (diff === 0) return "oggi";
  if (diff === 1) return "domani";
  if (diff === -1) return "ieri";
  if (Math.abs(diff) <= 6) return fmtWeekdayDayMonth.format(toDate(d));
  if (dayKey(d).slice(0, 4) === dayKey(now).slice(0, 4)) return fmtDayMonth.format(toDate(d));
  return fmtDayMonthYear.format(toDate(d));
}

export function fmtTime(d: DateLike): string {
  return fmtHm.format(toDate(d));
}

export function fmtDayTime(d: DateLike, now: DateLike = new Date()): string {
  return `${fmtDay(d, now)} alle ${fmtTime(d)}`;
}

/** Data completa per documenti e rendiconti: "14 ottobre 2026". */
export function fmtDate(d: DateLike): string {
  return fmtDayMonthYear.format(toDate(d));
}

/** Data lunga di oggi per i titoli: "lunedì 12 ottobre". */
export function fmtToday(now: DateLike = new Date()): string {
  return fmtWeekdayDayMonth.format(toDate(now));
}

export function fmtMonth(d: DateLike): string {
  return fmtMonthShort.format(toDate(d));
}

/** "scade oggi", "scade tra 3 giorni", "scaduto da 12 giorni". */
export function fmtDueIn(daysLeft: number): string {
  if (daysLeft === 0) return "scade oggi";
  if (daysLeft === 1) return "scade domani";
  if (daysLeft > 1) {
    if (daysLeft > 60) return `scade tra ${Math.round(daysLeft / 30)} mesi`;
    return `scade tra ${daysLeft} giorni`;
  }
  const late = -daysLeft;
  if (late === 1) return "scaduto da ieri";
  if (late > 60) return `scaduto da ${Math.round(late / 30)} mesi`;
  return `scaduto da ${late} giorni`;
}

/** "tra 3 ore", "tra 45 minuti". */
export function fmtHoursFromNow(target: DateLike, now: DateLike = new Date()): string {
  const minutes = Math.round((toDate(target).getTime() - toDate(now).getTime()) / 60_000);
  if (minutes < 60) return `tra ${Math.max(minutes, 1)} minuti`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "tra un'ora" : `tra ${hours} ore`;
}

export function fmtEuro(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

export function greeting(now: DateLike = new Date()): string {
  const h = Number(fmtHm.format(toDate(now)).slice(0, 2));
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

/** "a", "a e b", "a, b e c". */
export function joinIt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}
