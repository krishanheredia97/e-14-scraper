import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;
  const decoded = decodeURIComponent(fileName);
  const pdfPath = path.join(process.cwd(), "scraper", "pdfs", decoded);

  try {
    const stats = await stat(pdfPath);
    const stream = createReadStream(pdfPath);

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(stats.size),
      },
    });
  } catch {
    return new Response("PDF not found", { status: 404 });
  }
}
