import { getRandomBatch } from "../lib/pdfs";
import Reviewer from "../components/Reviewer";

export const dynamic = "force-dynamic";

export default async function E14Page() {
  const { names, metadata, total } = getRandomBatch(10);

  return <Reviewer initialBatch={names} initialMetadata={metadata} totalAvailable={total} />;
}
