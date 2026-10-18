import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { fmtTime } from "../../logica/index.ts";
import { STEP_MIN, type PlantView, type TelemetryPoint } from "../../logica/index.ts";
import { usePrefs } from "../../lib/prefs.tsx";
import { cx } from "../ui.tsx";

/*
 * Grafico delle ultime 24 ore.
 * - Mandata e ritorno nei colori delle tubazioni (arancio e blu), linee piene.
 * - La temperatura chiesta dalla curva climatica: puntini arancio, si legge "la mandata dovrebbe stare qui".
 * - Fuori: tratteggio neutro, è un riferimento.
 * - Fascia grigia: ore in cui il riscaldamento è acceso. Striscia sotto: quanto lavora il bruciatore.
 * Un solo asse (°C). Passando sopra, o con le frecce della tastiera, i valori di quell'istante.
 */

const STEP_MS = STEP_MIN * 60_000;
const DAY_MS = 24 * 3_600_000;

type Key = "supply" | "return" | "target" | "outdoor";

interface Series {
  key: Key;
  label: string;
  short: string;
  color: string;
  width: number;
  dash?: string;
}

const SERIES: Series[] = [
  { key: "supply", label: "Mandata", short: "Mandata", color: "var(--hot)", width: 2.5 },
  { key: "return", label: "Ritorno", short: "Ritorno", color: "var(--cold)", width: 2.5 },
  { key: "target", label: "Chiesta dalla curva", short: "Chiesta", color: "var(--hot)", width: 3, dash: "0.1 7" },
  { key: "outdoor", label: "Fuori", short: "Fuori", color: "var(--edge)", width: 2, dash: "7 5" },
];

const num = (n: number, d = 1) => n.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

const valueOf = (p: TelemetryPoint, k: Key): number | null => (k === "target" ? p.target : p[k]);

/** "al 45%", "fermo", "in blocco"; in cascata il blocco di una caldaia non ferma le altre. */
function burnerText(p: TelemetryPoint, cascade: boolean): string {
  const base = p.burner ? `al ${p.burner}%` : "fermo";
  if (!p.lockout) return base;
  return cascade ? `${base}, una caldaia in blocco` : "in blocco";
}

export function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const { size } = usePrefs();
  const [box, setBox] = useState({ width: 0, rem: 18 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Una misura a zero (pagina nascosta, stampa, cattura) non deve far sparire il grafico.
    const measure = () => {
      const width = Math.round(el.clientWidth);
      if (width > 0) setBox({ width, rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 18 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);
  return [ref, box] as const;
}

export function Swatch({ s }: { s: Pick<Series, "color" | "width" | "dash"> }) {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden className="shrink-0">
      <line x1="3" x2="25" y1="6" y2="6" stroke={s.color} strokeWidth={s.width + 0.5} strokeDasharray={s.dash} strokeLinecap="round" />
    </svg>
  );
}

/** Tratti continui in cui una condizione è vera: [indice iniziale, indice finale]. */
function runs(pts: TelemetryPoint[], cond: (p: TelemetryPoint) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  pts.forEach((p, i) => {
    if (cond(p)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      out.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, pts.length - 1]);
  return out;
}

/** Sposta le etichette a destra quel tanto che basta per non sovrapporle. */
function spread(items: { y: number }[], gap: number, top: number, bottom: number) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.y - sorted[i - 1]!.y < gap) sorted[i]!.y = sorted[i - 1]!.y + gap;
  }
  const overflow = sorted.length ? sorted[sorted.length - 1]!.y - bottom : 0;
  if (overflow > 0) for (const s of sorted) s.y -= overflow;
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i + 1]!.y - sorted[i]!.y < gap) sorted[i]!.y = sorted[i + 1]!.y - gap;
  }
  for (const s of sorted) s.y = Math.max(top, s.y);
}

export function Chart24h({ view }: { view: PlantView }) {
  const pts = view.telemetry.points;
  const [ref, { width, rem }] = useBox();
  const [cursor, setCursor] = useState<number | null>(null);
  const offline = view.status === "offline";

  const end = useMemo(() => Math.floor(Date.now() / STEP_MS) * STEP_MS, [pts]);
  const start = end - DAY_MS;

  const wide = width >= 34 * rem;
  const m = { top: rem * 0.8, right: wide ? rem * 6.4 : rem * 0.9, bottom: 0, left: rem * 2.7 };
  const plotH = Math.round(rem * (wide ? 15 : 13));
  const plotW = Math.max(40, width - m.left - m.right);
  const xLabelsY = m.top + plotH + rem * 1.25;
  const stripLabelY = xLabelsY + rem * 1.35;
  const stripY = stripLabelY + rem * 0.45;
  const stripH = rem * 0.95;
  const height = Math.round(stripY + stripH + rem * 0.3);

  const { y0, y1, ticks } = useMemo(() => {
    const vals: number[] = [];
    for (const p of pts) {
      vals.push(p.supply, p.return, p.outdoor);
      if (p.target !== null) vals.push(p.target);
    }
    const lo = Math.min(...vals);
    const hi = Math.max(...vals, 28);
    const step = hi - lo > 45 ? 20 : 10;
    const a = Math.floor((lo - 1) / step) * step;
    const b = Math.ceil((hi + 2) / step) * step;
    const t: number[] = [];
    for (let v = a; v <= b; v += step) t.push(v);
    return { y0: a, y1: b, ticks: t };
  }, [pts]);

  if (!pts.length) return null;

  const x = (t: number) => m.left + ((t - start) / DAY_MS) * plotW;
  const y = (v: number) => m.top + plotH - ((v - y0) / (y1 - y0)) * plotH;
  const stepW = (STEP_MS / DAY_MS) * plotW;

  const pathOf = (k: Key) => {
    let d = "";
    let pen = false;
    for (const p of pts) {
      const v = valueOf(p, k);
      if (v === null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(p.t).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    }
    return d;
  };

  const shown = SERIES.filter((s) => s.key !== "target" || pts.some((p) => p.target !== null));
  const last = pts[pts.length - 1]!;
  const idx = cursor ?? pts.length - 1;
  const cur = pts[idx]!;

  // Etichette dirette alla fine di ogni linea (solo su schermi larghi)
  const labels = shown
    .map((s) => {
      let lastV: number | null = null;
      for (let i = pts.length - 1; i >= 0 && lastV === null; i--) lastV = valueOf(pts[i]!, s.key);
      return lastV === null ? null : { s, y: y(lastV) };
    })
    .filter((l): l is { s: Series; y: number } => l !== null);
  spread(labels, rem * 1.05, m.top + rem * 0.4, m.top + plotH);

  // Tacche orarie: ogni 3 ore, ogni 6 o 12 se il grafico è stretto, più "adesso" alla fine
  const every = plotW > rem * 26 ? 3 : plotW > rem * 14 ? 6 : 12;
  const hourTicks: { t: number; label: string }[] = [];
  for (let t = Math.ceil(start / 3_600_000) * 3_600_000; t <= end; t += 3_600_000) {
    const label = fmtTime(t);
    const h = Number(label.slice(0, 2));
    if (h % every === 0 && x(end) - x(t) > rem * 3.2) hourTicks.push({ t, label });
  }

  const heatingRuns = runs(pts, (p) => p.heating);
  const lockRuns = runs(pts, (p) => p.lockout);
  const gapFrom = offline ? last.t + STEP_MS : null;

  const pick = (clientX: number, target: Element) => {
    const r = target.getBoundingClientRect();
    const t = start + ((clientX - r.left - m.left) / plotW) * DAY_MS;
    const i = Math.round((t - pts[0]!.t) / STEP_MS);
    setCursor(Math.max(0, Math.min(pts.length - 1, i)));
  };

  const onKey = (e: KeyboardEvent) => {
    const i = cursor ?? pts.length - 1;
    const jump = e.shiftKey ? 6 : 1;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = i - jump;
    else if (e.key === "ArrowRight") next = i + jump;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = pts.length - 1;
    else if (e.key === "Escape") return setCursor(null);
    if (next === null) return;
    e.preventDefault();
    setCursor(Math.max(0, Math.min(pts.length - 1, next)));
  };

  const heatingNever = heatingRuns.length === 0;
  const cascade = view.plant.generators.length > 1;
  const hasDhw = pts.some((p) => p.dhw !== null);

  return (
    <div className="@container flex flex-col gap-4">
      {/* Valori dell'istante scelto: fanno anche da legenda */}
      <div aria-live="polite" className="flex flex-col gap-2 rounded-xl bg-paper p-3 sm:p-4">
        <p className="text-small font-bold text-ink-2">
          {cursor === null ? (offline ? `Ultimo dato ricevuto, alle ${fmtTime(cur.t)}` : `Adesso, alle ${fmtTime(cur.t)}`) : `Alle ${fmtTime(cur.t)}`}
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 @md:grid-cols-3 @3xl:grid-cols-6">
          {shown.map((s) => {
            const v = valueOf(cur, s.key);
            return (
              <div key={s.key} className="flex min-w-0 flex-col">
                <dt className="flex items-center gap-1.5 text-small font-semibold text-ink-2">
                  <Swatch s={s} />
                  {s.label}
                </dt>
                <dd className="num text-lead font-extrabold">{v === null ? "spento" : `${num(v)} °C`}</dd>
              </div>
            );
          })}
          <div className="flex min-w-0 flex-col">
            <dt className="flex items-center gap-1.5 text-small font-semibold text-ink-2">
              <span aria-hidden className="inline-block h-3 w-7 shrink-0 rounded-sm" style={{ background: cur.lockout ? "var(--red)" : "var(--hot)", opacity: cur.lockout ? 1 : 0.35 + (cur.burner / 100) * 0.65 }} />
              Bruciatore
            </dt>
            <dd className="num text-lead font-extrabold">
              {cur.lockout && !cascade ? "in blocco" : cur.burner ? `al ${cur.burner}%` : "fermo"}
              {cur.lockout && cascade && <span className="block text-small font-bold text-red-ink">una caldaia in blocco</span>}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col">
            <dt className="text-small font-semibold text-ink-2">Pressione</dt>
            <dd className="num text-lead font-extrabold">{num(cur.pressure, 2)} bar</dd>
          </div>
        </dl>
      </div>

      <div
        ref={ref}
        tabIndex={0}
        onKeyDown={onKey}
        aria-label="Grafico delle ultime 24 ore. Con le frecce sinistra e destra scorri i valori, ogni 10 minuti."
        className="relative touch-pan-y rounded-lg"
      >
        {width > 0 && (
          <svg width={width} height={height} className="block select-none" role="img" aria-label={`Temperature delle ultime 24 ore: mandata ora a ${num(last.supply)} °C, ritorno a ${num(last.return)} °C, fuori ${num(last.outdoor)} °C.`}>
            <defs>
              <pattern id="nodata" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="var(--slate)" strokeWidth="2" opacity="0.5" />
              </pattern>
            </defs>

            {/* Ore di riscaldamento acceso */}
            {heatingRuns.map(([a, b]) => (
              <rect key={a} x={x(pts[a]!.t)} y={m.top} width={Math.max(1, x(pts[b]!.t) - x(pts[a]!.t) + stepW)} height={plotH} fill="var(--sunk)" />
            ))}

            {/* Griglia e asse delle temperature */}
            {ticks.map((v) => (
              <g key={v}>
                <line x1={m.left} x2={m.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={v === 0 ? 1.5 : 1} />
                <text x={m.left - rem * 0.4} y={y(v)} dy="0.35em" textAnchor="end" fill="var(--ink-2)" style={{ fontSize: "0.8rem" }} className="num">
                  {v}°
                </text>
              </g>
            ))}

            {/* Periodo senza dati */}
            {gapFrom !== null && x(end) - x(gapFrom) > 2 && (
              <g>
                <rect x={x(gapFrom)} y={m.top} width={x(end) - x(gapFrom)} height={plotH} fill="url(#nodata)" />
                {x(end) - x(gapFrom) > rem * 5 && (
                  <text x={(x(gapFrom) + x(end)) / 2} y={m.top + rem * 1.2} textAnchor="middle" fill="var(--slate-ink)" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                    Nessun dato
                  </text>
                )}
              </g>
            )}

            {/* Linee */}
            {[...shown].reverse().map((s) => (
              <path
                key={s.key}
                d={pathOf(s.key)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Etichette dirette */}
            {wide &&
              labels.map(({ s, y: ly }) => (
                <g key={s.key} transform={`translate(${m.left + plotW + rem * 0.5} ${ly})`}>
                  <line x1="0" x2={rem * 1.1} y1="0" y2="0" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" />
                  <text x={rem * 1.45} dy="0.35em" fill="var(--ink)" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                    {s.short}
                  </text>
                </g>
              ))}

            {/* Asse del tempo */}
            {hourTicks.map((h) => (
              <g key={h.t}>
                <line x1={x(h.t)} x2={x(h.t)} y1={m.top + plotH} y2={m.top + plotH + rem * 0.3} stroke="var(--edge)" />
                <text x={x(h.t)} y={xLabelsY} textAnchor="middle" fill="var(--ink-2)" style={{ fontSize: "0.8rem" }} className="num">
                  {h.label}
                </text>
              </g>
            ))}
            <text x={x(end)} y={xLabelsY} textAnchor="end" fill="var(--ink)" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
              adesso
            </text>
            <line x1={m.left} x2={m.left + plotW} y1={m.top + plotH} y2={m.top + plotH} stroke="var(--edge)" strokeWidth="1.5" />

            {/* Striscia del bruciatore */}
            <text x={m.left} y={stripLabelY} fill="var(--ink-2)" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
              Bruciatore{lockRuns.length ? " (rosso = in blocco)" : ""}
            </text>
            <rect x={m.left} y={stripY} width={plotW} height={stripH} fill="var(--sunk)" rx="3" />
            {pts.map((p) =>
              p.burner > 0 ? (
                <rect key={p.t} x={x(p.t)} y={stripY} width={stepW + 0.4} height={stripH} fill="var(--hot)" opacity={0.3 + (p.burner / 100) * 0.7} />
              ) : null,
            )}
            {lockRuns.map(([a, b]) => (
              <rect key={`l${a}`} x={x(pts[a]!.t)} y={stripY + stripH * 0.55} width={Math.max(2, x(pts[b]!.t) - x(pts[a]!.t) + stepW)} height={stripH * 0.45} fill="var(--red)" />
            ))}

            {/* Cursore */}
            <g pointerEvents="none">
              <line x1={x(cur.t)} x2={x(cur.t)} y1={m.top} y2={stripY + stripH} stroke="var(--ink)" strokeWidth={cursor === null ? 1 : 1.5} strokeDasharray={cursor === null ? "2 3" : undefined} />
              {shown.map((s) => {
                const v = valueOf(cur, s.key);
                if (v === null) return null;
                return <circle key={s.key} cx={x(cur.t)} cy={y(v)} r="5" fill={s.key === "outdoor" ? "var(--edge)" : s.color} stroke="var(--sheet)" strokeWidth="2" />;
              })}
            </g>

            {/* Zona sensibile più grande della linea */}
            <rect
              x={m.left - 6}
              y={0}
              width={plotW + 12}
              height={height}
              fill="transparent"
              onPointerMove={(e: PointerEvent<SVGRectElement>) => pick(e.clientX, e.currentTarget.ownerSVGElement!)}
              onPointerDown={(e: PointerEvent<SVGRectElement>) => pick(e.clientX, e.currentTarget.ownerSVGElement!)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setCursor(null)}
            />
          </svg>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-small text-ink-2">
        {!heatingNever && (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block h-3.5 w-6 rounded-sm border border-rule bg-sunk" /> Fascia grigia: riscaldamento acceso
          </span>
        )}
        {offline && (
          <span className="inline-flex items-center gap-2">
            <svg width="24" height="14" aria-hidden>
              <rect width="24" height="14" fill="url(#nodata)" stroke="var(--rule)" />
            </svg>
            Righe: nessun dato dalla centrale
          </span>
        )}
        <span>Passa col dito o col mouse sul grafico per leggere i valori.</span>
      </div>

      {heatingNever && (
        <p className="rounded-lg border-l-4 border-edge bg-paper px-4 py-3 text-ink-2">
          {view.season.active
            ? "Nelle ultime 24 ore il riscaldamento non si è acceso: fuori faceva abbastanza caldo o era fuori orario."
            : "Il riscaldamento è fuori stagione: le tubazioni restano alla temperatura del locale caldaia."}
          {hasDhw && " Il bruciatore lavora a tratti solo per scaldare l'acqua calda."}
        </p>
      )}

      <HourlyTable pts={pts} cascade={cascade} />
    </div>
  );
}

/** Gli stessi dati in tabella, un'ora per riga, dalla più recente: per chi preferisce i numeri. */
function HourlyTable({ pts, cascade }: { pts: TelemetryPoint[]; cascade: boolean }) {
  const rows = pts.filter((_, i) => (pts.length - 1 - i) % 6 === 0).reverse();
  const hasDhw = pts.some((p) => p.dhw !== null);
  return (
    <details className="group rounded-xl border-2 border-rule">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 font-bold">
        <span className="underline decoration-2 underline-offset-4 decoration-edge group-open:no-underline">Vedi i valori ora per ora</span>
      </summary>
      <div className="max-h-[28rem] overflow-auto border-t border-rule">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-sheet">
            <tr className="text-small text-ink-2">
              {["Ora", "Fuori", "Mandata", "Ritorno", "Chiesta", "Pressione", ...(hasDhw ? ["Acqua calda"] : []), "Bruciatore"].map((h) => (
                <th key={h} scope="col" className="border-b-2 border-rule px-3 py-2 font-bold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((p) => (
              <tr key={p.t} className="border-b border-rule last:border-b-0">
                <th scope="row" className="px-3 py-2 font-bold">
                  {fmtTime(p.t)}
                </th>
                <td className="px-3 py-2 whitespace-nowrap">{num(p.outdoor)} °C</td>
                <td className="px-3 py-2 whitespace-nowrap">{num(p.supply)} °C</td>
                <td className="px-3 py-2 whitespace-nowrap">{num(p.return)} °C</td>
                <td className="px-3 py-2 whitespace-nowrap">{p.target === null ? "—" : `${num(p.target)} °C`}</td>
                <td className="px-3 py-2 whitespace-nowrap">{num(p.pressure, 2)} bar</td>
                {hasDhw && <td className="px-3 py-2 whitespace-nowrap">{p.dhw === null ? "—" : `${num(p.dhw)} °C`}</td>}
                <td className={cx("px-3 py-2 whitespace-nowrap", p.lockout && "font-bold text-red-ink")}>
                  {burnerText(p, cascade)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
