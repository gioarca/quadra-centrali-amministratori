import type {
  AdminHome,
  Building,
  BuildingDetail,
  CompleteWorkInput,
  CreateNoticeInput,
  CreateQuoteInput,
  CreateWorkInput,
  DeadlineRow,
  FleetData,
  Me,
  Notice,
  NoticeRow,
  PlantDetail,
  Quote,
  QuoteDetail,
  QuoteRow,
  QuoteStatus,
  Role,
  WorkDetail,
  WorkOrder,
  WorkRow,
} from "../logica/index.ts";

// Le forme delle risposte sono quelle del servizio condiviso: demo e server danno gli stessi oggetti.
export type {
  AdminHome,
  BuildingDetail,
  DeadlineRow,
  FleetData,
  Me,
  NoticeRow,
  PlantDetail,
  QuoteDetail,
  QuoteRow,
  WorkDetail,
  WorkRow,
} from "../logica/index.ts";

/** Stesso errore della logica condivisa: stato HTTP + messaggio in italiano. */
export { ServiceError as ApiError } from "../logica/index.ts";

export interface Persona {
  userId: string;
  name: string;
  role: Role;
  title: string;
  description: string;
}

export interface Api {
  /** Con chi si può entrare nella demo */
  personas(): Persona[];
  loginAs(userId: string): Promise<void>;
  logout(): Promise<void>;
  me(): Promise<Me | null>;

  /* ditta */
  fleet(): Promise<FleetData>;
  plant(id: string): Promise<PlantDetail>;
  workOrders(): Promise<WorkRow[]>;
  workOrder(id: string): Promise<WorkDetail>;
  createWork(input: CreateWorkInput): Promise<WorkOrder>;
  assignWork(id: string, technicianId: string, scheduledFor: string | null): Promise<void>;
  startWork(id: string): Promise<void>;
  completeWork(id: string, input: CompleteWorkInput): Promise<void>;
  reopenWork(id: string): Promise<void>;
  markCadastreSent(plantId: string): Promise<void>;
  deadlines(): Promise<DeadlineRow[]>;
  createQuote(input: CreateQuoteInput): Promise<Quote>;

  /* entrambi */
  quotes(): Promise<QuoteRow[]>;
  quote(id: string): Promise<QuoteDetail>;
  myBuildings(): Promise<Building[]>;

  /* amministratore */
  adminHome(): Promise<AdminHome>;
  building(id: string): Promise<BuildingDetail>;
  decideQuote(id: string, status: Exclude<QuoteStatus, "in_attesa">, note: string): Promise<void>;
  notices(): Promise<NoticeRow[]>;
  createNotice(input: CreateNoticeInput): Promise<Notice>;

  /** Foto dell'intervento, già ridotta dal telefono */
  uploadPhoto(file: Blob, name: string): Promise<{ id: string; url: string }>;
}
