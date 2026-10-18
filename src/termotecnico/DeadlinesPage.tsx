import { useState } from "react";
import { Link } from "react-router";
import { CalendarPlus, ChevronRight, Send, ShieldCheck, Wrench } from "lucide-react";
import { fmtDate, fmtDayTime, fmtDueIn } from "../logica/index.ts";
import type { DeadlineStatus } from "../logica/index.ts";
import { api } from "../api/index.ts";
import type { DeadlineRow } from "../api/types.ts";
import { useToast } from "../components/Toast.tsx";
import { Button, DeadlinePill, EmptyState, ErrorState, LinkButton, Loading, PageHeader, SectionTitle, cx } from "../components/ui.tsx";
import { useAction, useDeadlines } from "../lib/queries.ts";

const GROUPS: { status: DeadlineStatus; title: string; note: string }[] = [
  { status: "scaduta", title: "Scaduti", note: "Da fare subito: in caso di controllo dell'ente la responsabilità è del terzo responsabile." },
  { status: "da_inviare", title: "Rapporti da inviare al catasto", note: "Controllo fatto, manca la registrazione nel catasto regionale." },
  { status: "in_scadenza", title: "Entro 30 giorni", note: "Conviene programmarli adesso, insieme ad altri lavori nella stessa zona." },
  { status: "ok", title: "In regola", note: "" },
];

function Row({ r, onMarkSent, sending }: { r: DeadlineRow; onMarkSent: () => void; sending: boolean }) {
  const d = r.deadline;
  return (
    <li className="flex flex-col gap-2 rounded-xl border-2 border-rule bg-sheet p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link to={`/centrali/${d.plantId}`} className="group flex min-w-0 flex-col">
          <span className="inline-flex items-center gap-1 text-lead font-bold underline decoration-transparent decoration-2 underline-offset-4 group-hover:decoration-ink">
            {r.building.name} <ChevronRight size={18} aria-hidden />
          </span>
          <span className="text-small text-ink-2">
            {r.building.address}, {r.building.city}
          </span>
        </Link>
        <DeadlinePill status={d.status} />
      </div>
      <p className="font-bold">{d.label}</p>
      <p className="text-ink-2">
        {d.type === "catasto"
          ? d.status === "da_inviare"
            ? "Rapporto di controllo da registrare."
            : d.lastDoneAt
              ? `Ultimo invio il ${fmtDate(d.lastDoneAt)}.`
              : "Nessun rapporto da inviare."
          : d.daysLeft !== null && d.dueAt
            ? `${fmtDueIn(d.daysLeft).replace(/^./, (c) => c.toUpperCase())}, il ${fmtDate(d.dueAt)}.`
            : "Nessuna data registrata."}
      </p>
      {r.openWork ? (
        <Link to={`/interventi/${r.openWork.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-2 underline-offset-4">
          <Wrench size={18} aria-hidden />
          In programma: {r.openWork.number}
          {r.openWork.scheduledFor ? `, ${fmtDayTime(r.openWork.scheduledFor)}` : ", da assegnare"}
        </Link>
      ) : d.status === "da_inviare" ? (
        <div>
          <Button variant="secondary" icon={Send} onClick={onMarkSent} loading={sending}>
            Segna come inviato
          </Button>
        </div>
      ) : d.status !== "ok" && d.type !== "delega" ? (
        <div>
          <LinkButton to={`/interventi/nuovo?centrale=${d.plantId}&controllo=${d.type}`} variant="secondary" icon={CalendarPlus}>
            Programma
          </LinkButton>
        </div>
      ) : null}
    </li>
  );
}

export function DeadlinesPage() {
  const q = useDeadlines();
  const toast = useToast();
  const [all, setAll] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const markSent = useAction((plantId: string) => api.markCadastreSent(plantId));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data;
  const todo = rows.filter((r) => r.deadline.status !== "ok").length;

  return (
    <>
      <PageHeader title="Scadenze" subtitle="I controlli di legge di tutte le centrali, dai più urgenti. Valgono le regole del DPR 74/2013; la Regione può chiedere di più." />
      <div role="group" aria-label="Quali scadenze mostrare" className="mb-8 inline-grid grid-cols-2 rounded-lg border-2 border-ink p-0.5">
        {[
          { v: false, label: `Da fare (${todo})` },
          { v: true, label: `Tutte (${rows.length})` },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={all === o.v}
            onClick={() => setAll(o.v)}
            className={cx("min-h-11 rounded-md px-4 font-bold", all === o.v ? "bg-primary-bg text-primary-fg" : "hover:bg-sunk")}
          >
            {o.label}
          </button>
        ))}
      </div>
      {todo === 0 && !all && (
        <EmptyState icon={ShieldCheck} title="Tutto in regola">
          Nessun controllo scaduto o in scadenza nei prossimi 30 giorni.
        </EmptyState>
      )}
      <div className="flex flex-col gap-10">
        {GROUPS.filter((g) => all || g.status !== "ok").map((g) => {
          const list = rows.filter((r) => r.deadline.status === g.status);
          if (!list.length) return null;
          return (
            <section key={g.status} className="flex flex-col gap-3">
              <SectionTitle count={list.length}>{g.title}</SectionTitle>
              {g.note && <p className="-mt-2 text-ink-2">{g.note}</p>}
              <ul className="grid gap-3 md:grid-cols-2">
                {list.map((r) => (
                  <Row
                    key={`${r.deadline.plantId}-${r.deadline.type}`}
                    r={r}
                    sending={markSent.isPending && sendingId === r.deadline.plantId}
                    onMarkSent={() => {
                      setSendingId(r.deadline.plantId);
                      markSent.mutate(r.deadline.plantId, {
                        onSuccess: () => toast(`${r.building.name}: rapporto segnato come inviato al catasto.`),
                        onError: (e) => toast(e.message, { tone: "error" }),
                      });
                    }}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
