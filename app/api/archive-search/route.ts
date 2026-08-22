import type { NewspaperRecord } from "../../../lib/catalog";

type LocSearchItem = {
  id?: string;
  title?: string;
  date?: string;
  location?: string[];
  language?: string[];
};

type LocDetail = {
  resources?: Array<{ image?: string }>;
};

const regionNames: Record<string, string> = {
  "ala.": "Alabama", "ariz.": "Arizona", "ark.": "Arkansas", "calif.": "California",
  "colo.": "Colorado", "conn.": "Connecticut", "d.c.": "District of Columbia", "del.": "Delaware",
  "fla.": "Florida", "ga.": "Georgia", "ill.": "Illinois", "ind.": "Indiana", "kan.": "Kansas",
  "ky.": "Kentucky", "la.": "Louisiana", "mass.": "Massachusetts", "md.": "Maryland",
  "me.": "Maine", "mich.": "Michigan", "minn.": "Minnesota", "miss.": "Mississippi",
  "mo.": "Missouri", "mont.": "Montana", "n.c.": "North Carolina", "n.d.": "North Dakota",
  "n.h.": "New Hampshire", "n.j.": "New Jersey", "n.m.": "New Mexico", "n.y.": "New York",
  "neb.": "Nebraska", "nev.": "Nevada", "ohio": "Ohio", "okla.": "Oklahoma", "or.": "Oregon",
  "pa.": "Pennsylvania", "r.i.": "Rhode Island", "s.c.": "South Carolina", "s.d.": "South Dakota",
  "tenn.": "Tennessee", "tex.": "Texas", "utah": "Utah", "va.": "Virginia", "vt.": "Vermont",
  "wash.": "Washington", "wis.": "Wisconsin", "w. va.": "West Virginia", "wyo.": "Wyoming",
};

const titleCase = (value: string) => value.replace(/\b\w/g, (character) => character.toUpperCase());

function parseIdentity(title: string) {
  const cleaned = title.replace(/^Image 1 of /, "");
  const match = cleaned.match(/^(.+?) \(([^,]+),\s*([^)]+)\),/);
  return {
    publication: match?.[1]?.trim() || cleaned.split(",")[0] || "Historic newspaper",
    city: match?.[2]?.trim() || "United States",
    region: regionNames[match?.[3]?.trim().toLowerCase() || ""] || match?.[3]?.trim() || "",
  };
}

function sourceReference(id: string) {
  return `LOC-${id.replace(/^https?:\/\/(www\.)?loc\.gov\/resource\//, "").replace(/[?&=/]/g, "-")}`.slice(0, 180);
}

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

  const locUrl = new URL("https://www.loc.gov/collections/chronicling-america/");
  locUrl.searchParams.set("fo", "json");
  locUrl.searchParams.set("at", "results");
  locUrl.searchParams.set("c", "60");
  locUrl.searchParams.set("q", mode === "date" ? "the" : query);
  if (mode === "date") locUrl.searchParams.set("dates", date);

  try {
    const searchResponse = await fetch(locUrl, { headers: { accept: "application/json" } });
    if (!searchResponse.ok) throw new Error(`Library of Congress returned ${searchResponse.status}`);
    const searchPayload = await searchResponse.json() as { results?: LocSearchItem[] };
    const candidates = (searchPayload.results || [])
      .filter((item) => item.id && item.date && item.title?.startsWith("Image 1 of "))
      .filter((item) => mode !== "date" || item.date === date)
      .slice(0, 8);

    const items = (await Promise.all(candidates.map(async (item, index): Promise<NewspaperRecord | null> => {
      const id = item.id!.replace("http://", "https://");
      const detailUrl = new URL(id);
      detailUrl.searchParams.set("fo", "json");
      const detailResponse = await fetch(detailUrl, { headers: { accept: "application/json" } });
      if (!detailResponse.ok) return null;
      const detail = await detailResponse.json() as LocDetail;
      const rawImage = detail.resources?.[0]?.image;
      if (!rawImage) return null;

      const identity = parseIdentity(item.title!);
      const year = Number(item.date!.slice(0, 4));
      const isOlderThan95Years = year <= new Date().getUTCFullYear() - 96;
      const headline = mode === "headline" ? `Front page mentioning “${query}”` : `The news of ${item.date}`;

      return {
        id: sourceReference(id),
        issueDate: item.date!,
        publication: identity.publication,
        city: identity.city,
        region: identity.region,
        country: "United States",
        headline,
        summary: mode === "headline"
          ? `A Library of Congress OCR search found this front page for “${query}.” Open the source scan to inspect the original wording and placement.`
          : "A front page from the requested date. Open the source scan to discover the stories that shared this meaningful day.",
        edition: "Front Page",
        occasion: "History",
        decade: `${Math.floor(year / 10) * 10}s`,
        language: titleCase(item.language?.[0] || "English"),
        keywords: mode === "headline" ? [query, "OCR archive match"] : ["exact date", item.date!],
        rightsStatus: isOlderThan95Years ? "Public domain" : "Rights review",
        assetStatus: "Source requested",
        sourceReference: sourceReference(id),
        sourceName: "Library of Congress — Chronicling America",
        sourceUrl: id,
        previewUrl: rawImage.replace(/pct:[^/]+/, "pct:12.5"),
        rightsBasis: isOlderThan95Years
          ? "Published more than 95 years ago; final item and scan review still required before sale."
          : "No automatic clearance; publication, contributions, and scan rights require review.",
        rightsCheckedAt: new Date().toISOString().slice(0, 10),
        catalogStatus: "Archive lead",
        featured: index < 2,
        accent: (["gold", "red", "green", "blue"] as const)[index % 4],
      };
    }))).filter((item): item is NewspaperRecord => Boolean(item));

    return Response.json(
      { items, count: items.length, source: "Library of Congress — Chronicling America" },
      { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archive lookup failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
