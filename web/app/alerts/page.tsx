import Header from "../components/Header";
import { getAlerts, type AlertRow } from "../lib/sqlite/flags";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = getAlerts({ limit: 500 });

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
      <Header />

      <main className="flex-1 p-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Alertas ciudadanas</h1>
          <p className="text-sm text-neutral-600 mb-4">
            Actas marcadas por los revisores. El orden prioriza las que tienen
            más señales de posible fraude o problema de carga.
          </p>

          {alerts.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
              <p className="text-neutral-600">
                Aún no hay alertas registradas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-neutral-100 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ubicación</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Alertas
                    </th>
                    <th className="px-4 py-3 font-medium">Enlace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
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
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-3 text-neutral-600">
        {location || alert.file_name}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-red-700">
        {totalAlerts}
      </td>
      <td className="px-4 py-3">
        <a
          href={alert.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Registraduría
        </a>
      </td>
    </tr>
  );
}
