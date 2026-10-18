import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Megaphone, Plus, Send } from "lucide-react";
import { fmtDate, fmtDay, fmtDayTime } from "../logica/index.ts";
import { CHANNEL_LABEL, seasonSentence, smsParts, type NoticeChannel, type PlantView, type WorkOrder } from "../logica/index.ts";
import { api } from "../api/index.ts";
import type { Me } from "../api/types.ts";
import { CheckCard, RadioCards, Select, Step, TextArea } from "../components/forms.tsx";
import { useToast } from "../components/Toast.tsx";
import { BackLink, Button, EmptyState, ErrorState, Field, LinkButton, Loading, PageHeader, inputClass } from "../components/ui.tsx";
import { useAction, useBuilding, useMyBuildings, useNotices } from "../lib/queries.ts";

export function NoticeList() {
  const q = useNotices();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <>
      <PageHeader
        title="Avvisi ai condomini"
        subtitle="Bacheca, email e SMS in un colpo solo."
        actions={
          <LinkButton to="/avvisi/nuovo" icon={Plus} size="lg">
            Nuovo avviso
          </LinkButton>
        }
      />
      {q.data.length ? (
        <ul className="flex max-w-3xl flex-col gap-3">
          {q.data.map(({ notice: n, building }) => (
            <li key={n.id} className="flex flex-col gap-2 rounded-xl border-2 border-rule bg-sheet p-4 sm:p-5">
              <p className="text-small font-bold text-ink-2">
                {building.name} · {fmtDate(n.createdAt)}
              </p>
              <h2 className="text-h3 font-bold">{n.title}</h2>
              <p className="whitespace-pre-line">{n.body}</p>
              <p className="text-small text-ink-2">Mandato con: {n.channels.map((c) => CHANNEL_LABEL[c].toLowerCase()).join(", ")}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Megaphone} title="Nessun avviso mandato" />
      )}
    </>
  );
}

type Template = "accensione" | "intervento" | "acqua" | "libero";

function fill(t: Template, v: PlantView | undefined, work: WorkOrder | undefined): { title: string; body: string } {
  if (!v) return { title: "", body: "" };
  const p = v.plant;
  const firm = v.maintainer.name;
  switch (t) {
    case "accensione": {
      const s = v.season;
      const when = !s.active && s.start ? `si accende ${fmtDay(s.start)}` : "è acceso";
      return {
        title: "Accensione del riscaldamento",
        body: `Gentili condomini, il riscaldamento ${when}. Orario: dalle ${p.schedule.from} alle ${p.schedule.to}. In zona ${p.zona} la legge lo consente ${seasonSentence(p.zona)}.\nSe un termosifone resta freddo, avvisate lo studio: la ditta ${firm} passerà a controllare.`,
      };
    }
    case "intervento": {
      const what = work ? work.title.charAt(0).toLowerCase() + work.title.slice(1) : "un controllo";
      const lead =
        work?.status === "in_corso"
          ? `in questo momento la ditta ${firm} sta lavorando in centrale termica`
          : `${work?.scheduledFor ? fmtDayTime(work.scheduledFor) : "nei prossimi giorni"} la ditta ${firm} farà un intervento in centrale termica`;
      return {
        title: "Intervento in centrale termica",
        body: `Gentili condomini, ${lead}: ${what}.\nPer qualche ora potrebbero mancare riscaldamento e acqua calda. Grazie per la pazienza.`,
      };
    }
    case "acqua":
      return {
        title: "Acqua calda sospesa",
        body: `Gentili condomini, domani dalle 9 alle 12 l'acqua calda non sarà disponibile per lavori in centrale termica della ditta ${firm}. Ci scusiamo per il disagio.`,
      };
    default:
      return { title: "", body: "" };
  }
}

export function NewNotice({ me }: { me: Me }) {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const buildings = useMyBuildings();
  const [buildingId, setBuildingId] = useState(sp.get("condominio") ?? "");
  const b = useBuilding(buildingId);
  const [template, setTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<NoticeChannel[]>(["bacheca", "email"]);
  const [error, setError] = useState<string | null>(null);
  const create = useAction(api.createNotice);
  const lastFilled = useRef("");

  const view = b.data?.view;
  const work = view?.openWork.find((w) => w.scheduledFor) ?? view?.openWork[0];

  // Il modello si riempie con i dati del condominio scelto; se l'utente ha già scritto, non lo sovrascriviamo.
  useEffect(() => {
    if (!template || !view) return;
    const key = `${template}:${view.building.id}`;
    if (lastFilled.current === key) return;
    const t = fill(template, view, work);
    setTitle(t.title);
    setBody(t.body);
    lastFilled.current = key;
  }, [template, view, work]);

  const units = view?.building.units ?? 0;
  const sms = smsParts(`${title}. ${body}`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(
      { buildingId, title, body, channels },
      {
        onSuccess: () => {
          const how = channels.map((c) => (c === "bacheca" ? "foglio per la bacheca pronto" : c === "email" ? `email a ${units} appartamenti` : `SMS a ${units} appartamenti`));
          toast(`Avviso mandato: ${how.join(", ")}.`);
          navigate("/avvisi");
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <>
      <PageHeader back={<BackLink to={buildingId ? `/condomini/${buildingId}` : "/avvisi"}>Indietro</BackLink>} title="Nuovo avviso" />
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Step n={1} title="Per quale condominio">
            <Field id="n-b" label="Condominio">
              <Select id="n-b" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                <option value="">Scegli il condominio…</option>
                {buildings.data?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}, {x.address}
                  </option>
                ))}
              </Select>
            </Field>
            <RadioCards<Template>
              name="modello"
              legend="Parti da un modello"
              hint="Il testo si riempie con i dati del condominio: orario, ditta, data dell'intervento. Poi lo correggi come vuoi."
              value={template}
              onChange={(t) => {
                lastFilled.current = "";
                setTemplate(t);
              }}
              options={[
                { value: "accensione", label: "Accensione del riscaldamento" },
                { value: "intervento", label: "Intervento in centrale", detail: work ? `${work.number}: ${work.title}` : undefined },
                { value: "acqua", label: "Acqua calda sospesa" },
                { value: "libero", label: "Testo libero" },
              ]}
            />
          </Step>

          <Step n={2} title="Il testo">
            <Field id="n-title" label="Titolo" hint="Corto: in bacheca si legge da lontano.">
              <input id="n-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} />
            </Field>
            <Field id="n-body" label="Testo">
              <TextArea id="n-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-40" />
            </Field>
          </Step>

          <Step n={3} title="Come farlo arrivare">
            <div className="grid gap-3">
              {(["bacheca", "email", "sms"] as const).map((c) => (
                <CheckCard
                  key={c}
                  label={CHANNEL_LABEL[c]}
                  checked={channels.includes(c)}
                  onChange={(on) => setChannels((l) => (on ? [...l, c] : l.filter((x) => x !== c)))}
                  detail={
                    c === "bacheca"
                      ? "Un foglio A4 a caratteri grandi, da stampare e appendere."
                      : c === "email"
                        ? units
                          ? `Agli indirizzi dei condomini in anagrafica (${units} appartamenti).`
                          : "Agli indirizzi dei condomini in anagrafica."
                        : units
                          ? `${sms === 1 ? "Un SMS" : `${sms} SMS`} per appartamento, ${units * sms} in tutto. Per chi non legge l'email.`
                          : "Per chi non legge l'email."
                  }
                />
              ))}
            </div>
          </Step>

          {error && (
            <p role="alert" className="rounded-xl border-2 border-red bg-red-tint p-4 font-bold text-red-ink">
              {error}
            </p>
          )}
          <Button type="submit" size="xl" icon={Send} loading={create.isPending}>
            Manda l'avviso
          </Button>
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-h3 font-bold">Come appare in bacheca</h2>
          <div className="flex aspect-[1/1.414] flex-col gap-4 overflow-hidden rounded-md border-2 border-ink bg-white p-6 text-[#14202e] shadow-lift">
            <p className="text-small font-bold tracking-wide uppercase">{view?.building.name ?? "Condominio"}</p>
            <p className="text-h2 leading-tight font-extrabold">{title || "Titolo dell'avviso"}</p>
            <p className="text-body whitespace-pre-line">{body || "Il testo apparirà qui."}</p>
            <p className="mt-auto border-t border-[#c9d2dc] pt-3 text-small">
              L'amministratore, {me.user.name}
              <br />
              {[me.org.name, me.user.phone || me.org.phone].filter(Boolean).join(" · ")}
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
