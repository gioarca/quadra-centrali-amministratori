import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CircleCheckBig, CircleAlert } from "lucide-react";

interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastItem {
  id: number;
  message: string;
  tone: "ok" | "error";
  action?: ToastAction;
}

const Ctx = createContext<(message: string, opts?: { tone?: "ok" | "error"; action?: ToastAction }) => void>(() => {});

/**
 * Messaggi di conferma in basso, tenuti a lungo (10 secondi) e con un'azione "Annulla"
 * quando serve: chi legge lentamente non deve perderli.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message: string, opts: { tone?: "ok" | "error"; action?: ToastAction } = {}) => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-2), { id, message, tone: opts.tone ?? "ok", action: opts.action }]);
      setTimeout(() => dismiss(id), opts.action ? 12_000 : 8_000);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] z-50 flex flex-col items-center gap-3 px-4 lg:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            // Senza azione il messaggio non blocca i tocchi: i pulsanti sotto restano usabili.
            className={`${t.action ? "pointer-events-auto" : ""} flex w-full max-w-lg items-center gap-3 rounded-xl border-2 border-ink bg-primary-bg px-4 py-3 text-primary-fg shadow-lift`}
          >
            {t.tone === "ok" ? (
              <CircleCheckBig size={24} className="shrink-0" aria-hidden />
            ) : (
              <CircleAlert size={24} className="shrink-0" aria-hidden />
            )}
            <p className="flex-1 font-semibold">{t.message}</p>
            {t.action && (
              <button
                type="button"
                className="min-h-12 shrink-0 rounded-lg border-2 border-primary-fg px-4 font-bold"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
