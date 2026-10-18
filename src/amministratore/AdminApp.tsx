import { Navigate, Route, Routes } from "react-router";
import { Building2, Megaphone, ReceiptText } from "lucide-react";
import type { Me } from "../api/types.ts";
import { useAdminHome } from "../lib/queries.ts";
import { MorePage, Shell, type NavItem } from "../shell/Shell.tsx";
import { AdminHome } from "./Home.tsx";
import { BuildingPage, Report } from "./BuildingPage.tsx";
import { AdminQuoteList, QuoteDecide } from "./Quotes.tsx";
import { NewNotice, NoticeList } from "./Notices.tsx";

export function AdminApp({ me }: { me: Me }) {
  const home = useAdminHome();
  const items: NavItem[] = [
    { to: "/", label: "Condomini", icon: Building2, mobile: true },
    { to: "/preventivi", label: "Preventivi", icon: ReceiptText, mobile: true, badge: home.data?.pendingQuotes.length },
    { to: "/avvisi", label: "Avvisi", icon: Megaphone, mobile: true },
  ];
  return (
    <Shell me={me} items={items}>
      <Routes>
        <Route path="/" element={<AdminHome me={me} />} />
        <Route path="/condomini/:id" element={<BuildingPage />} />
        <Route path="/condomini/:id/relazione" element={<Report />} />
        <Route path="/preventivi" element={<AdminQuoteList />} />
        <Route path="/preventivi/:id" element={<QuoteDecide />} />
        <Route path="/avvisi" element={<NoticeList />} />
        <Route path="/avvisi/nuovo" element={<NewNotice me={me} />} />
        <Route path="/altro" element={<MorePage me={me} items={items} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
