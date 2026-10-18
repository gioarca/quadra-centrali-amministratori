import { Component, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "./ui.tsx";

/** Se qualcosa si rompe, mai una pagina bianca: un messaggio chiaro e un pulsante per ripartire. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex max-w-xl flex-col items-start gap-5 px-4 py-16">
        <h1 className="text-h1 font-extrabold">Questa pagina non si è caricata</h1>
        <p className="text-lead">Il lavoro già salvato non è andato perso. Ricarica per riprovare.</p>
        <Button size="xl" icon={RotateCcw} onClick={() => window.location.reload()}>
          Ricarica
        </Button>
      </main>
    );
  }
}
