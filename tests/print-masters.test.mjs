import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog, localRelativePath, masterUrl, parsePublication } from "../scripts/download-print-masters.mjs";

const preview = "https://tile.loc.gov/image-services/iiif/service:ndnp:ak:batch_ak_albatross_ver01:data:sn84020657:00279550626:1912110201:0007/full/pct:12.5/0/default.jpg";

test("converts an LOC IIIF preview to the full-resolution preservation file", () => {
  assert.equal(
    masterUrl(preview),
    "https://tile.loc.gov/storage-services/service/ndnp/ak/batch_ak_albatross_ver01/data/sn84020657/00279550626/1912110201/0007.jp2",
  );
  assert.match(masterUrl(preview, "pdf"), /0007\.pdf$/);
});

test("organizes masters by date with a stable order filename", () => {
  const record = {
    id: "https://www.loc.gov/resource/sn84020657/1912-11-02/ed-1/?sp=1",
    title: "Image 1 of The Alaska daily empire. (Juneau, Alaska), 1912-11-02",
    date: "1912-11-02",
  };
  assert.deepEqual(parsePublication(record.title), { publication: "The Alaska daily empire.", city: "Juneau", region: "Alaska" });
  assert.equal(localRelativePath(record), "print-masters/1912/11/02/the-alaska-daily-empire--sn84020657--ed-1--front-page.jp2");
});

test("loads the complete generated LOC download catalog", async () => {
  const records = await loadCatalog();
  assert.ok(records.length >= 2050);
  assert.ok(records.every((record) => record.id && record.date && record.image_url?.[0]));
});
