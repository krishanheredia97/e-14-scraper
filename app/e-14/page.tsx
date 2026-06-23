import { getRandomBatch } from "../lib/metadata";
import Reviewer from "../components/Reviewer";

export const dynamic = "force-dynamic";

export default async function E14Page() {
  const { names, metadata, total } = await getRandomBatch(10);

  return <Reviewer initialBatch={names} initialMetadata={metadata} totalAvailable={total} />;
}
