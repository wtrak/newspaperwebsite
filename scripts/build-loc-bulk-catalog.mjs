import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="))?.slice(9);
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="))?.slice(8);
const batchesArgument = process.argv.find((argument) => argument.startsWith("--batches="))?.slice(10);
const outputPath = resolve(projectRoot, outputArgument || "catalog/loc_bulk_front_pages.json");
const targetCount = Math.max(1, Number(limitArgument || 2000));
const defaultBatches = [
  "mb_hera_ver01",
  "ak_albatross_ver01",
  "az_acacia_ver01",
  "dlc_1arp_ver01",
  "kyu_airplane_ver01",
  "nbu_abbott_ver01",
  "ncu_adam_ver02",
  "ndhi_alamo_ver01",
  "ohi_alastor_ver02",
  "okhi_apache_ver02",
  "oru_argonaut_ver01",
];
const batches = batchesArgument ? batchesArgument.split(",").map((value) => value.trim()).filter(Boolean) : defaultBatches;
const manifestNames = ["batch.xml", "batch_1.xml", "BATCH.xml", "BATCH_1.xml"];
const userAgent = "FirstEditionArchive/0.2 (public-domain newspaper catalog builder)";

const decodeXml = (value) => value
  .replaceAll("&quot;", '"')
  .replaceAll("&apos;", "'")
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");

function attribute(source, name) {
  return source.match(new RegExp(`${name}="([^"]+)"`))?.[1] || "";
}

async function fetchText(url, attempt = 0) {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/xml,text/xml,text/html", "user-agent": userAgent },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000 * 2 ** attempt));
      return fetchText(url, attempt + 1);
    }
    throw error;
  }
}

async function fetchManifest(batch) {
  let checksumManifest = "";
  for (const name of ["manifest-md5.txt", "manifest-sha1.txt"]) {
    try {
      checksumManifest = await fetchText(`https://chroniclingamerica.loc.gov/data/batches/${batch}/${name}`);
      if (/\sdata\/.+\.jp2\s*$/im.test(checksumManifest)) break;
    } catch {
      // BagIt packages may use either MD5 or SHA-1 payload manifests.
    }
  }
  if (!checksumManifest) throw new Error(`No checksum manifest found for ${batch}`);
  for (const name of manifestNames) {
    const url = `https://chroniclingamerica.loc.gov/data/batches/${batch}/data/${name}`;
    try {
      const xml = await fetchText(url);
      if (/<(?:ndnp:)?issue\b/.test(xml)) {
        return { batch, xml, checksumManifest };
      }
    } catch {
      // Older NDNP batches use different capitalization for the manifest filename.
    }
  }
  throw new Error(`No issue manifest found for ${batch}`);
}

function parseServiceFiles(checksumManifest) {
  const files = new Map();
  const pattern = /\sdata\/(.+?)\/([^/\s]+\.jp2)\s*$/gim;
  let match;
  while ((match = pattern.exec(checksumManifest))) {
    const directory = match[1];
    const filename = match[2];
    const current = files.get(directory);
    if (!current || filename.localeCompare(current, undefined, { numeric: true }) < 0) files.set(directory, filename);
  }
  return files;
}

function parseManifest({ batch, xml, checksumManifest }) {
  const batchOpen = xml.match(/<(?:ndnp:)?batch\b([^>]*)>/i)?.[1] || "";
  const awardee = attribute(batchOpen, "awardee") || batch.split("_")[0];
  const serviceFiles = parseServiceFiles(checksumManifest);
  const issues = [];
  const pattern = /<(?:ndnp:)?issue\b([^>]*)>([^<]+)<\/(?:ndnp:)?issue>/gi;
  let match;
  while ((match = pattern.exec(xml))) {
    const attributes = match[1];
    const date = attribute(attributes, "issueDate");
    const year = Number(date.slice(0, 4));
    if (!date || year >= 1931) continue;
    const metsPath = decodeXml(match[2].trim()).replace(/^\.\//, "");
    const directory = metsPath.slice(0, metsPath.lastIndexOf("/"));
    issues.push({
      awardee,
      batch,
      lccn: attribute(attributes, "lccn"),
      date,
      edition: String(Number(attribute(attributes, "editionOrder") || 1)),
      metsPath,
      serviceFile: serviceFiles.get(directory) || "",
    });
  }
  return issues.filter((issue) => issue.lccn && issue.metsPath && issue.serviceFile);
}

function selectEvenly(values, count) {
  if (values.length <= count) return values;
  return Array.from({ length: count }, (_, index) => values[Math.floor(index * values.length / count)]);
}

async function runPool(values, concurrency, task) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await task(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function storageUrl(issue) {
  return `https://tile.loc.gov/storage-services/service/ndnp/${issue.awardee}/batch_${issue.batch}/data/${issue.metsPath}`;
}

async function fetchTitleMetadata(issue) {
  try {
    const xml = await fetchText(storageUrl(issue));
    const label = decodeXml(xml.match(/<mets\b[^>]*\bLABEL="([^"]+)"/i)?.[1] || "");
    const baseLabel = label.replace(/,\s*\d{4}-\d{2}-\d{2}.*$/, "").trim();
    return { baseLabel };
  } catch (error) {
    process.stderr.write(`Metadata fallback for ${issue.lccn}: ${error instanceof Error ? error.message : "request failed"}\n`);
    return { baseLabel: `${issue.lccn} ([United States])` };
  }
}

const manifests = await runPool(batches, 3, fetchManifest);
const parsedBatches = manifests.map(parseManifest).filter((issues) => issues.length > 0);
const perBatch = Math.ceil(targetCount / parsedBatches.length);
let selectedIssues = parsedBatches.flatMap((issues) => selectEvenly(issues, perBatch)).slice(0, targetCount);
if (selectedIssues.length < targetCount) {
  const selectedKeys = new Set(selectedIssues.map((issue) => `${issue.batch}:${issue.metsPath}`));
  const remaining = parsedBatches.flat().filter((issue) => !selectedKeys.has(`${issue.batch}:${issue.metsPath}`));
  selectedIssues = [...selectedIssues, ...selectEvenly(remaining, targetCount - selectedIssues.length)];
}

const representatives = [...new Map(selectedIssues.map((issue) => [`${issue.batch}:${issue.lccn}`, issue])).values()];
const metadataValues = await runPool(representatives, 4, fetchTitleMetadata);
const metadata = new Map(representatives.map((issue, index) => [`${issue.batch}:${issue.lccn}`, metadataValues[index]]));

const records = selectedIssues.map((issue) => {
  const issueMetadata = metadata.get(`${issue.batch}:${issue.lccn}`) || { baseLabel: issue.lccn };
  const directory = issue.metsPath.slice(0, issue.metsPath.lastIndexOf("/"));
  const imageStem = issue.serviceFile.replace(/\.jp2$/i, "");
  const serviceIdentifier = ["service", "ndnp", issue.awardee, `batch_${issue.batch}`, "data", ...directory.split("/"), imageStem].join(":");
  const sourceUrl = `https://www.loc.gov/resource/${issue.lccn}/${issue.date}/ed-${issue.edition}/?sp=1`;
  return {
    id: sourceUrl,
    title: `Image 1 of ${issueMetadata.baseLabel}, ${issue.date}`,
    date: issue.date,
    image_url: [`https://tile.loc.gov/image-services/iiif/${serviceIdentifier}/full/pct:12.5/0/default.jpg`],
    language: ["english"],
  };
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`);
console.log(`Saved ${records.length} public-domain front pages from ${parsedBatches.length} LOC batches to ${outputPath}.`);
console.log(`${new Set(records.map((record) => record.title.replace(/, \d{4}-\d{2}-\d{2}$/, ""))).size} publications represented.`);
