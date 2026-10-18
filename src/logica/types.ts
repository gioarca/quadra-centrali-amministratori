/**
 * Quadra per condomini: il modello dati.
 *
 * Chi usa l'app:
 * - la ditta di manutenzione (termotecnico, spesso anche terzo responsabile) segue molte centrali;
 * - l'amministratore vede i suoi condomini, anche se li seguono ditte diverse.
 * L'unità di lavoro è la centrale termica di un condominio.
 */

export type Zona = "A" | "B" | "C" | "D" | "E" | "F";

export type Fuel = "metano" | "gpl" | "gasolio" | "pellet" | "elettrico" | "teleriscaldamento";

export type GeneratorKind = "caldaia" | "pompa_di_calore" | "sottostazione";

export interface Generator {
  id: string;
  kind: GeneratorKind;
  /** "Caldaia 1", "Pompa di calore" */
  label: string;
  brand: string;
  model: string;
  serial: string;
  /** Potenza termica utile nominale, kW */
  powerKw: number;
  fuel: Fuel;
  condensing: boolean;
  installedAt: string;
  /** Solo pompe di calore: carica di refrigerante in tonnellate di CO2 equivalente */
  refrigerantCo2eqT?: number;
}

export type CircuitKind = "riscaldamento" | "acs";

export interface Circuit {
  id: string;
  kind: CircuitKind;
  /** "Circuito alloggi", "Acqua calda sanitaria" */
  label: string;
  pump: string;
}

export interface Gateway {
  id: string;
  model: string;
  /** Collegamento: SIM 4G o rete del condominio */
  link: "4G" | "ethernet";
  installedAt: string;
}

/** Cosa sta succedendo davvero in centrale: guida la simulazione dei dati nella demo. */
export type Scenario =
  | "normale"
  | "blocco_bruciatore"
  | "pressione_in_calo"
  | "circolazione_scarsa"
  | "cicli_frequenti"
  | "non_condensa"
  | "acs_bassa"
  | "offline";

export interface ScenarioChange {
  at: string;
  scenario: Scenario;
  /** Generatore coinvolto, se serve (es. quale caldaia è in blocco) */
  generatorId?: string;
}

export type CheckType = "manutenzione" | "rcee" | "catasto" | "cpi" | "fgas" | "delega" | "prima_accensione";

export interface CheckRecord {
  lastDoneAt?: string;
  /** Solo RCEE: i valori dell'ultima analisi fumi */
  rcee?: RceeValues;
}

export interface RceeValues {
  /** Rendimento di combustione, % */
  efficiency: number;
  /** Monossido nei fumi, ppm */
  coPpm: number;
  /** Ossigeno, % */
  o2: number;
  /** Temperatura fumi, °C */
  fluesTemp: number;
}

export interface Plant {
  id: string;
  buildingId: string;
  /** Codice impianto nel catasto regionale (in Veneto: CIRCE) */
  cadastreCode: string;
  zona: Zona;
  generators: Generator[];
  circuits: Circuit[];
  gateway: Gateway | null;
  /** Orario di accensione del riscaldamento, ore locali */
  schedule: { from: number; to: number };
  /** Curva climatica: mandata = base + pendenza × (20 − esterna) */
  curve: { slope: number; base: number; max: number };
  /** Dove si trova e come si entra */
  location: string;
  access: string;
  checks: Partial<Record<CheckType, CheckRecord>>;
  scenarios: ScenarioChange[];
  /** Ditta che ha la delega di terzo responsabile, se c'è */
  thirdPartyOrgId: string | null;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  units: number;
  /** Amministratore */
  adminId: string;
  /** Ditta di manutenzione */
  maintainerOrgId: string;
  plantId: string;
  /** La ditta usa Quadra? Se no l'amministratore vede solo documenti e scadenze che inserisce lui. */
  connected: boolean;
  /** Prossima assemblea, se fissata */
  nextAssemblyAt?: string;
}

export type OrgKind = "manutenzione" | "amministrazione";

export interface Org {
  id: string;
  kind: OrgKind;
  name: string;
  city: string;
  phone: string;
  email: string;
}

export type Role = "termotecnico" | "amministratore";

export interface User {
  id: string;
  name: string;
  role: Role;
  orgId: string;
  phone: string;
  email: string;
}

export interface Technician {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  /** "Caldaie e bruciatori", "Pompe di calore" */
  skills: string;
}

export type WorkKind = "guasto" | "manutenzione" | "controllo" | "prima_accensione";

export type WorkStatus = "da_assegnare" | "assegnato" | "in_corso" | "fatto";

export interface WorkEvent {
  at: string;
  text: string;
}

export interface Photo {
  id: string;
  url: string;
}

export interface WorkOrder {
  id: string;
  number: string;
  plantId: string;
  buildingId: string;
  orgId: string;
  kind: WorkKind;
  title: string;
  description: string;
  status: WorkStatus;
  technicianId: string | null;
  createdAt: string;
  scheduledFor: string | null;
  startedAt: string | null;
  closedAt: string | null;
  /** Controlli che l'intervento registra (fanno ripartire le scadenze) */
  checkTypes: CheckType[];
  /** Regola di diagnosi che l'ha fatto aprire, se viene da un allarme */
  fromFinding: string | null;
  notes: string;
  cost: number | null;
  photos: Photo[];
  events: WorkEvent[];
}

export type QuoteStatus = "in_attesa" | "approvato" | "assemblea" | "chiarimenti" | "rifiutato";

export interface QuoteItem {
  label: string;
  qty: number;
  unit: string;
  price: number;
}

export interface Quote {
  id: string;
  number: string;
  buildingId: string;
  plantId: string;
  orgId: string;
  title: string;
  reason: string;
  items: QuoteItem[];
  /** Il lavoro non può aspettare l'assemblea */
  urgent: boolean;
  status: QuoteStatus;
  createdAt: string;
  validUntil: string;
  decidedAt: string | null;
  decisionNote: string;
}

export type DocKind =
  | "libretto"
  | "rcee"
  | "cpi"
  | "delega"
  | "conformita"
  | "inail"
  | "contratto"
  | "fgas";

export interface Doc {
  id: string;
  buildingId: string;
  kind: DocKind;
  title: string;
  issuedAt: string;
  expiresAt?: string;
  /** "PDF, 4 pagine" */
  file: string;
}

export type NoticeChannel = "bacheca" | "email" | "sms";

export interface Notice {
  id: string;
  buildingId: string;
  authorId: string;
  title: string;
  body: string;
  channels: NoticeChannel[];
  createdAt: string;
}

export interface Dataset {
  orgs: Org[];
  users: User[];
  technicians: Technician[];
  buildings: Building[];
  plants: Plant[];
  workOrders: WorkOrder[];
  quotes: Quote[];
  docs: Doc[];
  notices: Notice[];
}
