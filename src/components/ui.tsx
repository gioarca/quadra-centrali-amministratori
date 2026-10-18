import { forwardRef, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import {
  CalendarClock,
  ChevronLeft,
  CircleAlert,
  CircleCheckBig,
  Hourglass,
  LoaderCircle,
  MessageCircleQuestion,
  OctagonAlert,
  Send,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Unplug,
  UserRound,
  UsersRound,
  WifiOff,
  Wrench,
  X,
  type LucideProps,
} from "lucide-react";
import {
  PLANT_STATUS_ADMIN,
  PLANT_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  WORK_STATUS_LABEL,
  type DeadlineStatus,
  type PlantStatus,
  type QuoteStatus,
  type WorkStatus,
} from "../logica/index.ts";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type Icon = ComponentType<LucideProps>;

/* ------------------------------- Pulsanti ------------------------------- */

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-lg font-semibold text-center leading-tight select-none " +
  "transition-[background-color,transform] active:translate-y-px disabled:opacity-55 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-primary-bg text-primary-fg hover:opacity-90",
  secondary: "bg-sheet text-ink border-2 border-ink hover:bg-sunk",
  quiet: "text-ink underline underline-offset-4 decoration-2 decoration-edge hover:decoration-ink",
  danger: "bg-red-tint text-red-ink border-2 border-red hover:opacity-90",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-4 text-body",
  lg: "min-h-14 px-5 text-lead",
  xl: "min-h-16 px-6 text-lead w-full",
};

const iconSize: Record<Size, number> = { md: 20, lg: 22, xl: 26 };

export function buttonClass(variant: Variant = "primary", size: Size = "md", full = false) {
  return cx(base, variants[variant], variant === "quiet" ? "min-h-12 px-2 text-body" : sizes[size], full && "w-full");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: Icon;
  loading?: boolean;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: I, loading, full, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(buttonClass(variant, size, full), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={iconSize[size]} className="shrink-0 animate-spin" aria-hidden />
      ) : (
        I && <I size={iconSize[size]} strokeWidth={2.25} className="shrink-0" aria-hidden />
      )}
      <span>{children}</span>
    </button>
  );
});

export function LinkButton({
  variant = "primary",
  size = "md",
  icon: I,
  full,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: Icon; full?: boolean }) {
  return (
    <Link className={cx(buttonClass(variant, size, full), className)} {...rest}>
      {I && <I size={iconSize[size]} strokeWidth={2.25} className="shrink-0" aria-hidden />}
      <span>{children}</span>
    </Link>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="no-print inline-flex min-h-12 items-center gap-1.5 rounded-lg pr-3 font-semibold text-ink underline decoration-2 underline-offset-4 decoration-edge hover:decoration-ink"
    >
      <ChevronLeft size={22} strokeWidth={2.5} aria-hidden />
      {children}
    </Link>
  );
}

/* ------------------------------- Etichette di stato ------------------------------- */

export function Pill({ cls, icon: I, children, size = "md" }: { cls: string; icon: Icon; children: ReactNode; size?: "md" | "lg" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border-2 font-bold leading-none whitespace-nowrap",
        size === "lg" ? "px-3 py-2 text-lead" : "px-2.5 py-1.5 text-small",
        cls,
      )}
    >
      <I size={size === "lg" ? 22 : 18} strokeWidth={2.5} aria-hidden />
      {children}
    </span>
  );
}

export const TONE = {
  red: "bg-red-tint text-red-ink border-red",
  amber: "bg-amber-tint text-amber-ink border-amber",
  slate: "bg-slate-tint text-slate-ink border-slate",
  green: "bg-green-tint text-green-ink border-green",
  neutral: "bg-sheet text-ink border-edge",
  muted: "bg-sunk text-ink-2 border-edge",
} as const;

const PLANT_STYLE: Record<PlantStatus, { cls: string; icon: Icon; stripe: string }> = {
  blocco: { cls: TONE.red, icon: OctagonAlert, stripe: "border-l-red" },
  attenzione: { cls: TONE.amber, icon: TriangleAlert, stripe: "border-l-amber" },
  offline: { cls: TONE.slate, icon: WifiOff, stripe: "border-l-slate" },
  ok: { cls: TONE.green, icon: CircleCheckBig, stripe: "border-l-green" },
  non_collegata: { cls: TONE.muted, icon: Unplug, stripe: "border-l-edge" },
};

export const plantStripe = (s: PlantStatus) => PLANT_STYLE[s].stripe;

export function PlantStatusPill({ status, audience = "tecnico", size }: { status: PlantStatus; audience?: "tecnico" | "amministratore"; size?: "md" | "lg" }) {
  const s = PLANT_STYLE[status];
  return (
    <Pill cls={s.cls} icon={s.icon} size={size}>
      {audience === "tecnico" ? PLANT_STATUS_LABEL[status] : PLANT_STATUS_ADMIN[status]}
    </Pill>
  );
}

const WORK_STYLE: Record<WorkStatus, { cls: string; icon: Icon }> = {
  da_assegnare: { cls: TONE.amber, icon: UserRound },
  assegnato: { cls: TONE.neutral, icon: CalendarClock },
  in_corso: { cls: TONE.slate, icon: Wrench },
  fatto: { cls: TONE.green, icon: CircleCheckBig },
};

export function WorkStatusPill({ status }: { status: WorkStatus }) {
  const s = WORK_STYLE[status];
  return (
    <Pill cls={s.cls} icon={s.icon}>
      {WORK_STATUS_LABEL[status]}
    </Pill>
  );
}

const QUOTE_STYLE: Record<QuoteStatus, { cls: string; icon: Icon }> = {
  in_attesa: { cls: TONE.amber, icon: Hourglass },
  approvato: { cls: TONE.green, icon: CircleCheckBig },
  assemblea: { cls: TONE.slate, icon: UsersRound },
  chiarimenti: { cls: TONE.neutral, icon: MessageCircleQuestion },
  rifiutato: { cls: TONE.muted, icon: X },
};

export function QuoteStatusPill({ status, size }: { status: QuoteStatus; size?: "md" | "lg" }) {
  const s = QUOTE_STYLE[status];
  return (
    <Pill cls={s.cls} icon={s.icon} size={size}>
      {QUOTE_STATUS_LABEL[status]}
    </Pill>
  );
}

const DEADLINE_STYLE: Record<DeadlineStatus, { cls: string; icon: Icon; label: string }> = {
  scaduta: { cls: TONE.red, icon: ShieldAlert, label: "Scaduto" },
  da_inviare: { cls: TONE.amber, icon: Send, label: "Da inviare" },
  in_scadenza: { cls: TONE.amber, icon: Hourglass, label: "In scadenza" },
  ok: { cls: TONE.green, icon: ShieldCheck, label: "In regola" },
};

export function DeadlinePill({ status }: { status: DeadlineStatus }) {
  const s = DEADLINE_STYLE[status];
  return (
    <Pill cls={s.cls} icon={s.icon}>
      {s.label}
    </Pill>
  );
}

/* ------------------------------- Struttura ------------------------------- */

export function Panel({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  // Se chi lo usa sceglie un bordo suo (più spesso, colorato, tratteggiato), quello predefinito non si applica.
  const ownBorder = /\bborder-(2|dashed)\b/.test(className ?? "");
  return <As className={cx("rounded-xl bg-sheet p-5 sm:p-6", !ownBorder && "border border-rule", className)}>{children}</As>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 pb-6">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-h1 font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="text-lead text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, count, aside }: { children: ReactNode; count?: number; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3">
      <h2 className="text-h2 font-bold">
        {children}
        {typeof count === "number" && <span className="num ml-2 font-semibold text-ink-2">({count})</span>}
      </h2>
      {aside}
    </div>
  );
}

/** Coppia etichetta/valore, sempre nello stesso ordine e allineamento. */
export function Fact({ label, children, icon: I }: { label: string; children: ReactNode; icon?: Icon }) {
  return (
    <div className="flex gap-3">
      {I && <I size={22} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />}
      <div className="flex min-w-0 flex-col">
        <span className="text-small font-semibold text-ink-2">{label}</span>
        <span className="text-body">{children}</span>
      </div>
    </div>
  );
}

/* ------------------------------- Campi ------------------------------- */

export const inputClass =
  "w-full min-h-12 rounded-lg border-2 border-edge bg-sheet px-4 py-2.5 text-body text-ink placeholder:text-ink-2 " +
  "hover:border-ink";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-bold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-small text-ink-2">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 font-semibold text-red-ink">
          <CircleAlert size={20} aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------- Stati della pagina ------------------------------- */

export function Loading({ label = "Sto caricando…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-lead text-ink-2">
      <LoaderCircle size={28} className="animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Qualcosa non ha funzionato.";
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-xl border-2 border-red bg-red-tint p-5 text-red-ink">
      <p className="flex items-center gap-2 text-lead font-bold">
        <CircleAlert size={24} aria-hidden /> {message}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Riprova
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon: I, title, children, action }: { icon: Icon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-rule p-6">
      <I size={32} strokeWidth={2} className="text-ink-2" aria-hidden />
      <p className="text-lead font-bold">{title}</p>
      {children && <div className="text-ink-2">{children}</div>}
      {action}
    </div>
  );
}
