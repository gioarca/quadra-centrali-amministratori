import { useState } from "react";
import { useParams } from "react-router";
import { ChevronDown, FileText, Mail, Megaphone, Printer, Send, Unplug } from "lucide-react";
import { fmtDate, fmtDayTime, fmtEuro } from "../logica/index.ts";
import {
  CHANNEL_LABEL,
  FUEL_LABEL,
  GENERATOR_KIND_LABEL,
  PLANT_STATUS_ADMIN,
  QUOTE_STATUS_LABEL,
  WORK_STATUS_LABEL,
  type PlantView,
} from "../logica/index.ts";
import type { BuildingDetail } from "../api/types.ts";
import { PhoneAction } from "../components/bits.tsx";
import { Chart24h } from "../components/plant/Chart24h.tsx";
import { ConsumptionChart, consumptionSentence } from "../components/plant/ConsumptionChart.tsx";
import { DeadlineList } from "../components/plant/Deadlines.tsx";
import { Findings } from "../components/plant/Findings.tsx";
import { adminSentence } from "../components/plant/PlantCard.tsx";
import { Schematic, SimpleStatus } from "../components/plant/Schematic.tsx";
import { DocList, QuoteRowItem, WorkRowItem } from "../components/rows.tsx";
import { useToast } from "../components/Toast.tsx";
import { BackLink, Button, ErrorState, LinkButton, Loading, PageHeader, Panel, PlantStatusPill, SectionTitle, cx } from "../components/ui.tsx";
import { useBuilding } from "../lib/queries.ts";

function seasonCost(d: BuildingDetail): number {
  const from = Date.now() - 365 * 86_400_000;
  return d.work.filter((w) => w.work.status === "fatto" && w.work.cost && Date.parse(w.work.closedAt!) >= from).reduce((s, w) => s + (w.work.cost ?? 0), 0);
}

function InviteFirm({ view }: { view: PlantView }) {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  return (
    <Panel className="flex flex-col gap-3 border-2 border-dashed border-edge">
      <h2 className="flex items-center gap-2 text-h3 font-bold">
        <Unplug size={24} aria-hidden /> {view.maintainer.name} non usa ancora Quadra
      </h2>
      <p>
        Per questo condominio vedi solo le scadenze e i documenti che hai caricato tu. Se la ditta si collega, vedi anche come sta la centrale, gli interventi e i preventivi, come per gli altri condomini.
      </p>
      <p className="text-small text-ink-2">Per la ditta è gratuito per le centrali dei tuoi condomini. Le arriva un'email con il link per iscriversi.</p>
      <div>
        <Button
          icon={sent ? Mail : Send}
          variant={sent ? "secondary" : "primary"}
          disabled={sent}
          onClick={() => {
            setSent(true);
            toast(`Invito mandato a ${view.maintainer.email}.`);
          }}
        >
          {sent ? "Invito mandato" : `Invita ${view.maintainer.name}`}
        </Button>
      </div>
    </Panel>
  );
}

export function BuildingPage() {
  const { id = "" } = useParams();
  const q = useBuilding(id);
  const [full, setFull] = useState(false);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const { view, work, quotes, docs, notices, consumption } = d;
  const b = view.building;
  const live = view.status !== "non_collegata";
  const sentence = consumptionSentence(consumption);
  const cost = seasonCost(d);
  const isThird = view.plant.thirdPartyOrgId === view.maintainer.id;

  return (
    <>
      <PageHeader
        back={<BackLink to="/">I tuoi condomini</BackLink>}
        title={b.name}
        subtitle={`${b.address}, ${b.city} · ${b.units} appartamenti${b.nextAssemblyAt ? ` · assemblea ${fmtDayTime(b.nextAssemblyAt)}` : ""}`}
        actions={
          <>
            <PlantStatusPill status={view.status} audience="amministratore" size="lg" />
            <LinkButton to={`/condomini/${b.id}/relazione`} variant="secondary" icon={FileText}>
              Relazione per l'assemblea
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="stato-title" className="flex flex-col gap-4">
            <SectionTitle>
              <span id="stato-title">Come sta la centrale</span>
            </SectionTitle>
            <p className="-mt-2 text-lead font-semibold">{adminSentence(view)}</p>
            {live ? (
              <>
                {view.findings.length > 0 && <Findings view={view} audience="amministratore" />}
                <SimpleStatus view={view} />
                <button
                  type="button"
                  aria-expanded={full}
                  onClick={() => setFull((v) => !v)}
                  className="inline-flex min-h-12 items-center gap-2 self-start font-bold underline decoration-2 underline-offset-4"
                >
                  <ChevronDown size={22} aria-hidden className={cx("transition-transform", full && "rotate-180")} />
                  {full ? "Nascondi lo schema completo" : "Mostra lo schema completo, come lo vede la ditta"}
                </button>
                {full && (
                  <div className="flex flex-col gap-6">
                    <Schematic view={view} />
                    <Panel className="flex flex-col gap-4">
                      <h3 className="text-h2 font-bold">Ultime 24 ore</h3>
                      <Chart24h view={view} />
                    </Panel>
                  </div>
                )}
              </>
            ) : (
              <InviteFirm view={view} />
            )}
          </section>

          <section aria-labelledby="cons-title" className="flex flex-col gap-3">
            <SectionTitle>
              <span id="cons-title">Consumi</span>
            </SectionTitle>
            {sentence && <p className="-mt-2 text-lead">{sentence}</p>}
            <Panel>
              <ConsumptionChart c={consumption} />
            </Panel>
            <p className="text-small text-ink-2">
              {live ? "Stimati dal funzionamento del bruciatore; con il contatore collegato diventano letture vere." : "Dalle bollette caricate nello studio."}
            </p>
          </section>

          <section aria-labelledby="prev-title" className="flex flex-col gap-3">
            <SectionTitle count={quotes.length}>
              <span id="prev-title">Preventivi</span>
            </SectionTitle>
            {quotes.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {quotes.map((r) => (
                  <li key={r.quote.id}>
                    <QuoteRowItem row={r} to={`/preventivi/${r.quote.id}`} who="maintainer" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-2">Nessun preventivo.</p>
            )}
          </section>

          <section aria-labelledby="lav-title" className="flex flex-col gap-3">
            <SectionTitle
              count={work.length}
              aside={cost > 0 ? <span className="num font-semibold text-ink-2">Ultimi 12 mesi: {fmtEuro(cost)}</span> : undefined}
            >
              <span id="lav-title">Lavori</span>
            </SectionTitle>
            {work.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {work.map((w) => (
                  <li key={w.work.id}>
                    <WorkRowItem row={w} showCost />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-2">{live ? "Nessun lavoro registrato." : "La ditta non registra i lavori su Quadra."}</p>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-10">
          <Panel className="flex flex-col gap-3">
            <h2 className="text-h3 font-bold">Ditta di manutenzione</h2>
            <p className="text-lead font-bold">{view.maintainer.name}</p>
            {isThird && <p className="text-small text-ink-2">È anche terzo responsabile: risponde per legge della conduzione della centrale.</p>}
            <PhoneAction label="Telefono" phone={view.maintainer.phone} />
            <a href={`mailto:${view.maintainer.email}`} className="inline-flex min-h-12 items-center gap-2 font-semibold underline decoration-2 underline-offset-4">
              <Mail size={20} aria-hidden /> {view.maintainer.email}
            </a>
          </Panel>

          <section aria-labelledby="sc-title" className="flex flex-col gap-3">
            <SectionTitle>
              <span id="sc-title">Controlli di legge</span>
            </SectionTitle>
            <DeadlineList deadlines={view.deadlines} openWork={view.openWork} audience="amministratore" maintainerName={view.maintainer.name} plantId={view.plant.id} />
          </section>

          <section aria-labelledby="av-title" className="flex flex-col gap-3">
            <SectionTitle
              aside={
                <LinkButton to={`/avvisi/nuovo?condominio=${b.id}`} variant="secondary" icon={Megaphone}>
                  Scrivi un avviso
                </LinkButton>
              }
            >
              <span id="av-title">Avvisi</span>
            </SectionTitle>
            {notices.length ? (
              <ul className="flex flex-col gap-3">
                {notices.map((n) => (
                  <li key={n.id} className="rounded-xl border-2 border-rule bg-sheet p-4">
                    <p className="font-bold">{n.title}</p>
                    <p className="text-small text-ink-2">
                      {fmtDate(n.createdAt)} · {n.channels.map((c) => CHANNEL_LABEL[c].toLowerCase()).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-2">Nessun avviso mandato.</p>
            )}
          </section>

          <section aria-labelledby="doc-title" className="flex flex-col gap-3">
            <SectionTitle count={docs.length}>
              <span id="doc-title">Documenti</span>
            </SectionTitle>
            <DocList docs={docs} />
          </section>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Relazione per l'assemblea: una pagina da stampare o mandare in PDF
 * ------------------------------------------------------------------------- */

/** Tabella della relazione; `right` = colonne di numeri, allineate a destra. */
function RTable({ head, rows, foot, right = [] }: { head: string[]; rows: (string | number)[][]; foot?: (string | number)[]; right?: number[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} scope="col" className={cx("border-b-2 border-ink py-1.5 pr-3 text-small font-bold", right.includes(i) && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="num">
        {rows.map((r, n) => (
          <tr key={n} className="border-b border-rule">
            {r.map((c, i) => (
              <td key={i} className={cx("py-1.5 pr-3 align-top", right.includes(i) && "text-right whitespace-nowrap")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr>
            {foot.map((c, i) => (
              <td key={i} className={cx("py-1.5 pr-3 font-bold", right.includes(i) && "text-right")}>
                {c}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export function Report() {
  const { id = "" } = useParams();
  const q = useBuilding(id);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const { view, work, quotes, consumption: c } = d;
  const b = view.building;
  const from = Date.now() - 365 * 86_400_000;
  const done = work.filter((w) => w.work.status === "fatto" && Date.parse(w.work.closedAt!) >= from);
  const open = work.filter((w) => w.work.status !== "fatto");
  const total = done.reduce((s, w) => s + (w.work.cost ?? 0), 0);
  const int = (n: number) => Math.round(n).toLocaleString("it-IT");
  const sumCur = c.months.reduce((s, m) => s + (m.current ?? 0), 0);
  const sumPrev = c.months.reduce((s, m) => s + m.previous, 0);

  return (
    <>
      <div className="no-print">
        <PageHeader
          back={<BackLink to={`/condomini/${b.id}`}>{b.name}</BackLink>}
          title="Relazione per l'assemblea"
          subtitle="Una pagina sola, da stampare o allegare alla convocazione."
          actions={
            <Button icon={Printer} onClick={() => window.print()}>
              Stampa o salva in PDF
            </Button>
          }
        />
      </div>
      <article className="print-sheet mx-auto flex max-w-[52rem] flex-col gap-7 rounded-xl border border-rule bg-sheet p-6 shadow-lift sm:p-10">
        <header className="flex flex-col gap-1 border-b-2 border-ink pb-4">
          <p className="text-small font-bold tracking-wide text-ink-2 uppercase">Centrale termica · relazione per l'assemblea</p>
          <h1 className="text-h1 font-extrabold">{b.name}</h1>
          <p>
            {b.address}, {b.city} · {b.units} appartamenti
          </p>
          <p className="text-small text-ink-2">
            Preparata il {fmtDate(new Date())} da {view.admin.name}, {view.adminOrg.name}
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3 font-bold">1. La centrale oggi</h2>
          <p>
            <strong>{PLANT_STATUS_ADMIN[view.status]}.</strong> {adminSentence(view)}
          </p>
          <ul className="list-disc pl-6">
            {view.plant.generators.map((g) => (
              <li key={g.id}>
                {g.label}: {GENERATOR_KIND_LABEL[g.kind].toLowerCase()} {g.brand} {g.model}, {g.powerKw} kW, {FUEL_LABEL[g.fuel]}, installata nel {g.installedAt.slice(0, 4)}.
              </li>
            ))}
          </ul>
          <p>
            Manutenzione: {view.maintainer.name}
            {view.plant.thirdPartyOrgId === view.maintainer.id ? ", con delega di terzo responsabile" : ""}. Zona climatica {view.plant.zona}, orario impostato dalle {view.plant.schedule.from} alle {view.plant.schedule.to}.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3 font-bold">2. Controlli di legge</h2>
          <RTable
            head={["Controllo", "Ultimo", "Prossimo"]}
            rows={view.deadlines
              .filter((x) => x.type !== "catasto")
              .map((x) => [x.label, x.lastDoneAt ? fmtDate(x.lastDoneAt) : "—", x.dueAt ? `${fmtDate(x.dueAt)}${x.status === "scaduta" ? " (scaduto)" : ""}` : "—"])}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3 font-bold">3. Lavori degli ultimi 12 mesi</h2>
          {done.length ? (
            <RTable
              head={["Data", "Lavoro", "Costo"]}
              rows={done.map((w) => [fmtDate(w.work.closedAt!), w.work.title, w.work.cost ? fmtEuro(w.work.cost) : "nel contratto"])}
              foot={["", "Totale fuori contratto", fmtEuro(total)]}
              right={[2]}
            />
          ) : (
            <p>Nessun lavoro registrato.</p>
          )}
          {open.length > 0 && (
            <p>
              Ancora aperti: {open.map((w) => `${w.work.title.toLowerCase()} (${WORK_STATUS_LABEL[w.work.status].toLowerCase()})`).join("; ")}.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3 font-bold">4. Consumi</h2>
          <p>
            Stagione {c.seasonLabelCurrent}: {int(sumCur)} {c.unit}; stagione {c.seasonLabelPrevious}: {int(sumPrev)} {c.unit}. {consumptionSentence(c)}
          </p>
          <RTable
            head={["Mese", `${c.seasonLabelCurrent}, ${c.unit}`, `${c.seasonLabelPrevious}, ${c.unit}`]}
            rows={c.months.map((m) => [m.label, m.current === null ? "—" : int(m.current), int(m.previous)])}
            right={[1, 2]}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-h3 font-bold">5. Preventivi</h2>
          {quotes.length ? (
            <RTable
              head={["Lavoro", "Stato", "Importo"]}
              rows={quotes.map((r) => [`${r.quote.title} (${r.maintainer.name})`, QUOTE_STATUS_LABEL[r.quote.status], fmtEuro(r.total)])}
              right={[2]}
            />
          ) : (
            <p>Nessun preventivo.</p>
          )}
        </section>

        <footer className="border-t border-rule pt-3 text-small text-ink-2">
          Dati della centrale rilevati dal modulo di telecontrollo e registrati dalla ditta. Consumi {view.status === "non_collegata" ? "dalle bollette" : "stimati dal funzionamento del bruciatore"}. Importi IVA esclusa.
        </footer>
      </article>
    </>
  );
}
