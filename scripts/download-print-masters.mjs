import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = resolve(projectRoot, "local-archive");
const userAgent = "FirstEditionArchive/0.3 (local print-master downloader)";

const argValue = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const hasFlag = (name) => process.argv.includes(`--${name}`);

export function masterUrl(previewUrl, format = "jp2") {
  const identifier = previewUrl.split("/iiif/")[1]?.split("/full/")[0];
  if (!identifier?.startsWith("service:ndnp:")) throw new Error(`Unsupported LOC preview URL: ${previewUrl}`);
  return `https://tile.loc.gov/storage-services/${identifier.replaceAll(":", "/")}.${format}`;
}

function decodeTitle(rawTitle) {
  return rawTitle.replace(/^Image 1 of /, "").replace(/,\s*\d{4}-\d{2}-\d{2}.*$/, "").trim();
}

export function parsePublication(rawTitle) {
  const label = decodeTitle(rawTitle);
  const bracketMatch = label.match(/^(.+?) \((.*?) \[([^\]]+)\]\)$/);
  const commaMatch = label.match(/^(.+?) \(([^,]+),\s*([^)]+)\)$/);
  return {
    publication: (bracketMatch?.[1] || commaMatch?.[1] || label).trim(),
    city: (bracketMatch?.[2] || commaMatch?.[2] || "").trim(),
    region: (bracketMatch?.[3] || commaMatch?.[3] || "").trim(),
  };
}

const slugify = (value) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 80);

export function localRelativePath(record, format = "jp2") {
  const { publication } = parsePublication(record.title);
  const lccn = record.id.match(/\/resource\/([^/]+)/)?.[1] || "loc";
  const edition = record.id.match(/\/ed-(\d+)/)?.[1] || "1";
  const [year, month, day] = record.date.split("-");
  return `print-masters/${year}/${month}/${day}/${slugify(publication)}--${lccn}--ed-${edition}--front-page.${format}`;
}

export async function loadCatalog() {
  const files = ["catalog/loc_front_pages.json", "catalog/loc_bulk_front_pages.json", "catalog/loc_verified_front_pages.json"];
  const groups = await Promise.all(files.map(async (path) => JSON.parse(await readFile(resolve(projectRoot, path), "utf8"))));
  return [...new Map(groups.flat().map((record) => [record.id.replace("http://", "https://"), { ...record, id: record.id.replace("http://", "https://") }])).values()];
}

async function sha256(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function writeInventory(outputRoot, rows) {
  const inventoryRoot = resolve(outputRoot, "inventory");
  await mkdir(inventoryRoot, { recursive: true });
  const inventoryPath = resolve(inventoryRoot, "print-masters.json");
  const existing = await readFile(inventoryPath, "utf8").then(JSON.parse).catch(() => []);
  const merged = new Map(existing.map((row) => [`${row.sourceUrl}:${row.format}`, row]));
  for (const row of rows) {
    const key = `${row.sourceUrl}:${row.format}`;
    if (merged.get(key)?.status === "stored" && row.status === "pending") continue;
    merged.set(key, row);
  }
  const sorted = [...merged.values()].sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.publication.localeCompare(b.publication));
  await writeFile(inventoryPath, `${JSON.stringify(sorted, null, 2)}\n`);
  const fields = ["status", "issueDate", "publication", "city", "region", "lccn", "edition", "format", "bytes", "sha256", "localPath", "sourceUrl", "masterUrl", "downloadedAt", "error"];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [fields.join(","), ...sorted.map((row) => fields.map((field) => quote(row[field])).join(","))].join("\n");
  await writeFile(resolve(inventoryRoot, "print-masters.csv"), `${csv}\n`);
}

async function downloadOne(job, outputRoot, attempt = 0) {
  const absolutePath = resolve(outputRoot, job.localPath);
  const partialPath = `${absolutePath}.part`;
  await mkdir(dirname(absolutePath), { recursive: true });
  try {
    const existing = await stat(absolutePath).catch(() => null);
    if (existing?.size) {
      return { ...job, status: "stored", bytes: existing.size, sha256: await sha256(absolutePath), downloadedAt: new Date(existing.mtimeMs).toISOString(), error: "" };
    }
    const chunkBytes = argValue("chunk-kb")
      ? Math.max(16, Number(argValue("chunk-kb"))) * 1024
      : Math.max(1, Number(argValue("chunk-mb") || 4)) * 1024 * 1024;
    let partialBytes = (await stat(partialPath).catch(() => null))?.size || 0;
    let totalBytes = Number.POSITIVE_INFINITY;
    while (partialBytes < totalBytes) {
      const response = await fetch(job.masterUrl, {
        headers: {
          "user-agent": userAgent,
          range: `bytes=${partialBytes}-${partialBytes + chunkBytes - 1}`,
        },
        signal: AbortSignal.timeout(Number(argValue("timeout-ms") || 120000)),
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      if (response.status === 200 && partialBytes > 0) {
        await rm(partialPath, { force: true });
        partialBytes = 0;
      }
      const contentRange = response.headers.get("content-range");
      totalBytes = Number(contentRange?.match(/\/(\d+)$/)?.[1] || response.headers.get("content-length") || 0);
      await pipeline(response.body, createWriteStream(partialPath, { flags: partialBytes ? "a" : "w" }));
      partialBytes = (await stat(partialPath)).size;
      if (!Number.isFinite(totalBytes) || totalBytes <= 0) totalBytes = partialBytes;
    }
    await rename(partialPath, absolutePath);
    const file = await stat(absolutePath);
    return { ...job, status: "stored", bytes: file.size, sha256: await sha256(absolutePath), downloadedAt: new Date().toISOString(), error: "" };
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500 * 2 ** attempt));
      return downloadOne(job, outputRoot, attempt + 1);
    }
    const partialBytes = (await stat(partialPath).catch(() => null))?.size || 0;
    return { ...job, status: "failed", bytes: partialBytes, sha256: "", downloadedAt: "", error: error instanceof Error ? error.message : "Download failed" };
  }
}

async function runPool(values, concurrency, task, onResult) {
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      const result = await task(values[index], index);
      await onResult(result, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
}

function selectRecords(records) {
  const date = argValue("date");
  const monthDay = argValue("month-day");
  const recordNeedle = argValue("record")?.toLowerCase();
  const limit = Number(argValue("limit") || 0);
  let selected = records.filter((record) => {
    if (date && record.date !== date) return false;
    if (monthDay && record.date.slice(5) !== monthDay) return false;
    if (recordNeedle && !`${record.id} ${record.title}`.toLowerCase().includes(recordNeedle)) return false;
    return true;
  });
  if (!hasFlag("all") && !hasFlag("only-missing") && !date && !monthDay && !recordNeedle && !limit) return [];
  if (limit > 0) selected = selected.slice(0, limit);
  return selected;
}

async function estimate(records) {
  const sampleSize = Math.min(Number(argValue("sample") || 24), records.length);
  const sample = Array.from({ length: sampleSize }, (_, index) => records[Math.floor(index * records.length / sampleSize)]);
  let measuredBytes = 0;
  let measured = 0;
  for (const record of sample) {
    try {
      const response = await fetch(masterUrl(record.image_url[0]), { method: "HEAD", headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(30000) });
      const bytes = Number(response.headers.get("content-length") || 0);
      if (response.ok && bytes) { measuredBytes += bytes; measured += 1; }
    } catch {
      // A representative sample is enough for planning; transient failures are ignored.
    }
  }
  const average = measured ? measuredBytes / measured : 0;
  console.log(`Estimated ${((average * records.length) / 1024 / 1024 / 1024).toFixed(1)} GB for ${records.length.toLocaleString()} JP2 masters (${measured}/${sampleSize} samples measured).`);
}

async function main() {
  const outputRoot = resolve(projectRoot, argValue("output") || defaultOutput);
  const formats = (argValue("format") || "jp2") === "both" ? ["jp2", "pdf"] : [argValue("format") || "jp2"];
  if (formats.some((format) => !["jp2", "pdf"].includes(format))) throw new Error("--format must be jp2, pdf, or both");
  const records = selectRecords(await loadCatalog());
  if (records.length === 0) {
    console.log("No files selected. Use --all, --date=YYYY-MM-DD, --month-day=MM-DD, --record=TEXT, or --limit=N.");
    return;
  }
  if (hasFlag("estimate")) return estimate(records);

  let jobs = records.flatMap((record) => formats.map((format) => {
    const identity = parsePublication(record.title);
    const sourceUrl = record.id;
    return {
      status: "pending",
      issueDate: record.date,
      ...identity,
      lccn: sourceUrl.match(/\/resource\/([^/]+)/)?.[1] || "",
      edition: sourceUrl.match(/\/ed-(\d+)/)?.[1] || "1",
      format,
      bytes: 0,
      sha256: "",
      localPath: localRelativePath(record, format),
      sourceUrl,
      masterUrl: masterUrl(record.image_url[0], format),
      downloadedAt: "",
      error: "",
    };
  }));
  if (hasFlag("only-missing")) {
    const existing = await readFile(resolve(outputRoot, "inventory/print-masters.json"), "utf8").then(JSON.parse).catch(() => []);
    const stored = new Set(existing.filter((row) => row.status === "stored").map((row) => `${row.sourceUrl}:${row.format}`));
    jobs = jobs.filter((job) => !stored.has(`${job.sourceUrl}:${job.format}`));
    if (jobs.length === 0) {
      console.log("Every selected print master is already stored.");
      return;
    }
  }
  if (hasFlag("dry-run")) {
    await writeInventory(outputRoot, jobs);
    console.log(`Indexed ${jobs.length.toLocaleString()} planned files without downloading them.`);
    return;
  }

  const results = [];
  let completed = 0;
  let stored = 0;
  await runPool(jobs, Math.max(1, Math.min(10, Number(argValue("concurrency") || 3))), (job) => downloadOne(job, outputRoot), async (result) => {
    results.push(result);
    completed += 1;
    if (result.status === "stored") stored += 1;
    if (completed % 25 === 0 || completed === jobs.length) {
      await writeInventory(outputRoot, results);
      console.log(`${completed.toLocaleString()}/${jobs.length.toLocaleString()} checked · ${stored.toLocaleString()} stored · ${(results.reduce((sum, row) => sum + row.bytes, 0) / 1024 / 1024 / 1024).toFixed(1)} GB`);
    }
  });
  await writeInventory(outputRoot, results);
  const failed = results.filter((row) => row.status === "failed");
  console.log(`Finished: ${stored.toLocaleString()} stored, ${failed.length.toLocaleString()} failed. Run the same command again to resume or retry.`);
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
