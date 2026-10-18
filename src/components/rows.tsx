import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, FileText, Siren } from "lucide-react";
import { fmtDate, fmtDay, fmtDayTime, fmtEuro } from "../logica/index.ts";
import { DOC_KIND_LABEL, WORK_KIND_LABEL, type Doc, type QuoteItem } from "../logica/index.ts";
import type { QuoteRow, WorkRow } from "../api/types.ts";
import { fmtAgo } from "../lib/format.ts";
import { useToast } from "./Toast.tsx";
import { QuoteStatusPill, WorkStatusPill, cx } from "./ui.tsx";

function RowShell({ to, children, className }: { to?: string; children: ReactNode; className?: string }) {
  const cls = cx("flex flex-col gap-1.5 rounded-xl border-2 border-rule bg-sheet p-4", to && "group hover:border-ink", className);
  if (!to) return <div className={cls}>{children}</div>;
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}

export function workWhen({ work: w, technician: t }: WorkRow): string {
  switch (w.status) {
    case "fatto":
      return `Fatto ${fmtDay(w.closedAt!)}${t ? ` da ${t.name}` : ""}`;
    case "in_corso":
    {
      const ago = fmtAgo(w.startedAt!);
      return ago === "adesso" ? `${t?.name ?? "Il tecnico"} è appena arrivato in centrale` : `${t?.name ?? "Il tecnico"} è in centrale da ${ago.replace(" fa", "")}`;
    }
    case "assegnato":
      return `${t?.name ?? "Tecnico da scegliere"}, ${w.scheduledFor ? fmtDayTime(w.scheduledFor) : "giorno da fissare"}`;
    default:
      return `Aperto ${fmtAgo(w.createdAt)}, nessun tecnico`;
  }
}

export function WorkRowItem({
  row,
  showBuilding = false,
  to,
  showCost = false,
  firm,
}: {
  row: WorkRow;
  showBuilding?: boolean;
  to?: string;
  showCost?: boolean;
  /** Nome della ditta, per l'amministratore che ne ha più d'una */
  firm?: string;
}) {
  const w = row.work;
  return (
    <RowShell to={to}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-small font-bold text-ink-2">
          {w.number} · {WORK_KIND_LABEL[w.kind]}
        </span>
        <WorkStatusPill status={w.status} />
      </div>
      <h3 className="text-lead font-bold leading-snug">{w.title}</h3>
      {showBuilding && (
        <p className="font-semibold">
          {row.building.name}
          {firm && <span className="font-normal text-ink-2"> · {firm}</span>}
        </p>
      )}
      <p className="flex flex-wrap items-center justify-between gap-x-4 text-small text-ink-2">
        <span>{workWhen(row)}</span>
        {showCost && w.cost !== null && (w.cost > 0 ? <strong className="num text-body text-ink">{fmtEuro(w.cost)}</strong> : <span>nel contratto</span>)}
        {to && <ChevronRight size={20} aria-hidden className="ml-auto text-ink-2 group-hover:text-ink" />}
      </p>
    </RowShell>
  );
}

export function QuoteRowItem({ row, to, who = "building" }: { row: QuoteRow; to?: string; who?: "building" | "maintainer" | "both" }) {
  const q = row.quote;
  return (
    <RowShell to={to}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-small font-bold text-ink-2">
          {q.number} · {fmtDate(q.createdAt)}
        </span>
        <span className="flex flex-wrap gap-2">
          {q.urgent && q.status === "in_attesa" && (
            <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-red bg-red-tint px-2.5 py-1.5 text-small font-bold leading-none text-red-ink">
              <Siren size={18} aria-hidden /> Urgente
            </span>
          )}
          <QuoteStatusPill status={q.status} />
        </span>
      </div>
      <h3 className="text-lead font-bold leading-snug">{q.title}</h3>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-semibold">
          {who === "building" ? row.building.name : who === "maintainer" ? row.maintainer.name : `${row.building.name} · ${row.maintainer.name}`}
        </span>
        <span className="num text-h3 font-extrabold">{fmtEuro(row.total)}</span>
      </p>
    </RowShell>
  );
}

export function QuoteItems({ items, total }: { items: QuoteItem[]; total: number }) {
  return (
    <>
      {/* Telefono: una voce per riga, niente tabella da scorrere di lato */}
      <div className="flex flex-col rounded-xl border-2 border-rule bg-sheet sm:hidden">
        <ul className="divide-y divide-rule">
          {items.map((i, n) => (
            <li key={n} className="flex flex-col gap-1 px-4 py-3">
              <span className="font-semibold">{i.label}</span>
              <span className="num flex flex-wrap items-baseline justify-between gap-x-3 text-ink-2">
                <span>
                  {i.qty.toLocaleString("it-IT")} {i.unit} × {fmtEuro(i.price)}
                </span>
                <strong className="text-lead text-ink">{fmtEuro(i.qty * i.price)}</strong>
              </span>
            </li>
          ))}
        </ul>
        <p className="num flex items-baseline justify-between gap-3 border-t-2 border-ink px-4 py-3">
          <span className="font-bold">Totale, IVA esclusa</span>
          <span className="text-h3 font-extrabold">{fmtEuro(total)}</span>
        </p>
      </div>
      <QuoteTable items={items} total={total} />
    </>
  );
}

function QuoteTable({ items, total }: { items: QuoteItem[]; total: number }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border-2 border-rule sm:block">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-small text-ink-2">
            <th scope="col" className="border-b-2 border-rule px-4 py-2 font-bold">Voce</th>
            <th scope="col" className="border-b-2 border-rule px-4 py-2 text-right font-bold">Quantità</th>
            <th scope="col" className="border-b-2 border-rule px-4 py-2 text-right font-bold whitespace-nowrap">Prezzo</th>
            <th scope="col" className="border-b-2 border-rule px-4 py-2 text-right font-bold">Importo</th>
          </tr>
        </thead>
        <tbody className="num">
          {items.map((i, n) => (
            <tr key={n} className="border-b border-rule">
              <td className="px-4 py-3">{i.label}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {i.qty.toLocaleString("it-IT")} {i.unit}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">{fmtEuro(i.price)}</td>
              <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{fmtEuro(i.qty * i.price)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3} className="px-4 py-3 text-right text-lead font-bold">
              Totale, IVA esclusa
            </th>
            <td className="num px-4 py-3 text-right text-h3 font-extrabold whitespace-nowrap">{fmtEuro(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function DocList({ docs }: { docs: Doc[] }) {
  const toast = useToast();
  return (
    <ul className="flex flex-col divide-y divide-rule rounded-xl border-2 border-rule bg-sheet">
      {docs.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => toast("Nella demo i documenti non si aprono: nella versione vera si apre il PDF.")}
            className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunk"
          >
            <FileText size={26} className="shrink-0 text-ink-2" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">{d.title}</span>
              <span className="text-small text-ink-2">
                {DOC_KIND_LABEL[d.kind]} · {fmtDate(d.issuedAt)}
                {d.expiresAt ? ` · scade il ${fmtDate(d.expiresAt)}` : ""} · {d.file}
              </span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-ink-2" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
