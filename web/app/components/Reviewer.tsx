"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "./Header";
import type { DocumentMetadata } from "../lib/types";

const PRELOAD_AHEAD = 3;
const LOW_QUEUE_THRESHOLD = 5;
const FINGERPRINT_KEY = "reviewer-fingerprint";

type FlagType = "error" | "fraud";

interface ReviewerProps {
  initialBatch: string[];
  initialMetadata: Record<string, DocumentMetadata>;
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

function ExternalLinkIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function WarningIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function BrokenFileIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2Z" />
      <path d="m14 2 6 6" />
      <path d="m10 13-3 3 3 3" />
      <path d="m14 13 3 3-3 3" />
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
      className="relative inline-flex h-9 w-52 cursor-pointer items-center rounded-full bg-slate-200 p-1 transition-colors hover:bg-slate-300"
    >
      <span
        className={`absolute left-1 top-1 h-7 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-full" : "translate-x-0"
        }`}
      />
      <span
        className={`z-10 flex-1 text-center text-xs font-semibold transition-colors ${
          checked ? "text-slate-500" : "text-slate-900"
        }`}
      >
        {labelLeft}
      </span>
      <span
        className={`z-10 flex-1 text-center text-xs font-semibold transition-colors ${
          checked ? "text-slate-900" : "text-slate-500"
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

export default function Reviewer({
  initialBatch,
  initialMetadata,
  totalAvailable,
}: ReviewerProps) {
  const [queue, setQueue] = useState<string[]>(initialBatch);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [counts, setCounts] = useState<Record<string, FlagCounts>>({});
  const [metadata, setMetadata] = useState<Record<string, DocumentMetadata>>(
    initialMetadata,
  );
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
      return {
        pdfs: data.pdfs as string[],
        metadata: (data.metadata ?? {}) as Record<string, DocumentMetadata>,
      };
    } catch (error) {
      console.error(error);
      return { pdfs: [], metadata: {} };
    }
  }, []);

  useEffect(() => {
    if (queue.length - index > LOW_QUEUE_THRESHOLD) return;
    fetchBatch().then(({ pdfs, metadata: batchMetadata }) => {
      if (pdfs.length > 0) {
        setQueue((prev) => [...prev, ...pdfs]);
        setMetadata((prev) => ({ ...prev, ...batchMetadata }));
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
              : "PDF marcado para revisión humana"
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
  const currentMetadata = currentPdf ? metadata[currentPdf] : undefined;

  const locationParts = [
    currentMetadata?.department,
    currentMetadata?.municipality,
    currentMetadata?.zone,
    currentMetadata?.stand,
  ].filter(Boolean);

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900">
      {preloadUrls.map((url) => (
        <link key={url} rel="prefetch" href={url} />
      ))}

      <Header />

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white/80 backdrop-blur shrink-0 flex-wrap sm:flex-nowrap">
        <Toggle
          checked={zoomedOut}
          onChange={setZoomedOut}
          labelLeft="Normal"
          labelRight="Vista completa"
        />
        <div className="text-sm font-medium text-slate-600 w-full sm:w-auto text-right">
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

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <main className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden min-h-[50vh] lg:min-h-0">
          {currentPdf ? (
            <>
              <button
                aria-label="Anterior"
                onClick={prevPdf}
                disabled={isPrevDisabled}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-white/95 text-slate-800 shadow-lg hover:bg-white hover:scale-105 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>

              <div
                className={
                  zoomedOut
                    ? "h-[70vh] lg:h-[96vh] w-[96vw] lg:w-[min(96vw,1500px)]"
                    : "h-[70vh] lg:h-[86vh] w-[90vw] lg:w-[min(48vw,720px)]"
                }
              >
                {loadError ? (
                  <div className="h-full flex flex-col items-center justify-center gap-5 rounded-2xl border border-slate-700 bg-slate-900 text-white">
                    <div className="p-4 rounded-full bg-slate-800">
                      <BrokenFileIcon className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-lg font-medium">No se pudo cargar el PDF</p>
                    <button
                      onClick={() => setLoadError(false)}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 cursor-pointer"
                    >
                      Intentar de nuevo
                    </button>
                  </div>
                ) : (
                  <iframe
                    key={pdfUrl}
                    src={`${pdfUrl}${zoomedOut ? "#zoom=page-fit" : ""}`}
                    title={`Acta ${currentPdf}`}
                    className="h-full w-full rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
                    onError={() => setLoadError(true)}
                  />
                )}
              </div>

              <button
                aria-label="Siguiente"
                onClick={nextPdf}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-white/95 text-slate-800 shadow-lg hover:bg-white hover:scale-105 transition"
              >
                <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            </>
          ) : (
            <div className="text-center text-slate-300 px-4">
              <p className="text-lg">No hay PDFs disponibles.</p>
              <p className="text-sm text-slate-500 mt-2">
                Asegúrate de que los archivos estén en la carpeta{" "}
                <code className="bg-slate-900 px-2 py-1 rounded text-slate-400">pdfs/</code>{" "}
                del repositorio.
              </p>
            </div>
          )}
        </main>

        <aside className="w-full lg:w-96 lg:shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white flex flex-col shadow-xl max-h-[50vh] lg:max-h-none overflow-hidden">
          <div className="flex-1 p-5 flex flex-col gap-5 overflow-auto">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Información del acta
              </p>

              {!currentMetadata ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                </div>
              ) : (
                <div className="space-y-3">
                  {locationParts.length > 0 ? (
                    <div className="flex items-start gap-3">
                      <div className="min-w-[4px] h-full min-h-[2rem] rounded-full bg-blue-500" />
                      <p className="text-base font-semibold text-slate-900 leading-snug">
                        {locationParts.join(" · ")}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {currentMetadata.department && (
                      <MetadataItem label="Departamento" value={currentMetadata.department} />
                    )}
                    {currentMetadata.municipality && (
                      <MetadataItem label="Municipio" value={currentMetadata.municipality} />
                    )}
                    {currentMetadata.zone && (
                      <MetadataItem label="Zona" value={currentMetadata.zone} />
                    )}
                    {currentMetadata.stand && (
                      <MetadataItem label="Puesto" value={currentMetadata.stand} />
                    )}
                    {currentMetadata.stand_code && (
                      <MetadataItem
                        label="Número de mesa"
                        value={currentMetadata.stand_code}
                      />
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200">
                    <a
                      href={currentMetadata.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                    >
                      Ver en Registraduría
                      <ExternalLinkIcon className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {currentCounts && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Marcas de otros usuarios
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">
                      {currentCounts.fraud_count}
                    </p>
                    <p className="text-[11px] font-semibold uppercase text-red-600 mt-1">Fraude</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {currentCounts.error_count}
                    </p>
                    <p className="text-[11px] font-semibold uppercase text-amber-600 mt-1">No carga</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Marcar acta
            </p>
            <button
              onClick={() => flagCurrent("error")}
              disabled={!currentPdf}
              className="group w-full rounded-xl border border-amber-200 bg-white px-4 py-3.5 text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-50 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm cursor-pointer"
            >
              <span className="flex items-center justify-center gap-2">
                <BrokenFileIcon className="h-5 w-5 text-amber-600 group-hover:scale-110 transition" />
                No carga el PDF
              </span>
            </button>
            <button
              onClick={() => flagCurrent("fraud")}
              disabled={!currentPdf}
              className="group w-full rounded-xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-900/20 hover:bg-red-700 hover:shadow-xl hover:-translate-y-0.5 transition disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg cursor-pointer"
            >
              <span className="flex items-center justify-center gap-2">
                <WarningIcon className="h-5 w-5 text-red-100 group-hover:scale-110 transition" />
                Posible fraude / inconsistencia
              </span>
            </button>
          </div>
        </aside>
      </div>

      {message && (
        <div
          className={`fixed bottom-6 left-6 px-5 py-3 rounded-full text-sm font-semibold shadow-xl backdrop-blur ${
            message.type === "success"
              ? "bg-emerald-700/95 text-white"
              : "bg-red-700/95 text-white"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

function MetadataItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className={mono ? "col-span-2" : ""}>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm text-slate-800 ${
          mono ? "font-mono text-xs break-all" : "font-medium"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
