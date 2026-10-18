# Quadra centrali — demo

Demo dell'app per le centrali termiche dei condomini, vista da chi le mantiene (termotecnico) e da chi amministra i condomini.
Un solo progetto **Vite + React**, senza server né database: i dati delle centrali sono simulati nel browser.

```bash
npm install
npm run dev        # http://localhost:5180
```

Serve Node.js 22 o più recente.

## Cosa si vede

Si entra scegliendo una persona:

- **Mario Rossetto**, termotecnico e terzo responsabile, 9 centrali: elenco dalla più grave, schema della centrale con il grafico delle ultime 24 ore, diagnosi spiegate, interventi dall'allarme alla chiusura (con foto e analisi fumi), scadenze di legge, preventivi.
- **Laura Bressan**, amministratrice, 7 condomini seguiti da tre ditte: stato di ogni condominio in parole semplici, consumi, preventivi da approvare, avvisi ai condòmini, relazione per l'assemblea da stampare.

Le modifiche valgono per tutta la visita, anche cambiando persona: un preventivo mandato da Mario compare subito a Laura. Ricaricando la pagina si resta dentro con la stessa persona, ma i dati tornano quelli di partenza.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | demo in locale, si aggiorna mentre modifichi |
| `npm run build` | controlla i tipi e crea la cartella `dist` da pubblicare |
| `npm run preview` | apre la build di `dist` come sarà online |

## Pubblicarla su Netlify

**Il modo più veloce (trascina la cartella)**

1. `npm run build`
2. Apri app.netlify.com/drop e trascina la cartella `dist`.
3. Netlify dà subito un indirizzo `https://….netlify.app` da condividere.

Il file `public/_redirects` finisce dentro `dist`: anche gli indirizzi interni (es. `/centrali/p-betulle`) si riaprono ricaricando la pagina.

**Con GitHub (si aggiorna da solo a ogni modifica)**

1. Carica questa cartella in un repository GitHub.
2. Su Netlify: **Add new project → Import an existing project → GitHub** → scegli il repository.
3. Build command e cartella da pubblicare li legge da `netlify.toml` (`npm run build`, `dist`): lascia tutto com'è e fai **Deploy**.

Nessuna variabile d'ambiente da impostare. Il sito è statico: consuma pochissimi crediti anche sul piano gratuito.

## Com'è fatta

```
src/
  logica/           le regole: stagioni e orari per zona climatica, scadenze di legge (DPR 74/2013),
                    simulazione dei dati, diagnosi, viste per le schermate, comandi
    demo.ts         i condomini, le centrali e le persone di esempio
    simulate.ts     le ultime 24 ore di ogni centrale (con guasti preparati)
    diagnosi.ts     cosa dicono i dati: blocco, pressione, circolazione, accensioni, orari…
    service.ts      le operazioni dell'app: chi vede cosa, cosa succede a ogni pulsante
  api/              l'"API" della demo: chiama la logica e tiene i dati in memoria
  termotecnico/     le schermate della ditta
  amministratore/   le schermate dell'amministratore
  components/       pulsanti, campi, schema della centrale, grafici
  shell/            menu laterale (computer) e barra in basso (telefono)
```

Le schermate parlano solo con `src/api`: nel progetto completo lo stesso codice usa un server vero (API Express, MongoDB, moduli in centrale) senza cambiare le schermate.

Stack: React 19, React Router, TanStack Query, Tailwind CSS 4, icone Lucide, Zod per i moduli, font Atkinson Hyperlegible Next.
