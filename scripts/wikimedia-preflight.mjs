const API_URL = "https://commons.wikimedia.org/w/api.php";
const DEFAULT_QUERY = "newspaper front page filetype:bitmap";

const FRONT_PAGE_TERMS = /\b(front[ -]?page|first[ -]?page|page (?:one|1)|1st page|premi(?:e|è)re page|titelseite)\b/i;
const NEWSPAPER_TERMS = /\b(newspaper|gazette|times|herald|journal|tribune|daily|weekly|chronicle|courant|zeitung|news|post|sun|press)\b/i;
const NON_PAGE_TERMS = /\b(clipping|article clipping|press conference|newsstand|newspaper seller|reading (?:a )?newspaper|collage|two-page|double-page|spread|magazine cover|cartoon|poster|advertisement)\b/i;

function stripMarkup(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function metadataValue(metadata, key) {
  return stripMarkup(metadata?.[key]?.value ?? "");
}

function normalizedTitle(title) {
  return title
    .replace(/^File:/i, "")
    .replace(/\.(?:jpe?g|png|tiff?|webp)$/i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function scoreCandidate(page) {
  const info = page.imageinfo?.[0] ?? {};
  const metadata = info.extmetadata ?? {};
  const title = stripMarkup(page.title ?? "");
  const description = metadataValue(metadata, "ImageDescription");
  const categories = metadataValue(metadata, "Categories");
  const searchableText = `${title} ${description} ${categories}`;
  const width = Number(info.width ?? 0);
  const height = Number(info.height ?? 0);
  const ratio = height > 0 ? width / height : 0;
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const reasons = [];
  let score = 0;

  if (!width || !height) reasons.push("missing pixel dimensions");
  if (shortEdge < 1800 || longEdge < 2600) reasons.push("too small for large-format review");
  if (ratio < 0.45 || ratio > 0.92) reasons.push("not shaped like one portrait newspaper page");
  if (NON_PAGE_TERMS.test(searchableText)) reasons.push("metadata describes a clipping, photograph, spread, or other non-page item");
  if (!FRONT_PAGE_TERMS.test(searchableText)) reasons.push("no clear complete-front-page evidence in the metadata");

  if (FRONT_PAGE_TERMS.test(searchableText)) score += 4;
  if (NEWSPAPER_TERMS.test(searchableText)) score += 2;
  if (ratio >= 0.55 && ratio <= 0.82) score += 3;
  else if (ratio >= 0.45 && ratio <= 0.92) score += 1;
  if (shortEdge >= 3000 && longEdge >= 4200) score += 3;
  else if (shortEdge >= 1800 && longEdge >= 2600) score += 1;
  if (metadataValue(metadata, "DateTimeOriginal")) score += 1;
  if (metadataValue(metadata, "Credit") || metadataValue(metadata, "Artist")) score += 1;

  return {
    id: page.pageid,
    title,
    width,
    height,
    ratio: Number(ratio.toFixed(3)),
    score,
    status: reasons.length === 0 ? "shortlist" : "reject",
    reasons,
    pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? "")}`,
    imageUrl: info.url ?? "",
    thumbnailUrl: info.thumburl ?? "",
    date: metadataValue(metadata, "DateTimeOriginal"),
    license: metadataValue(metadata, "LicenseShortName"),
    licenseUrl: metadataValue(metadata, "LicenseUrl"),
    attribution: metadataValue(metadata, "Credit") || metadataValue(metadata, "Artist"),
  };
}

export function dedupeCandidates(candidates) {
  const byTitle = new Map();
  for (const candidate of candidates) {
    const key = normalizedTitle(candidate.title);
    const existing = byTitle.get(key);
    const pixels = candidate.width * candidate.height;
    const existingPixels = existing ? existing.width * existing.height : 0;
    if (!existing || candidate.score > existing.score || (candidate.score === existing.score && pixels > existingPixels)) {
      byTitle.set(key, candidate);
    }
  }
  return [...byTitle.values()];
}

function option(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  return value || fallback;
}

export async function fetchCandidates({ query = DEFAULT_QUERY, limit = 50, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(Math.min(Math.max(limit, 1), 500)),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "420",
    iiextmetadatafilter: "LicenseShortName|LicenseUrl|UsageTerms|Credit|Artist|ImageDescription|DateTimeOriginal|Categories",
    origin: "*",
  });
  const response = await fetchImpl(`${API_URL}?${params}`, {
    headers: { "User-Agent": "FirstEditionArchive/0.1 (newspaper visual-fit research)" },
  });
  if (!response.ok) throw new Error(`Wikimedia API returned ${response.status}`);
  const data = await response.json();
  return data.query?.pages ?? [];
}

async function main() {
  const limit = Number(option("limit", "50"));
  const query = option("query", DEFAULT_QUERY);
  const pages = await fetchCandidates({ query, limit });
  const assessed = dedupeCandidates(pages.map(scoreCandidate));
  const shortlist = assessed.filter((candidate) => candidate.status === "shortlist").sort((a, b) => b.score - a.score);
  const rejected = assessed.filter((candidate) => candidate.status === "reject");

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ query, reviewed: pages.length, unique: assessed.length, shortlist, rejected }, null, 2));
    return;
  }

  console.log(`Wikimedia visual-fit preflight: ${pages.length} reviewed, ${assessed.length} unique, ${shortlist.length} shortlisted.`);
  if (!shortlist.length) {
    console.log("No files passed this batch. Increase --limit or adjust --query; rejected items remain visible with --json.");
    return;
  }
  console.table(shortlist.map(({ title, width, height, score, license, pageUrl }) => ({ title, dimensions: `${width}×${height}`, score, license, pageUrl })));
}

const entryPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
if (import.meta.url === entryPath) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
