import { Navigate, Route, Routes } from "react-router";
import { CalendarClock, Gauge, ReceiptText, Wrench } from "lucide-react";
import type { Me } from "../api/types.ts";
import { useFleet } from "../lib/queries.ts";
import { MorePage, Shell, type NavItem } from "../shell/Shell.tsx";
import { Fleet } from "./Fleet.tsx";
import { PlantPage } from "./PlantPage.tsx";
import { FinishWork, NewWork, WorkDetail, WorkList } from "./Work.tsx";
import { DeadlinesPage } from "./DeadlinesPage.tsx";
import { NewQuote, QuoteList, TechQuote } from "./Quotes.tsx";

export function TechApp({ me }: { me: Me }) {
  const fleet = useFleet();
  const problems = fleet.data?.views.filter((v) => v.status === "blocco" || v.status === "attenzione" || v.status === "offline").length;
  const toAssign = fleet.data?.openWork.filter((w) => w.work.status === "da_assegnare").length;
  const items: NavItem[] = [
    { to: "/", label: "Centrali", icon: Gauge, mobile: true, badge: problems },
    { to: "/interventi", label: "Interventi", icon: Wrench, mobile: true, badge: toAssign },
    { to: "/scadenze", label: "Scadenze", icon: CalendarClock, mobile: true },
    { to: "/preventivi", label: "Preventivi", icon: ReceiptText, mobile: false },
  ];
  return (
    <Shell me={me} items={items}>
      <Routes>
        <Route path="/" element={<Fleet me={me} />} />
        <Route path="/centrali/:id" element={<PlantPage />} />
        <Route path="/interventi" element={<WorkList />} />
        <Route path="/interventi/nuovo" element={<NewWork />} />
        <Route path="/interventi/:id" element={<WorkDetail />} />
        <Route path="/interventi/:id/chiudi" element={<FinishWork />} />
        <Route path="/scadenze" element={<DeadlinesPage />} />
        <Route path="/preventivi" element={<QuoteList />} />
        <Route path="/preventivi/nuovo" element={<NewQuote me={me} />} />
        <Route path="/preventivi/:id" element={<TechQuote />} />
        <Route path="/altro" element={<MorePage me={me} items={items} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
