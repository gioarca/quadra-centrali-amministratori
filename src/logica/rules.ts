/**
 * Controlli e scadenze di una centrale termica.
 *
 * Periodicità del controllo di efficienza energetica (RCEE): DPR 74/2013, allegato A.
 * Le regioni possono chiedere controlli più frequenti: in produzione le regole vanno
 * rese configurabili per regione e verificate con il catasto regionale.
 */
import { addMonths, calendarDaysBetween, type DateLike } from "./time.ts";
import type { CheckType, Generator, Plant } from "./types.ts";

export const DUE_SOON_DAYS = 30;

/**
 * Mesi tra due controlli di efficienza energetica, per tipo di generatore e potenza.
 * Per generatori in cascata conta la potenza complessiva dello stesso tipo.
 */
export function rceeMonths(kind: Generator["kind"], fuel: Generator["fuel"], powerKw: number): number {
  if (kind === "pompa_di_calore") return powerKw >= 100 ? 24 : 48;
  if (kind === "sottostazione") return 48;
  const liquidOrSolid = fuel === "gasolio" || fuel === "pellet";
  if (liquidOrSolid) return powerKw > 100 ? 12 : 24;
  return powerKw > 100 ? 24 : 48;
}

export function plantRceeMonths(p: Plant): number {
  const groups = new Map<string, { kind: Generator["kind"]; fuel: Generator["fuel"]; kw: number }>();
  for (const g of p.generators) {
    const key = `${g.kind}:${g.fuel}`;
    const cur = groups.get(key) ?? { kind: g.kind, fuel: g.fuel, kw: 0 };
    cur.kw += g.powerKw;
    groups.set(key, cur);
  }
  return Math.min(...[...groups.values()].map((x) => rceeMonths(x.kind, x.fuel, x.kw)));
}

export function totalPowerKw(p: Plant): number {
  return p.generators.reduce((s, g) => s + g.powerKw, 0);
}

export interface CheckDef {
  type: CheckType;
  label: string;
  /** Spiegazione in una riga, per chi non è del mestiere */
  why: string;
  months: number;
  /** Obbligo di legge (non solo buona pratica) */
  law: boolean;
}

export const CHECK_LABEL: Record<CheckType, string> = {
  manutenzione: "Manutenzione ordinaria",
  rcee: "Controllo di efficienza energetica (RCEE)",
  catasto: "Invio del rapporto al catasto regionale",
  cpi: "Rinnovo antincendio (CPI)",
  fgas: "Controllo perdite gas refrigerante (F-gas)",
  delega: "Delega al terzo responsabile",
  prima_accensione: "Prova di prima accensione",
};

/** I controlli che valgono per questa centrale. */
export function checksFor(p: Plant): CheckDef[] {
  const defs: CheckDef[] = [
    {
      type: "manutenzione",
      label: CHECK_LABEL.manutenzione,
      why: "Pulizia e verifiche secondo il libretto del costruttore.",
      months: 12,
      law: true,
    },
  ];
  const rcee = plantRceeMonths(p);
  defs.push({
    type: "rcee",
    label: CHECK_LABEL.rcee,
    why: `Analisi dei fumi e rendimento: ogni ${rcee / 12 === 1 ? "anno" : `${rcee / 12} anni`} per questa centrale.`,
    months: rcee,
    law: true,
  });
  if (totalPowerKw(p) > 116) {
    defs.push({
      type: "cpi",
      label: CHECK_LABEL.cpi,
      why: "Centrali oltre 116 kW: attestazione di rinnovo ai Vigili del Fuoco ogni 5 anni.",
      months: 60,
      law: true,
    });
  }
  if (p.generators.some((g) => (g.refrigerantCo2eqT ?? 0) >= 5)) {
    defs.push({
      type: "fgas",
      label: CHECK_LABEL.fgas,
      why: "Pompe di calore con almeno 5 t di CO₂ equivalente: controllo perdite ogni anno.",
      months: 12,
      law: true,
    });
  }
  if (p.thirdPartyOrgId) {
    defs.push({
      type: "delega",
      label: CHECK_LABEL.delega,
      why: "Il contratto che affida esercizio e manutenzione alla ditta: va rinnovato alla scadenza.",
      months: 12,
      law: false,
    });
  }
  return defs;
}

export type DeadlineStatus = "scaduta" | "in_scadenza" | "ok" | "da_inviare";

export interface PlantDeadline {
  plantId: string;
  type: CheckType;
  label: string;
  why: string;
  law: boolean;
  lastDoneAt?: string;
  dueAt: string | null;
  daysLeft: number | null;
  status: DeadlineStatus;
}

export function deadlinesFor(p: Plant, now: DateLike = new Date()): PlantDeadline[] {
  const list: PlantDeadline[] = checksFor(p).map((c) => {
    const last = p.checks[c.type]?.lastDoneAt;
    const base = last ?? p.generators[0]?.installedAt;
    const due = base ? addMonths(base, c.months) : null;
    const daysLeft = due ? calendarDaysBetween(now, due) : null;
    const status: DeadlineStatus =
      daysLeft === null || daysLeft < 0 ? "scaduta" : daysLeft <= DUE_SOON_DAYS ? "in_scadenza" : "ok";
    return {
      plantId: p.id,
      type: c.type,
      label: c.label,
      why: c.why,
      law: c.law,
      lastDoneAt: last,
      dueAt: due ? due.toISOString() : null,
      daysLeft,
      status,
    };
  });

  // Dopo ogni RCEE il rapporto va trasmesso al catasto regionale.
  const rceeAt = p.checks.rcee?.lastDoneAt;
  const sentAt = p.checks.catasto?.lastDoneAt;
  const pending = !!rceeAt && (!sentAt || sentAt < rceeAt);
  list.push({
    plantId: p.id,
    type: "catasto",
    label: CHECK_LABEL.catasto,
    why: "Il rapporto di controllo va registrato nel catasto degli impianti della regione.",
    law: true,
    lastDoneAt: sentAt,
    dueAt: null,
    daysLeft: null,
    status: pending ? "da_inviare" : "ok",
  });

  const order: Record<DeadlineStatus, number> = { scaduta: 0, da_inviare: 1, in_scadenza: 2, ok: 3 };
  return list.sort((a, b) => order[a.status] - order[b.status] || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));
}
