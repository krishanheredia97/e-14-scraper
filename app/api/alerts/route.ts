import { getAlerts, getTotalAlertCount } from "../../lib/sqlite/flags";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

    const [alerts, total] = await Promise.all([
      getAlerts({ limit, offset }),
      getTotalAlertCount(),
    ]);

    return Response.json({ alerts, total });
  } catch (error) {
    console.error("Failed to load alerts:", error);
    return Response.json(
      { error: "Could not load alerts", details: String(error) },
      { status: 500 },
    );
  }
}
