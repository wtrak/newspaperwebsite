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
