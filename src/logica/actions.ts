/**
 * Azioni: ricevono il dataset e restituiscono quello aggiornato.
 * Le stesse funzioni servono alla demo nel browser e, in futuro, all'API.
 */
import { z } from "zod";
import { toDate, type DateLike } from "./time.ts";
import { CHECK_LABEL } from "./rules.ts";
import type { CheckType, Dataset, Notice, Quote, QuoteStatus, RceeValues, WorkKind, WorkOrder } from "./types.ts";

export class ActionError extends Error {}

const iso = (d: DateLike) => toDate(d).toISOString();

function nextNumber(list: { number: string }[], prefix: string): string {
  const max = list.reduce((m, x) => Math.max(m, Number(x.number.replace(/\D/g, "")) || 0), 0);
  return `${prefix}-${max + 1}`;
}

let idSeq = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(++idSeq).toString(36)}`;

function findWork(ds: Dataset, id: string): WorkOrder {
  const w = ds.workOrders.find((x) => x.id === id);
  if (!w) throw new ActionError("Intervento non trovato.");
  return w;
}

/* ---------------- interventi ---------------- */

export const CreateWorkInput = z.object({
  plantId: z.string().min(1, "Scegli la centrale"),
  kind: z.enum(["guasto", "manutenzione", "controllo", "prima_accensione"]),
  title: z.string().trim().min(3, "Scrivi in poche parole cosa c'è da fare").max(120),
  description: z.string().trim().max(2000).default(""),
  technicianId: z.string().nullable().default(null),
  scheduledFor: z.string().nullable().default(null),
  fromFinding: z.string().nullable().default(null),
  checkTypes: z.array(z.string()).default([]),
});
export type CreateWorkInput = z.input<typeof CreateWorkInput>;

export function createWork(ds: Dataset, input: CreateWorkInput, actorName: string, now: DateLike = new Date()): { ds: Dataset; work: WorkOrder } {
  const r = CreateWorkInput.safeParse(input);
  if (!r.success) throw new ActionError(r.error.issues[0]?.message ?? "Controlla i dati.");
  const data = r.data;
  const b = ds.buildings.find((x) => x.plantId === data.plantId);
  if (!b) throw new ActionError("Centrale non trovata.");
  const tech = data.technicianId ? ds.technicians.find((t) => t.id === data.technicianId) : undefined;
  const events = [{ at: iso(now), text: `Intervento aperto da ${actorName}` }];
  if (tech) events.push({ at: iso(now), text: `Assegnato a ${tech.name}` });
  const work: WorkOrder = {
    id: newId("w"),
    number: nextNumber(ds.workOrders, "INT"),
    plantId: data.plantId,
    buildingId: b.id,
    orgId: b.maintainerOrgId,
    kind: data.kind as WorkKind,
    title: data.title,
    description: data.description,
    status: tech ? "assegnato" : "da_assegnare",
    technicianId: tech?.id ?? null,
    createdAt: iso(now),
    scheduledFor: data.scheduledFor,
    startedAt: null,
    closedAt: null,
    checkTypes: data.checkTypes as CheckType[],
    fromFinding: data.fromFinding,
    notes: "",
    cost: null,
    photos: [],
    events,
  };
  return { ds: { ...ds, workOrders: [work, ...ds.workOrders] }, work };
}

export function assignWork(
  ds: Dataset,
  id: string,
  technicianId: string,
  scheduledFor: string | null,
  now: DateLike = new Date(),
): Dataset {
  const w = findWork(ds, id);
  const tech = ds.technicians.find((t) => t.id === technicianId);
  if (!tech) throw new ActionError("Scegli il tecnico.");
  const updated: WorkOrder = {
    ...w,
    technicianId,
    scheduledFor,
    status: w.status === "da_assegnare" ? "assegnato" : w.status,
    events: [...w.events, { at: iso(now), text: `Assegnato a ${tech.name}` }],
  };
  return { ...ds, workOrders: ds.workOrders.map((x) => (x.id === id ? updated : x)) };
}

export function startWork(ds: Dataset, id: string, now: DateLike = new Date()): Dataset {
  const w = findWork(ds, id);
  const tech = ds.technicians.find((t) => t.id === w.technicianId);
  const updated: WorkOrder = {
    ...w,
    status: "in_corso",
    startedAt: iso(now),
    events: [...w.events, { at: iso(now), text: `${tech?.name ?? "Il tecnico"} è arrivato in centrale` }],
  };
  return { ...ds, workOrders: ds.workOrders.map((x) => (x.id === id ? updated : x)) };
}

export interface CompleteWorkInput {
  checksDone: CheckType[];
  rcee?: RceeValues;
  notes?: string;
  cost?: number | null;
  photos?: { id: string; url: string }[];
  /** Il guasto è risolto: la centrale torna a funzionare normalmente */
  fixed: boolean;
}

export function completeWork(ds: Dataset, id: string, input: CompleteWorkInput, now: DateLike = new Date()): Dataset {
  const w = findWork(ds, id);
  if (input.checksDone.includes("rcee") && input.rcee) {
    const { efficiency, coPpm } = input.rcee;
    if (!(efficiency > 50 && efficiency <= 110)) throw new ActionError("Il rendimento deve essere tra 50 e 110%.");
    if (!(coPpm >= 0 && coPpm < 10_000)) throw new ActionError("Il monossido (CO) va scritto in ppm, ad esempio 35.");
  }
  const at = iso(now);
  const plants = ds.plants.map((p) => {
    if (p.id !== w.plantId) return p;
    const checks = { ...p.checks };
    for (const c of input.checksDone) {
      checks[c] = { lastDoneAt: at, ...(c === "rcee" && input.rcee ? { rcee: input.rcee } : {}) };
    }
    const scenarios =
      input.fixed && w.kind === "guasto" ? [...p.scenarios, { at, scenario: "normale" as const }] : p.scenarios;
    const schedule = input.fixed && w.fromFinding === "ore_oltre_limite" ? { from: 6, to: 20 } : p.schedule;
    return { ...p, checks, scenarios, schedule };
  });
  const done = input.checksDone.map((c) => CHECK_LABEL[c].toLowerCase());
  const updated: WorkOrder = {
    ...w,
    status: "fatto",
    startedAt: w.startedAt ?? at,
    closedAt: at,
    checkTypes: input.checksDone.length ? input.checksDone : w.checkTypes,
    notes: input.notes?.trim() ?? "",
    cost: input.cost ?? null,
    photos: input.photos ?? [],
    events: [
      ...w.events,
      {
        at,
        text: done.length
          ? `Chiuso: registrati ${done.join(", ")}`
          : input.fixed
            ? "Chiuso: guasto risolto"
            : "Chiuso: serve un altro intervento",
      },
    ],
  };
  return { ...ds, plants, workOrders: ds.workOrders.map((x) => (x.id === id ? updated : x)) };
}

export function reopenWork(ds: Dataset, id: string, now: DateLike = new Date()): Dataset {
  const w = findWork(ds, id);
  const updated: WorkOrder = {
    ...w,
    status: w.technicianId ? "assegnato" : "da_assegnare",
    closedAt: null,
    events: [...w.events, { at: iso(now), text: "Chiusura annullata" }],
  };
  return { ...ds, workOrders: ds.workOrders.map((x) => (x.id === id ? updated : x)) };
}

/** Rapporto RCEE trasmesso al catasto regionale. */
export function markCadastreSent(ds: Dataset, plantId: string, now: DateLike = new Date()): Dataset {
  return {
    ...ds,
    plants: ds.plants.map((p) => (p.id === plantId ? { ...p, checks: { ...p.checks, catasto: { lastDoneAt: iso(now) } } } : p)),
  };
}

/* ---------------- preventivi ---------------- */

export const CreateQuoteInput = z.object({
  plantId: z.string().min(1, "Scegli il condominio"),
  title: z.string().trim().min(5, "Scrivi che lavoro è, in poche parole").max(140),
  reason: z.string().trim().min(10, "Spiega perché serve: l'amministratore lo leggerà in assemblea").max(1500),
  urgent: z.boolean().default(false),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(2, "Ogni voce ha bisogno di una descrizione"),
        qty: z.number().positive("La quantità deve essere maggiore di zero"),
        unit: z.string().trim().min(1),
        price: z.number().min(0, "Il prezzo non può essere negativo"),
      }),
    )
    .min(1, "Aggiungi almeno una voce"),
});
export type CreateQuoteInput = z.input<typeof CreateQuoteInput>;

export function createQuote(ds: Dataset, input: CreateQuoteInput, now: DateLike = new Date()): { ds: Dataset; quote: Quote } {
  const r = CreateQuoteInput.safeParse(input);
  if (!r.success) throw new ActionError(r.error.issues[0]?.message ?? "Controlla i dati.");
  const b = ds.buildings.find((x) => x.plantId === r.data.plantId);
  if (!b) throw new ActionError("Condominio non trovato.");
  const quote: Quote = {
    id: newId("q"),
    number: nextNumber(ds.quotes, "PRV"),
    buildingId: b.id,
    plantId: r.data.plantId,
    orgId: b.maintainerOrgId,
    title: r.data.title,
    reason: r.data.reason,
    items: r.data.items,
    urgent: r.data.urgent,
    status: "in_attesa",
    createdAt: iso(now),
    validUntil: new Date(toDate(now).getTime() + 30 * 86_400_000).toISOString(),
    decidedAt: null,
    decisionNote: "",
  };
  return { ds: { ...ds, quotes: [quote, ...ds.quotes] }, quote };
}

export function decideQuote(
  ds: Dataset,
  id: string,
  status: Exclude<QuoteStatus, "in_attesa">,
  note: string,
  now: DateLike = new Date(),
): Dataset {
  const q = ds.quotes.find((x) => x.id === id);
  if (!q) throw new ActionError("Preventivo non trovato.");
  if (status === "chiarimenti" && note.trim().length < 5) throw new ActionError("Scrivi cosa vuoi sapere dalla ditta.");
  return {
    ...ds,
    quotes: ds.quotes.map((x) => (x.id === id ? { ...x, status, decidedAt: iso(now), decisionNote: note.trim() } : x)),
  };
}

/* ---------------- avvisi ---------------- */

export const CreateNoticeInput = z.object({
  buildingId: z.string().min(1, "Scegli il condominio"),
  title: z.string().trim().min(3, "Scrivi un titolo").max(90, "Tieni il titolo corto: si legge in bacheca da lontano"),
  body: z.string().trim().min(10, "Scrivi il testo dell'avviso").max(1200),
  channels: z.array(z.enum(["bacheca", "email", "sms"])).min(1, "Scegli almeno un modo per farlo arrivare"),
});
export type CreateNoticeInput = z.input<typeof CreateNoticeInput>;

export function createNotice(ds: Dataset, input: CreateNoticeInput, authorId: string, now: DateLike = new Date()): { ds: Dataset; notice: Notice } {
  const r = CreateNoticeInput.safeParse(input);
  if (!r.success) throw new ActionError(r.error.issues[0]?.message ?? "Controlla i dati.");
  const notice: Notice = { id: newId("n"), authorId, createdAt: iso(now), ...r.data };
  return { ds: { ...ds, notices: [notice, ...ds.notices] }, notice };
}

/** Un SMS lungo costa più messaggi: 160 caratteri l'uno (153 se concatenati). */
export function smsParts(text: string): number {
  if (text.length <= 160) return 1;
  return Math.ceil(text.length / 153);
}
