import { useState } from "react";
import { Check, Copy, Phone } from "lucide-react";
import { APP_NAME } from "../logica/index.ts";
import { telHref } from "../lib/format.ts";
import { TEXT_SIZES, usePrefs } from "../lib/prefs.tsx";
import { buttonClass, cx } from "./ui.tsx";

/** Il nome del prodotto: il quadrato è il foro del cartellino. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-h3 font-extrabold tracking-tight", className)}>
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-primary-bg">
        <span className="size-3 rounded-full border-2 border-primary-fg bg-signal" />
      </span>
      {APP_NAME}
    </span>
  );
}

/**
 * Telefono sempre visibile per intero e selezionabile, con "Chiama" e "Copia":
 * se il link di chiamata non parte, il numero resta lì da leggere.
 */
export function PhoneAction({ label, phone, primary = false }: { label: string; phone: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-small font-semibold text-ink-2">{label}</span>
      <span className="num select-all text-lead font-bold">{phone}</span>
      <div className="flex flex-wrap gap-2">
        <a href={telHref(phone)} className={buttonClass(primary ? "primary" : "secondary", "md")}>
          <Phone size={20} strokeWidth={2.25} aria-hidden />
          <span>Chiama</span>
        </a>
        <button
          type="button"
          className={buttonClass("quiet")}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(phone);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              /* se non si può copiare, il numero è selezionabile */
            }
          }}
        >
          {copied ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
          <span>{copied ? "Copiato" : "Copia numero"}</span>
        </button>
      </div>
    </div>
  );
}

export function TextSizeControl({ compact = false }: { compact?: boolean }) {
  const { size, setSize } = usePrefs();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={cx("pb-2 font-bold", compact ? "text-small text-ink-2" : "text-body")}>Dimensione del testo</legend>
      <div className="grid grid-cols-3 gap-2">
        {TEXT_SIZES.map((t, i) => (
          <label
            key={t.value}
            className={cx(
              "flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-lg border-2 px-1 py-1.5 text-center",
              size === t.value ? "border-ink bg-primary-bg text-primary-fg" : "border-edge bg-sheet hover:border-ink",
            )}
          >
            <input
              type="radio"
              name="text-size"
              value={t.value}
              checked={size === t.value}
              onChange={() => setSize(t.value)}
              className="sr-only"
            />
            <span aria-hidden className="font-bold leading-none" style={{ fontSize: `${1 + i * 0.25}rem` }}>
              {t.sample}
            </span>
            <span className="text-small font-semibold leading-tight">{t.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
