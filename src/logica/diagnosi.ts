/**
 * Diagnosi automatica: regole semplici, spiegabili a voce, sui dati delle ultime 24 ore.
 * Ogni regola dice cosa vede, da quando e cosa conviene controllare.
 * Niente "intelligenza" opaca: un termotecnico deve poter dire "sì, ha ragione".
 */
import { dayKey, toDate, type DateLike } from "./time.ts";
import { seasonInfo } from "./season.ts";
import { cyclesPerHour, STEP_MIN, type Telemetry, type TelemetryPoint } from "./simulate.ts";
import type { Plant } from "./types.ts";

export type Severity = "blocco" | "attenzione" | "consiglio";

export type FindingRule =
  | "offline"
  | "blocco"
  | "pressione_bassa"
  | "pressione_in_calo"
  | "sotto_temperatura"
  | "circolazione"
  | "cicli"
  | "ore_oltre_limite"
  | "acs_bassa"
  | "non_condensa";

export interface Finding {
  rule: FindingRule;
  severity: Severity;
  title: string;
  /** Cosa si vede nei dati, con i numeri */
  detail: string;
  /** Cosa conviene controllare sul posto */
  check: string;
  since: string | null;
}

/** Dopo quanti minuti senza dati la centrale è "non raggiungibile". */
export const OFFLINE_AFTER_MIN = 20;

const fmt = (n: number, digits = 1) => n.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const last = (pts: TelemetryPoint[], minutes: number) => pts.slice(-Math.max(1, Math.round(minutes / STEP_MIN)));

function durationIt(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} minuti`;
  const h = Math.round(minutes / 60);
  if (h < 48) return h === 1 ? "un'ora" : `${h} ore`;
  return `${Math.round(h / 24)} giorni`;
}

/** Primo istante, andando a ritroso, da cui la condizione è vera senza interruzioni. */
function sinceWhen(pts: TelemetryPoint[], cond: (p: TelemetryPoint) => boolean): string | null {
  let i = pts.length - 1;
  if (i < 0 || !cond(pts[i]!)) return null;
  while (i > 0 && cond(pts[i - 1]!)) i--;
  return new Date(pts[i]!.t).toISOString();
}

export function diagnose(plant: Plant, tel: Telemetry, now: DateLike = new Date()): Finding[] {
  const findings: Finding[] = [];
  const t = toDate(now).getTime();

  if (tel.lastSeenAt) {
    const silent = (t - Date.parse(tel.lastSeenAt)) / 60_000;
    if (silent > OFFLINE_AFTER_MIN) {
      findings.push({
        rule: "offline",
        severity: "attenzione",
        title: "La centrale non manda dati",
        detail: `Nessun dato da ${durationIt(silent)}. Finché non torna in linea, gli allarmi di questa centrale non arrivano.`,
        check: "Corrente al quadro della centrale, router o gateway acceso, segnale 4G e SIM attiva.",
        since: tel.lastSeenAt,
      });
      return findings; // i dati vecchi non dicono com'è la centrale adesso
    }
  }

  const pts = tel.points;
  const now1 = pts[pts.length - 1];
  if (!now1) return findings;

  // Blocco di un generatore
  const blocked = tel.generators.find((g) => g.state === "blocco");
  if (blocked) {
    const others = tel.generators.filter((g) => g.id !== blocked.id && g.state === "acceso");
    const covering = others.length
      ? ` ${others.map((o) => o.label).join(" e ")} sta lavorando da sola.`
      : " Nessun altro generatore sta lavorando.";
    const season = seasonInfo(plant.zona, now);
    const temps =
      now1.heating && now1.target !== null
        ? ` Mandata a ${fmt(now1.supply)} °C, la curva ne chiede ${fmt(now1.target)}.`
        : now1.dhw !== null
          ? ` Acqua calda a ${fmt(now1.dhw)} °C.`
          : "";
    const when =
      !season.active && season.daysToStart !== null && season.daysToStart <= 30
        ? ` Il riscaldamento si accende tra ${season.daysToStart === 1 ? "un giorno" : `${season.daysToStart} giorni`}.`
        : "";
    findings.push({
      rule: "blocco",
      severity: "blocco",
      title: `${blocked.label} in blocco`,
      detail: `Codice ${blocked.code ?? "di blocco"}: mancata accensione del bruciatore.${covering}${temps}${when}`,
      check: "Gas al bruciatore, elettrodo di accensione e di rilevazione fiamma, scarico condensa, ventilatore.",
      since: sinceWhen(pts, (p) => p.lockout),
    });
  }

  // Pressione
  const p0 = pts[0]!.pressure;
  const p1 = now1.pressure;
  if (p1 < 0.8) {
    findings.push({
      rule: "pressione_bassa",
      severity: "blocco",
      title: "Pressione troppo bassa",
      detail: `L'impianto è a ${fmt(p1, 2)} bar: sotto 0,8 bar le caldaie vanno in sicurezza.`,
      check: "Perdite visibili, valvola di sicurezza, vaso di espansione, carico dell'impianto.",
      since: sinceWhen(pts, (p) => p.pressure < 0.8),
    });
  } else if (p0 - p1 >= 0.3 || p1 < 1.1) {
    findings.push({
      rule: "pressione_in_calo",
      severity: "attenzione",
      title: "Pressione in calo",
      detail: `Da ${fmt(p0, 2)} a ${fmt(p1, 2)} bar nelle ultime 24 ore, senza reintegri. Di questo passo domani l'impianto va in sicurezza.`,
      check: "Perdite su radiatori e valvole, valvola di sicurezza che scarica, precarica del vaso di espansione.",
      since: new Date(pts[0]!.t).toISOString(),
    });
  }

  // Temperatura non raggiunta (se non è già spiegata da un blocco)
  const lastHour = last(pts, 60).filter((p) => p.heating && p.target !== null);
  if (!blocked && lastHour.length >= 4) {
    const gap = avg(lastHour.map((p) => p.target! - p.supply));
    if (gap > 6) {
      findings.push({
        rule: "sotto_temperatura",
        severity: "attenzione",
        title: "La centrale non tiene la temperatura",
        detail: `Nell'ultima ora la mandata è rimasta in media ${fmt(gap)} °C sotto quella chiesta dalla curva.`,
        check: "Potenza dei generatori, sonda di mandata, valvola miscelatrice, aria nell'impianto.",
        since: sinceWhen(pts, (p) => p.heating && p.target !== null && p.target - p.supply > 6),
      });
    }
  }

  // Circolazione
  const twoHours = last(pts, 120).filter((p) => p.pump && p.burner > 0);
  if (twoHours.length >= 9) {
    const dt = avg(twoHours.map((p) => p.supply - p.return));
    if (dt < 4) {
      findings.push({
        rule: "circolazione",
        severity: "attenzione",
        title: "L'acqua gira poco nell'impianto",
        detail: `Mandata e ritorno differiscono di soli ${fmt(dt)} °C da almeno 2 ore: il calore non arriva agli appartamenti.`,
        check: "Pompa del circuito, valvole di zona chiuse, filtro defangatore intasato, aria nelle colonne.",
        since: sinceWhen(pts, (p) => p.pump && p.burner > 0 && p.supply - p.return < 4),
      });
    }
  }

  // Accensioni troppo frequenti
  const cph = cyclesPerHour(pts, 3);
  if (cph > 6) {
    findings.push({
      rule: "cicli",
      severity: "attenzione",
      title: "Il bruciatore si accende troppe volte",
      detail: `${fmt(cph)} accensioni all'ora nelle ultime 3 ore. Ogni accensione consuma e sporca: l'ideale è restare sotto le 3.`,
      check: "Potenza minima di modulazione, differenziale della regolazione, portata della pompa.",
      since: null,
    });
  }

  // Ore di riscaldamento oltre il limite della zona (DPR 74/2013)
  const season = seasonInfo(plant.zona, now);
  if (season.maxHours !== null) {
    const today = dayKey(new Date(t));
    const hoursOn = (pts.filter((p) => p.heating && dayKey(new Date(p.t)) === today).length * STEP_MIN) / 60;
    const scheduled = plant.schedule.to - plant.schedule.from;
    if (season.active && scheduled > season.maxHours) {
      findings.push({
        rule: "ore_oltre_limite",
        severity: "attenzione",
        title: "Orario oltre il limite di legge",
        detail: `La regolazione accende il riscaldamento ${scheduled} ore al giorno (dalle ${plant.schedule.from} alle ${plant.schedule.to}); in zona ${plant.zona} il massimo è ${season.maxHours}. Oggi finora: ${fmt(hoursOn)} ore.`,
        check: "Orario impostato sulla centralina di regolazione.",
        since: null,
      });
    }
  }

  // Acqua calda sanitaria
  const dhwHour = last(pts, 60).filter((p) => p.dhw !== null);
  if (dhwHour.length >= 4) {
    const v = avg(dhwHour.map((p) => p.dhw!));
    if (v < 45) {
      findings.push({
        rule: "acs_bassa",
        severity: "attenzione",
        title: "Acqua calda sotto i 45 °C",
        detail: `Nell'ultima ora il bollitore è rimasto in media a ${fmt(v)} °C. Sotto i 50 °C cresce anche il rischio legionella.`,
        check: "Scambiatore del bollitore, valvola deviatrice, pompa di carico, ricircolo.",
        since: sinceWhen(pts, (p) => p.dhw !== null && p.dhw < 45),
      });
    }
  }

  // Condensazione (consiglio di efficienza)
  const condensing = plant.generators.some((g) => g.kind === "caldaia" && g.condensing);
  const sixHours = last(pts, 360).filter((p) => p.heating && p.burner > 0);
  if (condensing && sixHours.length >= 12) {
    const r = avg(sixHours.map((p) => p.return));
    if (r > 55) {
      findings.push({
        rule: "non_condensa",
        severity: "consiglio",
        title: "La caldaia non condensa",
        detail: `Il ritorno è in media a ${fmt(r)} °C: sopra i 55 °C una caldaia a condensazione rende come una tradizionale. La mandata sembra fissa invece di seguire la temperatura esterna.`,
        check: "Attivare la curva climatica o abbassare la temperatura massima di mandata.",
        since: null,
      });
    }
  }

  const order: Record<Severity, number> = { blocco: 0, attenzione: 1, consiglio: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}
