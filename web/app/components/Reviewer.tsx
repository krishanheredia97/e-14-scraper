"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const PRELOAD_AHEAD = 3;
const LOW_QUEUE_THRESHOLD = 5;
const FINGERPRINT_KEY = "reviewer-fingerprint";

type FlagType = "error" | "fraud" | "ok";

interface ReviewerProps {
  initialBatch: string[];
  totalAvailable: number;
}

interface FlagCounts {
  error_count: number;
  fraud_count: number;
  ok_count: number;
}

function ChevronLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function Toggle({
  checked,
  onChange,
  labelLeft,
  labelRight,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelLeft: string;
  labelRight: string;
}) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-8 w-48 cursor-pointer items-center rounded-full bg-neutral-200 p-1 transition-colors"
    >
      <span
        className={`absolute left-1 top-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-full" : "translate-x-0"
        }`}
      />
      <span
        className={`z-10 flex-1 text-center text-xs font-medium transition-colors ${
          checked ? "text-neutral-500" : "text-neutral-900"
        }`}
      >
        {labelLeft}
      </span>
      <span
        className={`z-10 flex-1 text-center text-xs font-medium transition-colors ${
          checked ? "text-neutral-900" : "text-neutral-500"
        }`}
      >
        {labelRight}
      </span>
    </div>
  );
}

function getOrCreateFingerprint(): string {
  if (typeof window === "undefined") return "";
  let fingerprint = window.localStorage.getItem(FINGERPRINT_KEY);
  if (!fingerprint) {
    fingerprint = crypto.randomUUID();
    window.localStorage.setItem(FINGERPRINT_KEY, fingerprint);
  }
  return fingerprint;
}

export default function Reviewer({ initialBatch, totalAvailable }: ReviewerProps) {
  const [queue, setQueue] = useState<string[]>(initialBatch);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [counts, setCounts] = useState<Record<string, FlagCounts>>({});
  const [message, setMessage] = useState<
    { text: string; type: "success" | "error" } | null
  >(null);
  const [zoomedOut, setZoomedOut] = useState(false);
  const [fingerprint] = useState(() => {
    if (typeof window === "undefined") return "";
    return getOrCreateFingerprint();
  });
  const [mounted, setMounted] = useState(false);
  const isPrevDisabled = !mounted || index === 0;

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const currentPdf = queue[index];
  const totalInQueue = queue.length;

  const showMessage = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const fetchBatch = useCallback(async () => {
    try {
      const res = await fetch("/api/pdfs");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch PDFs");
      }
      return data.pdfs as string[];
    } catch (error) {
      console.error(error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (queue.length - index > LOW_QUEUE_THRESHOLD) return;
    fetchBatch().then((batch) => {
      if (batch.length > 0) {
        setQueue((prev) => [...prev, ...batch]);
      }
    });
  }, [index, queue.length, fetchBatch]);

  const nextPdf = useCallback(() => {
    setLoadError(false);
    setIndex((i) => Math.min(i + 1, queue.length - 1));
  }, [queue.length]);

  const prevPdf = useCallback(() => {
    setLoadError(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextPdf();
      if (e.key === "ArrowLeft") prevPdf();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextPdf, prevPdf]);

  const flagCurrent = useCallback(
    async (type: FlagType) => {
      if (!currentPdf || !fingerprint) return;

      try {
        const res = await fetch("/api/flags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: currentPdf,
            flagType: type,
            fingerprint,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to record flag");
        }

        if (data.counts) {
          setCounts((prev) => ({ ...prev, [currentPdf]: data.counts }));
        }

        showMessage(
          data.accepted
            ? type === "error"
              ? "PDF marcado como no cargable"
              : type === "fraud"
                ? "PDF marcado para revisión humana"
                : "PDF marcado como correcto"
            : "Ya habías marcado este PDF",
          "success",
        );

        if (data.accepted) {
          nextPdf();
        }
      } catch (error) {
        showMessage(
          error instanceof Error ? error.message : "Error al enviar la marca",
          "error",
        );
      }
    },
    [currentPdf, fingerprint, nextPdf, showMessage],
  );

  const pdfUrl = useMemo(() => {
    if (!currentPdf) return "";
    return `/api/pdfs/${encodeURIComponent(currentPdf)}`;
  }, [currentPdf]);

  const preloadUrls = useMemo(() => {
    const urls: string[] = [];
    for (let i = 1; i <= PRELOAD_AHEAD; i++) {
      const next = queue[index + i];
      if (next) urls.push(`/api/pdfs/${encodeURIComponent(next)}`);
    }
    return urls;
  }, [index, queue]);

  const currentCounts = currentPdf ? counts[currentPdf] : undefined;

  return (
    <div className="h-screen flex flex-col bg-neutral-50 text-neutral-900">
      {preloadUrls.map((url) => (
        <link key={url} rel="prefetch" href={url} />
      ))}

      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold text-lg hover:underline">
            Revisión Actas E-14
          </Link>
          <Toggle
            checked={zoomedOut}
            onChange={setZoomedOut}
            labelLeft="Normal"
            labelRight="Vista completa"
          />
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/alerts"
            className="text-sm font-medium text-red-700 hover:underline"
          >
            Ver alertas
          </Link>
          <div className="text-sm text-neutral-600">
            {currentPdf ? (
              <>
                PDF {index + 1} de {totalInQueue} en cola
                {totalAvailable > 0 && ` · ${totalAvailable} disponibles`}
              </>
            ) : (
              "Cargando..."
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative bg-neutral-900 flex items-center justify-center overflow-hidden">
          {currentPdf ? (
            <>
              <button
                aria-label="Anterior"
                onClick={prevPdf}
                disabled={isPrevDisabled}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/90 shadow hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>

              <div
                className={
                  zoomedOut
                    ? "h-[95vh] w-[min(95vw,1400px)]"
                    : "h-[85vh] w-[min(45vw,650px)]"
                }
              >
                {loadError ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 rounded-xl border border-neutral-700 bg-neutral-800 text-white">
                    <p>No se pudo cargar el PDF.</p>
                    <button
                      onClick={() => setLoadError(false)}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Intentar de nuevo
                    </button>
                  </div>
                ) : (
                  <iframe
                    key={pdfUrl}
                    src={`${pdfUrl}${zoomedOut ? "#zoom=page-fit" : ""}`}
                    title={`Acta ${currentPdf}`}
                    className="h-full w-full rounded-lg border border-neutral-700 bg-neutral-900"
                    onError={() => setLoadError(true)}
                  />
                )}
              </div>

              <button
                aria-label="Siguiente"
                onClick={nextPdf}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/90 shadow hover:bg-white"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          ) : (
            <div className="text-center text-neutral-300">
              <p>No hay PDFs disponibles.</p>
              <p className="text-sm text-neutral-500 mt-1">
                Asegúrate de que los archivos estén en la carpeta{" "}
                <code>pdfs/</code> del repositorio.
              </p>
            </div>
          )}
        </main>

        <aside className="w-80 shrink-0 border-l border-neutral-200 bg-white flex flex-col">
          <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Archivo
              </p>
              {currentPdf ? (
                <p className="mt-1 text-sm text-neutral-800 break-all">
                  {currentPdf}
                </p>
              ) : (
                <p className="mt-1 text-sm text-neutral-400">—</p>
              )}
            </div>

            {currentCounts && (
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Marcas de otros usuarios
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-red-50 p-2">
                    <p className="text-lg font-semibold text-red-700">
                      {currentCounts.fraud_count}
                    </p>
                    <p className="text-[10px] uppercase text-red-600">Fraude</p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 p-2">
                    <p className="text-lg font-semibold text-yellow-700">
                      {currentCounts.error_count}
                    </p>
                    <p className="text-[10px] uppercase text-yellow-600">
                      No carga
                    </p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-2">
                    <p className="text-lg font-semibold text-green-700">
                      {currentCounts.ok_count}
                    </p>
                    <p className="text-[10px] uppercase text-green-600">OK</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-neutral-200 flex flex-col gap-3">
            <button
              onClick={() => flagCurrent("ok")}
              disabled={!currentPdf}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              Parece correcta
            </button>
            <button
              onClick={() => flagCurrent("error")}
              disabled={!currentPdf}
              className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800 hover:bg-yellow-100 disabled:opacity-50"
            >
              No carga el PDF
            </button>
            <button
              onClick={() => flagCurrent("fraud")}
              disabled={!currentPdf}
              className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Posible fraude / inconsistencia
            </button>
          </div>
        </aside>
      </div>

      {message && (
        <div
          className={`fixed bottom-6 left-6 px-4 py-2 rounded-full text-sm font-medium shadow-lg ${
            message.type === "success"
              ? "bg-green-700 text-white"
              : "bg-red-700 text-white"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
