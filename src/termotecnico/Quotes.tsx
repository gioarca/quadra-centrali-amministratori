import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { MessageCircleQuestion, Plus, ReceiptText, Send, Trash2 } from "lucide-react";
import { fmtDate, fmtEuro } from "../logica/index.ts";
import { QUOTE_STATUS_LABEL } from "../logica/index.ts";
import { api } from "../api/index.ts";
import type { Me } from "../api/types.ts";
import { CheckCard, Select, Step, TextArea, parseItNumber } from "../components/forms.tsx";
import { QuoteItems, QuoteRowItem } from "../components/rows.tsx";
import { useToast } from "../components/Toast.tsx";
import { BackLink, Button, EmptyState, ErrorState, Field, LinkButton, Loading, PageHeader, Panel, QuoteStatusPill, SectionTitle, inputClass } from "../components/ui.tsx";
import { useAction, useMyBuildings, usePlant, useQuote, useQuotes } from "../lib/queries.ts";

export function QuoteList() {
  const q = useQuotes();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const waiting = q.data.filter((r) => r.quote.status === "in_attesa" || r.quote.status === "chiarimenti");
  const decided = q.data.filter((r) => !waiting.includes(r));
  return (
    <>
      <PageHeader
        title="Preventivi"
        subtitle="Quelli mandati agli amministratori e la loro risposta."
        actions={
          <LinkButton to="/preventivi/nuovo" icon={Plus} size="lg">
            Nuovo preventivo
          </LinkButton>
        }
      />
      <div className="flex flex-col gap-10">
        {[
          { title: "In attesa di risposta", rows: waiting },
          { title: "Decisi", rows: decided },
        ].map((g) =>
          g.rows.length ? (
            <section key={g.title} className="flex flex-col gap-3">
              <SectionTitle count={g.rows.length}>{g.title}</SectionTitle>
              <ul className="grid gap-3 md:grid-cols-2">
                {g.rows.map((r) => (
                  <li key={r.quote.id}>
                    <QuoteRowItem row={r} to={`/preventivi/${r.quote.id}`} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
        {!q.data.length && <EmptyState icon={ReceiptText} title="Nessun preventivo" />}
      </div>
    </>
  );
}

export function TechQuote() {
  const { id = "" } = useParams();
  const q = useQuote(id);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { quote: x, building, total, view } = q.data;
  return (
    <>
      <PageHeader
        back={<BackLink to="/preventivi">Preventivi</BackLink>}
        title={x.title}
        subtitle={`${x.number} · ${building.name} · mandato il ${fmtDate(x.createdAt)}`}
        actions={<QuoteStatusPill status={x.status} size="lg" />}
      />
      <div className="flex max-w-3xl flex-col gap-6">
        {x.status !== "in_attesa" && (
          <Panel className="flex flex-col gap-2 border-2 border-ink">
            <h2 className="flex items-center gap-2 text-h3 font-bold">
              <MessageCircleQuestion size={24} aria-hidden /> Risposta di {view.admin.name}: {QUOTE_STATUS_LABEL[x.status].toLowerCase()}
            </h2>
            {x.decidedAt && <p className="text-small text-ink-2">Il {fmtDate(x.decidedAt)}</p>}
            {x.decisionNote ? <p className="text-lead">«{x.decisionNote}»</p> : <p className="text-ink-2">Nessuna nota.</p>}
          </Panel>
        )}
        {x.status === "in_attesa" && (
          <p className="rounded-xl bg-paper p-4 text-ink-2">
            {view.admin.name} lo vede nel suo portale tra le cose da decidere. Ti arriva un avviso quando risponde.
          </p>
        )}
        <section className="flex flex-col gap-2">
          <SectionTitle>Perché serve</SectionTitle>
          <p className="whitespace-pre-line text-lead">{x.reason}</p>
        </section>
        <QuoteItems items={x.items} total={total} />
        <p className="text-ink-2">
          Valido fino al {fmtDate(x.validUntil)}. <Link to={`/centrali/${x.plantId}`} className="font-semibold text-ink underline decoration-2 underline-offset-4">Apri la centrale</Link>
        </p>
      </div>
    </>
  );
}

interface ItemDraft {
  label: string;
  qty: string;
  unit: string;
  price: string;
}

const UNITS = ["pz", "ore", "a corpo", "m"];
const emptyItem = (): ItemDraft => ({ label: "", qty: "1", unit: "pz", price: "" });

export function NewQuote({ me }: { me: Me }) {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const buildings = useMyBuildings();
  const [plantId, setPlantId] = useState(sp.get("centrale") ?? "");
  const plant = usePlant(plantId);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const create = useAction(api.createQuote);

  const parsed = items.map((i) => ({ label: i.label, qty: parseItNumber(i.qty) ?? 0, unit: i.unit, price: parseItNumber(i.price) ?? 0 }));
  const total = parsed.reduce((s, i) => s + i.qty * i.price, 0);
  const set = (n: number, patch: Partial<ItemDraft>) => setItems((list) => list.map((x, i) => (i === n ? { ...x, ...patch } : x)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const bad = items.findIndex((i) => parseItNumber(i.price) === null || parseItNumber(i.qty) === null);
    if (bad >= 0) return setError(`Voce ${bad + 1}: scrivi quantità e prezzo in numeri, ad esempio 2 e 180,50.`);
    create.mutate(
      { plantId, title, reason, urgent, items: parsed },
      {
        onSuccess: (x) => {
          toast(`Preventivo ${x.number} mandato a ${plant.data?.view.admin.name ?? "l'amministratore"}.`);
          navigate(`/preventivi/${x.id}`, { replace: true });
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <>
      <PageHeader back={<BackLink to={plantId ? `/centrali/${plantId}` : "/preventivi"}>Indietro</BackLink>} title="Nuovo preventivo" subtitle={`Da ${me.org.name}`} />
      <form onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
        <Step n={1} title="Per chi e perché">
          <Field id="q-centrale" label="Condominio">
            <Select id="q-centrale" value={plantId} onChange={(e) => setPlantId(e.target.value)}>
              <option value="">Scegli il condominio…</option>
              {buildings.data?.map((b) => (
                <option key={b.id} value={b.plantId}>
                  {b.name}, {b.address}
                </option>
              ))}
            </Select>
          </Field>
          {plant.data && <p className="-mt-2 text-small text-ink-2">Arriva a {plant.data.view.admin.name}, {plant.data.view.adminOrg.name}.</p>}
          <Field id="q-title" label="Che lavoro è" hint="Come lo leggerebbe un condomino: «Sostituzione della pompa del riscaldamento».">
            <input id="q-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </Field>
          <Field id="q-reason" label="Perché serve" hint="L'amministratore lo legge in assemblea: cosa succede se non si fa, e cosa dicono i dati della centrale.">
            <TextArea id="q-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <CheckCard
            checked={urgent}
            onChange={setUrgent}
            label="Urgente: non può aspettare l'assemblea"
            detail="Per i lavori urgenti l'amministratore può decidere da solo e riferire alla prima assemblea (art. 1135 del codice civile)."
          />
        </Step>

        <Step n={2} title="Voci e prezzi">
          <ul className="flex flex-col gap-4">
            {items.map((it, n) => (
              <li key={n} className="flex flex-col gap-3 rounded-xl bg-paper p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">Voce {n + 1}</span>
                  {items.length > 1 && (
                    <Button variant="quiet" icon={Trash2} onClick={() => setItems((l) => l.filter((_, i) => i !== n))}>
                      Togli
                    </Button>
                  )}
                </div>
                <Field id={`it-${n}-label`} label="Descrizione">
                  <input id={`it-${n}-label`} className={inputClass} value={it.label} onChange={(e) => set(n, { label: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field id={`it-${n}-qty`} label="Quantità">
                    <input id={`it-${n}-qty`} inputMode="decimal" className={`${inputClass} num`} value={it.qty} onChange={(e) => set(n, { qty: e.target.value })} />
                  </Field>
                  <Field id={`it-${n}-unit`} label="Unità">
                    <Select id={`it-${n}-unit`} value={it.unit} onChange={(e) => set(n, { unit: e.target.value })}>
                      {UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field id={`it-${n}-price`} label="Prezzo, euro">
                    <input id={`it-${n}-price`} inputMode="decimal" className={`${inputClass} num`} value={it.price} onChange={(e) => set(n, { price: e.target.value })} placeholder="0,00" />
                  </Field>
                </div>
                <p className="num text-right font-semibold">Importo: {fmtEuro(parsed[n]!.qty * parsed[n]!.price)}</p>
              </li>
            ))}
          </ul>
          <div>
            <Button variant="secondary" icon={Plus} onClick={() => setItems((l) => [...l, emptyItem()])}>
              Aggiungi una voce
            </Button>
          </div>
          <p className="flex flex-wrap items-baseline justify-between gap-2 border-t-2 border-ink pt-4">
            <span className="text-lead font-bold">Totale, IVA esclusa</span>
            <span className="num text-h2 font-extrabold">{fmtEuro(total)}</span>
          </p>
        </Step>

        {error && (
          <p role="alert" className="rounded-xl border-2 border-red bg-red-tint p-4 font-bold text-red-ink">
            {error}
          </p>
        )}
        <Button type="submit" size="xl" icon={Send} loading={create.isPending}>
          Manda all'amministratore
        </Button>
      </form>
    </>
  );
}
