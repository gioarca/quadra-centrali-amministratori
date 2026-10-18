import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CircleCheckBig, MessageCircleQuestion, ReceiptText, Scale, Send, Siren, UsersRound, X } from "lucide-react";
import { fmtDate, fmtDayTime } from "../logica/index.ts";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "../logica/index.ts";
import { api } from "../api/index.ts";
import { RadioCards, TextArea } from "../components/forms.tsx";
import { Findings } from "../components/plant/Findings.tsx";
import { QuoteItems, QuoteRowItem } from "../components/rows.tsx";
import { useToast } from "../components/Toast.tsx";
import { BackLink, Button, EmptyState, ErrorState, Field, Loading, PageHeader, Panel, PlantStatusPill, QuoteStatusPill, SectionTitle } from "../components/ui.tsx";
import { useAction, useQuote, useQuotes } from "../lib/queries.ts";

export function AdminQuoteList() {
  const q = useQuotes();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const waiting = q.data.filter((r) => r.quote.status === "in_attesa");
  const rest = q.data.filter((r) => r.quote.status !== "in_attesa");
  return (
    <>
      <PageHeader title="Preventivi" subtitle="Da tutte le ditte, per tutti i tuoi condomini." />
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <SectionTitle count={waiting.length}>Da decidere</SectionTitle>
          {waiting.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {waiting.map((r) => (
                <li key={r.quote.id}>
                  <QuoteRowItem row={r} to={`/preventivi/${r.quote.id}`} who="both" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CircleCheckBig} title="Nessun preventivo da decidere" />
          )}
        </section>
        {rest.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle count={rest.length}>Già decisi</SectionTitle>
            <ul className="grid gap-3 md:grid-cols-2">
              {rest.map((r) => (
                <li key={r.quote.id}>
                  <QuoteRowItem row={r} to={`/preventivi/${r.quote.id}`} who="both" />
                </li>
              ))}
            </ul>
          </section>
        )}
        {!q.data.length && <EmptyState icon={ReceiptText} title="Nessun preventivo" />}
      </div>
    </>
  );
}

type Decision = Exclude<QuoteStatus, "in_attesa">;

export function QuoteDecide() {
  const { id = "" } = useParams();
  const q = useQuote(id);
  const toast = useToast();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const decide = useAction(({ d, n }: { d: Decision; n: string }) => api.decideQuote(id, d, n));
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { quote: x, building, maintainer, total, view } = q.data;
  const pending = x.status === "in_attesa";

  const send = () => {
    setError(null);
    if (!decision) return setError("Scegli una risposta.");
    decide.mutate(
      { d: decision, n: note },
      {
        onSuccess: () => {
          toast(`Risposta mandata a ${maintainer.name}: ${QUOTE_STATUS_LABEL[decision].toLowerCase()}.`);
          navigate("/preventivi");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <>
      <PageHeader
        back={<BackLink to="/preventivi">Preventivi</BackLink>}
        title={x.title}
        subtitle={`${x.number} · ${building.name} · da ${maintainer.name}, ${fmtDate(x.createdAt)}`}
        actions={<QuoteStatusPill status={x.status} size="lg" />}
      />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          {x.urgent && pending && (
            <div className="flex gap-3 rounded-xl border-2 border-red bg-red-tint p-4 text-red-ink">
              <Siren size={26} className="mt-0.5 shrink-0" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="text-lead font-bold">La ditta lo segnala come urgente</p>
                <p>
                  Per i lavori straordinari urgenti l'amministratore può decidere da solo e riferire alla prima assemblea (art. 1135 del codice civile).
                </p>
              </div>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <SectionTitle>Perché serve, secondo la ditta</SectionTitle>
            <p className="whitespace-pre-line text-lead">{x.reason}</p>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Quanto costa</SectionTitle>
            <QuoteItems items={x.items} total={total} />
            <p className="text-ink-2">Valido fino al {fmtDate(x.validUntil)}.</p>
          </section>

          {pending ? (
            <Panel className="flex flex-col gap-5 border-2 border-ink">
              <h2 className="text-h2 font-bold">La tua risposta</h2>
              <RadioCards<Decision>
                name="decisione"
                legend="Cosa decidi"
                value={decision}
                onChange={setDecision}
                options={[
                  { value: "approvato", label: "Approvo", icon: CircleCheckBig, detail: "La ditta può procedere." },
                  {
                    value: "assemblea",
                    label: "Lo porto in assemblea",
                    icon: UsersRound,
                    detail: building.nextAssemblyAt ? `Prossima assemblea: ${fmtDayTime(building.nextAssemblyAt)}.` : "Lavoro straordinario: decide l'assemblea.",
                  },
                  { value: "chiarimenti", label: "Chiedo chiarimenti", icon: MessageCircleQuestion, detail: "Scrivi qui sotto cosa vuoi sapere." },
                  { value: "rifiutato", label: "Non approvo", icon: X, detail: "Puoi spiegare il motivo nella nota." },
                ]}
              />
              <Field
                id="nota"
                label={decision === "chiarimenti" ? "Cosa vuoi sapere dalla ditta" : "Nota per la ditta (facoltativa)"}
                hint={decision === "assemblea" ? "Ad esempio: chiedete un secondo preventivo per confronto." : undefined}
              >
                <TextArea id="nota" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-24" />
              </Field>
              {error && (
                <p role="alert" className="rounded-xl border-2 border-red bg-red-tint p-4 font-bold text-red-ink">
                  {error}
                </p>
              )}
              <Button size="xl" icon={Send} loading={decide.isPending} onClick={send}>
                Manda la risposta a {maintainer.name}
              </Button>
            </Panel>
          ) : (
            <Panel className="flex flex-col gap-2 border-2 border-ink">
              <h2 className="flex items-center gap-2 text-h3 font-bold">
                <Scale size={24} aria-hidden /> Hai risposto: {QUOTE_STATUS_LABEL[x.status].toLowerCase()}
              </h2>
              {x.decidedAt && <p className="text-small text-ink-2">Il {fmtDate(x.decidedAt)}</p>}
              {x.decisionNote && <p className="text-lead">«{x.decisionNote}»</p>}
            </Panel>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <SectionTitle>La centrale adesso</SectionTitle>
          <p className="-mt-2 text-ink-2">Quello che dicono i dati, per capire se il lavoro è davvero necessario.</p>
          <div className="flex flex-wrap items-center gap-3">
            <PlantStatusPill status={view.status} audience="amministratore" />
            <Link to={`/condomini/${building.id}`} className="font-semibold underline decoration-2 underline-offset-4">
              Apri {building.name}
            </Link>
          </div>
          <Findings view={view} audience="amministratore" />
        </aside>
      </div>
    </>
  );
}
