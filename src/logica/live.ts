/**
 * Da dove arrivano i dati dal vivo di una centrale.
 *
 * Le viste (elenco centrali, scheda, portale) chiedono i dati a un "fornitore".
 * In questa demo `simulatedLive` simula nel browser le ultime 24 ore e fa la diagnosi.
 * Nel progetto completo un secondo fornitore usa i dati salvati dal modulo in centrale.
 */
import { diagnose, type Finding } from "./diagnosi.ts";
import { simulate, type Telemetry } from "./simulate.ts";
import type { Building, Plant } from "./types.ts";

export interface Live {
  telemetry: Telemetry;
  findings: Finding[];
}

export type LiveProvider = (plant: Plant, building: Building, now: Date) => Live;

const telemetryCache = new Map<string, Telemetry>();

/** I dati cambiano ogni 10 minuti: si ricalcolano solo quando cambia il blocco o lo scenario. */
function cachedTelemetry(plant: Plant, building: Building, now: Date): Telemetry {
  const bucket = Math.floor(now.getTime() / 600_000);
  const key = `${plant.id}:${bucket}:${JSON.stringify(plant.scenarios)}:${plant.schedule.from}-${plant.schedule.to}:${building.connected}`;
  let t = telemetryCache.get(key);
  if (!t) {
    t = simulate(plant, building, now);
    if (telemetryCache.size > 200) telemetryCache.clear();
    telemetryCache.set(key, t);
  }
  return t;
}

export const simulatedLive: LiveProvider = (plant, building, now) => {
  const telemetry = cachedTelemetry(plant, building, now);
  return { telemetry, findings: building.connected ? diagnose(plant, telemetry, now) : [] };
};
