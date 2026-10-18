/**
 * La logica delle centrali: stagioni e orari per zona climatica, scadenze di legge, diagnosi,
 * dati simulati, viste pronte per le schermate e comandi (interventi, preventivi, avvisi).
 * È la stessa del progetto completo (packages/shared), senza la parte che serve solo al server.
 */
export * from "./time.ts";
export * from "./types.ts";
export * from "./season.ts";
export * from "./rules.ts";
export * from "./simulate.ts";
export * from "./diagnosi.ts";
export * from "./views.ts";
export * from "./actions.ts";
export * from "./labels.ts";
export * from "./demo.ts";
export * from "./live.ts";
export * from "./service.ts";

/** Nome provvisorio del prodotto: cambialo qui e ovunque cambia. */
export const APP_NAME = "Quadra";
