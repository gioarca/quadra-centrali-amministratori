import { Link } from "react-router";
import { ChevronRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { fmtDate, fmtDueIn, fmtToday, greeting, joinIt } from "../logica/index.ts";
import type { PlantView } from "../logica/index.ts";
import type { Me } from "../api/types.ts";
import { PlantCard } from "../components/plant/PlantCard.tsx";
import { QuoteRowItem, WorkRowItem } from "../components/rows.tsx";
import { EmptyState, ErrorState, Loading, PageHeader, SectionTitle, cx } from "../components/ui.tsx";
import { plural } from "../lib/format.ts";
import { useAdminHome } from "../lib/queries.ts";

function summary(views: PlantView[], pending: number): string {
  const n = (s: PlantView["status"]) => views.filter((v) => v.status === s).length;
  const firms = new Set(views.map((v) => v.maintainer.id)).size;
  const parts: string[] = [];
  if (n("blocco")) parts.push(plural(n("blocco"), "guasto", "guasti"));
  if (n("attenzione")) parts.push(`${n("attenzione")} da controllare`);
  if (n("offline")) parts.push(`${n("offline")} senza dati`);
  const state = parts.length ? `${joinIt(parts)}: le ditte sono già avvisate.` : "Tutte le centrali funzionano.";
  const quotes = pending ? ` ${plural(pending, "preventivo aspetta", "preventivi aspettano")} la tua risposta.` : "";
  return `${plural(views.length, "condominio", "condomini")}, ${plural(firms, "ditta", "ditte")} di manutenzione. ${state}${quotes}`;
}

export function AdminHome({ me }: { me: Me }) {
  const q = useAdminHome();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { views, pendingQuotes, legal, openWork } = q.data;
  const maintainerOf = (buildingId: string) => views.find((v) => v.building.id === buildingId)?.maintainer.name ?? "";

  return (
    <>
      <PageHeader title={`${greeting()}, ${me.user.name.split(" ")[0]}`} subtitle={`${fmtToday().replace(/^./, (c) => c.toUpperCase())}. ${summary(views, pendingQuotes.length)}`} />
      <div className="flex flex-col gap-10">
        {pendingQuotes.length > 0 && (
          <section aria-labelledby="dec-title" className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-sheet p-4 sm:p-6">
            <SectionTitle count={pendingQuotes.length}>
              <span id="dec-title">Da decidere</span>
            </SectionTitle>
            <p className="-mt-2 text-ink-2">Preventivi mandati dalle ditte. Puoi approvare, portare in assemblea o chiedere chiarimenti.</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {pendingQuotes.map((r) => (
                <li key={r.quote.id}>
                  <QuoteRowItem row={r} to={`/preventivi/${r.quote.id}`} who="both" />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="cond-title" className="flex flex-col gap-3">
          <SectionTitle count={views.length}>
            <span id="cond-title">I tuoi condomini</span>
          </SectionTitle>
          <p className="-mt-2 text-ink-2">In cima quelli che hanno un problema. Ogni ditta vede solo i suoi; tu li vedi tutti.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {views.map((v) => (
              <li key={v.plant.id} className="flex">
                <div className="flex w-full flex-col [&>a]:h-full">
                  <PlantCard view={v} audience="amministratore" />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-10 lg:grid-cols-2">
          <section aria-labelledby="leg-title" className="flex flex-col gap-3">
            <SectionTitle count={legal.length}>
              <span id="leg-title">Scadenze di legge</span>
            </SectionTitle>
            <p className="-mt-2 text-ink-2">Scadute o in scadenza nei prossimi 60 giorni. Di solito se ne occupa la ditta: qui le tieni d'occhio.</p>
            {legal.length ? (
              <ul className="flex flex-col divide-y divide-rule rounded-xl border-2 border-rule bg-sheet">
                {legal.map((l, i) => {
                  const late = l.daysLeft < 0;
                  const label = l.deadline?.label ?? l.doc?.title ?? "";
                  return (
                    <li key={i}>
                      <Link to={`/condomini/${l.building.id}`} className="group flex items-start gap-3 px-4 py-3 hover:bg-sunk">
                        {late ? (
                          <ShieldAlert size={24} className="mt-0.5 shrink-0 text-red-ink" aria-hidden />
                        ) : (
                          <ShieldCheck size={24} className="mt-0.5 shrink-0 text-amber-ink" aria-hidden />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-bold">{l.building.name}</span>
                          <span>{label}</span>
                          <span className={cx("text-small font-semibold", late ? "text-red-ink" : "text-amber-ink")}>
                            {fmtDueIn(l.daysLeft).replace(/^./, (c) => c.toUpperCase())}
                            {l.deadline?.dueAt ? ` (${fmtDate(l.deadline.dueAt)})` : l.doc?.expiresAt ? ` (${fmtDate(l.doc.expiresAt)})` : ""}
                          </span>
                          <span className="text-small text-ink-2">
                            {l.doc ? "Da rinnovare con la ditta" : `Se ne occupa ${maintainerOf(l.building.id)}`}
                          </span>
                        </span>
                        <ChevronRight size={20} className="mt-1 shrink-0 text-ink-2" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={ShieldCheck} title="Nessuna scadenza nei prossimi 60 giorni" />
            )}
          </section>

          <section aria-labelledby="lav-title" className="flex flex-col gap-3">
            <SectionTitle count={openWork.length}>
              <span id="lav-title">Lavori aperti</span>
            </SectionTitle>
            <p className="-mt-2 text-ink-2">Interventi delle ditte nei tuoi condomini, aggiornati da loro.</p>
            <ul className="flex flex-col gap-3">
              {openWork.map((w) => (
                <li key={w.work.id}>
                  <WorkRowItem row={w} showBuilding to={`/condomini/${w.building.id}`} firm={maintainerOf(w.building.id)} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
