import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function getWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

const bindings = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

test("server-renders the First Edition storefront", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    bindings,
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>First Edition \| Historic Newspaper Prints<\/title>/i);
  assert.match(html, /FIRST EDITION/);
  assert.match(html, /Shop by date/);
  assert.match(html, /Shop by headline/);
  assert.match(html, /Same day, any year/);
  assert.match(html, /Prints only/);
  assert.match(html, /THE SEARCHABLE ARCHIVE/);
  assert.match(html, /Public domain first/);
  assert.match(html, /need no copyright permission/);
  assert.match(html, /complete sourcing directory/);
  assert.match(html, /California Digital Newspaper Collection/);
  assert.match(html, /Old Fulton New York Postcards/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("catalog records include the operational archive fields", async () => {
  const source = await readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8");
  assert.match(source, /issueDate:/);
  assert.match(source, /publication:/);
  assert.match(source, /city:/);
  assert.match(source, /region:/);
  assert.match(source, /occasion:/);
  assert.match(source, /rightsStatus:/);
  assert.match(source, /assetStatus:/);
  assert.match(source, /sourceReference:/);
  assert.match(source, /sourceUrl\?:/);
  assert.match(source, /rightsBasis\?:/);
  assert.ok((source.match(/id: "/g) ?? []).length >= 10);
});

test("archive source registry classifies the supplied research links", async () => {
  const source = await readFile(new URL("../lib/archive-sources.ts", import.meta.url), "utf8");
  assert.ok((source.match(/id: "/g) ?? []).length >= 25);
  assert.match(source, /Direct catalog source/);
  assert.match(source, /Rights-filtered source/);
  assert.match(source, /Discovery directory/);
  assert.match(source, /Research only/);
  assert.match(source, /Legacy \/ inactive/);
});

test("date searches return only purchasable archive results", async () => {
  const storefront = await readFile(new URL("../app/StorefrontV2.tsx", import.meta.url), "utf8");
  const archive = await readFile(new URL("../lib/loc-archive.ts", import.meta.url), "utf8");
  assert.match(storefront, /searchLocArchive/);
  assert.match(storefront, /searchLocSameDay/);
  assert.doesNotMatch(storefront, /createDateRequestRecord|createSameDayRequestRecord/);
  assert.match(storefront, /Every front page shown is available to order/);
  assert.match(storefront, /Add print to bag/);
  assert.match(storefront, /Place order/);
  assert.match(storefront, /onInput=\{\(event\) => setDate/);
  assert.match(archive, /image_url\?: string\[\]/);
  assert.match(archive, /representativeYears/);
  assert.match(archive, /item\.rightsStatus === "Public domain"/);
  assert.doesNotMatch(archive, /createDateRequestRecord|createSameDayRequestRecord/);
});

test("every catalog listing is directly available as a print", async () => {
  const catalogSource = await readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8");
  assert.match(catalogSource, /assetStatus: "Print ready", catalogStatus: "Print cleared"/);
});

test("print sizes keep production presets internal and customer copy simple", async () => {
  const catalogSource = await readFile(new URL("../lib/catalog.ts", import.meta.url), "utf8");
  const storefront = await readFile(new URL("../app/StorefrontV2.tsx", import.meta.url), "utf8");
  const orderApi = await readFile(new URL("../app/api/catalog/route.ts", import.meta.url), "utf8");
  for (const [size, price] of [["17 × 22 in", 35], ["24 × 36 in", 49], ["34 × 44 in", 62], ["36 × 48 in", 75]]) {
    assert.match(catalogSource, new RegExp(`${size.replace("×", "×")}.*price: ${price}`));
  }
  for (const preset of ["ANSI C", "ARCH D", "ANSI E", "ARCH E"]) assert.match(catalogSource, new RegExp(preset));
  assert.match(storefront, /From \$35/);
  assert.match(storefront, /All prices are before shipping/);
  assert.doesNotMatch(storefront, /paper roll|44-in roll|ANSI or ARCH preset|Standard printer sizes/i);
  assert.match(storefront, /Four print-only sizes/);
  assert.match(storefront, /No frame or mounting hardware is included/);
  assert.match(orderApi, /new Set\(\[35, 49, 62, 75\]\)/);
});

test("the browse catalog is backed by real image records", async () => {
  const raw = await readFile(new URL("../catalog/loc_front_pages.json", import.meta.url), "utf8");
  const records = JSON.parse(raw);
  assert.ok(records.length >= 40);
  assert.ok(records.every((record) => record.id?.includes("loc.gov/resource/") && record.image_url?.some((url) => url.includes("tile.loc.gov/image-services/"))));
  for (const monthDay of ["03-13", "05-11", "05-20", "05-25", "08-06", "06-06", "04-26"]) {
    assert.ok(records.filter((record) => record.date?.slice(5) === monthDay).length >= 4, `${monthDay} should have at least four real pages`);
  }
});

test("the bulk catalog contains at least 2,000 real public-domain issue pages", async () => {
  const raw = await readFile(new URL("../catalog/loc_bulk_front_pages.json", import.meta.url), "utf8");
  const records = JSON.parse(raw);
  assert.ok(records.length >= 2000);
  assert.ok(records.every((record) => Number(record.date?.slice(0, 4)) < 1931));
  assert.ok(records.every((record) => record.id?.includes("loc.gov/resource/") && record.image_url?.some((url) => url.includes("tile.loc.gov/image-services/"))));
});

test("large archive results are progressively revealed", async () => {
  const storefront = await readFile(new URL("../app/StorefrontV2.tsx", import.meta.url), "utf8");
  assert.match(storefront, /const PAGE_SIZE = 48/);
  assert.match(storefront, /visibleRecords = filtered\.slice/);
  assert.match(storefront, /Show 48 more/);
});

test("archive previews enlarge and use a sharper detail image", async () => {
  const storefront = await readFile(new URL("../app/StorefrontV2.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(storefront, /detailPreviewUrl/);
  assert.match(storefront, /pct:25/);
  assert.match(storefront, /Click to enlarge/);
  assert.match(storefront, /Open larger scan/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.modal-preview \.news-preview \{ width: min\(580px, 100%\)/);
});

test("Internet Archive imports are visually approved before catalog publication", async () => {
  const importer = await readFile(new URL("../scripts/import-internet-archive.mjs", import.meta.url), "utf8");
  const sources = await readFile(new URL("../lib/archive-sources.ts", import.meta.url), "utf8");
  const records = JSON.parse(await readFile(new URL("../catalog/internet_archive_front_pages.json", import.meta.url), "utf8"));
  assert.match(importer, /newspapers_miscellaneous/);
  assert.match(importer, /ready-for-visual-review/);
  assert.match(importer, /hasFlag\("approve"\)/);
  assert.match(importer, /hasFlag\("thin-days"\)/);
  assert.match(importer, /targetPerDay/);
  assert.match(importer, /pdftoppm/);
  assert.match(sources, /More than 280,000 dated newspaper issue records/);
  assert.ok(records.length >= 150);
  assert.ok(records.every((record) => record.sourceUrl?.startsWith("https://archive.org/details/") && record.previewUrl?.startsWith("/archive/internet-archive/")));
  for (const record of records) {
    const preview = new URL(`../public${record.previewUrl}`, import.meta.url);
    assert.ok((await stat(preview)).size > 50_000, `${record.id} should have a usable local preview`);
  }
});

test("every calendar day has at least four gift-date choices", async () => {
  const files = [
    "../catalog/loc_front_pages.json",
    "../catalog/loc_bulk_front_pages.json",
    "../catalog/internet_archive_front_pages.json",
  ];
  const catalogs = await Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"))));
  const counts = new Map();
  for (const record of catalogs.flat()) {
    const monthDay = (record.issueDate || record.date).slice(5, 10);
    counts.set(monthDay, (counts.get(monthDay) || 0) + 1);
  }

  const day = new Date(Date.UTC(2024, 0, 1));
  while (day.getUTCFullYear() === 2024) {
    const monthDay = day.toISOString().slice(5, 10);
    assert.ok((counts.get(monthDay) || 0) >= 4, `${monthDay} should have at least four real pages`);
    day.setUTCDate(day.getUTCDate() + 1);
  }
});
