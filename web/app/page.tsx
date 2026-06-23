import Header from "./components/Header";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
      <Header />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-xl w-full text-center space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Revisión Actas E-14
            </h1>
            <p className="text-lg text-neutral-600">
              Revisión ciudadana de actas de escrutinio de Colombia.
            </p>
          </div>

          <p className="text-neutral-600 leading-relaxed">
            Esta herramienta permite a cualquier persona revisar de forma
            aleatoria las actas E-14 publicadas por la Registraduría y marcar
            aquellas que presenten posibles inconsistencias, fraude o problemas
            de carga. Juntos podemos hacer un seguimiento más riguroso de la
            información electoral.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/e-14"
              className="w-full sm:w-auto rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              Revisar actas
            </Link>
            <Link
              href="/alerts"
              className="w-full sm:w-auto rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Ver alertas ciudadanas
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-neutral-500">
        Datos públicos de la Registraduría Nacional del Estado Civil.
      </footer>
    </div>
  );
}
