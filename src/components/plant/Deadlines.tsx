import { Link } from "react-router";
import { CalendarPlus, Send, Wrench } from "lucide-react";
import { fmtDate, fmtDayTime, fmtDueIn } from "../../logica/index.ts";
import type { PlantDeadline, WorkOrder } from "../../logica/index.ts";
import { Button, DeadlinePill, LinkButton } from "../ui.tsx";

function dueSentence(d: PlantDeadline): string {
  if (d.type === "catasto") {
    if (d.status === "da_inviare") return "L'ultimo rapporto di controllo non è ancora registrato nel catasto regionale.";
    return d.lastDoneAt ? `Ultimo invio il ${fmtDate(d.lastDoneAt)}.` : "Nessun rapporto da inviare.";
  }
  if (d.daysLeft === null || !d.dueAt) return "Mai fatto: non risulta nessuna data.";
  const due = fmtDueIn(d.daysLeft);
  return `${due.charAt(0).toUpperCase()}${due.slice(1)}, il ${fmtDate(d.dueAt)}.`;
}

/**
 * Il cartellino dei controlli della centrale, come quello appeso in centrale termica:
 * una riga per controllo, con lo stato in parole e la data.
 */
export function DeadlineList({
  deadlines,
  openWork = [],
  audience = "tecnico",
  maintainerName,
  onMarkSent,
  sending,
  plantId,
}: {
  deadlines: PlantDeadline[];
  openWork?: WorkOrder[];
  audience?: "tecnico" | "amministratore";
  maintainerName?: string;
  onMarkSent?: () => void;
  sending?: boolean;
  plantId: string;
}) {
  return (
    <div className="tag">
      <div className="tag-stub">
        <span className="tag-hole" />
      </div>
      <ul className="flex flex-col">
        {deadlines.map((d) => {
          const work = openWork.find((w) => w.checkTypes.includes(d.type));
          const needsAction = d.status === "scaduta" || d.status === "in_scadenza";
          return (
            <li key={d.type} className="flex flex-col gap-2 border-b border-rule px-4 py-4 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-col">
                  <h3 className="text-body font-bold">{d.label}</h3>
                  <p className="text-small text-ink-2">{d.why}</p>
                </div>
                <DeadlinePill status={d.status} />
              </div>
              <p className="font-semibold">{dueSentence(d)}</p>
              {d.lastDoneAt && d.type !== "catasto" && <p className="text-small text-ink-2">Ultimo fatto il {fmtDate(d.lastDoneAt)}.</p>}

              {work ? (
                <p className="flex flex-wrap items-center gap-2 text-small font-semibold">
                  <Wrench size={18} aria-hidden />
                  {audience === "tecnico" ? (
                    <>
                      In programma: {work.number}
                      {work.scheduledFor ? `, ${fmtDayTime(work.scheduledFor)}` : ", da assegnare"}.
                      <Link to={`/interventi/${work.id}`} className="underline decoration-2 underline-offset-4">
                        Apri
                      </Link>
                    </>
                  ) : (
                    <>Già in programma con {maintainerName}{work.scheduledFor ? `, ${fmtDayTime(work.scheduledFor)}` : ""}.</>
                  )}
                </p>
              ) : audience === "tecnico" && d.status === "da_inviare" && onMarkSent ? (
                <div>
                  <Button variant="secondary" icon={Send} onClick={onMarkSent} loading={sending}>
                    Segna come inviato
                  </Button>
                </div>
              ) : audience === "tecnico" && needsAction && d.type !== "delega" ? (
                <div>
                  <LinkButton to={`/interventi/nuovo?centrale=${plantId}&controllo=${d.type}`} variant="secondary" icon={CalendarPlus}>
                    Programma
                  </LinkButton>
                </div>
              ) : audience === "amministratore" && (needsAction || d.status === "da_inviare") ? (
                <p className="text-small font-semibold text-ink-2">Se ne occupa {maintainerName}.</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
