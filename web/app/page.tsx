import { getRandomBatch } from "./lib/pdfs";
import Reviewer from "./components/Reviewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { names, total } = getRandomBatch(10);

  return <Reviewer initialBatch={names} totalAvailable={total} />;
}

