import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const runFile = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const collection = "newspapers_miscellaneous";
const userAgent = "FirstEditionArchive/0.4 (Internet Archive newspaper importer)";

const argValue = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const hasFlag = (name) => process.argv.includes(`--${name}`);
const page = Math.max(1, Number(argValue("page") || 1));
const rows = Math.max(1, Math.min(100, Number(argValue("limit") || 24)));
const outputRoot = resolve(projectRoot, argValue("output") || "local-archive");
const reviewRoot = resolve(outputRoot, "review", "internet-archive", `page-${page}`);
const previewRoot = resolve(projectRoot, "public", "archive", "internet-archive");
const catalogPath = resolve(projectRoot, "catalog", "internet_archive_front_pages.json");
const rejectedIds = new Set((argValue("reject") || "").split(",").map((value) => value.trim()).filter(Boolean));

const slugify = (value) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 80);

const htmlValue = (description, label) => {
  const plain = String(description || "").replaceAll("&nbsp;", " ");
  return plain.match(new RegExp(`${label}:\\s*([^<]+)`, "i"))?.[1]?.trim() || "";
};

const publicationFromTitle = (title, date) => String(title || "Historic newspaper")
  .replace(new RegExp(`\\s+-?\\s*(?:${date}|${date.split("-").reverse().join("-")})(?:,.*)?$`), "")
  .trim();

function placeIdentity(place, identifier) {
  if (identifier.includes("pittsburgh-commercial")) return { city: "Pittsburgh", region: "Pennsylvania", country: "United States" };
  if (identifier.includes("bedford-gazette")) return { city: "Bedford", region: "Pennsylvania", country: "United States" };
  if (identifier.includes("reporter-journal-and-bradford")) return { city: "Towanda", region: "Pennsylvania", country: "United States" };
  if (identifier.includes("mapleton-item")) return { city: "Mapleton", region: "Pennsylvania", country: "United States" };
  if (identifier.includes("millheim-journal")) return { city: "Millheim", region: "Pennsylvania", country: "United States" };
  if (identifier.includes("waynesburg-republican")) return { city: "Waynesburg", region: "Pennsylvania", country: "United States" };
  if (/cura[cç]ao/i.test(place)) return { city: "Willemstad", region: "Curaçao", country: "Curaçao" };
  return { city: place || "Netherlands", region: "Netherlands", country: "Netherlands" };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": userAgent }, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function searchItems() {
  const url = new URL("https://archive.org/advancedsearch.php");
  url.searchParams.set("q", `collection:${collection}`);
  for (const field of ["identifier", "title", "date", "year", "creator", "language", "description", "subject"]) url.searchParams.append("fl[]", field);
  url.searchParams.set("rows", String(rows));
  url.searchParams.set("page", String(page));
  url.searchParams.set("output", "json");
  const payload = await fetchJson(url);
  return payload.response?.docs || [];
}

async function mapCandidate(searchRecord) {
  const identifier = searchRecord.identifier;
  const metadataPayload = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  const metadata = metadataPayload.metadata || {};
  const date = String(metadata.date || searchRecord.date || "").slice(0, 10);
  const year = Number(date.slice(0, 4));
  const pdf = (metadataPayload.files || []).find((file) => file.source === "original" && file.name?.toLowerCase().endsWith(".pdf"))
    || (metadataPayload.files || []).find((file) => file.name?.toLowerCase().endsWith(".pdf"));
  if (!identifier || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !pdf?.name || year >= 1931) return null;

  const publication = publicationFromTitle(metadata.title || searchRecord.title, date);
  const place = htmlValue(metadata.description, "Plaats van uitgave");
  const identity = placeIdentity(place, identifier);
  const localRelativePath = `print-masters/internet-archive/${date.replaceAll("-", "/")}/${slugify(publication)}--${identifier}--front-page.pdf`;
  const reviewRelativePath = `review/internet-archive/page-${page}/${identifier}.jpg`;
  return {
    identifier,
    title: metadata.title || searchRecord.title,
    date,
    publication,
    ...identity,
    language: Array.isArray(metadata.language) ? metadata.language[0] : metadata.language || searchRecord.language || (identifier.startsWith("per_") ? "English" : "Dutch"),
    creator: Array.isArray(metadata.creator) ? metadata.creator.join("; ") : metadata.creator || "",
    subjects: Array.isArray(metadata.subject) ? metadata.subject : metadata.subject ? [metadata.subject] : [],
    sourceUrl: `https://archive.org/details/${identifier}`,
    downloadUrl: `https://archive.org/download/${identifier}/${encodeURIComponent(pdf.name).replaceAll("%2F", "/")}`,
    localRelativePath,
    reviewRelativePath,
    pdfBytes: Number(pdf.size || 0),
    pageCount: 0,
    technicalStatus: "metadata-ready",
  };
}

async function downloadFile(url, destination) {
  const existing = await stat(destination).catch(() => null);
  if (existing?.size) return existing.size;
  const partial = `${destination}.part`;
  await mkdir(dirname(destination), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(120000) });
    if (response.ok && response.body) {
      await pipeline(response.body, createWriteStream(partial));
      await rename(partial, destination);
      return (await stat(destination)).size;
    }
    await rm(partial, { force: true });
    if (attempt === 2) throw new Error(`Download returned HTTP ${response.status}`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200 * (attempt + 1)));
  }
  throw new Error("Download failed");
}

async function prepareCandidate(candidate) {
  const pdfPath = resolve(outputRoot, candidate.localRelativePath);
  const reviewPath = resolve(outputRoot, candidate.reviewRelativePath);
  try {
    const bytes = await downloadFile(candidate.downloadUrl, pdfPath);
    await mkdir(dirname(reviewPath), { recursive: true });
    await runFile(argValue("pdftoppm") || "pdftoppm", ["-f", "1", "-singlefile", "-jpeg", "-scale-to-x", "1200", "-scale-to-y", "-1", "-jpegopt", "quality=88", pdfPath, reviewPath.replace(/\.jpg$/, "")], { timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    const info = await runFile(argValue("pdfinfo") || "pdfinfo", [pdfPath], { timeout: 30000 }).catch(() => ({ stdout: "" }));
    const pageCount = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
    return { ...candidate, pdfBytes: bytes, pageCount, technicalStatus: "ready-for-visual-review" };
  } catch (error) {
    await rm(`${pdfPath}.part`, { force: true });
    return { ...candidate, technicalStatus: "failed", error: error instanceof Error ? error.message : "Preparation failed" };
  }
}

async function runPool(values, concurrency, task) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await task(values[index], index);
      if ((index + 1) % 10 === 0 || index + 1 === values.length) console.log(`${index + 1}/${values.length} reviewed`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function catalogRecord(candidate, index) {
  const year = Number(candidate.date.slice(0, 4));
  const publication = publicationFromTitle(candidate.title, candidate.date);
  const identity = placeIdentity(candidate.city === "Netherlands" ? "" : candidate.city, candidate.identifier);
  return {
    id: `IA-${candidate.identifier}`,
    issueDate: candidate.date,
    publication,
    ...identity,
    headline: `Front page from ${candidate.date}`,
    summary: "A visually verified complete front page from the Internet Archive. Open the scan to discover the stories printed on this date.",
    edition: "Front Page",
    occasion: "History",
    decade: `${Math.floor(year / 10) * 10}s`,
    language: String(candidate.language || "Dutch").replace(/^./, (character) => character.toUpperCase()),
    keywords: ["exact date", candidate.date, publication, identity.city, ...candidate.subjects].filter(Boolean),
    rightsStatus: "Public domain",
    assetStatus: "Print ready",
    sourceReference: `IA-${candidate.identifier}`,
    sourceName: "Internet Archive — Miscellaneous Newspapers",
    sourceUrl: candidate.sourceUrl,
    previewUrl: `/archive/internet-archive/${candidate.identifier}.jpg`,
    rightsBasis: `Published in ${year}; the underlying newspaper issue is in the public domain. No copyright permission is required for the newspaper content.`,
    rightsCheckedAt: new Date().toISOString().slice(0, 10),
    catalogStatus: "Archive lead",
    featured: index < 2,
    accent: ["gold", "red", "green", "blue"][index % 4],
  };
}

async function main() {
  await mkdir(reviewRoot, { recursive: true });
  const manifestPath = resolve(reviewRoot, "manifest.json");
  const savedManifest = await readFile(manifestPath, "utf8").then(JSON.parse).catch(() => []);
  let candidates;
  if (hasFlag("approve") && !hasFlag("download") && savedManifest.length) {
    candidates = savedManifest;
  } else {
    const searchRecords = await searchItems();
    const mapped = (await runPool(searchRecords, 8, mapCandidate)).filter(Boolean);
    candidates = hasFlag("download") ? await runPool(mapped, 3, prepareCandidate) : mapped;
    await writeFile(manifestPath, `${JSON.stringify(candidates, null, 2)}\n`);
  }

  if (hasFlag("approve")) {
    const approved = candidates.filter((candidate) => candidate.technicalStatus === "ready-for-visual-review" && !rejectedIds.has(candidate.identifier));
    await mkdir(previewRoot, { recursive: true });
    for (const candidate of approved) {
      await copyFile(resolve(outputRoot, candidate.reviewRelativePath), resolve(previewRoot, `${candidate.identifier}.jpg`));
    }
    const existing = await readFile(catalogPath, "utf8").then(JSON.parse).catch(() => []);
    const merged = new Map(existing.map((record) => [record.id, record]));
    approved.map(catalogRecord).forEach((record) => merged.set(record.id, record));
    const catalog = [...merged.values()].sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.publication.localeCompare(b.publication));
    await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    console.log(`Approved ${approved.length} visually reviewed front pages for the website catalog.`);
  }

  const mapped = candidates.length;
  const ready = candidates.filter((candidate) => candidate.technicalStatus === "ready-for-visual-review").length;
  const failed = candidates.filter((candidate) => candidate.technicalStatus === "failed").length;
  console.log(`Internet Archive page ${page}: ${mapped} public-domain PDFs found, ${ready} ready for visual review, ${failed} failed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
