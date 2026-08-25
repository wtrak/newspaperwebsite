import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const records = JSON.parse(await readFile(resolve(projectRoot, "catalog/loc_bulk_front_pages.json"), "utf8"));
const byDay = new Map();
const ids = new Set();
let duplicateIds = 0;

for (const record of records) {
  const monthDay = record.date.slice(5, 10);
  const values = byDay.get(monthDay) || [];
  values.push(record);
  byDay.set(monthDay, values);
  if (ids.has(record.id)) duplicateIds += 1;
  ids.add(record.id);
}

function identity(record) {
  const cleaned = record.title.replace(/^Image 1 of /, "");
  const bracketMatch = cleaned.match(/^(.+?) \((.*?) \[([^\]]+)\]\),/);
  const commaMatch = cleaned.match(/^(.+?) \(([^,]+),\s*([^)]+)\),/);
  return {
    publication: bracketMatch?.[1]?.trim() || commaMatch?.[1]?.trim() || cleaned.split(",")[0],
    city: bracketMatch?.[2]?.trim() || commaMatch?.[2]?.trim() || "United States",
    region: bracketMatch?.[3]?.trim() || commaMatch?.[3]?.trim() || "",
  };
}

const coverage = [...byDay.entries()].map(([monthDay, values]) => ({
  monthDay,
  records: values.length,
  publications: new Set(values.map((record) => identity(record).publication)).size,
  cities: new Set(values.map((record) => identity(record).city)).size,
  regions: new Set(values.map((record) => identity(record).region)).size,
}));
const lowest = (field) => coverage.reduce((current, item) => item[field] < current[field] ? item : current);

console.log(JSON.stringify({
  bytes: (await stat(resolve(projectRoot, "catalog/loc_bulk_front_pages.json"))).size,
  records: records.length,
  calendarDays: byDay.size,
  duplicateIds,
  publications: new Set(records.map((record) => identity(record).publication)).size,
  cities: new Set(records.map((record) => identity(record).city)).size,
  regions: new Set(records.map((record) => identity(record).region)).size,
  lowestDailyRecordCoverage: lowest("records"),
  lowestDailyPublicationCoverage: lowest("publications"),
  lowestDailyCityCoverage: lowest("cities"),
  lowestDailyRegionCoverage: lowest("regions"),
  allPublicDomain: records.every((record) => Number(record.date.slice(0, 4)) < 1931),
  allImageBacked: records.every((record) => record.image_url?.some((url) => url.includes("tile.loc.gov/image-services/"))),
}, null, 2));
