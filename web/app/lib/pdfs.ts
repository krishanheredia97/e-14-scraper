import { readdir } from "fs/promises";
import path from "path";

const BATCH_SIZE = 10;

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function getRandomBatch(size = BATCH_SIZE) {
  const pdfDir = path.join(process.cwd(), "public", "pdfs");

  let entries: string[];
  try {
    entries = await readdir(pdfDir);
  } catch {
    entries = [];
  }

  const pdfs = entries.filter((name) => name.toLowerCase().endsWith(".pdf"));
  const batch = shuffle(pdfs).slice(0, size);

  return { names: batch, total: pdfs.length };
}
