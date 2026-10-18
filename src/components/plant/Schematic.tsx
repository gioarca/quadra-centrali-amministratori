import type { CSSProperties, ReactNode } from "react";
import {
  CircleCheckBig,
  Fan,
  Flame,
  Gauge as GaugeIcon,
  Moon,
  OctagonAlert,
  Radio,
  ShowerHead,
  Thermometer,
  TriangleAlert,
  WifiOff,
  Building2,
} from "lucide-react";
import { fmtDay, fmtTime } from "../../logica/index.ts";
import {
  FUEL_LABEL,
  seasonSentence,
  type GeneratorState,
  type PlantView,
  type TelemetryPoint,
} from "../../logica/index.ts";
import { fmtAgo } from "../../lib/format.ts";
import { cx } from "../ui.tsx";

const num = (n: number, d = 1) =>
  n.toLocaleString("it-IT", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

/* ---------------------------------------------------------------------------
 * Tubazioni
 * ------------------------------------------------------------------------- */

function Pipe({
  axis,
  dir,
  color,
  flowing,
}: {
  axis: "x" | "y";
  dir: "forward" | "back";
  color: "hot" | "cold";
  flowing: boolean;
}) {
  return (
    <span
      aria-hidden
      className="pipe"
      data-axis={axis}
      data-dir={dir}
      data-flow={flowing ? "on" : "off"}
      style={{ "--pipe-color": `var(--${color})` } as CSSProperties}
    />
  );
}

function PipeLabel({
  name,
  value,
  color,
  note,
}: {
  name: string;
  value: string;
  color: "hot" | "cold";
  note?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-2 text-small font-bold text-ink-2">
        <span
          aria-hidden
          className="inline-block h-3 w-5 rounded-full"
          style={{ background: `var(--${color})` }}
        />
        {name}
      </span>
      <span className="num text-h2 font-extrabold leading-tight">{value}</span>
      {note && <span className="text-small text-ink-2">{note}</span>}
    </div>
  );
}

function Pipes({ p, flowing }: { p: TelemetryPoint; flowing: boolean }) {
  const dt = p.supply - p.return;
  const rest = flowing ? undefined : "a riposo";
  return (
    <div className="flex flex-col justify-center">
      {/* Schermo largo: tubazioni orizzontali tra generatori e utenze */}
      <div className="hidden flex-col gap-7 px-4 py-2 @2xl:flex">
        <div className="flex flex-col gap-2">
          <PipeLabel
            name="Mandata"
            value={`${num(p.supply)} °C`}
            color="hot"
            note={rest}
          />
          <Pipe axis="x" dir="forward" color="hot" flowing={flowing} />
        </div>
        <div className="flex flex-col gap-2">
          <Pipe axis="x" dir="back" color="cold" flowing={flowing} />
          <PipeLabel
            name="Ritorno"
            value={`${num(p.return)} °C`}
            color="cold"
            note={rest}
          />
        </div>
        {flowing && (
          <p className="text-small text-ink-2">
            Differenza <strong className="num text-ink">{num(dt)} °C</strong>
          </p>
        )}
      </div>
      {/* Telefono: tubazioni verticali, la mandata scende verso le utenze */}
      <div className="grid grid-cols-2 gap-4 py-5 @2xl:hidden">
        <div className="flex items-stretch gap-4">
          <Pipe axis="y" dir="forward" color="hot" flowing={flowing} />
          <div className="flex flex-col justify-center">
            <PipeLabel
              name="Mandata"
              value={`${num(p.supply)} °C`}
              color="hot"
              note={rest ?? "verso le utenze"}
            />
          </div>
        </div>
        <div className="flex items-stretch gap-4">
          <Pipe axis="y" dir="back" color="cold" flowing={flowing} />
          <div className="flex flex-col justify-center">
            <PipeLabel
              name="Ritorno"
              value={`${num(p.return)} °C`}
              color="cold"
              note={rest ?? `differenza ${num(dt)} °C`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Generatori e utenze
 * ------------------------------------------------------------------------- */

function GeneratorCard({ g, detail }: { g: GeneratorState; detail: string }) {
  const I = g.kind === "pompa_di_calore" ? Fan : Flame;
  const blocked = g.state === "blocco";
  const on = g.state === "acceso";
  return (
    <article
      className={cx(
        "flex flex-col gap-3 rounded-xl border-2 p-4",
        blocked ? "border-red bg-red-tint" : "border-ink bg-sheet",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cx(
            "grid size-12 shrink-0 place-items-center rounded-lg",
            on ? "bg-hot-tint text-hot" : "bg-sunk text-ink-2",
          )}
        >
          <I size={28} strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-h3 font-bold leading-tight">{g.label}</h3>
          <p className="text-small text-ink-2">{detail}</p>
        </div>
      </div>
      {blocked ? (
        <p className="flex items-center gap-2 text-lead font-extrabold text-red-ink">
          <OctagonAlert size={24} strokeWidth={2.5} aria-hidden />
          In blocco, codice {g.code}
        </p>
      ) : on ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-lead font-bold">
            {g.kind === "pompa_di_calore" ? "In funzione" : "Accesa"} al{" "}
            <span className="num">{g.modulation}%</span>
          </p>
          <div className="meter" aria-hidden>
            <span
              style={{ width: `${g.modulation}%`, background: "var(--hot)" }}
            />
          </div>
        </div>
      ) : (
        <p className="text-lead font-semibold text-ink-2">
          {g.kind === "pompa_di_calore" ? "Ferma" : "Spenta"}, pronta a partire
        </p>
      )}
    </article>
  );
}

function HeatingCard({ view }: { view: PlantView }) {
  const p = view.now!;
  const s = view.season;
  let headline: ReactNode;
  let detail: string;
  if (!s.active && s.start) {
    headline = (
      <>
        <Moon size={22} aria-hidden /> Spento fino a {fmtDay(s.start)}
      </>
    );
    detail = `In zona ${view.plant.zona} il riscaldamento è consentito ${seasonSentence(view.plant.zona)}.`;
  } else if (!p.heating) {
    headline = (
      <>
        <Moon size={22} aria-hidden /> Fuori orario
      </>
    );
    detail = `Si riaccende alle ${view.plant.schedule.from}:00. Orario impostato: dalle ${view.plant.schedule.from} alle ${view.plant.schedule.to}.`;
  } else {
    headline = (
      <>
        <Flame size={22} className="text-hot" aria-hidden /> Acceso
      </>
    );
    detail = `La curva climatica chiede ${num(p.target ?? 0)} °C in mandata con ${num(p.outdoor)} °C fuori. Pompa in funzione.`;
  }
  return (
    <article className="flex flex-col gap-3 rounded-xl border-2 border-ink bg-sheet p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-sunk">
          <Building2 size={28} strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-h3 font-bold leading-tight">Riscaldamento</h3>
          <p className="text-small text-ink-2">
            {view.plant.circuits.find((c) => c.kind === "riscaldamento")
              ?.label ?? "Circuito"}
            , {view.building.units} appartamenti
          </p>
        </div>
      </div>
      <p className="flex items-center gap-2 text-lead font-bold">{headline}</p>
      <p className="text-ink-2">{detail}</p>
    </article>
  );
}

function DhwCard({ view }: { view: PlantView }) {
  const p = view.now!;
  const circuit = view.plant.circuits.find((c) => c.kind === "acs");
  if (!circuit || p.dhw === null) return null;
  const tone = p.dhw >= 50 ? "ok" : p.dhw >= 45 ? "tiepida" : "fredda";
  return (
    <article
      className={cx(
        "flex flex-col gap-3 rounded-xl border-2 p-4",
        tone === "ok" ? "border-ink bg-sheet" : "border-amber bg-amber-tint",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-sunk">
          <ShowerHead size={28} strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-h3 font-bold leading-tight">Acqua calda</h3>
          <p className="text-small text-ink-2">
            {circuit.label.replace("Acqua calda sanitaria, ", "")}
          </p>
        </div>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="num text-h2 font-extrabold">{num(p.dhw)} °C</span>
        <span
          className={cx(
            "inline-flex items-center gap-1.5 font-bold",
            tone === "ok" ? "text-green-ink" : "text-amber-ink",
          )}
        >
          {tone === "ok" ? (
            <CircleCheckBig size={20} aria-hidden />
          ) : (
            <TriangleAlert size={20} aria-hidden />
          )}
          {tone === "ok" ? "Calda" : tone === "tiepida" ? "Tiepida" : "Fredda"}
        </span>
      </p>
    </article>
  );
}

/* ---------------------------------------------------------------------------
 * Strumenti: esterno, manometro, combustibile, collegamento
 * ------------------------------------------------------------------------- */

const PRESSURE_MAX = 3;

function arc(
  cx0: number,
  cy0: number,
  r: number,
  from: number,
  to: number,
): string {
  // da 0 (sinistra) a PRESSURE_MAX (destra) su un semicerchio
  const a = (v: number) => Math.PI - (v / PRESSURE_MAX) * Math.PI;
  const x1 = cx0 + r * Math.cos(a(from));
  const y1 = cy0 - r * Math.sin(a(from));
  const x2 = cx0 + r * Math.cos(a(to));
  const y2 = cy0 - r * Math.sin(a(to));
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

/** Manometro come quello in centrale: rosso sotto 0,8 bar, verde tra 1,2 e 2,2. */
function Manometer({ value }: { value: number }) {
  const v = Math.min(PRESSURE_MAX, Math.max(0, value));
  const angle = Math.PI - (v / PRESSURE_MAX) * Math.PI;
  const nx = 50 + 34 * Math.cos(angle);
  const ny = 50 - 34 * Math.sin(angle);
  return (
    <svg viewBox="0 0 100 58" className="h-14 w-24 shrink-0" aria-hidden>
      <path
        d={arc(50, 50, 42, 0, 0.8)}
        stroke="var(--red)"
        strokeWidth="8"
        fill="none"
      />
      <path
        d={arc(50, 50, 42, 0.82, 1.18)}
        stroke="var(--amber)"
        strokeWidth="8"
        fill="none"
      />
      <path
        d={arc(50, 50, 42, 1.2, 2.2)}
        stroke="var(--green)"
        strokeWidth="8"
        fill="none"
      />
      <path
        d={arc(50, 50, 42, 2.22, 3)}
        stroke="var(--amber)"
        strokeWidth="8"
        fill="none"
      />
      <line
        x1="50"
        y1="50"
        x2={nx}
        y2={ny}
        stroke="var(--ink)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="5" fill="var(--ink)" />
    </svg>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values, 0.8);
  const max = Math.max(...values, 2);
  const w = 160;
  const h = 34;
  const x = (i: number) => (i / (values.length - 1)) * (w - 6) + 3;
  const y = (v: number) => h - 4 - ((v - min) / (max - min)) * (h - 8);
  const d = values
    .map((v, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full max-w-40" aria-hidden>
      <line
        x1="3"
        x2={w - 3}
        y1={y(1.2)}
        y2={y(1.2)}
        stroke="var(--rule)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <path
        d={d}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(last)}
        r="4"
        fill="var(--ink)"
        stroke="var(--sheet)"
        strokeWidth="2"
      />
    </svg>
  );
}

function Instrument({
  icon: I,
  label,
  children,
  tone = "neutral",
  wide = false,
}: {
  icon: typeof Thermometer;
  label: string;
  children: ReactNode;
  tone?: "neutral" | "warn" | "bad";
  /** Sul telefono occupa tutta la riga */
  wide?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-1.5 rounded-xl border-2 p-3 sm:p-4",
        wide && "col-span-2 @2xl:col-span-1",
        tone === "bad"
          ? "border-red bg-red-tint"
          : tone === "warn"
            ? "border-amber bg-amber-tint"
            : "border-rule bg-paper",
      )}
    >
      <span className="flex items-center gap-2 text-small font-bold text-ink-2">
        <I size={20} aria-hidden />
        {label}
      </span>
      {children}
    </div>
  );
}

function Instruments({ view }: { view: PlantView }) {
  const p = view.now!;
  const tel = view.telemetry;
  const pressureTone =
    p.pressure < 0.8
      ? "bad"
      : p.pressure < 1.2 ||
          view.findings.some((f) => f.rule === "pressione_in_calo")
        ? "warn"
        : "neutral";
  const offline = view.status === "offline";
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      <Instrument icon={Thermometer} label="Fuori">
        <span className="num text-h2 font-extrabold leading-tight">
          {num(p.outdoor)} °C
        </span>
        <span className="text-small text-ink-2">Sonda esterna, lato nord</span>
      </Instrument>
      <Instrument icon={Flame} label="Combustibile da mezzanotte">
        <span className="num text-h2 font-extrabold leading-tight">
          {tel.fuelToday.value.toLocaleString("it-IT")} {tel.fuelToday.unit}
        </span>
        <span className="text-small text-ink-2">
          {FUEL_LABEL[view.plant.generators[0]!.fuel]}, stima dal bruciatore
        </span>
      </Instrument>
      <Instrument
        icon={GaugeIcon}
        label="Pressione dell'impianto"
        tone={pressureTone}
        wide
      >
        <div className="flex items-center gap-3">
          <Manometer value={p.pressure} />
          <span className="num text-h2 font-extrabold leading-tight">
            {num(p.pressure, 2)} bar
          </span>
        </div>
        <Sparkline values={tel.points.map((x) => x.pressure)} />
        <span className="text-small text-ink-2">
          Ultime 24 ore. Normale tra 1,2 e 2 bar.
        </span>
      </Instrument>
      <Instrument
        icon={offline ? WifiOff : Radio}
        label="Collegamento"
        tone={offline ? "warn" : "neutral"}
        wide
      >
        <span className="text-h3 font-extrabold leading-tight">
          {tel.lastSeenAt
            ? offline
              ? `Nessun dato da ${fmtAgo(tel.lastSeenAt).replace(" fa", "")}`
              : `Dati di ${fmtAgo(tel.lastSeenAt)}`
            : "Mai collegata"}
        </span>
        <span className="text-small text-ink-2">
          {view.plant.gateway?.model}, rete {view.plant.gateway?.link}
        </span>
      </Instrument>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Schema completo
 * ------------------------------------------------------------------------- */

export function Schematic({ view }: { view: PlantView }) {
  const p = view.now;
  if (!p) return null;
  const offline = view.status === "offline";
  const flowing = p.pump && !offline;
  const genDetail = (id: string) => {
    const g = view.plant.generators.find((x) => x.id === id)!;
    return `${g.brand} ${g.model}, ${g.powerKw} kW, ${FUEL_LABEL[g.fuel]}`;
  };
  return (
    <section
      aria-labelledby="schema-title"
      className="@container flex flex-col gap-5 rounded-2xl border-2 border-ink bg-sheet p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="schema-title" className="text-h2 font-bold">
          Schema della centrale
        </h2>
        <p className="text-small text-ink-2">
          {offline
            ? "Valori dell'ultimo collegamento"
            : `Aggiornato alle ${fmtTime(p.t)}, un dato ogni 10 minuti`}
        </p>
      </div>

      {offline && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border-2 border-slate bg-slate-tint p-4 font-semibold text-slate-ink"
        >
          <WifiOff size={22} className="mt-0.5 shrink-0" aria-hidden />
          La centrale non manda dati da{" "}
          {fmtAgo(view.telemetry.lastSeenAt!).replace(" fa", "")}. I valori qui
          sotto sono gli ultimi ricevuti e possono non essere più veri.
        </p>
      )}

      <div className={cx("flex flex-col gap-5", offline && "opacity-60")}>
        <Instruments view={view} />

        <div className="grid items-center @2xl:grid-cols-[minmax(0,1fr)_minmax(11rem,14rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <h3 className="text-small font-bold text-ink-2">
              Generatori di calore
            </h3>
            {view.telemetry.generators.map((g) => (
              <GeneratorCard key={g.id} g={g} detail={genDetail(g.id)} />
            ))}
          </div>
          <Pipes p={p} flowing={flowing} />
          <div className="flex flex-col gap-3">
            <h3 className="text-small font-bold text-ink-2">Utenze</h3>
            <HeatingCard view={view} />
            <DhwCard view={view} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Versione semplice per l'amministratore
 * ------------------------------------------------------------------------- */

export function SimpleStatus({ view }: { view: PlantView }) {
  const p = view.now;
  if (!p) return null;
  const s = view.season;
  const heating =
    !s.active && s.start
      ? `Spento fino a ${fmtDay(s.start)}`
      : p.heating
        ? "Acceso"
        : `Fuori orario, riparte alle ${view.plant.schedule.from}:00`;
  const tiles: { label: string; value: string; note: string }[] = [
    {
      label: "Riscaldamento",
      value: heating,
      note: p.heating
        ? `Mandata a ${num(p.supply)} °C`
        : `Zona ${view.plant.zona}: ${seasonSentence(view.plant.zona)}`,
    },
    ...(p.dhw !== null
      ? [
          {
            label: "Acqua calda",
            value: `${num(p.dhw)} °C`,
            note: p.dhw >= 50 ? "Calda, regolare" : "Più fredda del normale",
          },
        ]
      : []),
    {
      label: "Fuori",
      value: `${num(p.outdoor)} °C`,
      note: `Pressione impianto ${num(p.pressure, 2)} bar`,
    },
  ];
  return (
    <div className="@container">
      <div className="grid gap-3 @lg:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-1 rounded-xl border-2 border-rule bg-paper p-4"
          >
            <span className="text-small font-bold text-ink-2">{t.label}</span>
            <span className="num text-h3 font-extrabold leading-tight">
              {t.value}
            </span>
            <span className="text-small text-ink-2">{t.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
