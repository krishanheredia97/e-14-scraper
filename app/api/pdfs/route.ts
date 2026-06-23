import { getRandomBatch } from "../../lib/metadata";

export async function GET() {
  try {
    const { names, metadata, total } = await getRandomBatch(10);
    return Response.json({ pdfs: names, metadata, total });
  } catch (error) {
    return Response.json(
      { error: "Could not load PDF list", details: String(error) },
      { status: 500 },
    );
  }
}
