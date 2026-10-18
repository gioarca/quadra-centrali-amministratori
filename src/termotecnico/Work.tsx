import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Camera, CircleCheckBig, Flag, MapPin, Plus, Trash2, Undo2, UserRound, Wrench } from "lucide-react";
import { fmtDate, fmtDayTime, fmtEuro, fmtTime } from "../logica/index.ts";
import {
  CHECK_LABEL,
  WORK_KIND_LABEL,
  checksFor,
  type CheckType,
  type FindingRule,
  type PlantView,
  type Technician,
  type WorkKind,
  type WorkOrder,
} from "../logica/index.ts";
import { api } from "../api/index.ts";
import type { WorkRow } from "../api/types.ts";
import { CheckCard, RadioCards, Select, Step, TextArea, parseItNumber } from "../components/forms.tsx";
import { WorkRowItem, workWhen } from "../components/rows.tsx";
import { useToast } from "../components/Toast.tsx";
import {
  BackLink,
  Button,
  EmptyState,
  ErrorState,
  Fact,
  Field,
  LinkButton,
  Loading,
  PageHeader,
  Panel,
  PlantStatusPill,
  SectionTitle,
  WorkStatusPill,
  inputClass,
} from "../components/ui.tsx";
import { compressPhoto } from "../lib/photos.ts";
import { useAction, useMyBuildings, usePlant, useWorkOrder, useWorkOrders } from "../lib/queries.ts";
import { HowToGetThere } from "./PlantPage.tsx";

const num = (n: number, d = 1) => n.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------------------------------------------------------------------------
 * Elenco
 * ------------------------------------------------------------------------- */

export function WorkList() {
  const q = useWorkOrders();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data;
  const groups: { title: string; rows: WorkRow[]; empty?: string }[] = [
    { title: "In corso", rows: rows.filter((r) => r.work.status === "in_corso") },
    { title: "Da assegnare", rows: rows.filter((r) => r.work.status === "da_assegnare") },
    { title: "In programma", rows: rows.filter((r) => r.work.status === "assegnato") },
    {
      title: "Fatti di recente",
      rows: rows
        .filter((r) => r.work.status === "fatto")
        .sort((a, b) => b.work.closedAt!.localeCompare(a.work.closedAt!))
        .slice(0, 8),
    },
  ];
  return (
    <>
      <PageHeader
        title="Interventi"
        subtitle="Guasti, manutenzioni e controlli di tutte le centrali."
        actions={
          <LinkButton to="/interventi/nuovo" icon={Plus} size="lg">
            Nuovo intervento
          </LinkButton>
        }
      />
      <div className="flex flex-col gap-10">
        {groups
          .filter((g) => g.rows.length)
          .map((g) => (
            <section key={g.title} className="flex flex-col gap-3">
              <SectionTitle count={g.rows.length}>{g.title}</SectionTitle>
              <ul className="grid gap-3 md:grid-cols-2">
                {g.rows.map((r) => (
                  <li key={r.work.id}>
                    <WorkRowItem row={r} showBuilding to={`/interventi/${r.work.id}`} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Quando: poche scelte pronte, più "scegli tu"
 * ------------------------------------------------------------------------- */

type WhenChoice = "dopo" | "oggi" | "domani" | "altro";

function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function whenOptions() {
  const now = new Date();
  const soon = new Date(now);
  soon.setMinutes(0, 0, 0);
  soon.setHours(soon.getHours() + 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 30, 0, 0);
  return { soon, tomorrow };
}

function useWhen(initial: WhenChoice = "dopo") {
  const [choice, setChoice] = useState<WhenChoice>(initial);
  const [custom, setCustom] = useState(() => localInput(whenOptions().tomorrow));
  const { soon, tomorrow } = whenOptions();
  const value: string | null =
    choice === "dopo" ? null : choice === "oggi" ? soon.toISOString() : choice === "domani" ? tomorrow.toISOString() : custom ? new Date(custom).toISOString() : null;
  const field = (
    <div className="flex flex-col gap-3">
      <RadioCards<WhenChoice>
        name="quando"
        legend="Quando"
        value={choice}
        onChange={setChoice}
        columns={4}
        options={[
          { value: "dopo", label: "Lo decido dopo" },
          { value: "oggi", label: "Oggi", detail: `alle ${fmtTime(soon)}` },
          { value: "domani", label: "Domani mattina", detail: `alle ${fmtTime(tomorrow)}` },
          { value: "altro", label: "Scelgo giorno e ora" },
        ]}
      />
      {choice === "altro" && (
        <Field id="quando-altro" label="Giorno e ora">
          <input id="quando-altro" type="datetime-local" className={inputClass} value={custom} onChange={(e) => setCustom(e.target.value)} />
        </Field>
      )}
    </div>
  );
  return { value, field };
}

function TechPicker({ technicians, value, onChange, allowNone = true }: { technicians: Technician[]; value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  return (
    <RadioCards<string>
      name="tecnico"
      legend="Chi ci va"
      value={value}
      onChange={onChange}
      options={[
        ...(allowNone ? [{ value: "", label: "Lo decido dopo", detail: "Resta tra gli interventi da assegnare" }] : []),
        ...technicians.map((t) => ({ value: t.id, label: t.name, detail: t.skills, icon: UserRound })),
      ]}
    />
  );
}

/* ---------------------------------------------------------------------------
 * Nuovo intervento
 * ------------------------------------------------------------------------- */

const KIND_FOR_CHECK: Partial<Record<CheckType, WorkKind>> = {
  manutenzione: "manutenzione",
  prima_accensione: "prima_accensione",
  rcee: "controllo",
  cpi: "controllo",
  fgas: "controllo",
};

function availableChecks(view: PlantView): CheckType[] {
  return [...checksFor(view.plant).map((c) => c.type).filter((t) => t !== "delega"), "prima_accensione"];
}

export function NewWork() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const buildings = useMyBuildings();
  const [plantId, setPlantId] = useState(sp.get("centrale") ?? "");
  const plant = usePlant(plantId);
  const rule = sp.get("regola") as FindingRule | null;
  const control = sp.get("controllo") as CheckType | null;

  const [kind, setKind] = useState<WorkKind | null>(control ? (KIND_FOR_CHECK[control] ?? "controllo") : rule ? "guasto" : null);
  const [title, setTitle] = useState(control ? CHECK_LABEL[control] : "");
  const [description, setDescription] = useState("");
  const [checks, setChecks] = useState<CheckType[]>(control ? [control] : []);
  const [tech, setTech] = useState("");
  const when = useWhen(rule ? "oggi" : "dopo");
  const [error, setError] = useState<string | null>(null);
  const create = useAction(api.createWork);
  const prefilled = useRef(false);

  // Se arriva da un allarme, il testo è già scritto: si corregge, non si ricopia.
  useEffect(() => {
    if (prefilled.current || !plant.data || !rule) return;
    const f = plant.data.view.findings.find((x) => x.rule === rule);
    if (f) {
      setTitle(f.title);
      setDescription(`${f.detail}\n\nDa controllare: ${f.check}`);
      if (f.severity === "consiglio" || f.rule === "ore_oltre_limite") setKind("controllo");
    }
    prefilled.current = true;
  }, [plant.data, rule]);

  const view = plant.data?.view;
  const options = view ? availableChecks(view) : [];

  const pickKind = (k: WorkKind) => {
    setKind(k);
    if (k === "manutenzione") setChecks((c) => (c.includes("manutenzione") ? c : [...c, "manutenzione"]));
    if (k === "prima_accensione") setChecks((c) => (c.includes("prima_accensione") ? c : [...c, "prima_accensione"]));
    if (!title || Object.values(CHECK_LABEL).includes(title) || title === "Manutenzione ordinaria") {
      if (k === "manutenzione") setTitle(CHECK_LABEL.manutenzione);
      if (k === "prima_accensione") setTitle(CHECK_LABEL.prima_accensione);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!plantId) return setError("Scegli la centrale.");
    if (!kind) return setError("Scegli che tipo di intervento è.");
    create.mutate(
      {
        plantId,
        kind,
        title,
        description,
        technicianId: tech || null,
        scheduledFor: when.value,
        fromFinding: rule,
        checkTypes: checks,
      },
      {
        onSuccess: (w) => {
          toast(`Intervento ${w.number} aperto${tech ? " e assegnato" : ""}.`);
          navigate(`/interventi/${w.id}`, { replace: true });
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <>
      <PageHeader back={<BackLink to={plantId ? `/centrali/${plantId}` : "/interventi"}>Indietro</BackLink>} title="Nuovo intervento" />
      <form onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
        <Step n={1} title="Dove e cosa">
          <Field id="centrale" label="Centrale">
            <Select id="centrale" value={plantId} onChange={(e) => setPlantId(e.target.value)}>
              <option value="">Scegli il condominio…</option>
              {buildings.data?.map((b) => (
                <option key={b.id} value={b.plantId}>
                  {b.name}, {b.address}
                </option>
              ))}
            </Select>
          </Field>
          {view && (
            <p className="flex flex-wrap items-center gap-3 text-small">
              <PlantStatusPill status={view.status} />
              <span className="text-ink-2">
                {view.plant.location}. {view.findings[0] ? `Adesso: ${view.findings[0].title.toLowerCase()}.` : ""}
              </span>
            </p>
          )}
          <RadioCards<WorkKind>
            name="tipo"
            legend="Tipo di intervento"
            value={kind}
            onChange={pickKind}
            columns={4}
            options={(["guasto", "manutenzione", "controllo", "prima_accensione"] as const).map((k) => ({ value: k, label: WORK_KIND_LABEL[k] }))}
          />
          <Field id="titolo" label="Cosa c'è da fare, in poche parole">
            <input id="titolo" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </Field>
          <Field id="descrizione" label="Dettagli per il tecnico" hint="Facoltativo. Cosa si vede, cosa portare, chi avvisare.">
            <TextArea id="descrizione" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </Step>

        {view && (
          <Step n={2} title="Controlli da registrare">
            <p className="-mt-2 text-ink-2">Quando chiudi l'intervento, questi controlli ripartono da zero nelle scadenze.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((c) => (
                <CheckCard
                  key={c}
                  label={CHECK_LABEL[c]}
                  checked={checks.includes(c)}
                  onChange={(on) => setChecks((list) => (on ? [...list, c] : list.filter((x) => x !== c)))}
                />
              ))}
            </div>
          </Step>
        )}

        <Step n={view ? 3 : 2} title="Chi e quando">
          {plant.data ? <TechPicker technicians={plant.data.technicians} value={tech} onChange={setTech} /> : <p className="text-ink-2">Scegli prima la centrale.</p>}
          {when.field}
        </Step>

        {error && (
          <p role="alert" className="rounded-xl border-2 border-red bg-red-tint p-4 font-bold text-red-ink">
            {error}
          </p>
        )}
        <Button type="submit" size="xl" icon={Wrench} loading={create.isPending}>
          Apri l'intervento
        </Button>
      </form>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Dettaglio
 * ------------------------------------------------------------------------- */

function AssignBox({ work, technicians, onDone }: { work: WorkOrder; technicians: Technician[]; onDone?: () => void }) {
  const toast = useToast();
  const [tech, setTech] = useState(work.technicianId ?? "");
  const when = useWhen(work.kind === "guasto" ? "oggi" : "domani");
  const assign = useAction(({ id, t, at }: { id: string; t: string; at: string | null }) => api.assignWork(id, t, at));
  return (
    <div className="flex flex-col gap-5">
      <TechPicker technicians={technicians} value={tech} onChange={setTech} allowNone={false} />
      {when.field}
      <Button
        size="xl"
        icon={UserRound}
        disabled={!tech}
        loading={assign.isPending}
        onClick={() =>
          assign.mutate(
            { id: work.id, t: tech, at: when.value },
            {
              onSuccess: () => {
                toast(`Assegnato a ${technicians.find((t) => t.id === tech)?.name}. Riceve un SMS con indirizzo e accesso.`);
                onDone?.();
              },
              onError: (e) => toast(e.message, { tone: "error" }),
            },
          )
        }
      >
        {tech ? `Assegna a ${technicians.find((t) => t.id === tech)?.name}` : "Scegli chi ci va"}
      </Button>
    </div>
  );
}

function NowAtPlant({ view, work }: { view: PlantView; work: WorkOrder }) {
  const p = view.now;
  const related = work.fromFinding ? view.findings.find((f) => f.rule === work.fromFinding) : undefined;
  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3 font-bold">La centrale adesso</h2>
        <PlantStatusPill status={view.status} />
      </div>
      {work.fromFinding && view.status !== "non_collegata" && (
        related ? (
          <p className="font-semibold">
            Il problema è ancora nei dati: {related.title.toLowerCase()}.
          </p>
        ) : (
          <p className="flex items-center gap-2 font-semibold text-green-ink">
            <CircleCheckBig size={20} aria-hidden /> Nei dati il problema non c'è più.
          </p>
        )
      )}
      {p && view.status !== "non_collegata" && (
        <p className="num flex flex-wrap gap-x-5 gap-y-1">
          <span>
            Mandata <strong>{num(p.supply)} °C</strong>
          </span>
          <span>
            Ritorno <strong>{num(p.return)} °C</strong>
          </span>
          <span>
            Pressione <strong>{num(p.pressure, 2)} bar</strong>
          </span>
          {p.dhw !== null && (
            <span>
              Acqua calda <strong>{num(p.dhw)} °C</strong>
            </span>
          )}
        </p>
      )}
      <Link to={`/centrali/${view.plant.id}`} className="inline-flex min-h-12 items-center font-bold underline decoration-2 underline-offset-4">
        Apri schema e grafico della centrale
      </Link>
    </Panel>
  );
}

export function WorkDetail() {
  const { id = "" } = useParams();
  const q = useWorkOrder(id);
  const toast = useToast();
  const [reassign, setReassign] = useState(false);
  const start = useAction((wid: string) => api.startWork(wid));
  const reopen = useAction((wid: string) => api.reopenWork(wid));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { work: w, building, technician, view, technicians } = q.data;

  let action: ReactNode = null;
  if (w.status === "da_assegnare" || reassign) {
    action = (
      <Panel className="flex flex-col gap-4 border-2 border-ink">
        <h2 className="text-h2 font-bold">{reassign ? "Cambia tecnico o giorno" : "Assegna l'intervento"}</h2>
        <AssignBox work={w} technicians={technicians} onDone={() => setReassign(false)} />
        {reassign && (
          <Button variant="quiet" onClick={() => setReassign(false)}>
            Lascia com'è
          </Button>
        )}
      </Panel>
    );
  } else if (w.status === "assegnato") {
    action = (
      <Panel className="flex flex-col gap-4 border-2 border-ink">
        <h2 className="text-h2 font-bold">Quando arrivi in centrale</h2>
        <p className="text-ink-2">Così l'amministratore vede che il tecnico è sul posto.</p>
        <Button
          size="xl"
          icon={MapPin}
          loading={start.isPending}
          onClick={() => start.mutate(w.id, { onSuccess: () => toast("Segnato: sei in centrale."), onError: (e) => toast(e.message, { tone: "error" }) })}
        >
          Sono arrivato in centrale
        </Button>
        <Button variant="quiet" onClick={() => setReassign(true)}>
          Cambia tecnico o giorno
        </Button>
      </Panel>
    );
  } else if (w.status === "in_corso") {
    action = (
      <Panel className="flex flex-col gap-4 border-2 border-ink">
        <h2 className="text-h2 font-bold">Hai finito?</h2>
        <p className="text-ink-2">Segna i controlli fatti, aggiungi le foto e chiudi. Ci vogliono due minuti.</p>
        <LinkButton to={`/interventi/${w.id}/chiudi`} size="xl" icon={Flag}>
          Chiudi l'intervento
        </LinkButton>
      </Panel>
    );
  } else {
    action = (
      <Panel className="flex flex-col gap-4 border-2 border-green">
        <h2 className="flex items-center gap-2 text-h2 font-bold text-green-ink">
          <CircleCheckBig size={28} aria-hidden /> Fatto {w.closedAt ? `il ${fmtDate(w.closedAt)}` : ""}
        </h2>
        {w.checkTypes.length > 0 && (
          <p>
            <strong>Controlli registrati: </strong>
            {w.checkTypes.map((c) => CHECK_LABEL[c].toLowerCase()).join(", ")}.
          </p>
        )}
        {w.notes && <p className="whitespace-pre-line">{w.notes}</p>}
        {w.cost !== null && (
          <p>
            <strong>Costo per il condominio: </strong>
            <span className="num">{fmtEuro(w.cost)}</span>
          </p>
        )}
        {w.photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {w.photos.map((p) => (
              <li key={p.id}>
                <img src={p.url} alt="Foto dell'intervento" className="aspect-square w-full rounded-lg object-cover" />
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button
            variant="quiet"
            icon={Undo2}
            loading={reopen.isPending}
            onClick={() => reopen.mutate(w.id, { onSuccess: () => toast("Chiusura annullata: l'intervento è di nuovo aperto.") })}
          >
            Annulla la chiusura
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/interventi">Interventi</BackLink>}
        title={w.title}
        subtitle={`${w.number} · ${WORK_KIND_LABEL[w.kind]} · ${building.name}`}
        actions={<WorkStatusPill status={w.status} />}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          {action}
          <Panel className="flex flex-col gap-4">
            <h2 className="text-h3 font-bold">Dettagli</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Fact label="Tecnico">{technician?.name ?? "Da scegliere"}</Fact>
              <Fact label="Quando">{w.scheduledFor ? fmtDayTime(w.scheduledFor) : "Da fissare"}</Fact>
              <Fact label="Condominio">
                {building.name}, {building.address}
              </Fact>
              <Fact label="Controlli da registrare">
                {w.checkTypes.length ? w.checkTypes.map((c) => CHECK_LABEL[c]).join(", ") : "Nessuno"}
              </Fact>
            </div>
            {w.description && <p className="whitespace-pre-line border-t border-rule pt-4">{w.description}</p>}
          </Panel>
          <section className="flex flex-col gap-3">
            <SectionTitle>Storia</SectionTitle>
            <ol className="flex flex-col gap-0 border-l-2 border-rule pl-5">
              {[...w.events].reverse().map((e, i) => (
                <li key={i} className="relative pb-4 last:pb-0">
                  <span aria-hidden className="absolute top-2 -left-[1.72rem] size-3 rounded-full border-2 border-sheet bg-ink" />
                  <p className="font-semibold">{e.text}</p>
                  <p className="text-small text-ink-2">{fmtDayTime(e.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="flex flex-col gap-8">
          <NowAtPlant view={view} work={w} />
          <HowToGetThere view={view} />
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Chiusura: controlli, analisi fumi, foto, note
 * ------------------------------------------------------------------------- */

const RCEE_FIELDS = [
  { key: "efficiency", label: "Rendimento di combustione", unit: "%", hint: "Dall'analizzatore, ad esempio 97,8" },
  { key: "coPpm", label: "Monossido di carbonio (CO)", unit: "ppm", hint: "Corretto a O₂ 0%, ad esempio 35" },
  { key: "o2", label: "Ossigeno (O₂)", unit: "%", hint: "Ad esempio 4,2" },
  { key: "fluesTemp", label: "Temperatura dei fumi", unit: "°C", hint: "Ad esempio 58" },
] as const;

type RceeKey = (typeof RCEE_FIELDS)[number]["key"];

export function FinishWork() {
  const { id = "" } = useParams();
  const q = useWorkOrder(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [checks, setChecks] = useState<CheckType[] | null>(null);
  const [rcee, setRcee] = useState<Record<RceeKey, string>>({ efficiency: "", coPpm: "", o2: "", fluesTemp: "" });
  const [fixed, setFixed] = useState<"si" | "no" | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const complete = useAction(({ wid, input }: { wid: string; input: Parameters<typeof api.completeWork>[1] }) => api.completeWork(wid, input));

  const options = useMemo(() => (q.data ? availableChecks(q.data.view) : []), [q.data]);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { work: w, building, view } = q.data;
  const done = checks ?? w.checkTypes;
  const last = view.plant.checks.rcee?.rcee;

  if (w.status === "fatto") {
    return (
      <EmptyState icon={CircleCheckBig} title="Questo intervento è già chiuso" action={<LinkButton to={`/interventi/${w.id}`}>Torna all'intervento</LinkButton>} />
    );
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const added: { id: string; url: string }[] = [];
    setError(null);
    try {
      for (const f of Array.from(files).slice(0, 8 - photos.length)) {
        const blob = await compressPhoto(f);
        added.push(await api.uploadPhoto(blob, f.name.replace(/\.\w+$/, ".jpg")));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "La foto non si è caricata. Riprova.");
    }
    setPhotos((p) => [...p, ...added].slice(0, 8));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (w.kind === "guasto" && !fixed) return setError("Dicci se il guasto è risolto.");
    let rceeValues;
    if (done.includes("rcee")) {
      const vals = Object.fromEntries(RCEE_FIELDS.map((f) => [f.key, parseItNumber(rcee[f.key])])) as Record<RceeKey, number | null>;
      const missing = RCEE_FIELDS.find((f) => vals[f.key] === null);
      if (missing) return setError(`Scrivi ${missing.label.toLowerCase()}: serve per il rapporto di controllo.`);
      rceeValues = vals as Record<RceeKey, number>;
    }
    const euro = cost.trim() ? parseItNumber(cost) : null;
    if (cost.trim() && euro === null) return setError("Il costo va scritto in euro, ad esempio 180 oppure 180,50.");
    complete.mutate(
      { wid: w.id, input: { checksDone: done, rcee: rceeValues, notes, cost: euro, photos, fixed: w.kind !== "guasto" || fixed === "si" } },
      {
        onSuccess: () => {
          toast(
            done.includes("rcee")
              ? "Intervento chiuso. Ricordati di inviare il rapporto al catasto: lo trovi nelle scadenze."
              : "Intervento chiuso. Scadenze aggiornate e amministratore avvisato.",
          );
          navigate(`/interventi/${w.id}`, { replace: true });
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  let n = 0;
  return (
    <>
      <PageHeader back={<BackLink to={`/interventi/${w.id}`}>Torna all'intervento</BackLink>} title="Chiudi l'intervento" subtitle={`${w.title} · ${building.name}`} />
      <form onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
        {w.kind === "guasto" && (
          <Step n={++n} title="Com'è andata">
            <RadioCards<"si" | "no">
              name="esito"
              legend="Il guasto è risolto?"
              value={fixed}
              onChange={setFixed}
              options={[
                { value: "si", label: "Sì, la centrale funziona", detail: "L'allarme si chiude quando i dati tornano normali." },
                { value: "no", label: "No, serve un altro intervento", detail: "Ad esempio un pezzo da ordinare: poi prepara il preventivo." },
              ]}
            />
          </Step>
        )}

        <Step n={++n} title="Controlli fatti">
          <p className="-mt-2 text-ink-2">Spunta quello che hai fatto: le scadenze ripartono da oggi.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((c) => (
              <CheckCard
                key={c}
                label={CHECK_LABEL[c]}
                checked={done.includes(c)}
                onChange={(on) => setChecks(on ? [...done, c] : done.filter((x) => x !== c))}
              />
            ))}
          </div>
          {done.includes("rcee") && (
            <fieldset className="flex flex-col gap-4 rounded-xl bg-paper p-4">
              <legend className="sr-only">Valori dell'analisi dei fumi</legend>
              <p className="font-bold">Valori dell'analisi dei fumi</p>
              {last && (
                <p className="text-small text-ink-2">
                  L'ultima volta: rendimento {num(last.efficiency)}%, CO {last.coPpm} ppm, O₂ {num(last.o2)}%, fumi {last.fluesTemp} °C.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {RCEE_FIELDS.map((f) => (
                  <Field key={f.key} id={`rcee-${f.key}`} label={`${f.label} (${f.unit})`} hint={f.hint}>
                    <input
                      id={`rcee-${f.key}`}
                      inputMode="decimal"
                      autoComplete="off"
                      className={`${inputClass} num`}
                      value={rcee[f.key]}
                      onChange={(e) => setRcee((r) => ({ ...r, [f.key]: e.target.value }))}
                    />
                  </Field>
                ))}
              </div>
            </fieldset>
          )}
        </Step>

        <Step n={++n} title="Foto">
          <p className="-mt-2 text-ink-2">Facoltative, fino a 8. Utili per l'amministratore e per la prossima volta: targhe, pezzi sostituiti, letture.</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
          {photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <li key={p.id} className="relative">
                  <img src={p.url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((list) => list.filter((x) => x.id !== p.id))}
                    className="absolute top-1 right-1 inline-flex min-h-10 items-center gap-1 rounded-md bg-sheet px-2 text-small font-bold shadow-lift"
                  >
                    <Trash2 size={16} aria-hidden /> Togli
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button type="button" variant="secondary" icon={Camera} onClick={() => fileRef.current?.click()} disabled={photos.length >= 8}>
              {photos.length ? "Aggiungi un'altra foto" : "Fai una foto"}
            </Button>
          </div>
        </Step>

        <Step n={++n} title="Note e costo">
          <Field id="note" label="Cosa hai fatto" hint="Lo legge anche l'amministratore: scrivi in modo semplice.">
            <TextArea id="note" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ad esempio: sostituito l'elettrodo di accensione, pulito il bruciatore, prova di funzionamento regolare." />
          </Field>
          <Field id="costo" label="Costo per il condominio, in euro" hint="Facoltativo. Se è compreso nel contratto, lascia vuoto.">
            <input id="costo" inputMode="decimal" className={`${inputClass} num max-w-60`} value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        </Step>

        {error && (
          <p role="alert" className="rounded-xl border-2 border-red bg-red-tint p-4 font-bold text-red-ink">
            {error}
          </p>
        )}
        <Button type="submit" size="xl" icon={Flag} loading={complete.isPending}>
          Chiudi l'intervento
        </Button>
        <p className="text-small text-ink-2">Hai sbagliato qualcosa? Dopo la chiusura puoi annullarla dalla pagina dell'intervento.</p>
      </form>
    </>
  );
}

