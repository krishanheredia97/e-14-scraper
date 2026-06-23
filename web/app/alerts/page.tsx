import Link from "next/link";
import { getAlerts, type AlertRow } from "../lib/sqlite/flags";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = getAlerts({ limit: 500 });

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white">
        <Link href="/" className="font-semibold text-lg hover:underline">
          Revisión Actas E-14
        </Link>
        <h1 className="text-base font-medium">Alertas ciudadanas</h1>
      </header>

      <main className="flex-1 p-4">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-neutral-600 mb-4">
            Actas marcadas por los revisores. El orden prioriza las que tienen
            más señales de posible fraude o problema de carga.
          </p>

          {alerts.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
              <p className="text-neutral-600">
                Aún no hay alertas registradas.
              </p>
              <Link
                href="/"
                className="mt-2 inline-block text-blue-600 hover:underline"
              >
                Empezar a revisar
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-neutral-100 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Acta</th>
                    <th className="px-4 py-3 font-medium">Ubicación</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Fraude
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      No carga
                    </th>
                    <th className="px-4 py-3 font-medium text-right">OK</th>
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

  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-3 break-all max-w-xs">{alert.file_name}</td>
      <td className="px-4 py-3 text-neutral-600">
        {location || "—"}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-red-700">
        {alert.fraud_count}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-yellow-700">
        {alert.error_count}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-green-700">
        {alert.ok_count}
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
