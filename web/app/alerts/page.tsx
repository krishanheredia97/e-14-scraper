import Header from "../components/Header";
import { getAlerts, type AlertRow } from "../lib/sqlite/flags";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = getAlerts({ limit: 500 });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Alertas ciudadanas
            </h1>
            <p className="mt-2 text-slate-600">
              Actas marcadas por los revisores. El orden prioriza las que tienen
              más señales de posible fraude o problema de carga.
            </p>
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <p className="text-slate-600 text-lg">Aún no hay alertas registradas.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Ubicación
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right w-32">
                      Alertas
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-40">
                      Enlace
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alerts.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertRow }) {
  const location = [alert.department, alert.municipality, alert.zone, alert.stand]
    .filter(Boolean)
    .join(" · ");

  const totalAlerts = alert.fraud_count + alert.error_count;

  return (
    <tr className="hover:bg-slate-50/80 transition group">
      <td className="px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 h-2 w-2 rounded-full bg-red-500 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900">
              {location || "Ubicación desconocida"}
            </p>
            <p className="mt-0.5 text-xs font-mono text-slate-400 break-all max-w-md">
              {alert.file_name}
            </p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="inline-flex items-center justify-center min-w-[2.5rem] rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-700 border border-red-100">
          {totalAlerts}
        </span>
      </td>
      <td className="px-6 py-4">
        <a
          href={alert.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition"
        >
          Registraduría
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </a>
      </td>
    </tr>
  );
}
