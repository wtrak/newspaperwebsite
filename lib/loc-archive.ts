import type { NewspaperRecord } from "./catalog";

type LocSearchMode = "date" | "headline";

type LocSearchItem = {
  id?: string;
  title?: string;
  date?: string;
  image_url?: string[];
  language?: string[];
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

const PUBLIC_DOMAIN_BEFORE_YEAR = 1931;
const RIGHTS_CHECKED_AT = "2026-08-25";

const titleCase = (value: string) => value.replace(/\b\w/g, (character) => character.toUpperCase());

function parseIdentity(title: string) {
  const cleaned = title.replace(/^Image 1 of /, "");
  const bracketMatch = cleaned.match(/^(.+?) \((.*?) \[([^\]]+)\]\),/);
  const commaMatch = cleaned.match(/^(.+?) \(([^,]+),\s*([^)]+)\),/);
  return {
    publication: bracketMatch?.[1]?.trim() || commaMatch?.[1]?.trim() || cleaned.split(",")[0] || "Historic newspaper",
    city: bracketMatch?.[2]?.trim() || commaMatch?.[2]?.trim() || "United States",
    region: regionNames[(bracketMatch?.[3] || commaMatch?.[3] || "").trim().toLowerCase()] || (bracketMatch?.[3] || commaMatch?.[3] || "").trim(),
  };
}

function sourceReference(id: string) {
  return `LOC-${id.replace(/^https?:\/\/(www\.)?loc\.gov\/resource\//, "").replace(/[?&=/]/g, "-")}`.slice(0, 180);
}

function bestPreview(imageUrls: string[]) {
  const image = imageUrls.find((url) => url.includes("pct:12.5")) || imageUrls.find((url) => url.includes("image-services")) || "";
  return image.replace(/#.*$/, "");
}

export function mapLocResult(item: LocSearchItem, mode: LocSearchMode, query = "", index = 0): NewspaperRecord | null {
  if (!item.id || !item.date || !item.title?.startsWith("Image 1 of ")) return null;
  const previewUrl = bestPreview(item.image_url || []);
  if (!previewUrl) return null;

  const id = item.id.replace("http://", "https://");
  const identity = parseIdentity(item.title);
  const year = Number(item.date.slice(0, 4));
  const isPublicDomain = year < PUBLIC_DOMAIN_BEFORE_YEAR;

  return {
    id: sourceReference(id),
    issueDate: item.date,
    publication: identity.publication,
    city: identity.city,
    region: identity.region,
    country: "United States",
    headline: mode === "headline" ? `Front page mentioning “${query}”` : `Front page from ${item.date}`,
    summary: mode === "headline"
      ? `A Library of Congress OCR search found this front page for “${query}.” Open the source scan to inspect the original wording and placement.`
      : "A front page from the chosen date. Open the source scan to discover the stories that shared this meaningful day.",
    edition: "Front Page",
    occasion: "History",
    decade: `${Math.floor(year / 10) * 10}s`,
    language: titleCase(item.language?.[0] || "English"),
    keywords: mode === "headline" ? [query, "OCR archive match"] : ["exact date", item.date],
    rightsStatus: isPublicDomain ? "Public domain" : "Rights review",
    assetStatus: isPublicDomain ? "Print ready" : "Restoration needed",
    sourceReference: sourceReference(id),
    sourceName: "Library of Congress — Chronicling America",
    sourceUrl: id,
    previewUrl,
    rightsBasis: isPublicDomain
      ? `Published in the United States before January 1, ${PUBLIC_DOMAIN_BEFORE_YEAR}; public domain in its entirety. No copyright permission required.`
      : "No automatic clearance; publication, contributions, and scan rights require review.",
    rightsCheckedAt: RIGHTS_CHECKED_AT,
    catalogStatus: "Archive lead",
    featured: index < 2,
    accent: (["gold", "red", "green", "blue"] as const)[index % 4],
  };
}

export async function searchLocArchive({
  mode,
  date = "",
  query = "",
  limit = 8,
  timeoutMs = 7000,
  fetchImpl = fetch,
}: {
  mode: LocSearchMode;
  date?: string;
  query?: string;
  limit?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}) {
  const locUrl = new URL("https://www.loc.gov/collections/chronicling-america/");
  locUrl.searchParams.set("fo", "json");
  locUrl.searchParams.set("at", "results");
  locUrl.searchParams.set("c", String(Math.max(20, limit * 3)));
  locUrl.searchParams.set("q", mode === "date" ? "the" : query);
  if (mode === "date") locUrl.searchParams.set("dates", date);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let payload: { results?: LocSearchItem[] };
  try {
    const response = await fetchImpl(locUrl, { headers: { accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`Library of Congress returned ${response.status}`);
    payload = await response.json() as { results?: LocSearchItem[] };
  } finally {
    clearTimeout(timeout);
  }
  return (payload.results || [])
    .filter((item) => mode !== "date" || item.date === date)
    .map((item, index) => mapLocResult(item, mode, query, index))
    .filter((item): item is NewspaperRecord => Boolean(item))
    .filter((item) => item.rightsStatus === "Public domain")
    .slice(0, limit);
}

export async function searchLocSameDay(month: string, day: string) {
  const representativeYears = [1910, 1920, 1930, 1940, 1950, 1960, 1900, 1880, 1860, 1840];
  const dates = representativeYears
    .map((year) => `${year}-${month}-${day.padStart(2, "0")}`)
    .filter((date) => !Number.isNaN(Date.parse(`${date}T00:00:00Z`)));
  const records: NewspaperRecord[] = [];
  for (let index = 0; index < dates.length && records.length < 4; index += 2) {
    const settled = await Promise.allSettled(dates.slice(index, index + 2).map((date) =>
      searchLocArchive({ mode: "date", date, limit: 1, timeoutMs: 12000 }),
    ));
    records.push(...settled.flatMap((result) => result.status === "fulfilled" ? result.value : []));
  }
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}
