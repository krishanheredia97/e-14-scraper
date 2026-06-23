import Link from "next/link";

export default function Header() {
  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white/90 backdrop-blur shrink-0 sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2 group">
        <div className="h-7 w-7 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition">
          E14
        </div>
        <span className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-red-700 transition">
          Revisión Actas
        </span>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2">
        <NavLink href="/e-14">Revisar actas</NavLink>
        <NavLink href="/alerts" highlight>
          Alertas
        </NavLink>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  children,
  highlight,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        highlight
          ? "text-red-700 bg-red-50 hover:bg-red-100"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}
