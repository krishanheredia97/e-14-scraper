import Header from "./components/Header";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-100 px-4 py-1.5 text-sm font-medium text-red-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              Revisión ciudadana en curso
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Revisión Actas E-14
            </h1>
            <p className="text-xl text-slate-600 max-w-lg mx-auto">
              Revisión ciudadana de actas de escrutinio de Colombia.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-left space-y-5">
            <p className="text-slate-700 leading-relaxed">
              Esta herramienta permite a cualquier persona revisar de forma
              aleatoria las actas E-14 publicadas por la Registraduría y marcar
              aquellas que presenten posibles inconsistencias, fraude o
              problemas de carga.
            </p>
            <p className="text-slate-700 leading-relaxed">
              Juntos podemos hacer un seguimiento más riguroso de la información
              electoral y destacar los casos que requieren atención.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/e-14"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-red-900/15 hover:bg-red-700 hover:shadow-xl hover:-translate-y-0.5 transition"
            >
              Revisar actas
            </Link>
            <Link
              href="/alerts"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-4 text-base font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition"
            >
              Ver alertas ciudadanas
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-sm text-slate-500">
        Datos públicos de la Registraduría Nacional del Estado Civil.
      </footer>
    </div>
  );
}
