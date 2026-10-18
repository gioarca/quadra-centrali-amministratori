import { useEffect, type ComponentType, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { Ellipsis, LogOut, type LucideProps } from "lucide-react";
import type { Me } from "../api/types.ts";
import { useLogout } from "../App.tsx";
import { TextSizeControl, Wordmark } from "../components/bits.tsx";
import { Button, PageHeader, cx } from "../components/ui.tsx";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<LucideProps>;
  /** Visibile nella barra in basso del telefono */
  mobile: boolean;
  badge?: number;
}

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="num ml-auto grid min-w-7 place-items-center rounded-full bg-signal px-1.5 text-small font-extrabold text-[#14202e]">
      {n}
    </span>
  );
}

export function DemoBanner() {
  const logout = useLogout();
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b-2 border-signal bg-amber-tint px-4 py-2 text-amber-ink">
      <p className="text-small font-semibold">Demo con dati di esempio: i dati delle centrali sono simulati.</p>
      <button type="button" onClick={logout} className="min-h-10 text-small font-bold underline decoration-2 underline-offset-4">
        Cambia persona
      </button>
    </div>
  );
}

function SideNav({ items, me }: { items: NavItem[]; me: Me }) {
  const logout = useLogout();
  return (
    <div className="no-print hidden border-r border-rule bg-sheet lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col gap-8 overflow-y-auto px-4 py-6">
        <div className="flex flex-col gap-1 px-2">
          <Wordmark />
          <span className="text-small text-ink-2">{me.org.name}</span>
        </div>
        <nav aria-label="Sezioni" className="flex flex-col gap-1">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                cx(
                  "relative flex min-h-13 items-center gap-3 rounded-lg px-3 text-lead font-semibold",
                  isActive ? "bg-primary-bg text-primary-fg" : "text-ink hover:bg-sunk",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden className="absolute -left-4 top-2 bottom-2 w-1.5 rounded-r bg-signal" />}
                  <n.icon size={24} strokeWidth={2.25} aria-hidden />
                  {n.label}
                  <Badge n={n.badge} />
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-4 px-1">
          <TextSizeControl compact />
          <div className="flex flex-col gap-1 border-t border-rule pt-4">
            <span className="font-bold">{me.user.name}</span>
            <span className="text-small break-all text-ink-2">{me.user.email}</span>
          </div>
          <Button variant="secondary" icon={LogOut} onClick={logout}>
            Esci
          </Button>
        </div>
      </aside>
    </div>
  );
}

function BottomNav({ items }: { items: NavItem[] }) {
  const shown = [...items.filter((i) => i.mobile), { to: "/altro", label: "Altro", icon: Ellipsis, mobile: true }];
  return (
    <nav
      aria-label="Sezioni"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-sheet pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                cx(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-small font-bold",
                  isActive ? "bg-primary-bg text-primary-fg" : "text-ink",
                )
              }
            >
              <n.icon size={26} strokeWidth={2.25} aria-hidden />
              {n.label}
              {"badge" in n && n.badge ? (
                <span className="num absolute top-1.5 right-[calc(50%-1.9rem)] grid min-w-6 place-items-center rounded-full bg-signal px-1 text-[0.8rem] font-extrabold leading-6 text-[#14202e]">
                  {n.badge}
                </span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "Altro" sul telefono: le sezioni che non stanno nella barra, la dimensione del testo e l'uscita. */
export function MorePage({ me, items }: { me: Me; items: NavItem[] }) {
  const logout = useLogout();
  const rest = items.filter((n) => !n.mobile);
  return (
    <>
      <PageHeader title="Altro" />
      <div className="flex flex-col gap-8">
        {rest.length > 0 && (
          <nav aria-label="Altre sezioni">
            <ul className="flex flex-col gap-3">
              {rest.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    className="flex min-h-16 items-center gap-4 rounded-xl border-2 border-ink bg-sheet px-4 text-h3 font-bold hover:bg-sunk"
                  >
                    <n.icon size={28} aria-hidden /> {n.label}
                    <Badge n={n.badge} />
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <TextSizeControl />
        <div className="flex flex-col gap-3">
          <p>
            Hai fatto l'accesso come <strong>{me.user.name}</strong>, {me.org.name}.
          </p>
          <Button variant="secondary" icon={LogOut} onClick={logout} size="lg">
            Esci
          </Button>
        </div>
      </div>
    </>
  );
}

export function Shell({ me, items, children }: { me: Me; items: NavItem[]; children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <SideNav items={items} me={me} />
      <div className="flex min-w-0 flex-col">
        <DemoBanner />
        <div className="no-print flex items-center justify-between border-b border-rule bg-sheet px-4 py-3 lg:hidden">
          <Wordmark />
          <span className="truncate pl-4 text-small text-ink-2">{me.org.name}</span>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          {children}
        </main>
      </div>
      <BottomNav items={items} />
    </div>
  );
}
