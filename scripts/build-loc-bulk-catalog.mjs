import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="))?.slice(9);
const batchesArgument = process.argv.find((argument) => argument.startsWith("--batches="))?.slice(10);
const perDayArgument = process.argv.find((argument) => argument.startsWith("--per-day="))?.slice(10);
const batchesPerAwardeeArgument = process.argv.find((argument) => argument.startsWith("--batches-per-awardee="))?.slice(22);
const outputPath = resolve(projectRoot, outputArgument || "catalog/loc_bulk_front_pages.json");
const targetPerDay = Math.max(20, Number(perDayArgument || 40));
const batchesPerAwardee = Math.max(1, Number(batchesPerAwardeeArgument || 2));
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

async function discoverBatches() {
  if (batchesArgument) return batchesArgument.split(",").map((value) => value.trim()).filter(Boolean);

  const html = await fetchText("https://chroniclingamerica.loc.gov/data/batches/");
  const available = [...html.matchAll(/href="([a-z0-9]+_[a-z0-9]+_ver[0-9]+)\//gi)].map((match) => match[1]);
  const byAwardee = new Map();
  for (const batch of available) {
    const awardee = batch.split("_")[0];
    const values = byAwardee.get(awardee) || [];
    values.push(batch);
    byAwardee.set(awardee, values);
  }

  return [...byAwardee.values()].flatMap((values) => selectEvenly(values, batchesPerAwardee));
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

function roundRobinBy(values, key) {
  const groups = new Map();
  for (const value of values) {
    const groupKey = key(value);
    const group = groups.get(groupKey) || [];
    group.push(value);
    groups.set(groupKey, group);
  }
  const ordered = [];
  const queues = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
  while (queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const value = queue.shift();
      if (value) ordered.push(value);
    }
  }
  return ordered;
}

function selectCalendarDayIssues(issues, count) {
  const byPublication = new Map();
  for (const issue of issues) {
    const key = `${issue.awardee}:${issue.lccn}`;
    const values = byPublication.get(key) || [];
    values.push(issue);
    byPublication.set(key, values);
  }

  const publications = roundRobinBy(
    [...byPublication.entries()].map(([key, values]) => ({ key, values: values.sort((a, b) => a.date.localeCompare(b.date)) })),
    (publication) => publication.values[0].awardee,
  );
  const selected = [];
  for (let round = 0; selected.length < count; round += 1) {
    let added = 0;
    for (const publication of publications) {
      const issue = publication.values[round];
      if (!issue) continue;
      selected.push(issue);
      added += 1;
      if (selected.length === count) break;
    }
    if (!added) break;
  }
  return selected;
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

const batches = await discoverBatches();
console.log(`Loading ${batches.length} geographically diverse LOC newspaper batches…`);
const manifestResults = await runPool(batches, 6, async (batch) => {
  try {
    return await fetchManifest(batch);
  } catch (error) {
    process.stderr.write(`Skipped batch ${batch}: ${error instanceof Error ? error.message : "request failed"}\n`);
    return null;
  }
});
const parsedBatches = manifestResults.filter(Boolean).map(parseManifest).filter((issues) => issues.length > 0);
const issuesByDay = new Map();
for (const issue of parsedBatches.flat()) {
  const monthDay = issue.date.slice(5, 10);
  const values = issuesByDay.get(monthDay) || [];
  values.push(issue);
  issuesByDay.set(monthDay, values);
}
const selectedIssues = [...issuesByDay.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, issues]) => selectCalendarDayIssues(issues, targetPerDay));

const thinDays = [...issuesByDay.entries()]
  .map(([monthDay, issues]) => ({ monthDay, count: selectCalendarDayIssues(issues, targetPerDay).length }))
  .filter(({ count }) => count < targetPerDay);
const belowMinimum = thinDays.filter(({ count }) => count < 20);
if (belowMinimum.length) {
  throw new Error(`Archive coverage is below 20 choices for ${belowMinimum.map(({ monthDay, count }) => `${monthDay} (${count})`).join(", ")}`);
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
console.log(thinDays.length ? `${thinDays.length} calendar days have 20–39 choices; all others have ${targetPerDay}.` : `Every calendar day has ${targetPerDay} choices.`);
