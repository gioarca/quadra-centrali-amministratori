/**
 * Viste pronte per le schermate: stessa logica per la demo nel browser e per l'API.
 */
import { addMonths, calendarDaysBetween, dayKey, romeAt, toDate, type DateLike } from "./time.ts";
import type { Finding } from "./diagnosi.ts";
import { simulatedLive, type LiveProvider } from "./live.ts";
import { deadlinesFor, type PlantDeadline } from "./rules.ts";
import { seasonInfo, type SeasonInfo } from "./season.ts";
import type { Telemetry, TelemetryPoint } from "./simulate.ts";
import type { Building, Dataset, Doc, Org, Plant, Quote, Technician, User, WorkOrder } from "./types.ts";

export type PlantStatus = "blocco" | "attenzione" | "offline" | "ok" | "non_collegata";

export const PLANT_STATUS_ORDER: Record<PlantStatus, number> = {
  blocco: 0,
  attenzione: 1,
  offline: 2,
  ok: 3,
  non_collegata: 4,
};

export interface PlantView {
  plant: Plant;
  building: Building;
  admin: User;
  adminOrg: Org;
  maintainer: Org;
  telemetry: Telemetry;
  now: TelemetryPoint | null;
  findings: Finding[];
  status: PlantStatus;
  deadlines: PlantDeadline[];
  season: SeasonInfo;
  openWork: WorkOrder[];
}

export function isOpenWork(w: WorkOrder): boolean {
  return w.status !== "fatto";
}

function statusOf(building: Building, plant: Plant, findings: Finding[]): PlantStatus {
  if (!building.connected || !plant.gateway) return "non_collegata";
  if (findings.some((f) => f.rule === "offline")) return "offline";
  if (findings.some((f) => f.severity === "blocco")) return "blocco";
  if (findings.some((f) => f.severity === "attenzione")) return "attenzione";
  return "ok";
}

/**
 * Tutto quello che serve per mostrare una centrale. `live` dice da dove arrivano i dati dal vivo:
 * simulati nel browser (predefinito, demo) o salvati dal modulo vero (server).
 */
export function plantView(ds: Dataset, plantId: string, nowLike: DateLike = new Date(), live: LiveProvider = simulatedLive): PlantView {
  const now = toDate(nowLike);
  const plant = ds.plants.find((p) => p.id === plantId);
  if (!plant) throw new Error("Centrale non trovata.");
  const building = ds.buildings.find((b) => b.plantId === plant.id)!;
  const admin = ds.users.find((u) => u.id === building.adminId)!;
  const adminOrg = ds.orgs.find((o) => o.id === admin.orgId)!;
  const maintainer = ds.orgs.find((o) => o.id === building.maintainerOrgId)!;
  const { telemetry, findings } = live(plant, building, now);
  return {
    plant,
    building,
    admin,
    adminOrg,
    maintainer,
    telemetry,
    now: telemetry.points[telemetry.points.length - 1] ?? null,
    findings,
    status: statusOf(building, plant, findings),
    deadlines: deadlinesFor(plant, now),
    season: seasonInfo(plant.zona, now),
    openWork: ds.workOrders
      .filter((w) => w.plantId === plant.id && isOpenWork(w))
      .sort((a, b) => (a.scheduledFor ?? a.createdAt).localeCompare(b.scheduledFor ?? b.createdAt)),
  };
}

function sortViews(list: PlantView[]): PlantView[] {
  return list.sort(
    (a, b) =>
      PLANT_STATUS_ORDER[a.status] - PLANT_STATUS_ORDER[b.status] || a.building.name.localeCompare(b.building.name, "it"),
  );
}

/** Le centrali seguite da una ditta, dalla più grave. */
export function fleet(ds: Dataset, orgId: string, now: DateLike = new Date(), live: LiveProvider = simulatedLive): PlantView[] {
  return sortViews(ds.buildings.filter((b) => b.maintainerOrgId === orgId).map((b) => plantView(ds, b.plantId, now, live)));
}

/** I condomini di un amministratore, qualunque sia la ditta. */
export function adminBuildings(ds: Dataset, adminId: string, now: DateLike = new Date(), live: LiveProvider = simulatedLive): PlantView[] {
  return sortViews(ds.buildings.filter((b) => b.adminId === adminId).map((b) => plantView(ds, b.plantId, now, live)));
}

/* ---------------- prove di prima accensione ---------------- */

export interface PreSeason {
  season: SeasonInfo;
  total: number;
  done: number;
  upcoming: WorkOrder[];
  missing: Building[];
}

/** Prima della stagione: quante centrali in zona E hanno già fatto la prova di accensione. */
export function preSeason(ds: Dataset, orgId: string, nowLike: DateLike = new Date()): PreSeason | null {
  const now = toDate(nowLike);
  const season = seasonInfo("E", now);
  if (season.active || season.daysToStart === null || season.daysToStart > 30) return null;
  const buildings = ds.buildings.filter((b) => {
    if (b.maintainerOrgId !== orgId) return false;
    return ds.plants.find((p) => p.id === b.plantId)?.zona === "E";
  });
  const windowStart = new Date(season.start!.getTime() - 45 * 86_400_000).toISOString();
  let done = 0;
  const upcoming: WorkOrder[] = [];
  const missing: Building[] = [];
  for (const b of buildings) {
    const works = ds.workOrders.filter((w) => w.plantId === b.plantId && w.checkTypes.includes("prima_accensione"));
    if (works.some((w) => w.status === "fatto" && (w.closedAt ?? "") >= windowStart)) done++;
    else {
      const next = works.find(isOpenWork);
      if (next) upcoming.push(next);
      else missing.push(b);
    }
  }
  upcoming.sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
  return { season, total: buildings.length, done, upcoming, missing };
}

/* ---------------- consumi e gradi giorno ---------------- */

/** Gradi giorno medi per mese in pianura veneta (zona E), indicativi. */
const GG_E: Record<number, number> = { 10: 115, 11: 330, 12: 470, 1: 500, 2: 400, 3: 320, 4: 110 };
const GG_CITY_FACTOR: Record<string, number> = { Belluno: 1.3 };

export interface ConsumptionMonth {
  key: string;
  label: string;
  gg: number;
  current: number | null;
  previous: number;
}

export interface Consumption {
  unit: string;
  months: ConsumptionMonth[];
  /** Consumo per grado giorno: stagione di riferimento e quella prima */
  perGgCurrent: number | null;
  perGgPrevious: number;
  seasonLabelCurrent: string;
  seasonLabelPrevious: string;
}

function seeded(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const MONTH_LABEL = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/**
 * Consumi della stagione in corso (o dell'ultima conclusa a inizio stagione) confrontati con la precedente.
 * Nella demo sono stimati dalle unità abitative e dai gradi giorno; in produzione arrivano
 * dal contatore (M-Bus) o dalle bollette.
 */
export function consumption(ds: Dataset, plantId: string, nowLike: DateLike = new Date()): Consumption {
  const now = toDate(nowLike);
  const plant = ds.plants.find((p) => p.id === plantId)!;
  const building = ds.buildings.find((b) => b.plantId === plantId)!;
  const fuel = plant.generators[0]?.fuel ?? "metano";
  const unit = fuel === "gasolio" ? "litri" : fuel === "elettrico" ? "kWh" : "Sm³";
  const factor = (GG_CITY_FACTOR[building.city] ?? 1) * (fuel === "elettrico" ? 3.1 : fuel === "gasolio" ? 0.95 : 1);
  const perUnitPerGg = 0.52 + seeded(plant.id) * 0.12;
  const trend = 0.9 + seeded(`${plant.id}:trend`) * 0.16; // tra −10% e +6%

  const y = Number(dayKey(now).slice(0, 4));
  const m = Number(dayKey(now).slice(5, 7));
  // Stagione di riferimento: quella in corso da dicembre ad aprile; altrimenti l'ultima conclusa,
  // perché a ottobre e novembre i dati della nuova stagione sono ancora troppo pochi.
  const startYear = m === 12 ? y : y - 1;
  const seasonMonths = [10, 11, 12, 1, 2, 3, 4];
  const months: ConsumptionMonth[] = seasonMonths.map((mm) => {
    const yy = mm >= 10 ? startYear : startYear + 1;
    const key = `${yy}-${String(mm).padStart(2, "0")}`;
    const gg = Math.round((GG_E[mm] ?? 0) * (GG_CITY_FACTOR[building.city] ?? 1) * (0.92 + seeded(`${key}:gg`) * 0.16));
    const prevGg = Math.round((GG_E[mm] ?? 0) * (GG_CITY_FACTOR[building.city] ?? 1) * (0.92 + seeded(`${yy - 1}-${mm}:gg`) * 0.16));
    const isFuture = key > dayKey(now).slice(0, 7);
    const isCurrentMonth = key === dayKey(now).slice(0, 7);
    let current: number | null = null;
    if (!isFuture) {
      const share = isCurrentMonth ? Math.min(1, Number(dayKey(now).slice(8, 10)) / 30) : 1;
      current = Math.round(gg * share * building.units * perUnitPerGg * trend * factor);
    }
    return {
      key,
      label: MONTH_LABEL[mm - 1]!,
      gg: isFuture ? gg : Math.round(gg * (isCurrentMonth ? Math.min(1, Number(dayKey(now).slice(8, 10)) / 30) : 1)),
      current,
      previous: Math.round(prevGg * building.units * perUnitPerGg * factor),
    };
  });
  const elapsed = months.filter((x) => x.current !== null && x.current > 0);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const perGgCurrent = elapsed.length ? sum(elapsed.map((x) => x.current!)) / Math.max(1, sum(elapsed.map((x) => x.gg))) : null;
  const perGgPrevious =
    sum(months.map((x) => x.previous)) /
    Math.max(1, sum(seasonMonths.map((mm) => Math.round((GG_E[mm] ?? 0) * (GG_CITY_FACTOR[building.city] ?? 1)))));
  return {
    unit,
    months,
    perGgCurrent: perGgCurrent === null ? null : Math.round(perGgCurrent * 100) / 100,
    perGgPrevious: Math.round(perGgPrevious * 100) / 100,
    seasonLabelCurrent: `${startYear}/${String(startYear + 1).slice(2)}`,
    seasonLabelPrevious: `${startYear - 1}/${String(startYear).slice(2)}`,
  };
}

/* ---------------- amministratore ---------------- */

export interface LegalDue {
  building: Building;
  deadline?: PlantDeadline;
  doc?: Doc;
  /** Frase pronta: "Rinnovo antincendio (CPI) scade tra 19 giorni" */
  daysLeft: number;
}

/** Scadenze di legge e documenti in scadenza nei prossimi `days` giorni (o già scaduti). */
export function legalDue(ds: Dataset, adminId: string, nowLike: DateLike = new Date(), days = 60): LegalDue[] {
  const now = toDate(nowLike);
  const out: LegalDue[] = [];
  for (const b of ds.buildings.filter((x) => x.adminId === adminId)) {
    const p = ds.plants.find((x) => x.id === b.plantId)!;
    for (const d of deadlinesFor(p, now)) {
      if (!d.law || d.daysLeft === null) continue;
      if (d.daysLeft <= days) out.push({ building: b, deadline: d, daysLeft: d.daysLeft });
    }
    for (const doc of ds.docs.filter((x) => x.buildingId === b.id && x.expiresAt && x.kind === "contratto")) {
      const left = calendarDaysBetween(now, doc.expiresAt!);
      if (left <= days) out.push({ building: b, doc, daysLeft: left });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function quotesFor(ds: Dataset, filter: { adminId?: string; orgId?: string }): Quote[] {
  return ds.quotes
    .filter((q) => {
      const b = ds.buildings.find((x) => x.id === q.buildingId)!;
      if (filter.adminId && b.adminId !== filter.adminId) return false;
      if (filter.orgId && q.orgId !== filter.orgId) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function quoteTotal(q: Pick<Quote, "items">): number {
  return Math.round(q.items.reduce((s, i) => s + i.qty * i.price, 0) * 100) / 100;
}

export function technicianOf(ds: Dataset, w: WorkOrder): Technician | undefined {
  return w.technicianId ? ds.technicians.find((t) => t.id === w.technicianId) : undefined;
}

/** Interventi di una stagione per la relazione: dal 1° settembre dell'anno di inizio. */
export function seasonWork(ds: Dataset, plantId: string, nowLike: DateLike = new Date()): WorkOrder[] {
  const now = toDate(nowLike);
  const y = Number(dayKey(now).slice(0, 4));
  const m = Number(dayKey(now).slice(5, 7));
  const from = romeAt(new Date(Date.UTC(m >= 9 ? y : y - 1, 8, 1, 12)), 0, 0).toISOString();
  return ds.workOrders
    .filter((w) => w.plantId === plantId && (w.closedAt ?? w.createdAt) >= addMonths(from, -12).toISOString())
    .sort((a, b) => (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt));
}
