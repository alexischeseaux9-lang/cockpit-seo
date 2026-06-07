"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, Activity, LogOut } from "lucide-react";
import { VERSION } from "@/lib/version";

const PW_KEY = "cockpit_admin_pw";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/admin/onboarding-wizard", label: "Onboarding", icon: <Sparkles size={16} /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(localStorage.getItem(PW_KEY)));
    const onStorage = () => setAuthed(Boolean(localStorage.getItem(PW_KEY)));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname]);

  if (!authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-zinc-950">
      <aside className="fixed left-0 top-0 z-20 flex h-screen w-56 flex-col border-r border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-6 flex items-center gap-2">
          <Activity size={20} className="text-emerald-400" />
          <span className="font-semibold text-zinc-100">Cockpit SEO</span>
          <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400">{VERSION}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900"
                }`}
              >
                {n.icon} {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => { localStorage.removeItem(PW_KEY); window.location.href = "/admin"; }}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
        >
          <LogOut size={16} /> Deconnecter
        </button>
      </aside>
      <div className="pl-56">{children}</div>
    </div>
  );
}
