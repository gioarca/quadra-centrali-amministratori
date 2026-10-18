import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Finestra modale con <dialog> nativo: tastiera, Esc e fuoco gestiti dal browser.
 * Sul telefono diventa un pannello che sale dal basso, a tutta larghezza.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl border-0 bg-sheet p-0 text-ink shadow-lift backdrop:bg-[rgb(10_16_24/0.55)] sm:m-auto sm:max-w-xl sm:rounded-2xl sm:border-2 sm:border-ink"
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-rule px-5 pt-5 pb-4 sm:px-6">
            <h2 id="dialog-title" className="text-h3 font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 inline-flex min-h-12 items-center gap-1.5 rounded-lg px-3 font-semibold text-ink hover:bg-sunk"
            >
              <X size={22} strokeWidth={2.5} aria-hidden />
              Chiudi
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-3 border-t border-rule px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
