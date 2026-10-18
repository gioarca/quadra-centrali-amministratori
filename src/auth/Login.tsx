import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, HardHat } from "lucide-react";
import { api } from "../api/index.ts";
import { Wordmark } from "../components/bits.tsx";

const ICON = { termotecnico: HardHat, amministratore: Building2 } as const;

/** Demo: si sceglie con chi entrare. */
function DemoPicker() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <p className="text-lead">Questa è una demo con dati di esempio. Scegli con chi entrare: le due persone vedono app diverse.</p>
      <ul className="flex flex-col gap-3">
        {api.personas().map((p) => {
          const I = ICON[p.role];
          return (
            <li key={p.userId}>
              <button
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  setBusy(p.userId);
                  await api.loginAs(p.userId);
                  await qc.invalidateQueries({ queryKey: ["me"] });
                }}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-4 rounded-xl border-2 border-ink bg-sheet p-4 text-left hover:bg-sunk disabled:opacity-60 sm:p-5"
              >
                <span className="grid size-12 place-items-center rounded-lg bg-primary-bg text-primary-fg">
                  <I size={26} aria-hidden />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-small font-bold text-ink-2">{p.title}</span>
                  <span className="text-h3 font-bold">{busy === p.userId ? "Entro…" : `Entra come ${p.name}`}</span>
                  <span className="text-ink-2">{p.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-small text-ink-2">Nella versione vera si entra con l'email: arriva un codice di 6 cifre, senza password da ricordare.</p>
    </div>
  );
}

export function Login() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-4 py-10 sm:py-16">
      <Wordmark />
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 font-extrabold tracking-tight">Entra</h1>
        <p className="text-lead text-ink-2">Le centrali termiche dei condomini: come stanno, cosa si è rotto, cosa scade.</p>
      </div>
      <DemoPicker />
    </main>
  );
}
