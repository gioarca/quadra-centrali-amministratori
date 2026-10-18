/**
 * Dati di esempio per la demo "condomini": una ditta di Treviso che segue 9 centrali
 * e un'amministratrice con 7 condomini affidati a tre ditte diverse.
 * Tutte le date sono relative ad adesso, così la demo è sempre credibile:
 * a ottobre mostra le prove di prima accensione, a gennaio la stagione piena.
 */
import { addMonths, romeAt, type DateLike, toDate } from "./time.ts";
import { seasonInfo } from "./season.ts";
import { checksFor } from "./rules.ts";
import type {
  Building,
  CheckType,
  Dataset,
  Doc,
  Generator,
  Notice,
  Plant,
  Quote,
  Scenario,
  WorkOrder,
} from "./types.ts";

export const DEMO_PERSONAS = {
  termotecnico: "u-mario",
  amministratore: "u-laura",
} as const;

const iso = (d: Date) => d.toISOString();

export function buildCentraliDemo(nowLike: DateLike = new Date()): Dataset {
  const now = toDate(nowLike);
  const minAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const monthsAgo = (m: number, extraDays = 0) => new Date(addMonths(now, -m).getTime() - extraDays * 86_400_000);
  const yearsAgo = (y: number) => addMonths(now, -12 * y);

  /* ---------------- persone e organizzazioni ---------------- */

  const orgs: Dataset["orgs"] = [
    { id: "o-rossetto", kind: "manutenzione", name: "Rossetto Impianti", city: "Treviso", phone: "+39 0422 000 0101", email: "ufficio@rossettoimpianti.example" },
    { id: "o-sile", kind: "manutenzione", name: "Termica Sile", city: "Treviso", phone: "+39 0422 000 0202", email: "info@termicasile.example" },
    { id: "o-monti", kind: "manutenzione", name: "Idrotermica Monti", city: "Paese", phone: "+39 0422 000 0303", email: "monti@idrotermica.example" },
    { id: "o-bressan", kind: "amministrazione", name: "Studio Bressan", city: "Treviso", phone: "+39 0422 000 0404", email: "studio@bressan.example" },
    { id: "o-pivetta", kind: "amministrazione", name: "Amministrazioni Pivetta", city: "Treviso", phone: "+39 0422 000 0505", email: "pivetta@amministrazioni.example" },
    { id: "o-doretto", kind: "amministrazione", name: "Studio Doretto", city: "Treviso", phone: "+39 0422 000 0606", email: "doretto@studio.example" },
  ];

  const users: Dataset["users"] = [
    { id: "u-mario", name: "Mario Rossetto", role: "termotecnico", orgId: "o-rossetto", phone: "+39 340 000 0101", email: "mario@rossettoimpianti.example" },
    { id: "u-paolo", name: "Paolo Furlan", role: "termotecnico", orgId: "o-sile", phone: "+39 340 000 0202", email: "paolo@termicasile.example" },
    { id: "u-laura", name: "Laura Bressan", role: "amministratore", orgId: "o-bressan", phone: "+39 340 000 0404", email: "laura@bressan.example" },
    { id: "u-franco", name: "Franco Pivetta", role: "amministratore", orgId: "o-pivetta", phone: "+39 340 000 0505", email: "franco@amministrazioni.example" },
    { id: "u-silvia", name: "Silvia Doretto", role: "amministratore", orgId: "o-doretto", phone: "+39 340 000 0606", email: "silvia@studio.example" },
  ];

  const technicians: Dataset["technicians"] = [
    { id: "t-mario", orgId: "o-rossetto", name: "Mario Rossetto", phone: "+39 340 000 0101", skills: "Caldaie, bruciatori e analisi dei fumi" },
    { id: "t-davide", orgId: "o-rossetto", name: "Davide Zanatta", phone: "+39 340 000 0111", skills: "Caldaie a condensazione e pompe di calore" },
    { id: "t-nicola", orgId: "o-rossetto", name: "Nicola Gatto", phone: "+39 340 000 0122", skills: "Idraulica, pompe e circolazione" },
    { id: "t-paolo", orgId: "o-sile", name: "Paolo Furlan", phone: "+39 340 000 0202", skills: "Caldaie e acqua calda sanitaria" },
  ];

  /* ---------------- condomini e centrali ---------------- */

  const boiler = (id: string, label: string, kw: number, opts: Partial<Generator> = {}): Generator => ({
    id,
    kind: "caldaia",
    label,
    brand: "Riello",
    model: kw > 100 ? "Condexa PRO" : "Family Condens",
    serial: `${id.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${(kw * 731).toString(36).toUpperCase()}`,
    powerKw: kw,
    fuel: "metano",
    condensing: true,
    installedAt: iso(yearsAgo(6)),
    ...opts,
  });

  const heatingCircuit = (pump = "Pompa gemellare elettronica") => ({ id: "c-risc", kind: "riscaldamento" as const, label: "Circuito alloggi", pump });
  const dhwCircuit = (litres = 500) => ({ id: "c-acs", kind: "acs" as const, label: `Acqua calda sanitaria, bollitore da ${litres} litri`, pump: "Pompa di carico bollitore" });
  const gateway = (id: string, years = 2) => ({ id, model: "Gateway 4G con sonde e lettura Modbus", link: "4G" as const, installedAt: iso(yearsAgo(years)) });

  type PlantSpec = Omit<Plant, "checks" | "scenarios" | "curve" | "schedule"> &
    Partial<Pick<Plant, "curve" | "schedule">> & {
      last: Partial<Record<CheckType, Date>>;
      scenario?: { scenario: Scenario; minutesAgo: number; generatorId?: string };
    };

  const plant = (s: PlantSpec): Plant => {
    const { last, scenario, ...rest } = s;
    const checks: Plant["checks"] = {};
    for (const [k, v] of Object.entries(last)) if (v) checks[k as CheckType] = { lastDoneAt: iso(v) };
    return {
      curve: { slope: 1.35, base: 22, max: 70 },
      schedule: { from: 6, to: 20 },
      ...rest,
      checks,
      scenarios: scenario
        ? [{ at: iso(minAgo(scenario.minutesAgo)), scenario: scenario.scenario, generatorId: scenario.generatorId }]
        : [],
    };
  };

  const plants: Plant[] = [
    plant({
      id: "p-betulle",
      buildingId: "b-betulle",
      cadastreCode: "CIRCE TV-0026086-1187",
      zona: "E",
      generators: [boiler("p-betulle-g1", "Caldaia 1", 100), boiler("p-betulle-g2", "Caldaia 2", 100)],
      circuits: [heatingCircuit(), dhwCircuit(800)],
      gateway: gateway("gw-1187"),
      location: "Locale caldaia al piano interrato, ingresso dal cortile",
      access: "Chiave nella cassetta rossa accanto al contatore del gas, codice 2741",
      thirdPartyOrgId: "o-rossetto",
      last: { manutenzione: monthsAgo(10), rcee: monthsAgo(20), cpi: monthsAgo(26), delega: monthsAgo(9), catasto: monthsAgo(20, -5) },
      scenario: { scenario: "blocco_bruciatore", minutesAgo: 95, generatorId: "p-betulle-g1" },
    }),
    plant({
      id: "p-margherita",
      buildingId: "b-margherita",
      cadastreCode: "CIRCE TV-0026086-0942",
      zona: "E",
      generators: [boiler("p-margherita-g1", "Caldaia", 90, { brand: "Vaillant", model: "ecoTEC plus VKK" })],
      circuits: [heatingCircuit("Pompa elettronica"), dhwCircuit(400)],
      gateway: gateway("gw-0942"),
      location: "Centrale termica in copertura, scala B",
      access: "Chiavi dal portiere, signor Gino, dalle 8 alle 12",
      thirdPartyOrgId: "o-rossetto",
      last: { manutenzione: monthsAgo(11, -20), rcee: monthsAgo(30), delega: monthsAgo(9), catasto: monthsAgo(30, -7) },
      scenario: { scenario: "pressione_in_calo", minutesAgo: 26 * 60 },
    }),
    plant({
      id: "p-sanzeno",
      buildingId: "b-sanzeno",
      cadastreCode: "CIRCE TV-0026086-1530",
      zona: "E",
      generators: [boiler("p-sanzeno-g1", "Caldaia 1", 150), boiler("p-sanzeno-g2", "Caldaia 2", 150)],
      circuits: [heatingCircuit(), dhwCircuit(1000)],
      gateway: gateway("gw-1530", 3),
      location: "Centrale termica al piano interrato, box 14",
      access: "Codice del portone 0815, chiave della centrale nel quadro elettrico",
      thirdPartyOrgId: "o-rossetto",
      last: { manutenzione: monthsAgo(9), rcee: monthsAgo(9), cpi: monthsAgo(60, -19), delega: monthsAgo(9), catasto: monthsAgo(9, -6) },
    }),
    plant({
      id: "p-mulini",
      buildingId: "b-mulini",
      cadastreCode: "CIRCE TV-0026086-2011",
      zona: "E",
      generators: [
        {
          id: "p-mulini-g1",
          kind: "pompa_di_calore",
          label: "Pompa di calore",
          brand: "Daikin",
          model: "Altherma 3 H HT",
          serial: "DK-40-77310",
          powerKw: 40,
          fuel: "elettrico",
          condensing: false,
          installedAt: iso(yearsAgo(3)),
          refrigerantCo2eqT: 8.4,
        },
        boiler("p-mulini-g2", "Caldaia di integrazione", 60),
      ],
      circuits: [heatingCircuit("Pompa elettronica")],
      gateway: gateway("gw-2011"),
      location: "Pompa di calore in cortile, caldaia nel locale tecnico al piano terra",
      access: "Cancello carraio con codice 4410",
      thirdPartyOrgId: "o-rossetto",
      curve: { slope: 0.9, base: 24, max: 55 },
      last: { manutenzione: monthsAgo(8), rcee: monthsAgo(14), fgas: monthsAgo(13), delega: monthsAgo(9), catasto: monthsAgo(14, -4) },
    }),
    plant({
      id: "p-dolomiti",
      buildingId: "b-dolomiti",
      cadastreCode: "CIRCE BL-0025006-0311",
      zona: "F",
      generators: [boiler("p-dolomiti-g1", "Caldaia", 150, { brand: "Viessmann", model: "Vitocrossal 100" })],
      circuits: [heatingCircuit(), dhwCircuit(600)],
      gateway: gateway("gw-0311"),
      location: "Centrale al piano seminterrato, accesso dal garage",
      access: "Telecomando del garage nella cassetta chiavi della ditta",
      thirdPartyOrgId: "o-rossetto",
      schedule: { from: 5, to: 22 },
      last: { manutenzione: monthsAgo(4), rcee: monthsAgo(4), cpi: monthsAgo(30), delega: monthsAgo(9), catasto: monthsAgo(4, -3) },
      scenario: { scenario: "circolazione_scarsa", minutesAgo: 190 },
    }),
    plant({
      id: "p-querce",
      buildingId: "b-querce",
      cadastreCode: "CIRCE TV-0026086-0877",
      zona: "E",
      generators: [boiler("p-querce-g1", "Caldaia", 120)],
      circuits: [heatingCircuit(), dhwCircuit(500)],
      gateway: gateway("gw-0877"),
      location: "Locale caldaia nel cortile interno",
      access: "Chiave dal condomino dell'interno 2, signora Bortoluzzi",
      thirdPartyOrgId: "o-rossetto",
      last: { manutenzione: monthsAgo(10), rcee: monthsAgo(10), cpi: monthsAgo(40), delega: monthsAgo(9), catasto: monthsAgo(10, -5) },
      scenario: { scenario: "offline", minutesAgo: 190 },
    }),
    plant({
      id: "p-cavour",
      buildingId: "b-cavour",
      cadastreCode: "CIRCE TV-0026086-0215",
      zona: "E",
      generators: [
        boiler("p-cavour-g1", "Caldaia a gasolio", 80, {
          brand: "Ferroli",
          model: "GN1 con bruciatore Sun G",
          fuel: "gasolio",
          condensing: false,
          installedAt: iso(yearsAgo(22)),
        }),
      ],
      circuits: [heatingCircuit("Pompa a tre velocità")],
      gateway: gateway("gw-0215", 1),
      location: "Cantina, porta in ferro in fondo al corridoio",
      access: "Chiave dall'amministratrice o dalla ditta",
      thirdPartyOrgId: "o-rossetto",
      curve: { slope: 1.5, base: 25, max: 78 },
      last: { manutenzione: monthsAgo(13), rcee: monthsAgo(26), delega: monthsAgo(9), catasto: monthsAgo(26, -10) },
    }),
    plant({
      id: "p-santabona",
      buildingId: "b-santabona",
      cadastreCode: "CIRCE TV-0026086-1702",
      zona: "E",
      generators: [boiler("p-santabona-g1", "Caldaia", 95)],
      circuits: [heatingCircuit("Pompa elettronica"), dhwCircuit(400)],
      gateway: gateway("gw-1702"),
      location: "Sottotetto, scala A",
      access: "Chiave nella cassetta della ditta, codice 1702",
      thirdPartyOrgId: "o-rossetto",
      last: { manutenzione: monthsAgo(7), rcee: monthsAgo(31), delega: monthsAgo(9), catasto: monthsAgo(31, -6) },
      scenario: { scenario: "non_condensa", minutesAgo: 60 * 24 * 20 },
    }),
    plant({
      id: "p-riviera",
      buildingId: "b-riviera",
      cadastreCode: "CIRCE TV-0026086-1311",
      zona: "E",
      generators: [boiler("p-riviera-g1", "Caldaia", 110)],
      circuits: [heatingCircuit(), dhwCircuit(500)],
      gateway: gateway("gw-1311"),
      location: "Piano terra, porta accanto ai garage",
      access: "Codice del portone 3318",
      thirdPartyOrgId: "o-rossetto",
      schedule: { from: 5, to: 21 },
      last: { manutenzione: monthsAgo(6), rcee: monthsAgo(6), delega: monthsAgo(9), catasto: monthsAgo(6, -4) },
      scenario: { scenario: "cicli_frequenti", minutesAgo: 5 * 60 },
    }),
    plant({
      id: "p-glicine",
      buildingId: "b-glicine",
      cadastreCode: "CIRCE TV-0026086-1904",
      zona: "E",
      generators: [boiler("p-glicine-g1", "Caldaia", 85, { brand: "Baxi", model: "Power HT+" })],
      circuits: [heatingCircuit("Pompa elettronica"), dhwCircuit(300)],
      gateway: gateway("gw-1904"),
      location: "Locale tecnico al piano terra",
      access: "Chiave dalla ditta",
      thirdPartyOrgId: "o-sile",
      last: { manutenzione: monthsAgo(5), rcee: monthsAgo(17), delega: monthsAgo(4), catasto: monthsAgo(17, -6) },
      scenario: { scenario: "acs_bassa", minutesAgo: 140 },
    }),
    plant({
      id: "p-fiera",
      buildingId: "b-fiera",
      cadastreCode: "CIRCE TV-0026086-0460",
      zona: "E",
      generators: [boiler("p-fiera-g1", "Caldaia", 70, { brand: "Immergas", model: "Victrix Pro", installedAt: iso(yearsAgo(11)) })],
      circuits: [heatingCircuit("Pompa elettronica")],
      gateway: null,
      location: "Cantina",
      access: "Chiave dalla ditta",
      thirdPartyOrgId: null,
      last: { manutenzione: monthsAgo(11), rcee: monthsAgo(47), catasto: monthsAgo(47, -8) },
    }),
  ];

  const nextAssembly = romeAt(now, 24, 18);
  const buildings: Building[] = [
    { id: "b-betulle", name: "Condominio Le Betulle", address: "Via Feltrina 112", city: "Treviso", units: 24, adminId: "u-laura", maintainerOrgId: "o-rossetto", plantId: "p-betulle", connected: true },
    { id: "b-margherita", name: "Condominio Villa Margherita", address: "Viale della Repubblica 45", city: "Treviso", units: 16, adminId: "u-laura", maintainerOrgId: "o-rossetto", plantId: "p-margherita", connected: true },
    { id: "b-sanzeno", name: "Residenza San Zeno", address: "Via San Zeno 8", city: "Treviso", units: 32, adminId: "u-laura", maintainerOrgId: "o-rossetto", plantId: "p-sanzeno", connected: true },
    { id: "b-mulini", name: "Condominio Ai Mulini", address: "Vicolo dei Mulini 3", city: "Treviso", units: 12, adminId: "u-laura", maintainerOrgId: "o-rossetto", plantId: "p-mulini", connected: true },
    { id: "b-dolomiti", name: "Condominio Dolomiti", address: "Via Vittorio Veneto 120", city: "Belluno", units: 20, adminId: "u-franco", maintainerOrgId: "o-rossetto", plantId: "p-dolomiti", connected: true },
    { id: "b-querce", name: "Condominio Le Querce", address: "Via Noalese 76", city: "Treviso", units: 18, adminId: "u-silvia", maintainerOrgId: "o-rossetto", plantId: "p-querce", connected: true },
    { id: "b-cavour", name: "Condominio Borgo Cavour", address: "Borgo Cavour 21", city: "Treviso", units: 10, adminId: "u-laura", maintainerOrgId: "o-rossetto", plantId: "p-cavour", connected: true, nextAssemblyAt: iso(nextAssembly) },
    { id: "b-santabona", name: "Condominio Santa Bona", address: "Via Santa Bona Vecchia 30", city: "Treviso", units: 14, adminId: "u-silvia", maintainerOrgId: "o-rossetto", plantId: "p-santabona", connected: true },
    { id: "b-riviera", name: "Condominio Riviera", address: "Riviera Santa Margherita 18", city: "Treviso", units: 22, adminId: "u-franco", maintainerOrgId: "o-rossetto", plantId: "p-riviera", connected: true },
    { id: "b-glicine", name: "Condominio Il Glicine", address: "Via Sant'Antonino 210", city: "Treviso", units: 15, adminId: "u-laura", maintainerOrgId: "o-sile", plantId: "p-glicine", connected: true },
    { id: "b-fiera", name: "Condominio Fiera", address: "Via Fiera 15", city: "Treviso", units: 9, adminId: "u-laura", maintainerOrgId: "o-monti", plantId: "p-fiera", connected: false },
  ];

  /* ---------------- interventi ---------------- */

  let seq = 400;
  const wo = (w: Partial<WorkOrder> & Pick<WorkOrder, "plantId" | "kind" | "title" | "status">): WorkOrder => {
    const p = plants.find((x) => x.id === w.plantId)!;
    const b = buildings.find((x) => x.plantId === p.id)!;
    seq += 1;
    return {
      id: w.id ?? `w-${seq}`,
      number: `INT-${seq}`,
      buildingId: b.id,
      orgId: b.maintainerOrgId,
      description: "",
      technicianId: null,
      createdAt: iso(minAgo(60)),
      scheduledFor: null,
      startedAt: null,
      closedAt: null,
      checkTypes: [],
      fromFinding: null,
      notes: "",
      cost: null,
      photos: [],
      events: [],
      ...w,
    };
  };

  const ev = (d: Date, text: string) => ({ at: iso(d), text });

  const workOrders: WorkOrder[] = [
    wo({
      id: "w-betulle-blocco",
      plantId: "p-betulle",
      kind: "guasto",
      title: "Caldaia 1 in blocco",
      description:
        "Blocco con codice E01 (mancata accensione). La caldaia 2 copre da sola l'acqua calda. Controllare elettrodo di accensione e rilevazione fiamma prima dell'avvio del riscaldamento.",
      status: "in_corso",
      technicianId: "t-davide",
      createdAt: iso(minAgo(88)),
      scheduledFor: iso(minAgo(60)),
      startedAt: iso(minAgo(22)),
      fromFinding: "blocco",
      events: [ev(minAgo(95), "Allarme dal gateway: caldaia 1 in blocco"), ev(minAgo(88), "Intervento aperto da Mario Rossetto"), ev(minAgo(86), "Assegnato a Davide Zanatta"), ev(minAgo(22), "Davide Zanatta è arrivato in centrale")],
    }),
    wo({
      id: "w-dolomiti-circolazione",
      plantId: "p-dolomiti",
      kind: "guasto",
      title: "L'acqua gira poco nel circuito alloggi",
      description: "Differenza mandata e ritorno sotto i 4 °C da ore. Verificare pompa gemellare, filtro defangatore e valvole di colonna.",
      status: "assegnato",
      technicianId: "t-nicola",
      createdAt: iso(minAgo(150)),
      scheduledFor: iso(new Date(now.getTime() + 100 * 60_000)),
      fromFinding: "circolazione",
      events: [ev(minAgo(170), "Allarme dalla diagnosi automatica"), ev(minAgo(150), "Intervento aperto da Mario Rossetto"), ev(minAgo(148), "Assegnato a Nicola Gatto")],
    }),
    wo({
      id: "w-margherita-pressione",
      plantId: "p-margherita",
      kind: "guasto",
      title: "Pressione in calo: cercare la perdita",
      description: "In 24 ore la pressione è scesa di oltre mezzo bar senza reintegri.",
      status: "da_assegnare",
      createdAt: iso(minAgo(35)),
      fromFinding: "pressione_in_calo",
      events: [ev(minAgo(40), "Allarme dalla diagnosi automatica"), ev(minAgo(35), "Intervento aperto da Mario Rossetto")],
    }),
    wo({
      id: "w-glicine-acs",
      plantId: "p-glicine",
      kind: "guasto",
      title: "Acqua calda tiepida",
      description: "Bollitore sotto i 45 °C da più di due ore.",
      status: "assegnato",
      technicianId: "t-paolo",
      createdAt: iso(minAgo(110)),
      scheduledFor: iso(new Date(now.getTime() + 50 * 60_000)),
      fromFinding: "acs_bassa",
      events: [ev(minAgo(130), "Allarme dalla diagnosi automatica"), ev(minAgo(110), "Intervento aperto da Paolo Furlan")],
    }),
  ];

  // Controllo di efficienza scaduto (con la prova di accensione, se siamo prima della stagione)
  const seasonE = seasonInfo("E", now);
  const preSeason = !seasonE.active && seasonE.daysToStart !== null && seasonE.daysToStart <= 30;
  workOrders.push(
    wo({
      id: "w-cavour-rcee",
      plantId: "p-cavour",
      kind: "controllo",
      title: "Controllo di efficienza energetica scaduto",
      description: "Analisi dei fumi, compilazione RCEE e invio a CIRCE. Caldaia a gasolio del 2004: controllo ogni 2 anni.",
      status: "assegnato",
      technicianId: "t-mario",
      createdAt: iso(minAgo(3 * 24 * 60)),
      scheduledFor: iso(romeAt(now, 1, 9)),
      checkTypes: preSeason ? ["rcee", "manutenzione", "prima_accensione"] : ["rcee", "manutenzione"],
      events: [ev(minAgo(3 * 24 * 60), "Scadenza superata: intervento aperto"), ev(minAgo(3 * 24 * 60 - 10), "Assegnato a Mario Rossetto")],
    }),
  );

  // Prove di prima accensione (zona E)
  if (preSeason || seasonE.active) {
    const done = preSeason ? ["p-sanzeno", "p-santabona", "p-margherita", "p-betulle"] : ["p-sanzeno", "p-santabona", "p-margherita", "p-betulle", "p-mulini", "p-riviera", "p-querce"];
    const upcoming = preSeason ? ["p-mulini", "p-riviera", "p-querce"] : [];
    const startRef = seasonE.active ? seasonE.start! : now;
    done.forEach((pid, i) => {
      const closed = seasonE.active
        ? romeAt(startRef, -(i + 1), 10)
        : romeAt(now, -(done.length - i + 1), 9 + i);
      const techs = ["t-mario", "t-davide", "t-nicola"];
      workOrders.push(
        wo({
          plantId: pid,
          kind: "prima_accensione",
          title: "Prova di prima accensione",
          description: "Accensione di prova prima della stagione: tenuta, sicurezze, regolazione e orario.",
          status: "fatto",
          technicianId: techs[i % 3]!,
          createdAt: iso(new Date(closed.getTime() - 7 * 86_400_000)),
          scheduledFor: iso(closed),
          startedAt: iso(new Date(closed.getTime() - 75 * 60_000)),
          closedAt: iso(closed),
          checkTypes: ["prima_accensione"],
          notes:
            pid === "p-betulle"
              ? "Accensione regolare. Pompa 2 del gruppo gemellare non parte: preparato preventivo per la sostituzione."
              : "Accensione regolare, sicurezze provate, orario impostato.",
          events: [ev(closed, "Prova di prima accensione fatta")],
        }),
      );
      const p = plants.find((x) => x.id === pid)!;
      p.checks.prima_accensione = { lastDoneAt: iso(closed) };
    });
    upcoming.forEach((pid, i) => {
      const when = romeAt(now, Math.min(i + 1, Math.max(1, (seasonE.daysToStart ?? 2) - 1)), 9 + i * 2, 30);
      workOrders.push(
        wo({
          plantId: pid,
          kind: "prima_accensione",
          title: "Prova di prima accensione",
          description: "Accensione di prova prima della stagione: tenuta, sicurezze, regolazione e orario.",
          status: "assegnato",
          technicianId: ["t-davide", "t-nicola", "t-mario"][i]!,
          createdAt: iso(minAgo(6 * 24 * 60)),
          scheduledFor: iso(when),
          checkTypes: ["prima_accensione"],
          events: [ev(minAgo(6 * 24 * 60), "Programmata con le altre prove di accensione")],
        }),
      );
    });
  }

  // Storico chiuso
  workOrders.push(
    wo({
      plantId: "p-sanzeno",
      kind: "controllo",
      title: "Manutenzione annuale e analisi dei fumi",
      status: "fatto",
      technicianId: "t-mario",
      createdAt: iso(monthsAgo(9, 10)),
      scheduledFor: iso(monthsAgo(9)),
      startedAt: iso(monthsAgo(9)),
      closedAt: iso(monthsAgo(9)),
      checkTypes: ["manutenzione", "rcee"],
      notes: "Pulizia scambiatori e bruciatori, analisi fumi regolare su entrambe le caldaie (rendimento 97,8% e 98,1%).",
      cost: 0,
      events: [ev(monthsAgo(9), "Chiuso: controlli registrati")],
    }),
    wo({
      plantId: "p-mulini",
      kind: "guasto",
      title: "Valvola di sicurezza che gocciola",
      status: "fatto",
      technicianId: "t-davide",
      createdAt: iso(monthsAgo(2, 3)),
      scheduledFor: iso(monthsAgo(2, 2)),
      startedAt: iso(monthsAgo(2, 2)),
      closedAt: iso(monthsAgo(2, 2)),
      notes: "Sostituita la valvola di sicurezza da 3 bar sul circuito caldaia.",
      cost: 180,
      events: [ev(monthsAgo(2, 2), "Chiuso: guasto riparato")],
    }),
    wo({
      plantId: "p-betulle",
      kind: "guasto",
      title: "Perdita dal bollitore dell'acqua calda",
      status: "fatto",
      technicianId: "t-nicola",
      createdAt: iso(monthsAgo(5, 4)),
      scheduledFor: iso(monthsAgo(5, 3)),
      startedAt: iso(monthsAgo(5, 3)),
      closedAt: iso(monthsAgo(5, 3)),
      notes: "Sostituita la guarnizione della flangia del bollitore.",
      cost: 240,
      events: [ev(monthsAgo(5, 3), "Chiuso: guasto riparato")],
    }),
    wo({
      plantId: "p-betulle",
      kind: "manutenzione",
      title: "Manutenzione annuale",
      status: "fatto",
      technicianId: "t-mario",
      createdAt: iso(monthsAgo(10, 6)),
      scheduledFor: iso(monthsAgo(10)),
      startedAt: iso(monthsAgo(10)),
      closedAt: iso(monthsAgo(10)),
      checkTypes: ["manutenzione"],
      notes: "Pulizia delle due caldaie, controllo vaso di espansione e sicurezze.",
      cost: 0,
      events: [ev(monthsAgo(10), "Chiuso: controlli registrati")],
    }),
  );

  /* ---------------- preventivi ---------------- */

  const quotes: Quote[] = [
    {
      id: "q-betulle-pompa",
      number: "PRV-118",
      buildingId: "b-betulle",
      plantId: "p-betulle",
      orgId: "o-rossetto",
      title: "Sostituzione della pompa gemellare del circuito alloggi",
      reason:
        "Alla prova di accensione la seconda pompa del gruppo gemellare non è partita. Oggi il riscaldamento funziona con una pompa sola: se si ferma anche quella, il condominio resta al freddo.",
      items: [
        { label: "Pompa gemellare elettronica DN 50", qty: 1, unit: "pezzo", price: 1120 },
        { label: "Manodopera, due tecnici", qty: 6, unit: "ore", price: 40 },
        { label: "Raccordi, guarnizioni e valvole", qty: 1, unit: "a corpo", price: 120 },
      ],
      urgent: true,
      status: "in_attesa",
      createdAt: iso(minAgo(22 * 60)),
      validUntil: iso(romeAt(now, 30, 18)),
      decidedAt: null,
      decisionNote: "",
    },
    {
      id: "q-mulini-fgas",
      number: "PRV-116",
      buildingId: "b-mulini",
      plantId: "p-mulini",
      orgId: "o-rossetto",
      title: "Controllo perdite e ricarica del gas della pompa di calore",
      reason:
        "Il controllo perdite F-gas è scaduto da un mese ed è obbligatorio. La pressione del gas refrigerante è bassa: va cercata la perdita e ricaricato il circuito.",
      items: [
        { label: "Controllo perdite F-gas e registro", qty: 1, unit: "a corpo", price: 120 },
        { label: "Gas refrigerante R410A", qty: 2, unit: "kg", price: 85 },
        { label: "Manodopera", qty: 1.5, unit: "ore", price: 40 },
      ],
      urgent: false,
      status: "in_attesa",
      createdAt: iso(minAgo(3 * 24 * 60)),
      validUntil: iso(romeAt(now, 27, 18)),
      decidedAt: null,
      decisionNote: "",
    },
    {
      id: "q-sanzeno-cpi",
      number: "PRV-112",
      buildingId: "b-sanzeno",
      plantId: "p-sanzeno",
      orgId: "o-rossetto",
      title: "Pratica di rinnovo antincendio della centrale",
      reason: "L'attestazione antincendio della centrale (300 kW) scade tra poche settimane e va rinnovata ai Vigili del Fuoco.",
      items: [
        { label: "Attestazione di rinnovo con asseverazione", qty: 1, unit: "a corpo", price: 450 },
        { label: "Verifica dei dispositivi di sicurezza della centrale", qty: 1, unit: "a corpo", price: 180 },
      ],
      urgent: false,
      status: "approvato",
      createdAt: iso(minAgo(9 * 24 * 60)),
      validUntil: iso(romeAt(now, 21, 18)),
      decidedAt: iso(minAgo(5 * 24 * 60)),
      decisionNote: "Approvato, procedete pure.",
    },
    {
      id: "q-cavour-caldaia",
      number: "PRV-109",
      buildingId: "b-cavour",
      plantId: "p-cavour",
      orgId: "o-rossetto",
      title: "Sostituzione della caldaia a gasolio con una a condensazione a metano",
      reason:
        "La caldaia ha 22 anni, il gasolio costa più del metano e il rendimento è basso. Con la condensazione il consumo scende di circa un quarto (stima della ditta).",
      items: [
        { label: "Caldaia a condensazione 90 kW con regolazione climatica", qty: 1, unit: "pezzo", price: 9800 },
        { label: "Allaccio alla rete del gas e contatore", qty: 1, unit: "a corpo", price: 2400 },
        { label: "Intubamento della canna fumaria", qty: 1, unit: "a corpo", price: 3100 },
        { label: "Smontaggio caldaia e bonifica serbatoio", qty: 1, unit: "a corpo", price: 1600 },
        { label: "Pratiche, collaudo e libretto", qty: 1, unit: "a corpo", price: 1700 },
      ],
      urgent: false,
      status: "assemblea",
      createdAt: iso(minAgo(12 * 24 * 60)),
      validUntil: iso(romeAt(now, 48, 18)),
      decidedAt: iso(minAgo(2 * 24 * 60)),
      decisionNote: "Lavoro straordinario: lo porto in assemblea.",
    },
  ];

  /* ---------------- documenti ---------------- */

  const docs: Doc[] = [];
  let docSeq = 0;
  const doc = (d: Omit<Doc, "id">) => docs.push({ id: `d-${++docSeq}`, ...d });
  for (const b of buildings) {
    const p = plants.find((x) => x.id === b.plantId)!;
    const installed = p.generators[0]!.installedAt;
    const defs = checksFor(p);
    const kw = p.generators.reduce((s, g) => s + g.powerKw, 0);
    doc({ buildingId: b.id, kind: "libretto", title: "Libretto di impianto", issuedAt: p.checks.manutenzione?.lastDoneAt ?? installed, file: "PDF, 12 pagine" });
    if (p.checks.rcee?.lastDoneAt) {
      doc({ buildingId: b.id, kind: "rcee", title: "Rapporto di controllo di efficienza energetica", issuedAt: p.checks.rcee.lastDoneAt, file: "PDF, 2 pagine" });
    }
    if (defs.some((d) => d.type === "cpi") && p.checks.cpi?.lastDoneAt) {
      doc({ buildingId: b.id, kind: "cpi", title: "Attestazione di rinnovo antincendio", issuedAt: p.checks.cpi.lastDoneAt, expiresAt: iso(addMonths(p.checks.cpi.lastDoneAt, 60)), file: "PDF, 3 pagine" });
    }
    if (p.thirdPartyOrgId && p.checks.delega?.lastDoneAt) {
      doc({ buildingId: b.id, kind: "delega", title: "Delega al terzo responsabile", issuedAt: p.checks.delega.lastDoneAt, expiresAt: iso(addMonths(p.checks.delega.lastDoneAt, 12)), file: "PDF, 2 pagine" });
    }
    doc({ buildingId: b.id, kind: "conformita", title: "Dichiarazione di conformità (DM 37/2008)", issuedAt: installed, file: "PDF, 6 pagine" });
    if (kw > 35) doc({ buildingId: b.id, kind: "inail", title: "Denuncia dell'impianto all'INAIL", issuedAt: iso(addMonths(installed, 1)), file: "PDF, 4 pagine" });
    doc({ buildingId: b.id, kind: "contratto", title: "Contratto di manutenzione", issuedAt: iso(monthsAgo(9)), expiresAt: iso(addMonths(monthsAgo(9), 12)), file: "PDF, 5 pagine" });
    if (defs.some((d) => d.type === "fgas")) {
      doc({ buildingId: b.id, kind: "fgas", title: "Registro dell'apparecchiatura F-gas", issuedAt: p.checks.fgas?.lastDoneAt ?? installed, file: "PDF, 2 pagine" });
    }
  }

  /* ---------------- avvisi ---------------- */

  const notices: Notice[] = [
    {
      id: "n-1",
      buildingId: "b-sanzeno",
      authorId: "u-laura",
      title: "Prova di accensione del riscaldamento",
      body: "Gentili condomini, la ditta Rossetto Impianti farà la prova di accensione del riscaldamento. I termosifoni potranno scaldarsi per qualche ora. Non serve fare nulla.",
      channels: ["bacheca", "email"],
      createdAt: iso(minAgo(8 * 24 * 60)),
    },
  ];

  return { orgs, users, technicians, buildings, plants, workOrders, quotes, docs, notices };
}
