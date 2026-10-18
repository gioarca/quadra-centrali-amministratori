/**
 * Le operazioni dell'app, uguali nella demo e sul server.
 *
 * Ricevono i dati già filtrati per chi chiede (o tutti, nella demo), l'utente e "adesso".
 * Le letture restituiscono le forme pronte per le schermate; i comandi restituiscono
 * il dataset aggiornato: la demo lo tiene in memoria, il server salva solo ciò che è cambiato.
 * Chi può vedere cosa si decide qui, una volta sola.
 */
import { ActionError, assignWork, completeWork, createNotice, createQuote, createWork, decideQuote, markCadastreSent, reopenWork, startWork } from "./actions.ts";
import type { CompleteWorkInput, CreateNoticeInput, CreateQuoteInput, CreateWorkInput } from "./actions.ts";
import { simulatedLive, type LiveProvider } from "./live.ts";
import { deadlinesFor, type PlantDeadline } from "./rules.ts";
import type { Building, Dataset, Doc, Notice, Org, Quote, QuoteStatus, Technician, User, WorkOrder } from "./types.ts";
import {
  adminBuildings,
  consumption,
  fleet,
  isOpenWork,
  legalDue,
  plantView,
  preSeason,
  quoteTotal,
  type Consumption,
  type LegalDue,
  type PlantView,
  type PreSeason,
} from "./views.ts";

/** Errore con lo stato HTTP da restituire: 401, 403, 404, 400. */
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/* ---------------- forme delle risposte ---------------- */

export interface Me {
  user: User;
  org: Org;
}

export interface WorkRow {
  work: WorkOrder;
  building: Building;
  technician?: Technician;
}

export interface QuoteRow {
  quote: Quote;
  building: Building;
  maintainer: Org;
  total: number;
}

export interface DeadlineRow {
  building: Building;
  deadline: PlantDeadline;
  openWork?: WorkOrder;
}

export interface PlantDetail {
  view: PlantView;
  history: WorkRow[];
  quotes: QuoteRow[];
  docs: Doc[];
  technicians: Technician[];
}

export interface FleetData {
  views: PlantView[];
  preSeason: PreSeason | null;
  openWork: WorkRow[];
  pendingQuotes: number;
}

export type WorkDetail = WorkRow & { view: PlantView; technicians: Technician[] };
export type QuoteDetail = QuoteRow & { view: PlantView };

export interface AdminHome {
  views: PlantView[];
  pendingQuotes: QuoteRow[];
  legal: LegalDue[];
  /** Interventi aperti nei suoi condomini, di qualunque ditta */
  openWork: WorkRow[];
}

export interface BuildingDetail {
  view: PlantView;
  work: WorkRow[];
  quotes: QuoteRow[];
  docs: Doc[];
  notices: Notice[];
  consumption: Consumption;
  maintainerUsesApp: boolean;
}

export interface NoticeRow {
  notice: Notice;
  building: Building;
}

export interface Ctx {
  ds: Dataset;
  user: User;
  now: Date;
  /** Da dove arrivano i dati dal vivo; predefinito: simulati (demo) */
  live?: LiveProvider;
}

export interface Result<T> {
  ds: Dataset;
  result: T;
}

/* ---------------- permessi ---------------- */

/** Ogni persona vede solo i suoi condomini: la ditta quelli che segue, l'amministratore quelli che amministra. */
export function canSee(b: Building, u: User): boolean {
  return u.role === "amministratore" ? b.adminId === u.id : b.maintainerOrgId === u.orgId;
}

function asTech(u: User): User {
  if (u.role !== "termotecnico") throw new ServiceError(403, "Questa sezione è per la ditta di manutenzione.");
  return u;
}

function asAdmin(u: User): User {
  if (u.role !== "amministratore") throw new ServiceError(403, "Questa sezione è per l'amministratore.");
  return u;
}

function run<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ActionError) throw new ServiceError(400, e.message);
    throw e;
  }
}

function sortWork(a: WorkRow, b: WorkRow): number {
  const order = { in_corso: 0, da_assegnare: 1, assegnato: 2, fatto: 3 } as const;
  return (
    order[a.work.status] - order[b.work.status] ||
    (a.work.scheduledFor ?? a.work.createdAt).localeCompare(b.work.scheduledFor ?? b.work.createdAt)
  );
}

/* ---------------- letture ---------------- */

export function queries({ ds, user, now, live = simulatedLive }: Ctx) {
  const buildingOfPlant = (plantId: string): Building => {
    const b = ds.buildings.find((x) => x.plantId === plantId);
    if (!b) throw new ServiceError(404, "Condominio non trovato.");
    return b;
  };
  const guard = (b: Building) => {
    if (!canSee(b, user)) throw new ServiceError(403, "Non hai accesso a questo condominio.");
  };
  const workRow = (w: WorkOrder): WorkRow => ({
    work: w,
    building: ds.buildings.find((b) => b.id === w.buildingId)!,
    technician: w.technicianId ? ds.technicians.find((t) => t.id === w.technicianId) : undefined,
  });
  const quoteRow = (q: Quote): QuoteRow => ({
    quote: q,
    building: ds.buildings.find((b) => b.id === q.buildingId)!,
    maintainer: ds.orgs.find((o) => o.id === q.orgId)!,
    total: quoteTotal(q),
  });
  const view = (plantId: string) => plantView(ds, plantId, now, live);

  return {
    me(): Me {
      return { user, org: ds.orgs.find((o) => o.id === user.orgId)! };
    },

    /* ditta */

    fleet(): FleetData {
      const u = asTech(user);
      return {
        views: fleet(ds, u.orgId, now, live),
        preSeason: preSeason(ds, u.orgId, now),
        openWork: ds.workOrders.filter((w) => w.orgId === u.orgId && isOpenWork(w)).map(workRow).sort(sortWork),
        pendingQuotes: ds.quotes.filter((q) => q.orgId === u.orgId && q.status === "in_attesa").length,
      };
    },

    plant(id: string): PlantDetail {
      const b = buildingOfPlant(id);
      guard(b);
      return {
        view: view(id),
        history: ds.workOrders
          .filter((w) => w.plantId === id)
          .map(workRow)
          .sort((a, c) => (c.work.closedAt ?? c.work.scheduledFor ?? c.work.createdAt).localeCompare(a.work.closedAt ?? a.work.scheduledFor ?? a.work.createdAt)),
        quotes: ds.quotes.filter((q) => q.plantId === id).map(quoteRow),
        docs: ds.docs.filter((d) => d.buildingId === b.id),
        technicians: ds.technicians.filter((t) => t.orgId === (user.role === "termotecnico" ? user.orgId : b.maintainerOrgId)),
      };
    },

    workOrders(): WorkRow[] {
      const u = asTech(user);
      return ds.workOrders.filter((w) => w.orgId === u.orgId).map(workRow).sort(sortWork);
    },

    workOrder(id: string): WorkDetail {
      const w = ds.workOrders.find((x) => x.id === id);
      if (!w) throw new ServiceError(404, "Intervento non trovato.");
      const row = workRow(w);
      guard(row.building);
      return { ...row, view: view(w.plantId), technicians: ds.technicians.filter((t) => t.orgId === w.orgId) };
    },

    deadlines(): DeadlineRow[] {
      const u = asTech(user);
      const rows: DeadlineRow[] = [];
      for (const b of ds.buildings.filter((x) => x.maintainerOrgId === u.orgId)) {
        const p = ds.plants.find((x) => x.id === b.plantId)!;
        for (const d of deadlinesFor(p, now)) {
          const openWork = ds.workOrders.find((w) => w.plantId === p.id && isOpenWork(w) && w.checkTypes.includes(d.type));
          rows.push({ building: b, deadline: d, openWork });
        }
      }
      const order = { scaduta: 0, da_inviare: 1, in_scadenza: 2, ok: 3 } as const;
      return rows.sort(
        (a, b) => order[a.deadline.status] - order[b.deadline.status] || (a.deadline.daysLeft ?? 1e9) - (b.deadline.daysLeft ?? 1e9),
      );
    },

    /* entrambi */

    quotes(): QuoteRow[] {
      return ds.quotes
        .filter((q) => canSee(ds.buildings.find((b) => b.id === q.buildingId)!, user))
        .sort((a, b) => {
          const pa = a.status === "in_attesa" ? 0 : 1;
          const pb = b.status === "in_attesa" ? 0 : 1;
          return pa - pb || b.createdAt.localeCompare(a.createdAt);
        })
        .map(quoteRow);
    },

    quote(id: string): QuoteDetail {
      const q = ds.quotes.find((x) => x.id === id);
      if (!q) throw new ServiceError(404, "Preventivo non trovato.");
      const row = quoteRow(q);
      guard(row.building);
      return { ...row, view: view(q.plantId) };
    },

    myBuildings(): Building[] {
      return ds.buildings.filter((b) => canSee(b, user)).sort((a, b) => a.name.localeCompare(b.name, "it"));
    },

    /* amministratore */

    adminHome(): AdminHome {
      const u = asAdmin(user);
      const mine = new Set(ds.buildings.filter((b) => b.adminId === u.id).map((b) => b.id));
      return {
        views: adminBuildings(ds, u.id, now, live),
        pendingQuotes: ds.quotes.filter((q) => mine.has(q.buildingId) && q.status === "in_attesa").map(quoteRow),
        legal: legalDue(ds, u.id, now),
        openWork: ds.workOrders.filter((w) => mine.has(w.buildingId) && isOpenWork(w)).map(workRow).sort(sortWork),
      };
    },

    building(id: string): BuildingDetail {
      const b = ds.buildings.find((x) => x.id === id);
      if (!b) throw new ServiceError(404, "Condominio non trovato.");
      guard(b);
      return {
        view: view(b.plantId),
        work: ds.workOrders
          .filter((w) => w.buildingId === id)
          .map(workRow)
          .sort((a, c) => (c.work.closedAt ?? c.work.createdAt).localeCompare(a.work.closedAt ?? a.work.createdAt)),
        quotes: ds.quotes.filter((q) => q.buildingId === id).map(quoteRow),
        docs: ds.docs.filter((d) => d.buildingId === id),
        notices: ds.notices.filter((n) => n.buildingId === id),
        consumption: consumption(ds, b.plantId, now),
        maintainerUsesApp: b.connected,
      };
    },

    notices(): NoticeRow[] {
      const u = asAdmin(user);
      return ds.notices
        .filter((n) => ds.buildings.find((b) => b.id === n.buildingId)?.adminId === u.id)
        .map((n) => ({ notice: n, building: ds.buildings.find((b) => b.id === n.buildingId)! }));
    },
  };
}

/* ---------------- comandi ---------------- */

export function commands({ ds, user, now }: Ctx) {
  const guardPlant = (plantId: string) => {
    const b = ds.buildings.find((x) => x.plantId === plantId);
    if (!b) throw new ServiceError(404, "Condominio non trovato.");
    if (!canSee(b, user)) throw new ServiceError(403, "Non hai accesso a questo condominio.");
  };
  const guardWork = (id: string) => {
    const w = ds.workOrders.find((x) => x.id === id);
    if (!w) throw new ServiceError(404, "Intervento non trovato.");
    if (w.orgId !== user.orgId) throw new ServiceError(403, "Questo intervento è di un'altra ditta.");
  };

  return {
    createWork(input: CreateWorkInput): Result<WorkOrder> {
      asTech(user);
      guardPlant(input.plantId);
      const r = run(() => createWork(ds, input, user.name, now));
      return { ds: r.ds, result: r.work };
    },
    assignWork(id: string, technicianId: string, scheduledFor: string | null): Result<null> {
      asTech(user);
      guardWork(id);
      if (!ds.technicians.some((t) => t.id === technicianId && t.orgId === user.orgId)) throw new ServiceError(400, "Scegli un tecnico della tua ditta.");
      return { ds: run(() => assignWork(ds, id, technicianId, scheduledFor, now)), result: null };
    },
    startWork(id: string): Result<null> {
      asTech(user);
      guardWork(id);
      return { ds: run(() => startWork(ds, id, now)), result: null };
    },
    completeWork(id: string, input: CompleteWorkInput): Result<null> {
      asTech(user);
      guardWork(id);
      return { ds: run(() => completeWork(ds, id, input, now)), result: null };
    },
    reopenWork(id: string): Result<null> {
      asTech(user);
      guardWork(id);
      return { ds: run(() => reopenWork(ds, id, now)), result: null };
    },
    markCadastreSent(plantId: string): Result<null> {
      asTech(user);
      guardPlant(plantId);
      return { ds: markCadastreSent(ds, plantId, now), result: null };
    },
    createQuote(input: CreateQuoteInput): Result<Quote> {
      asTech(user);
      guardPlant(input.plantId);
      const r = run(() => createQuote(ds, input, now));
      return { ds: r.ds, result: r.quote };
    },
    decideQuote(id: string, status: Exclude<QuoteStatus, "in_attesa">, note: string): Result<null> {
      asAdmin(user);
      const q = ds.quotes.find((x) => x.id === id);
      if (!q) throw new ServiceError(404, "Preventivo non trovato.");
      const b = ds.buildings.find((x) => x.id === q.buildingId);
      if (!b || !canSee(b, user)) throw new ServiceError(403, "Non hai accesso a questo condominio.");
      if (q.status !== "in_attesa" && q.status !== "chiarimenti") throw new ServiceError(400, "Hai già risposto a questo preventivo.");
      return { ds: run(() => decideQuote(ds, id, status, note, now)), result: null };
    },
    createNotice(input: CreateNoticeInput): Result<Notice> {
      asAdmin(user);
      const b = ds.buildings.find((x) => x.id === input.buildingId);
      if (!b) throw new ServiceError(404, "Condominio non trovato.");
      if (!canSee(b, user)) throw new ServiceError(403, "Non hai accesso a questo condominio.");
      const r = run(() => createNotice(ds, input, user.id, now));
      return { ds: r.ds, result: r.notice };
    },
  };
}

/* ---------------- cosa salvare ---------------- */

export type Collection = keyof Dataset;

/**
 * Differenze tra due dataset: oggetti nuovi o cambiati, per raccolta.
 * Il server salva solo questi; con dataset piccoli (quelli di una persona) il confronto costa poco.
 */
export function changedEntities(before: Dataset, after: Dataset): { collection: Collection; item: { id: string } }[] {
  const out: { collection: Collection; item: { id: string } }[] = [];
  for (const key of Object.keys(after) as Collection[]) {
    const prev = new Map((before[key] as { id: string }[]).map((x) => [x.id, JSON.stringify(x)]));
    for (const item of after[key] as { id: string }[]) {
      if (prev.get(item.id) !== JSON.stringify(item)) out.push({ collection: key, item });
    }
  }
  return out;
}
