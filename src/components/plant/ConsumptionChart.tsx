import { useState, type KeyboardEvent } from "react";
import type { Consumption } from "../../logica/index.ts";
import { useBox } from "./Chart24h.tsx";

/*
 * Consumi mese per mese: stagione di riferimento (barra piena) contro la precedente (barra vuota).
 * Pieno/vuoto distingue le due serie anche senza colori. Un solo asse, in Sm³ (o litri, kWh).
 */

const MONTH_FULL: Record<string, string> = {
  ott: "Ottobre",
  nov: "Novembre",
  dic: "Dicembre",
  gen: "Gennaio",
  feb: "Febbraio",
  mar: "Marzo",
  apr: "Aprile",
};

const int = (n: number) => Math.round(n).toLocaleString("it-IT");

function niceMax(v: number): { max: number; step: number } {
  const raw = v / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return { max: Math.ceil(v / step) * step, step };
}

export function consumptionSentence(c: Consumption): string | null {
  if (c.perGgCurrent === null) return null;
  const pct = Math.round(((c.perGgCurrent - c.perGgPrevious) / c.perGgPrevious) * 100);
  const how = pct === 0 ? "come" : pct < 0 ? `il ${-pct}% in meno della` : `il ${pct}% in più della`;
  return `Tenendo conto di quanto ha fatto freddo (gradi giorno), la stagione ${c.seasonLabelCurrent} ha consumato ${how} stagione ${c.seasonLabelPrevious}.`;
}

export function ConsumptionChart({ c }: { c: Consumption }) {
  const [ref, { width, rem }] = useBox();
  const [cursor, setCursor] = useState<number | null>(null);
  const months = c.months;
  const top = Math.max(...months.map((m) => Math.max(m.previous, m.current ?? 0)), 1);
  const { max, step } = niceMax(top);
  const m = { top: rem * 1.7, right: rem * 0.5, left: rem * 3.6 };
  const plotH = Math.round(rem * 12);
  const plotW = Math.max(60, width - m.left - m.right);
  const height = Math.round(m.top + plotH + rem * 1.8);
  const group = plotW / months.length;
  const barW = Math.min(rem * 1.6, (group - rem * 0.9) / 2);
  const y = (v: number) => m.top + plotH - (v / max) * plotH;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);

  const sel = cursor === null ? null : months[cursor]!;

  /** Barra con angoli arrotondati solo in alto, appoggiata alla linea di base. */
  const bar = (x: number, v: number) => {
    const h = Math.max(0, (v / max) * plotH);
    const r = Math.min(4, h, barW / 2);
    const y0 = m.top + plotH;
    return `M${x} ${y0} V${y0 - h + r} Q${x} ${y0 - h} ${x + r} ${y0 - h} H${x + barW - r} Q${x + barW} ${y0 - h} ${x + barW} ${y0 - h + r} V${y0} Z`;
  };

  const onKey = (e: KeyboardEvent) => {
    const i = cursor ?? -1;
    if (e.key === "ArrowRight") setCursor(Math.min(months.length - 1, i + 1));
    else if (e.key === "ArrowLeft") setCursor(Math.max(0, i < 0 ? months.length - 1 : i - 1));
    else if (e.key === "Escape") setCursor(null);
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-small font-semibold">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-4 w-4 rounded-sm" style={{ background: "var(--bar)" }} />
          Stagione {c.seasonLabelCurrent}
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-4 w-4 rounded-sm border-2" style={{ borderColor: "var(--edge)", background: "var(--sunk)" }} />
          Stagione {c.seasonLabelPrevious}
        </span>
      </div>

      <p aria-live="polite" className="min-h-[3em] rounded-lg bg-paper px-3 py-2 text-small">
        {sel ? (
          <>
            <strong>{MONTH_FULL[sel.label] ?? sel.label}</strong>: {sel.current === null ? "non ancora" : `${int(sel.current)} ${c.unit}`} nella stagione {c.seasonLabelCurrent},{" "}
            {int(sel.previous)} {c.unit} in quella prima. Gradi giorno del mese: {sel.gg}.
          </>
        ) : (
          <span className="text-ink-2">Passa sopra un mese, o toccalo, per leggere i valori.</span>
        )}
      </p>

      <div ref={ref} tabIndex={0} onKeyDown={onKey} aria-label="Grafico dei consumi per mese. Usa le frecce per leggere i mesi." className="rounded-lg">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`Consumi per mese, in ${c.unit}, stagione ${c.seasonLabelCurrent} confrontata con ${c.seasonLabelPrevious}.`} className="block select-none">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={m.left} x2={m.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
                <text x={m.left - rem * 0.4} y={y(v)} dy="0.35em" textAnchor="end" fill="var(--ink-2)" style={{ fontSize: "0.8rem" }} className="num">
                  {int(v)}
                </text>
              </g>
            ))}
            <text x={0} y={rem * 0.8} fill="var(--ink-2)" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
              {c.unit}
            </text>
            {months.map((mo, i) => {
              const gx = m.left + i * group;
              const x0 = gx + (group - (barW * 2 + 2)) / 2;
              const active = cursor === i;
              return (
                <g key={mo.key}>
                  {active && <rect x={gx + 2} y={m.top} width={group - 4} height={plotH} fill="var(--sunk)" rx="4" />}
                  {/* Stagione precedente: barra vuota */}
                  <path d={bar(x0 + barW + 2, mo.previous)} fill="var(--sheet)" stroke="var(--edge)" strokeWidth="2" />
                  {/* Stagione di riferimento: barra piena */}
                  {mo.current !== null && <path d={bar(x0, mo.current)} fill="var(--bar)" />}
                  <text x={gx + group / 2} y={m.top + plotH + rem * 1.25} textAnchor="middle" fill={active ? "var(--ink)" : "var(--ink-2)"} style={{ fontSize: "0.8rem", fontWeight: active ? 800 : 400 }}>
                    {mo.label}
                  </text>
                  <rect
                    x={gx}
                    y={0}
                    width={group}
                    height={height}
                    fill="transparent"
                    onPointerEnter={() => setCursor(i)}
                    onPointerDown={() => setCursor(i)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && setCursor(null)}
                  />
                </g>
              );
            })}
            <line x1={m.left} x2={m.left + plotW} y1={m.top + plotH} y2={m.top + plotH} stroke="var(--edge)" strokeWidth="1.5" />
          </svg>
        )}
      </div>

      <details className="group rounded-xl border-2 border-rule">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 font-bold">
          <span className="underline decoration-2 underline-offset-4 decoration-edge group-open:no-underline">Vedi i consumi in tabella</span>
        </summary>
        <div className="overflow-x-auto border-t border-rule">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-small text-ink-2">
                <th scope="col" className="border-b-2 border-rule px-3 py-2">Mese</th>
                <th scope="col" className="border-b-2 border-rule px-3 py-2 text-right">{c.seasonLabelCurrent}</th>
                <th scope="col" className="border-b-2 border-rule px-3 py-2 text-right">{c.seasonLabelPrevious}</th>
                <th scope="col" className="border-b-2 border-rule px-3 py-2 text-right">Gradi giorno</th>
              </tr>
            </thead>
            <tbody className="num">
              {months.map((mo) => (
                <tr key={mo.key} className="border-b border-rule last:border-b-0">
                  <th scope="row" className="px-3 py-2 font-bold">{MONTH_FULL[mo.label] ?? mo.label}</th>
                  <td className="px-3 py-2 text-right">{mo.current === null ? "—" : `${int(mo.current)} ${c.unit}`}</td>
                  <td className="px-3 py-2 text-right">{int(mo.previous)} {c.unit}</td>
                  <td className="px-3 py-2 text-right">{mo.gg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
