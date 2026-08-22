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
  const publicDomainCutoff = new Date().getUTCFullYear() - 95;
  const isPublicDomain = year < publicDomainCutoff;

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
      : "A front page from the requested date. Open the source scan to discover the stories that shared this meaningful day.",
    edition: "Front Page",
    occasion: "History",
    decade: `${Math.floor(year / 10) * 10}s`,
    language: titleCase(item.language?.[0] || "English"),
    keywords: mode === "headline" ? [query, "OCR archive match"] : ["exact date", item.date],
    rightsStatus: isPublicDomain ? "Public domain" : "Rights review",
    assetStatus: "Source requested",
    sourceReference: sourceReference(id),
    sourceName: "Library of Congress — Chronicling America",
    sourceUrl: id,
    previewUrl,
    rightsBasis: isPublicDomain
      ? `Published in the United States before January 1, ${publicDomainCutoff}; public domain in its entirety. No copyright permission required.`
      : "No automatic clearance; publication, contributions, and scan rights require review.",
    rightsCheckedAt: new Date().toISOString().slice(0, 10),
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

export function createDateRequestRecord(date: string, location = ""): NewspaperRecord {
  const year = Number(date.slice(0, 4));
  return {
    id: `request-${date}-${location.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "anywhere"}`,
    issueDate: date,
    publication: "Custom archive search",
    city: location || "Any location",
    region: "",
    country: "",
    headline: "Find this date for me",
    summary: "This date is not yet in the instant catalog. Add the request and we will search the mapped newspaper archives for the strongest printable front page.",
    edition: "Front-page request",
    occasion: "Birthday",
    decade: `${Math.floor(year / 10) * 10}s`,
    language: "English",
    keywords: ["custom date", date, location],
    rightsStatus: "Rights review",
    assetStatus: "Source requested",
    sourceReference: `REQUEST-${date}`,
    catalogStatus: "Archive lead",
    featured: true,
    accent: "gold",
  };
}

export function createSameDayRequestRecord(month: string, day: string, location = ""): NewspaperRecord {
  const paddedDay = day.padStart(2, "0");
  return {
    ...createDateRequestRecord(`1920-${month}-${paddedDay}`, location),
    id: `request-same-day-${month}-${paddedDay}-${location.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "anywhere"}`,
    headline: `Research ${month}/${paddedDay} across the years`,
    summary: "No instant scans loaded this time. Submit this calendar day and we will search the mapped archives across multiple years and locations.",
    edition: "Same-day research request",
    keywords: ["same day", month, paddedDay, location],
    sourceReference: `REQUEST-SAME-DAY-${month}-${paddedDay}`,
  };
}
