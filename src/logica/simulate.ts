/**
 * Dati della centrale nelle ultime 24 ore, un punto ogni 10 minuti.
 *
 * Nella demo i valori sono simulati in modo realistico e ripetibile (stesso istante, stesso valore),
 * seguendo stagione, orario, curva climatica e lo scenario della centrale.
 * In produzione la stessa struttura arriva dal gateway in centrale.
 */
import { dayKey, toDate, type DateLike } from "./time.ts";
import { heatingAllowedAt } from "./season.ts";
import type { Building, Generator, Plant, Scenario } from "./types.ts";

export const STEP_MIN = 10;
const STEP_MS = STEP_MIN * 60_000;
const POINTS = (24 * 60) / STEP_MIN + 1;

export interface TelemetryPoint {
  t: number;
  /** Temperatura esterna, °C */
  outdoor: number;
  /** Mandata e ritorno del circuito riscaldamento, °C */
  supply: number;
  return: number;
  /** Mandata richiesta dalla curva climatica, °C (null se il riscaldamento è fermo) */
  target: number | null;
  /** Pressione dell'impianto, bar */
  pressure: number;
  /** Acqua calda sanitaria nel bollitore, °C (null se non è centralizzata) */
  dhw: number | null;
  /** Potenza del bruciatore, % della potenza totale */
  burner: number;
  /** Accensioni del bruciatore nei 10 minuti (dal contatore della caldaia) */
  starts: number;
  lockout: boolean;
  /** Il riscaldamento è nell'orario e nella stagione consentiti */
  heating: boolean;
  pump: boolean;
}

export type GeneratorStateKind = "acceso" | "spento" | "blocco";

export interface GeneratorState {
  id: string;
  label: string;
  kind: Generator["kind"];
  state: GeneratorStateKind;
  /** % di potenza del singolo generatore */
  modulation: number;
  code?: string;
}

export interface Telemetry {
  points: TelemetryPoint[];
  /** Ultimo dato ricevuto; null = mai collegata */
  lastSeenAt: string | null;
  generators: GeneratorState[];
  fuelToday: { value: number; unit: string };
}

/* ---------- numeri pseudo-casuali ripetibili ---------- */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Valore tra -1 e 1, sempre uguale per la stessa chiave. */
function noise(key: string): number {
  let t = hash(key) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
}

/* ---------- clima ---------- */

/** Media mensile della temperatura esterna in pianura veneta, °C (indicativa). */
const MONTHLY_MEAN = [3, 4.5, 8.5, 12.5, 17.5, 21.5, 23.5, 23, 19, 13.5, 8, 4];

/** Città più fredde o più calde della pianura trevigiana, in gradi. */
const CITY_OFFSET: Record<string, number> = { Belluno: -3.5, Feltre: -2.5, Asiago: -5 };

const hmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function romeHourMinute(t: number): number {
  const parts = hmFmt.formatToParts(new Date(t));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

export function outdoorAt(t: number, city: string): number {
  const key = dayKey(new Date(t));
  const month = Number(key.slice(5, 7)) - 1;
  const day = Number(key.slice(8, 10));
  // interpolazione tra le medie dei mesi (riferite a metà mese)
  const frac = (day - 15) / 30;
  const next = frac >= 0 ? (month + 1) % 12 : (month + 11) % 12;
  const mean = MONTHLY_MEAN[month]! + (MONTHLY_MEAN[next]! - MONTHLY_MEAN[month]!) * Math.abs(frac);
  const hour = romeHourMinute(t);
  const daily = -4.5 * Math.cos(((hour - 4) / 24) * 2 * Math.PI);
  const dayNoise = noise(`${city}:${key}`) * 2.5;
  return mean + daily + dayNoise + (CITY_OFFSET[city] ?? 0) + noise(`${city}:${t}`) * 0.2;
}

/* ---------- scenari ---------- */

export function scenarioAt(plant: Plant, t: number): { scenario: Scenario; since: number; generatorId?: string } {
  let current: { scenario: Scenario; since: number; generatorId?: string } = { scenario: "normale", since: 0 };
  for (const c of plant.scenarios) {
    const at = Date.parse(c.at);
    if (at <= t) current = { scenario: c.scenario, since: at, generatorId: c.generatorId };
  }
  return current;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Mandata chiesta dalla curva climatica con questa temperatura esterna. */
export function curveTarget(plant: Pick<Plant, "curve">, outdoor: number): number {
  return Math.round(clamp(plant.curve.base + plant.curve.slope * (20 - outdoor), 30, plant.curve.max) * 10) / 10;
}

/**
 * Combustibile usato da mezzanotte (ora di Roma): potenza del bruciatore × tempo ÷ potere calorifico.
 * È una stima: con un contatore collegato (M-Bus) si usa la lettura vera.
 */
export function fuelToday(points: Pick<TelemetryPoint, "t" | "burner">[], plant: Pick<Plant, "generators">, now: DateLike): { value: number; unit: string } {
  const totalKw = plant.generators.reduce((s, g) => s + g.powerKw, 0);
  const todayKey = dayKey(now);
  const kwh = points
    .filter((p) => dayKey(new Date(p.t)) === todayKey)
    .reduce((s, p) => s + (p.burner / 100) * totalKw * (STEP_MIN / 60), 0);
  const fuel = plant.generators[0]?.fuel ?? "metano";
  if (fuel === "gasolio") return { value: Math.round(kwh / 10), unit: "litri" };
  if (fuel === "elettrico") return { value: Math.round(kwh / 3.2), unit: "kWh elettrici" };
  return { value: Math.round(kwh / 9.6), unit: "Sm³" };
}

export function simulate(plant: Plant, building: Pick<Building, "city" | "connected">, now: DateLike = new Date()): Telemetry {
  if (!plant.gateway || !building.connected) {
    return { points: [], lastSeenAt: null, generators: [], fuelToday: { value: 0, unit: "Sm³" } };
  }
  const end = Math.floor(toDate(now).getTime() / STEP_MS) * STEP_MS;
  const hasDhw = plant.circuits.some((c) => c.kind === "acs");
  const totalKw = plant.generators.reduce((s, g) => s + g.powerKw, 0);
  const points: TelemetryPoint[] = [];
  let pressure = 1.6;
  let lastSupply = 26;
  let lastSeen: number | null = null;

  for (let i = POINTS - 1; i >= 0; i--) {
    const t = end - i * STEP_MS;
    const sc = scenarioAt(plant, t);
    if (sc.scenario === "offline") continue; // il gateway non manda più nulla
    lastSeen = t;
    const n = (k: string) => noise(`${plant.id}:${k}:${t}`);
    const outdoor = round1(outdoorAt(t, building.city));
    const heating = heatingAllowedAt(plant.zona, plant.schedule, new Date(t)) && outdoor < 19;
    const target = heating ? curveTarget(plant, outdoor) : null;

    let supply: number;
    let ret: number;
    let burner = 0;
    let lockout = false;
    const minutesIn = (t - sc.since) / 60_000;

    if (heating && target !== null) {
      const dt = 9 + 5 * clamp((15 - outdoor) / 20, 0, 1);
      supply = target + n("s") * 0.9;
      ret = supply - dt + n("r") * 0.6;
      burner = clamp(((target - 25) / (plant.curve.max - 25)) * 85 + n("b") * 6, 18, 100);

      if (sc.scenario === "blocco_bruciatore") {
        lockout = true;
        const boilers = plant.generators.filter((g) => g.kind === "caldaia").length;
        if (boilers > 1) {
          // Le altre caldaie in cascata coprono finché la richiesta non supera la loro potenza.
          const available = (100 / boilers) * (boilers - 1);
          if (burner > available) {
            const deficit = (burner - available) / burner;
            supply = target - Math.min(15 * deficit, minutesIn / 8) + n("s") * 0.8;
            burner = available;
          }
        } else {
          // Una sola caldaia: la mandata scende verso la temperatura del locale.
          supply = 24 + (lastSupply - 24) * Math.exp(-STEP_MIN / 70);
          burner = 0;
        }
        ret = Math.max(20, supply - dt * 0.8 + n("r") * 0.5);
      } else if (sc.scenario === "circolazione_scarsa") {
        supply = target + 3 + n("s") * 0.7;
        ret = supply - 2.8 + n("r") * 0.4;
      } else if (sc.scenario === "non_condensa") {
        supply = 72 + n("s") * 1.2;
        ret = 62 + n("r") * 1;
        burner = clamp(burner + 15, 20, 100);
      } else if (sc.scenario === "cicli_frequenti") {
        const on = Math.round(t / STEP_MS) % 2 === 0;
        burner = on ? 70 : 0;
        supply = target + (on ? 3.5 : -3.5) + n("s") * 0.6;
      }
    } else {
      // Riscaldamento fermo: le tubazioni sono alla temperatura del locale caldaia.
      supply = 25 + n("s") * 0.6;
      ret = 24 + n("r") * 0.5;
      const slot = Math.round(t / STEP_MS);
      // Il bruciatore lavora a tratti per ricaricare l'acqua calda.
      if (hasDhw) burner = slot % 6 === 0 || slot % 6 === 1 ? 35 + n("b") * 5 : 0;
      if (sc.scenario === "cicli_frequenti") burner = slot % 2 === 0 ? 60 : 0;
      if (sc.scenario === "blocco_bruciatore") {
        lockout = true;
        const cascade = plant.generators.filter((g) => g.kind === "caldaia").length > 1;
        if (!cascade) burner = 0;
      }
    }

    // Pressione: stabile, sale un poco con l'acqua calda; scende se c'è una perdita.
    if (sc.scenario === "pressione_in_calo") {
      pressure = clamp(1.6 - (minutesIn / (24 * 60)) * 0.55, 0.5, 1.6);
    } else {
      pressure = 1.55 + (supply - 30) * 0.004;
    }
    pressure = round1(pressure * 10) / 10 + n("p") * 0.01;

    let dhw: number | null = null;
    if (hasDhw) {
      dhw = 55.5 + n("d") * 1.2;
      if (sc.scenario === "acs_bassa") dhw = 42 + n("d") * 1;
      if (sc.scenario === "blocco_bruciatore" && plant.generators.filter((g) => g.kind === "caldaia").length < 2) {
        dhw = Math.max(30, 55 - minutesIn / 8);
      }
    }

    let starts = 0;
    if (burner > 0) {
      const prev = points[points.length - 1];
      starts = !prev || prev.burner === 0 ? 1 : n("c") > 0.55 ? 1 : 0;
      // Il contatore della caldaia conta 3 accensioni ogni 10 minuti di lavoro: circa 9 all'ora.
      if (sc.scenario === "cicli_frequenti") starts = 3;
    }

    lastSupply = supply;
    points.push({
      t,
      outdoor,
      supply: round1(supply),
      return: round1(ret),
      target: target === null ? null : round1(target),
      pressure: Math.round(pressure * 100) / 100,
      dhw: dhw === null ? null : round1(dhw),
      burner: Math.round(burner),
      starts,
      lockout,
      heating,
      pump: heating,
    });
  }

  const last = points[points.length - 1];
  const sc = scenarioAt(plant, end);
  const blockedId =
    last?.lockout && sc.scenario === "blocco_bruciatore" ? (sc.generatorId ?? plant.generators[0]?.id) : undefined;
  const mods = cascade(plant.generators, last?.burner ?? 0, blockedId);
  const generators: GeneratorState[] = plant.generators.map((g) => {
    if (g.id === blockedId) return { id: g.id, label: g.label, kind: g.kind, state: "blocco", modulation: 0, code: "E01" };
    const modulation = mods[g.id] ?? 0;
    return { id: g.id, label: g.label, kind: g.kind, state: modulation > 0 ? "acceso" : "spento", modulation };
  });

  return {
    points,
    lastSeenAt: lastSeen === null ? null : new Date(lastSeen).toISOString(),
    generators,
    fuelToday: fuelToday(points, plant, end),
  };
}

/**
 * Generatori in cascata: la richiesta (in % della potenza totale) va al primo generatore libero,
 * poi al successivo. Restituisce la modulazione di ciascuno, in %.
 */
export function cascade(generators: Pick<Generator, "id" | "powerKw">[], burnerPct: number, blockedId?: string): Record<string, number> {
  const totalKw = generators.reduce((s, g) => s + g.powerKw, 0);
  let demandKw = (burnerPct / 100) * totalKw;
  const out: Record<string, number> = {};
  for (const g of generators) {
    if (g.id === blockedId) {
      out[g.id] = 0;
      continue;
    }
    const assigned = Math.min(g.powerKw, demandKw);
    demandKw -= assigned;
    out[g.id] = Math.round((assigned / g.powerKw) * 100);
  }
  return out;
}

/** Accensioni del bruciatore per ora, sulle ultime `hours` ore (dal contatore). */
export function cyclesPerHour(points: TelemetryPoint[], hours = 3): number {
  const recent = points.slice(-Math.round((hours * 60) / STEP_MIN));
  const starts = recent.reduce((s, p) => s + p.starts, 0);
  return Math.round((starts / hours) * 10) / 10;
}
