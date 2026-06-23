"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const PRELOAD_AHEAD = 3;
const LOW_QUEUE_THRESHOLD = 5;

type FlagType = "error" | "fraud";

interface ReviewerProps {
  initialBatch: string[];
  totalAvailable: number;
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

export default function Reviewer({ initialBatch, totalAvailable }: ReviewerProps) {
  const [queue, setQueue] = useState<string[]>(initialBatch);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [flagged, setFlagged] = useState<Record<string, FlagType>>(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem("flagged-pdfs");
    if (!saved) return {};
    try {
      return JSON.parse(saved);
    } catch {
      return {};
    }
  });
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(
    null
  );

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

  // Persist flags to localStorage whenever they change.
  useEffect(() => {
    localStorage.setItem("flagged-pdfs", JSON.stringify(flagged));
  }, [flagged]);

  // Lazy-load more PDFs when the user gets close to the end of the queue.
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
    (type: FlagType) => {
      if (!currentPdf) return;
      setFlagged((prev) => ({ ...prev, [currentPdf]: type }));
      showMessage(
        type === "error"
          ? "PDF marcado como no cargable"
          : "PDF marcado para revisión humana",
        "success"
      );
      nextPdf();
    },
    [currentPdf, nextPdf, showMessage]
  );

  const pdfUrl = useMemo(() => {
    if (!currentPdf) return "";
    return `/pdfs/${encodeURIComponent(currentPdf)}`;
  }, [currentPdf]);

  const preloadUrls = useMemo(() => {
    const urls: string[] = [];
    for (let i = 1; i <= PRELOAD_AHEAD; i++) {
      const next = queue[index + i];
      if (next) urls.push(`/pdfs/${encodeURIComponent(next)}`);
    }
    return urls;
  }, [index, queue]);

  return (
    <div className="h-screen flex flex-col bg-neutral-50 text-neutral-900">
      {preloadUrls.map((url) => (
        <link key={url} rel="prefetch" href={url} as="document" />
      ))}

      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white shrink-0">
        <h1 className="font-semibold text-lg">Revisión Actas E-14</h1>
        <div className="text-sm text-neutral-600">
          {currentPdf ? (
            <>
              PDF {index + 1} de {totalInQueue} en cola
              {totalAvailable > 0 && ` · ${totalAvailable} disponibles`}{" "}
              {flagged[currentPdf] && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {flagged[currentPdf] === "error" ? "Error" : "Revisar"}
                </span>
              )}
            </>
          ) : (
            "Cargando..."
          )}
        </div>
      </header>

      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        {currentPdf ? (
          <>
            <button
              aria-label="Anterior"
              onClick={prevPdf}
              disabled={index === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/90 shadow hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            <div className="w-full h-full px-16 py-4">
              {loadError ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 rounded-xl border border-neutral-200 bg-white">
                  <p className="text-neutral-700">No se pudo cargar el PDF.</p>
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
                  src={pdfUrl}
                  title={`Acta ${currentPdf}`}
                  className="w-full h-full rounded-xl border border-neutral-200 bg-white"
                  onError={() => setLoadError(true)}
                />
              )}
            </div>

            <button
              aria-label="Siguiente"
              onClick={nextPdf}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/90 shadow hover:bg-white"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </>
        ) : (
          <div className="text-center">
            <p className="text-neutral-600">No hay PDFs disponibles.</p>
            <p className="text-sm text-neutral-500 mt-1">
              Coloca los archivos en <code>public/pdfs</code>.
            </p>
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {currentPdf && (
            <p className="text-center text-xs text-neutral-500 truncate">{currentPdf}</p>
          )}
          <div className="flex justify-center gap-3">
            <button
              onClick={() => flagCurrent("error")}
              disabled={!currentPdf}
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              No carga el PDF
            </button>
            <button
              onClick={() => flagCurrent("fraud")}
              disabled={!currentPdf}
              className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Posible fraude / inconsistencia
            </button>
          </div>
        </div>
      </footer>

      {message && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium shadow-lg ${
            message.type === "success" ? "bg-green-700 text-white" : "bg-red-700 text-white"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
