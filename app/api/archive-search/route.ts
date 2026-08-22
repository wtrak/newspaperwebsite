import { searchLocArchive } from "../../../lib/loc-archive";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const mode = requestUrl.searchParams.get("mode");
  const date = requestUrl.searchParams.get("date")?.trim() || "";
  const query = requestUrl.searchParams.get("q")?.trim().slice(0, 100) || "";

  if (mode !== "date" && mode !== "headline") {
    return Response.json({ error: "Search mode must be date or headline." }, { status: 400 });
  }
  if (mode === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "A valid exact date is required." }, { status: 400 });
  }
  if (mode === "headline" && query.length < 2) {
    return Response.json({ error: "Enter at least two search characters." }, { status: 400 });
  }

  try {
    const items = await searchLocArchive({ mode, date, query });
    return Response.json(
      { items, count: items.length, source: "Library of Congress — Chronicling America" },
      { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archive lookup failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
