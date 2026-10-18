import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api } from "./api/index.ts";
import { ErrorState, Loading } from "./components/ui.tsx";
import { useMe } from "./lib/queries.ts";
import { Login } from "./auth/Login.tsx";
import { TechApp } from "./termotecnico/TechApp.tsx";
import { AdminApp } from "./amministratore/AdminApp.tsx";

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await api.logout();
    navigate("/", { replace: true });
    // "me" a null mostra subito la pagina di accesso; gli altri dati della persona precedente si buttano.
    qc.setQueryData(["me"], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
  };
}

export function App() {
  const me = useMe();
  if (me.isPending) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Loading />
      </main>
    );
  }
  if (me.isError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </main>
    );
  }
  if (!me.data) return <Login />;
  return me.data.user.role === "termotecnico" ? <TechApp me={me.data} /> : <AdminApp me={me.data} />;
}
