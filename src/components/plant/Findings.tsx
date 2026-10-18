import { Link } from "react-router";
import { CircleCheckBig, Lightbulb, OctagonAlert, Search, TriangleAlert, WifiOff, Wrench } from "lucide-react";
import { fmtDayTime } from "../../logica/index.ts";
import { WORK_STATUS_LABEL, type Finding, type PlantView, type Severity, type Technician } from "../../logica/index.ts";
import { fmtAgo } from "../../lib/format.ts";
import { firmProgress } from "./PlantCard.tsx";
import { LinkButton, cx, type Icon } from "../ui.tsx";

const STYLE: Record<Severity, { box: string; ink: string; icon: Icon; word: string }> = {
  blocco: { box: "border-red bg-red-tint", ink: "text-red-ink", icon: OctagonAlert, word: "Blocco" },
  attenzione: { box: "border-amber bg-amber-tint", ink: "text-amber-ink", icon: TriangleAlert, word: "Da controllare" },
  consiglio: { box: "border-slate bg-slate-tint", ink: "text-slate-ink", icon: Lightbulb, word: "Consiglio" },
};

function sinceText(f: Finding): string | null {
  if (!f.since) return null;
  const ago = fmtAgo(f.since);
  return ago.endsWith(" fa") ? `Da ${ago.replace(" fa", "")} (${fmtDayTime(f.since)})` : `Da ${ago}`;
}

/**
 * Cosa dicono i dati. Per la ditta: cosa si vede, da quando, cosa controllare e il pulsante per aprire l'intervento.
 * Per l'amministratore: le stesse frasi, senza istruzioni tecniche, e chi se ne sta occupando.
 */
export function Findings({
  view,
  audience = "tecnico",
  technicians = [],
}: {
  view: PlantView;
  audience?: "tecnico" | "amministratore";
  technicians?: Technician[];
}) {
  if (view.status === "non_collegata") return null;
  if (!view.findings.length) {
    return (
      <p className="flex items-start gap-3 rounded-xl border-2 border-green bg-green-tint p-4 text-lead font-semibold text-green-ink">
        <CircleCheckBig size={26} className="mt-0.5 shrink-0" aria-hidden />
        {audience === "tecnico"
          ? "Nessun problema nei dati delle ultime 24 ore."
          : "La centrale funziona: nelle ultime 24 ore non ci sono stati problemi."}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {view.findings.map((f) => {
        const s = STYLE[f.severity];
        const I = f.rule === "offline" ? WifiOff : s.icon;
        const work =
          view.openWork.find((w) => w.fromFinding === f.rule) ??
          (f.severity !== "consiglio" ? view.openWork.find((w) => w.kind === "guasto") : undefined);
        const tech = work?.technicianId ? technicians.find((t) => t.id === work.technicianId) : undefined;
        const since = sinceText(f);
        return (
          <li key={f.rule} className={cx("flex flex-col gap-3 rounded-xl border-2 p-4 sm:p-5", s.box)}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={cx("inline-flex items-center gap-1.5 text-small font-extrabold tracking-wide uppercase", s.ink)}>
                <I size={20} strokeWidth={2.5} aria-hidden />
                {s.word}
              </span>
              {since && <span className="text-small font-semibold text-ink-2">{since}</span>}
            </div>
            <h3 className="text-h3 font-bold leading-snug">{f.title}</h3>
            <p className="text-body">{f.detail}</p>

            {audience === "tecnico" && (
              <div className="flex gap-3 rounded-lg bg-sheet p-3">
                <Search size={22} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
                <p>
                  <strong>Cosa controllare: </strong>
                  {f.check}
                </p>
              </div>
            )}

            {work ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                <Wrench size={20} aria-hidden />
                {audience === "tecnico" ? (
                  <>
                    Intervento {work.number} {WORK_STATUS_LABEL[work.status].toLowerCase()}
                    {tech ? `, ${tech.name}` : ""}.
                    <Link to={`/interventi/${work.id}`} className="underline decoration-2 underline-offset-4">
                      Apri l'intervento
                    </Link>
                  </>
                ) : (
                  <>{firmProgress(view, work)}</>
                )}
              </p>
            ) : audience === "tecnico" ? (
              <div>
                <LinkButton
                  to={`/interventi/nuovo?centrale=${view.plant.id}&regola=${f.rule}`}
                  icon={Wrench}
                  variant={f.severity === "consiglio" ? "secondary" : "primary"}
                >
                  {f.severity === "consiglio" ? "Programma una regolazione" : "Apri un intervento"}
                </LinkButton>
              </div>
            ) : (
              <p className="font-semibold text-ink-2">{view.maintainer.name} riceve lo stesso avviso.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
