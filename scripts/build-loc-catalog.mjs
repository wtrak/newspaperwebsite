import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="))?.slice(9);
const outputPath = resolve(projectRoot, outputArgument || "catalog/loc_front_pages.json");
const reportedDays = ["03-13", "05-11", "05-20", "05-25", "08-06", "06-06", "04-26"];
const reportedYears = [1900, 1910, 1920, 1930, 1940, 1950];

function weeklyDates(year) {
  const dates = [];
  const cursor = new Date(`${year}-01-01T00:00:00Z`);
  while (cursor.getUTCFullYear() === year) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return dates;
}

async function fetchDate(date, attempt = 0) {
  const url = new URL("https://www.loc.gov/collections/chronicling-america/");
  for (const [key, value] of Object.entries({ fo: "json", at: "results", c: "20", q: "the", dates: date })) {
    url.searchParams.set(key, value);
  }
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "FirstEditionArchive/0.1 (public-domain newspaper catalog builder)" },
      signal: AbortSignal.timeout(18000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const item = (payload.results || []).find((result) =>
      result.id && result.date === date && result.title?.startsWith("Image 1 of ") && result.image_url?.some((image) => image.includes("image-services")),
    );
    if (!item) return null;
    return {
      id: item.id,
      title: item.title,
      date: item.date,
      image_url: item.image_url.filter((image) => image.includes("image-services")),
      language: item.language || ["english"],
    };
  } catch (error) {
    if (attempt < 2) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500 * (attempt + 1)));
      return fetchDate(date, attempt + 1);
    }
    process.stderr.write(`Skipped ${date}: ${error instanceof Error ? error.message : "request failed"}\n`);
    return null;
  }
}

async function runPool(values, concurrency, task) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await task(values[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

const reportedJobs = reportedDays.flatMap((monthDay) => reportedYears.map((year) => `${year}-${monthDay}`));
const weeklyJobs = weeklyDates(1920);
const jobs = [...new Set([...reportedJobs, ...weeklyJobs])];
const fetched = (await runPool(jobs, 2, fetchDate)).filter(Boolean);

const reportedCounts = new Map();
const selected = [];
for (const item of fetched) {
  const monthDay = item.date.slice(5);
  if (reportedDays.includes(monthDay)) {
    const count = reportedCounts.get(monthDay) || 0;
    if (count < 4) {
      selected.push(item);
      reportedCounts.set(monthDay, count + 1);
    }
  } else if (item.date.startsWith("1920-")) {
    selected.push(item);
  }
}

const unique = [...new Map(selected.map((item) => [item.id, item])).values()]
  .sort((a, b) => a.date.localeCompare(b.date));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(unique, null, 2)}\n`);
console.log(`Saved ${unique.length} real, image-backed front pages to ${outputPath}.`);
for (const day of reportedDays) {
  console.log(`${day}: ${unique.filter((item) => item.date.slice(5) === day).length}`);
}
