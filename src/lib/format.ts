import { fmtDay, fmtTime, toDate, type DateLike } from "../logica/index.ts";

/** "adesso", "40 minuti fa", "3 ore fa", "ieri alle 18:20", "sabato 10 ottobre". */
export function fmtAgo(d: DateLike, now: DateLike = new Date()): string {
  const minutes = Math.round((toDate(now).getTime() - toDate(d).getTime()) / 60_000);
  if (minutes < 2) return "adesso";
  if (minutes < 60) return `${minutes} minuti fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 12) return hours === 1 ? "un'ora fa" : `${hours} ore fa`;
  const day = fmtDay(d, now);
  if (day === "oggi" || day === "ieri") return `${day} alle ${fmtTime(d)}`;
  return day;
}

export function nights(checkIn: DateLike, checkOut: DateLike): number {
  return Math.max(1, Math.round((toDate(checkOut).getTime() - toDate(checkIn).getTime()) / 86_400_000));
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Link a Google Maps con l'indirizzo: funziona su ogni telefono senza chiavi API. */
export function mapsUrl(address: string, city: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${city}`)}`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
