/**
 * Stagione termica per zona climatica (DPR 74/2013, art. 4).
 * Il Comune può anticipare o prolungare con un'ordinanza (art. 5): qui c'è la regola nazionale.
 */
import { calendarDaysBetween, dayKey, romeAt, toDate, type DateLike } from "./time.ts";
import type { Zona } from "./types.ts";

interface SeasonRule {
  /** [mese, giorno] di inizio e fine; null = nessun limite (zona F) */
  start: [number, number] | null;
  end: [number, number] | null;
  /** Ore massime al giorno; null = nessun limite */
  maxHours: number | null;
}

export const SEASON_RULES: Record<Zona, SeasonRule> = {
  A: { start: [12, 1], end: [3, 15], maxHours: 6 },
  B: { start: [12, 1], end: [3, 31], maxHours: 8 },
  C: { start: [11, 15], end: [3, 31], maxHours: 10 },
  D: { start: [11, 1], end: [4, 15], maxHours: 12 },
  E: { start: [10, 15], end: [4, 15], maxHours: 14 },
  F: { start: null, end: null, maxHours: null },
};

/** Mezzogiorno UTC di quel giorno cade sempre nello stesso giorno a Roma. */
function romeDay(y: number, m: number, d: number, hour = 0, minute = 0): Date {
  return romeAt(new Date(Date.UTC(y, m - 1, d, 12)), 0, hour, minute);
}

export interface SeasonInfo {
  zona: Zona;
  /** Zona F: nessun limite di date né di ore */
  unlimited: boolean;
  /** Oggi il riscaldamento si può accendere */
  active: boolean;
  start: Date | null;
  end: Date | null;
  maxHours: number | null;
  /** Giorni all'accensione (se la stagione non è iniziata) */
  daysToStart: number | null;
  /** Giorno della stagione in corso, a partire da 1 */
  dayOfSeason: number | null;
  seasonDays: number | null;
}

export function seasonInfo(zona: Zona, now: DateLike = new Date()): SeasonInfo {
  const rule = SEASON_RULES[zona];
  if (!rule.start || !rule.end) {
    return { zona, unlimited: true, active: true, start: null, end: null, maxHours: null, daysToStart: null, dayOfSeason: null, seasonDays: null };
  }
  const y = Number(dayKey(now).slice(0, 4));
  const t = toDate(now).getTime();
  const make = (startYear: number) => ({
    start: romeDay(startYear, rule.start![0], rule.start![1]),
    end: romeDay(startYear + 1, rule.end![0], rule.end![1], 23, 59),
  });
  const candidates = [make(y - 1), make(y)];
  const current = candidates.find((c) => c.start.getTime() <= t && t <= c.end.getTime());
  const s = current ?? candidates.find((c) => c.start.getTime() > t) ?? make(y + 1);
  const seasonDays = calendarDaysBetween(s.start, s.end) + 1;
  return {
    zona,
    unlimited: false,
    active: !!current,
    start: s.start,
    end: s.end,
    maxHours: rule.maxHours,
    daysToStart: current ? null : calendarDaysBetween(now, s.start),
    dayOfSeason: current ? calendarDaysBetween(s.start, now) + 1 : null,
    seasonDays,
  };
}

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" });
const seasonCache = new Map<string, SeasonInfo>();

/** Il riscaldamento può essere acceso in quest'ora, secondo stagione e orario impostato in centrale? */
export function heatingAllowedAt(zona: Zona, schedule: { from: number; to: number }, at: DateLike): boolean {
  const key = `${zona}:${dayKey(at)}`;
  let s = seasonCache.get(key);
  if (!s) {
    s = seasonInfo(zona, romeAt(at, 0, 12));
    seasonCache.set(key, s);
  }
  if (!s.active) return false;
  const hour = Number(hourFmt.format(toDate(at)));
  return hour >= schedule.from && hour < schedule.to;
}

/** "dal 15 ottobre al 15 aprile, 14 ore al giorno" */
export function seasonSentence(zona: Zona): string {
  const r = SEASON_RULES[zona];
  if (!r.start || !r.end) return "nessun limite di date e di ore";
  const months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const d = ([m, day]: [number, number]) => `${day === 1 ? "1°" : day} ${months[m - 1]}`;
  return `dal ${d(r.start)} al ${d(r.end)}, ${r.maxHours} ore al giorno`;
}
