import Link from "next/link";

export default function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white shrink-0">
      <Link href="/" className="font-semibold text-sm sm:text-base hover:underline">
        Revisión Actas E-14
      </Link>
      <nav className="flex items-center gap-3 sm:gap-4 text-sm">
        <Link
          href="/e-14"
          className="text-neutral-700 hover:underline"
        >
          Revisar actas
        </Link>
        <Link
          href="/alerts"
          className="font-medium text-red-700 hover:underline"
        >
          Alertas
        </Link>
      </nav>
    </header>
  );
}
