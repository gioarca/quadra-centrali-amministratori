import { useParams } from "react-router";
import { KeyRound, MapPin, Navigation, Plus, ReceiptText, Unplug, Wrench } from "lucide-react";
import { fmtDate } from "../logica/index.ts";
import { FUEL_LABEL, GENERATOR_KIND_LABEL, totalPowerKw, type PlantView } from "../logica/index.ts";
import { api } from "../api/index.ts";
import { PhoneAction } from "../components/bits.tsx";
import { Chart24h } from "../components/plant/Chart24h.tsx";
import { DeadlineList } from "../components/plant/Deadlines.tsx";
import { Findings } from "../components/plant/Findings.tsx";
import { Schematic } from "../components/plant/Schematic.tsx";
import { DocList, QuoteRowItem, WorkRowItem } from "../components/rows.tsx";
import { useToast } from "../components/Toast.tsx";
import { BackLink, EmptyState, ErrorState, Fact, LinkButton, Loading, PageHeader, Panel, PlantStatusPill, SectionTitle } from "../components/ui.tsx";
import { mapsUrl } from "../lib/format.ts";
import { useAction, usePlant } from "../lib/queries.ts";

export function HowToGetThere({ view }: { view: PlantView }) {
  const b = view.building;
  return (
    <Panel className="flex flex-col gap-4">
      <h2 className="text-h3 font-bold">Come arrivare</h2>
      <Fact label="Indirizzo" icon={MapPin}>
        {b.address}, {b.city}
      </Fact>
      <Fact label="Dove si trova la centrale" icon={Navigation}>
        {view.plant.location}
      </Fact>
      <Fact label="Come si entra" icon={KeyRound}>
        {view.plant.access}
      </Fact>
      <a href={mapsUrl(b.address, b.city)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 font-bold underline decoration-2 underline-offset-4">
        <MapPin size={20} aria-hidden /> Apri in Google Maps
      </a>
      <div className="border-t border-rule pt-4">
        <PhoneAction label={`Amministratore: ${view.admin.name}, ${view.adminOrg.name}`} phone={view.admin.phone || view.adminOrg.phone} />
      </div>
    </Panel>
  );
}

function Libretto({ view }: { view: PlantView }) {
  const p = view.plant;
  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3 font-bold">Dati del libretto</h2>
        <span className="num text-small text-ink-2">Catasto: {p.cadastreCode}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {p.generators.map((g) => (
          <li key={g.id} className="flex flex-col rounded-lg bg-paper p-3">
            <span className="font-bold">
              {g.label}: {g.brand} {g.model}
            </span>
            <span className="num text-small text-ink-2">
              {GENERATOR_KIND_LABEL[g.kind]}
              {g.condensing ? " a condensazione" : ""}, {g.powerKw} kW, {FUEL_LABEL[g.fuel]}. Matricola {g.serial}. Installata nel {g.installedAt.slice(0, 4)}.
              {g.refrigerantCo2eqT ? ` Refrigerante: ${g.refrigerantCo2eqT.toLocaleString("it-IT")} t CO₂ eq.` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label="Potenza totale">{totalPowerKw(p)} kW</Fact>
        <Fact label="Zona climatica">Zona {p.zona}</Fact>
        <Fact label="Orario impostato">
          Dalle {p.schedule.from} alle {p.schedule.to}
        </Fact>
        <Fact label="Curva climatica">
          Pendenza {p.curve.slope.toLocaleString("it-IT")}, massimo {p.curve.max} °C
        </Fact>
        {p.circuits.map((c) => (
          <Fact key={c.id} label={c.label}>
            {c.pump}
          </Fact>
        ))}
        <Fact label="Modulo di telecontrollo">
          {p.gateway ? `${p.gateway.model}, ${p.gateway.link}, dal ${fmtDate(p.gateway.installedAt)}` : "Non installato"}
        </Fact>
      </div>
    </Panel>
  );
}

export function PlantPage() {
  const { id = "" } = useParams();
  const q = usePlant(id);
  const toast = useToast();
  const markSent = useAction(() => api.markCadastreSent(id));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { view, history, quotes, docs, technicians } = q.data;
  const b = view.building;
  const live = view.status !== "non_collegata";

  return (
    <>
      <PageHeader
        back={<BackLink to="/">Tutte le centrali</BackLink>}
        title={b.name}
        subtitle={`${b.address}, ${b.city} · ${b.units} appartamenti · zona ${view.plant.zona}`}
        actions={<PlantStatusPill status={view.status} size="lg" />}
      />
      <div className="flex flex-col gap-10">
        {live ? (
          <>
            <section aria-labelledby="dati-title" className="flex flex-col gap-3">
              <SectionTitle>
                <span id="dati-title">Cosa dicono i dati</span>
              </SectionTitle>
              <Findings view={view} technicians={technicians} />
            </section>
            <Schematic view={view} />
            <Panel className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-h2 font-bold">Ultime 24 ore</h2>
                <p className="text-ink-2">Temperature dell'impianto e della sonda esterna, un dato ogni 10 minuti.</p>
              </div>
              <Chart24h view={view} />
            </Panel>
          </>
        ) : (
          <EmptyState icon={Unplug} title="Questa centrale non ha il modulo di telecontrollo">
            Vedi scadenze, interventi e documenti, ma non i dati dal vivo né gli allarmi. Il modulo si installa in mezz'ora sul quadro della centrale.
          </EmptyState>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section aria-labelledby="scad-title" className="flex flex-col gap-3">
            <SectionTitle>
              <span id="scad-title">Controlli e scadenze</span>
            </SectionTitle>
            <DeadlineList
              deadlines={view.deadlines}
              openWork={view.openWork}
              plantId={view.plant.id}
              sending={markSent.isPending}
              onMarkSent={() =>
                markSent.mutate(undefined, {
                  onSuccess: () => toast("Segnato come inviato al catasto regionale."),
                  onError: (e) => toast(e.message, { tone: "error" }),
                })
              }
            />
          </section>
          <div className="flex flex-col gap-8">
            <HowToGetThere view={view} />
            <Libretto view={view} />
          </div>
        </div>

        <section aria-labelledby="int-title" className="flex flex-col gap-3">
          <SectionTitle
            count={history.length}
            aside={
              <LinkButton to={`/interventi/nuovo?centrale=${view.plant.id}`} icon={Plus} variant="secondary">
                Nuovo intervento
              </LinkButton>
            }
          >
            <span id="int-title">Interventi</span>
          </SectionTitle>
          {history.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {history.map((w) => (
                <li key={w.work.id}>
                  <WorkRowItem row={w} to={`/interventi/${w.work.id}`} showCost />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Wrench} title="Nessun intervento registrato" />
          )}
        </section>

        <section aria-labelledby="prv-title" className="flex flex-col gap-3">
          <SectionTitle
            count={quotes.length}
            aside={
              <LinkButton to={`/preventivi/nuovo?centrale=${view.plant.id}`} icon={ReceiptText} variant="secondary">
                Nuovo preventivo
              </LinkButton>
            }
          >
            <span id="prv-title">Preventivi</span>
          </SectionTitle>
          {quotes.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {quotes.map((r) => (
                <li key={r.quote.id}>
                  <QuoteRowItem row={r} to={`/preventivi/${r.quote.id}`} who="building" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2">Nessun preventivo per questo condominio.</p>
          )}
        </section>

        <section aria-labelledby="doc-title" className="flex flex-col gap-3">
          <SectionTitle count={docs.length}>
            <span id="doc-title">Documenti</span>
          </SectionTitle>
          <DocList docs={docs} />
          <p className="text-small text-ink-2">L'amministratore vede gli stessi documenti nel suo portale.</p>
        </section>
      </div>
    </>
  );
}
