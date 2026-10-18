import { useState } from "react";
import { Link } from "react-router";
import { CalendarPlus, Flame, Wrench } from "lucide-react";
import { dayKey, fmtDay, fmtDayTime, fmtToday, greeting, joinIt } from "../logica/index.ts";
import { type PlantStatus, type PlantView, type PreSeason } from "../logica/index.ts";
import type { Me, WorkRow } from "../api/types.ts";
import { PlantCard } from "../components/plant/PlantCard.tsx";
import { WorkRowItem } from "../components/rows.tsx";
import { ErrorState, LinkButton, Loading, PageHeader, SectionTitle, cx } from "../components/ui.tsx";
import { plural } from "../lib/format.ts";
import { useFleet } from "../lib/queries.ts";

const PROBLEM: PlantStatus[] = ["blocco", "attenzione", "offline"];

function summary(views: PlantView[]): string {
  const n = (s: PlantStatus) => views.filter((v) => v.status === s).length;
  const parts: string[] = [];
  if (n("blocco")) parts.push(`${n("blocco")} in blocco`);
  if (n("attenzione")) parts.push(`${n("attenzione")} da controllare`);
  if (n("offline")) parts.push(`${n("offline")} ${n("offline") === 1 ? "non raggiungibile" : "non raggiungibili"}`);
  const ok = n("ok");
  if (!parts.length) return `Tutte le ${views.length} centrali funzionano.`;
  return `${joinIt(parts)}.${ok ? ` ${plural(ok, "funziona", "funzionano")} senza problemi.` : ""}`;
}

function PreSeasonPanel({ ps, views, work }: { ps: PreSeason; views: PlantView[]; work: WorkRow[] }) {
  const name = (plantId: string) => views.find((v) => v.plant.id === plantId)?.building.name ?? "";
  const tech = (id: string) => work.find((w) => w.work.id === id)?.technician?.name;
  const days = ps.season.daysToStart ?? 0;
  return (
    <section aria-labelledby="ps-title" className="flex flex-col gap-4 rounded-xl border-2 border-ink bg-sheet p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-signal text-[#14202e]">
          <Flame size={24} strokeWidth={2.25} aria-hidden />
        </span>
        <div>
          <h2 id="ps-title" className="text-h3 font-bold">
            Prove di prima accensione
          </h2>
          <p className="text-ink-2">
            In zona E il riscaldamento si accende {fmtDay(ps.season.start!)}, {days === 1 ? "domani" : `tra ${days} giorni`}.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-lead font-bold">
          Fatte <span className="num">{ps.done}</span> su <span className="num">{ps.total}</span>
        </p>
        <div className="meter" role="img" aria-label={`${ps.done} prove fatte su ${ps.total}`}>
          <span style={{ width: `${(ps.done / Math.max(1, ps.total)) * 100}%`, background: "var(--green)" }} />
        </div>
      </div>
      {ps.upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-small font-bold text-ink-2">In programma</h3>
          <ul className="flex flex-col gap-2">
            {ps.upcoming.map((w) => (
              <li key={w.id}>
                <Link to={`/interventi/${w.id}`} className="flex flex-col rounded-lg border border-rule px-3 py-2 hover:border-ink">
                  <span className="font-bold">{name(w.plantId)}</span>
                  <span className="text-small text-ink-2">
                    {w.scheduledFor ? fmtDayTime(w.scheduledFor) : "Giorno da fissare"}
                    {tech(w.id) ? `, ${tech(w.id)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {ps.missing.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-small font-bold text-red-ink">Ancora da programmare</h3>
          <ul className="flex flex-col gap-2">
            {ps.missing.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{b.name}</span>
                <LinkButton to={`/interventi/nuovo?centrale=${b.plantId}&controllo=prima_accensione`} variant="secondary" icon={CalendarPlus}>
                  Programma
                </LinkButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function Fleet({ me }: { me: Me }) {
  const q = useFleet();
  const [onlyProblems, setOnlyProblems] = useState(false);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { views, preSeason, openWork } = q.data;
  const problems = views.filter((v) => PROBLEM.includes(v.status));
  const shown = onlyProblems ? problems : views;
  const workFor = (plantId: string) => openWork.find((w) => w.work.plantId === plantId);
  const today = dayKey(new Date());
  const agenda = openWork.filter(
    (w) => w.work.status === "in_corso" || (w.work.scheduledFor && dayKey(w.work.scheduledFor) === today) || w.work.status === "da_assegnare",
  );

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${me.user.name.split(" ")[0]}`}
        subtitle={`${fmtToday().replace(/^./, (c) => c.toUpperCase())}. ${summary(views)}`}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="fleet-title" className="flex min-w-0 flex-col gap-4">
          <SectionTitle
            aside={
              <div role="group" aria-label="Quali centrali mostrare" className="grid grid-cols-2 rounded-lg border-2 border-ink p-0.5">
                {[
                  { v: false, label: `Tutte (${views.length})` },
                  { v: true, label: `Con problemi (${problems.length})` },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={onlyProblems === o.v}
                    onClick={() => setOnlyProblems(o.v)}
                    className={cx("min-h-11 rounded-md px-3 font-bold", onlyProblems === o.v ? "bg-primary-bg text-primary-fg" : "hover:bg-sunk")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            }
          >
            <span id="fleet-title">Le tue centrali</span>
          </SectionTitle>
          <p className="-mt-2 text-small text-ink-2">In cima quelle che hanno bisogno di te.</p>
          <ul className="flex flex-col gap-3">
            {shown.map((v) => (
              <li key={v.plant.id}>
                <PlantCard view={v} work={workFor(v.plant.id)} />
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex flex-col gap-8">
          {preSeason && <PreSeasonPanel ps={preSeason} views={views} work={openWork} />}
          <section aria-labelledby="agenda-title" className="flex flex-col gap-3">
            <SectionTitle aside={<LinkButton to="/interventi" variant="quiet">Tutti</LinkButton>}>
              <span id="agenda-title">Oggi</span>
            </SectionTitle>
            {agenda.length ? (
              <ul className="flex flex-col gap-3">
                {agenda.map((w) => (
                  <li key={w.work.id}>
                    <WorkRowItem row={w} showBuilding to={`/interventi/${w.work.id}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-ink-2">
                <Wrench size={20} aria-hidden /> Nessun intervento per oggi.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
