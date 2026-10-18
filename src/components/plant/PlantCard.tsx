import { Link } from "react-router";
import { ChevronRight, ShieldAlert, Wrench } from "lucide-react";
import { fmtDay, fmtDayTime } from "../../logica/index.ts";
import { WORK_STATUS_LABEL, type PlantView, type WorkOrder } from "../../logica/index.ts";
import type { WorkRow } from "../../api/types.ts";
import { fmtAgo, plural } from "../../lib/format.ts";
import { PlantStatusPill, cx, plantStripe } from "../ui.tsx";

const num = (n: number, d = 1) => n.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

/** A che punto è la ditta, in parole semplici: "Rossetto Impianti passa domani alle 9:00." */
export function firmProgress(v: PlantView, w?: WorkOrder): string {
  const m = v.maintainer.name;
  if (!w) return `${m} è stata avvisata.`;
  if (w.status === "in_corso") return `Il tecnico di ${m} è in centrale.`;
  if (w.status === "assegnato") return w.scheduledFor ? `${m} passa ${fmtDayTime(w.scheduledFor)}.` : `${m} ha già scelto il tecnico.`;
  return `${m} ha aperto un intervento.`;
}

/** L'intervento che riguarda un problema: quello aperto dall'allarme, o un guasto aperto. */
export function workFor(v: PlantView, rule?: string): WorkOrder | undefined {
  return v.openWork.find((w) => rule && w.fromFinding === rule) ?? v.openWork.find((w) => w.kind === "guasto");
}

/** Una frase per l'amministratore: cosa succede e chi se ne occupa. */
export function adminSentence(v: PlantView): string {
  const m = v.maintainer.name;
  const top = v.findings[0];
  switch (v.status) {
    case "non_collegata":
      return `${m} non usa ancora Quadra: qui vedi solo documenti e scadenze.`;
    case "offline":
      return `La centrale non manda dati da ${fmtAgo(v.telemetry.lastSeenAt!).replace(" fa", "")}. ${m} è stata avvisata.`;
    case "blocco":
    case "attenzione":
      return `${top?.title ?? "C'è qualcosa da controllare"}. ${firmProgress(v, workFor(v, top?.rule))}`;
    default: {
      const s = v.season;
      if (!s.active && s.start) return `Funziona. Il riscaldamento si accende ${fmtDay(s.start)}.`;
      return v.now?.heating ? "Funziona. Riscaldamento acceso." : "Funziona.";
    }
  }
}

export function PlantCard({ view: v, audience = "tecnico", work }: { view: PlantView; audience?: "tecnico" | "amministratore"; work?: WorkRow }) {
  const to = audience === "tecnico" ? `/centrali/${v.plant.id}` : `/condomini/${v.building.id}`;
  const late = v.deadlines.filter((d) => d.status === "scaduta");
  const top = v.findings[0];
  const p = v.now;
  return (
    <Link
      to={to}
      className={cx(
        "stripe group flex flex-col gap-3 rounded-xl border-2 border-rule bg-sheet p-4 hover:border-ink sm:p-5",
        plantStripe(v.status),
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col">
          <h3 className="text-h3 font-bold leading-tight">{v.building.name}</h3>
          <p className="text-small text-ink-2">
            {v.building.address}, {v.building.city} · {audience === "tecnico" ? `amm. ${v.admin.name}` : v.maintainer.name}
          </p>
        </div>
        <PlantStatusPill status={v.status} audience={audience} />
      </div>

      {audience === "tecnico" ? (
        <>
          {top ? (
            <p className="text-lead font-bold">{top.title}</p>
          ) : v.status === "non_collegata" ? (
            <p className="text-ink-2">Centrale senza modulo: solo scadenze e interventi.</p>
          ) : (
            <p className="font-semibold text-ink-2">Nessun problema nelle ultime 24 ore.</p>
          )}
          {p && v.status !== "offline" && (
            <p className="num flex flex-wrap gap-x-4 gap-y-1 text-small">
              <span>
                <span className="text-ink-2">Mandata </span>
                <strong>{num(p.supply)} °C</strong>
              </span>
              <span>
                <span className="text-ink-2">Ritorno </span>
                <strong>{num(p.return)} °C</strong>
              </span>
              <span>
                <span className="text-ink-2">Pressione </span>
                <strong>{num(p.pressure, 2)} bar</strong>
              </span>
              <span>
                <span className="text-ink-2">Fuori </span>
                <strong>{num(p.outdoor)} °C</strong>
              </span>
            </p>
          )}
        </>
      ) : (
        <p className="text-body">{adminSentence(v)}</p>
      )}

      {(work || late.length > 0) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-small font-semibold">
          {work && (
            <span className="inline-flex items-center gap-1.5">
              <Wrench size={18} aria-hidden />
              {WORK_STATUS_LABEL[work.work.status]}
              {work.technician ? `: ${work.technician.name}` : ""}
              {work.work.status === "assegnato" && work.work.scheduledFor ? `, ${fmtDayTime(work.work.scheduledFor)}` : ""}
            </span>
          )}
          {late.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-red-ink">
              <ShieldAlert size={18} aria-hidden />
              {plural(late.length, "controllo scaduto", "controlli scaduti")}
            </span>
          )}
        </div>
      )}
      <span className="mt-auto inline-flex items-center gap-1 self-end text-small font-bold text-ink-2 group-hover:text-ink">
        {audience === "tecnico" ? "Apri la centrale" : "Apri il condominio"}
        <ChevronRight size={18} aria-hidden />
      </span>
    </Link>
  );
}
