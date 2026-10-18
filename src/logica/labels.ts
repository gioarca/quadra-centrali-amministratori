import type { DocKind, Fuel, GeneratorKind, NoticeChannel, QuoteStatus, WorkKind, WorkStatus } from "./types.ts";
import type { PlantStatus } from "./views.ts";

/** Parole dell'interfaccia in un solo posto: facili da tradurre. */

export const PLANT_STATUS_LABEL: Record<PlantStatus, string> = {
  blocco: "In blocco",
  attenzione: "Da controllare",
  offline: "Non raggiungibile",
  ok: "Funziona",
  non_collegata: "Senza dati dal vivo",
};

/** Per l'amministratore: stesse situazioni, parole di chi non è del mestiere. */
export const PLANT_STATUS_ADMIN: Record<PlantStatus, string> = {
  blocco: "Guasto",
  attenzione: "Da controllare",
  offline: "Nessun dato",
  ok: "Funziona",
  non_collegata: "Ditta non collegata",
};

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  da_assegnare: "Da assegnare",
  assegnato: "Assegnato",
  in_corso: "In corso",
  fatto: "Fatto",
};

export const WORK_KIND_LABEL: Record<WorkKind, string> = {
  guasto: "Guasto",
  manutenzione: "Manutenzione",
  controllo: "Controllo",
  prima_accensione: "Prima accensione",
};

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  in_attesa: "Da decidere",
  approvato: "Approvato",
  assemblea: "In assemblea",
  chiarimenti: "Chiesti chiarimenti",
  rifiutato: "Non approvato",
};

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  libretto: "Libretto di impianto",
  rcee: "Rapporto di controllo (RCEE)",
  cpi: "Antincendio",
  delega: "Delega terzo responsabile",
  conformita: "Dichiarazione di conformità",
  inail: "Pratica INAIL",
  contratto: "Contratto",
  fgas: "Registro F-gas",
};

export const FUEL_LABEL: Record<Fuel, string> = {
  metano: "metano",
  gpl: "GPL",
  gasolio: "gasolio",
  pellet: "pellet",
  elettrico: "elettricità",
  teleriscaldamento: "teleriscaldamento",
};

export const GENERATOR_KIND_LABEL: Record<GeneratorKind, string> = {
  caldaia: "Caldaia",
  pompa_di_calore: "Pompa di calore",
  sottostazione: "Sottostazione di teleriscaldamento",
};

export const CHANNEL_LABEL: Record<NoticeChannel, string> = {
  bacheca: "Foglio per la bacheca",
  email: "Email ai condomini",
  sms: "SMS",
};
