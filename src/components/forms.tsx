import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cx, inputClass, type Icon } from "./ui.tsx";

/** Scelta tra poche opzioni: schede grandi da toccare, non un menu a tendina. */
export function RadioCards<T extends string>({
  name,
  legend,
  hint,
  value,
  onChange,
  options,
  columns = 2,
}: {
  name: string;
  legend: string;
  hint?: string;
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string; detail?: ReactNode; icon?: Icon; tone?: "neutral" | "danger" }[];
  columns?: 1 | 2 | 3 | 4;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" }[columns];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1 text-body font-bold">{legend}</legend>
      {hint && <p className="-mt-1 pb-1 text-small text-ink-2">{hint}</p>}
      <div className={cx("grid gap-3", cols)}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cx(
                "relative flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink",
                checked ? "border-ink bg-primary-bg text-primary-fg" : "border-edge bg-sheet hover:border-ink",
              )}
            >
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              <span
                aria-hidden
                className={cx(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2",
                  checked ? "border-primary-fg" : "border-edge",
                )}
              >
                {checked && <span className="size-3 rounded-full bg-signal" />}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-start gap-2 font-bold">
                  {o.icon && <o.icon size={20} aria-hidden className="mt-0.5 shrink-0" />}
                  {o.label}
                </span>
                {o.detail && <span className={cx("text-small", checked ? "opacity-90" : "text-ink-2")}>{o.detail}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Caselle da spuntare grandi, con spiegazione sotto. */
export function CheckCard({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  detail?: ReactNode;
}) {
  return (
    <label
      className={cx(
        "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ink",
        checked ? "border-ink bg-sunk" : "border-edge bg-sheet hover:border-ink",
      )}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span
        aria-hidden
        className={cx("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2", checked ? "border-ink bg-ink text-sheet" : "border-edge")}
      >
        {checked && <Check size={18} strokeWidth={3.5} />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-bold">{label}</span>
        {detail && <span className="text-small text-ink-2">{detail}</span>}
      </span>
    </label>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(inputClass, "appearance-none pr-12", className)} {...rest}>
        {children}
      </select>
      <ChevronDown size={22} aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-2" />
    </div>
  );
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, "min-h-32 leading-relaxed", className)} {...rest} />;
}

/** Numero con la virgola, come lo scrive chiunque in Italia. */
export function parseItNumber(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Sezione numerata di un modulo lungo: "1. Cosa hai fatto". */
export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-h3 font-bold">
        <span aria-hidden className="num grid size-9 shrink-0 place-items-center rounded-full bg-primary-bg text-body font-extrabold text-primary-fg">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
