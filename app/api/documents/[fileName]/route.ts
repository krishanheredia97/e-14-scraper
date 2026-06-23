import { getDocumentMetadataByFileName } from "../../../lib/sqlite/documents";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  try {
    const { fileName } = await params;
    const decoded = decodeURIComponent(fileName);
    const metadata = getDocumentMetadataByFileName(decoded);

    if (!metadata) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    return Response.json({ metadata });
  } catch (error) {
    console.error("Failed to load document metadata:", error);
    return Response.json(
      { error: "Could not load metadata", details: String(error) },
      { status: 500 },
    );
  }
}
