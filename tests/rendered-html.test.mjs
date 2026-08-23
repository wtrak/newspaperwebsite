import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("date searches have live archive and custom-request fallbacks", async () => {
  const storefront = await readFile(new URL("../app/StorefrontV2.tsx", import.meta.url), "utf8");
  const archive = await readFile(new URL("../lib/loc-archive.ts", import.meta.url), "utf8");
  assert.match(storefront, /searchLocArchive/);
  assert.match(storefront, /searchLocSameDay/);
  assert.match(storefront, /createDateRequestRecord/);
  assert.match(storefront, /onInput=\{\(event\) => setDate/);
  assert.match(archive, /image_url\?: string\[\]/);
  assert.match(archive, /representativeYears/);
  assert.match(archive, /Find this date for me/);
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
