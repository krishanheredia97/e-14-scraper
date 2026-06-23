import { getDocumentByFileName } from "../../lib/sqlite/documents";
import { upsertFlag, getFlagCounts, type FlagType } from "../../lib/sqlite/flags";

const VALID_FLAG_TYPES: FlagType[] = ["error", "fraud", "ok"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, flagType, fingerprint } = body ?? {};

    if (typeof fileName !== "string" || !fileName) {
      return Response.json({ error: "fileName is required" }, { status: 400 });
    }
    if (typeof fingerprint !== "string" || !fingerprint) {
      return Response.json(
        { error: "fingerprint is required" },
        { status: 400 },
      );
    }
    if (!VALID_FLAG_TYPES.includes(flagType)) {
      return Response.json(
        { error: "flagType must be one of error, fraud, ok" },
        { status: 400 },
      );
    }

    const document = getDocumentByFileName(fileName);
    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const { changed } = upsertFlag(document.id, flagType, fingerprint);
    const counts = getFlagCounts(document.id);

    return Response.json({
      success: true,
      accepted: changed,
      counts,
    });
  } catch (error) {
    console.error("Failed to record flag:", error);
    return Response.json(
      { error: "Could not record flag", details: String(error) },
      { status: 500 },
    );
  }
}
