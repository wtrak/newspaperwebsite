import assert from "node:assert/strict";
import test from "node:test";
import { dedupeCandidates, scoreCandidate } from "../scripts/wikimedia-preflight.mjs";

function page({ title, width, height, description = "", date = "", credit = "", pageid = 1 }) {
  return {
    pageid,
    title: `File:${title}`,
    imageinfo: [{
      width,
      height,
      url: "https://upload.wikimedia.org/example.jpg",
      descriptionurl: "https://commons.wikimedia.org/wiki/File:Example",
      extmetadata: {
        ImageDescription: { value: description },
        DateTimeOriginal: { value: date },
        Credit: { value: credit },
        LicenseShortName: { value: "Public domain" },
      },
    }],
  };
}

test("shortlists a high-resolution portrait front page", () => {
  const result = scoreCandidate(page({
    title: "The Daily Chronicle front page, 12 May 1912.jpg",
    width: 4800,
    height: 7200,
    description: "Complete front page of The Daily Chronicle newspaper.",
    date: "1912-05-12",
    credit: "City archive",
  }));
  assert.equal(result.status, "shortlist");
  assert.ok(result.score >= 10);
});

test("rejects a scan that is too small for large-format review", () => {
  const result = scoreCandidate(page({ title: "Gazette front page.jpg", width: 900, height: 1400 }));
  assert.equal(result.status, "reject");
  assert.ok(result.reasons.some((reason) => reason.includes("too small")));
});

test("rejects a landscape spread", () => {
  const result = scoreCandidate(page({ title: "Weekly News front page spread.jpg", width: 5000, height: 2800 }));
  assert.equal(result.status, "reject");
  assert.ok(result.reasons.some((reason) => reason.includes("portrait")));
});

test("rejects photographs that merely contain a newspaper", () => {
  const result = scoreCandidate(page({
    title: "Newspaper press conference.jpg",
    width: 3600,
    height: 5200,
    description: "A press conference where a guest is reading a newspaper.",
  }));
  assert.equal(result.status, "reject");
  assert.ok(result.reasons.some((reason) => reason.includes("non-page")));
});

test("deduplicates alternate file formats and retains the best scan", () => {
  const first = scoreCandidate(page({ title: "Morning Post front page.png", width: 2600, height: 4000, pageid: 1 }));
  const better = scoreCandidate(page({ title: "Morning Post front page.tif", width: 5200, height: 8000, pageid: 2 }));
  const results = dedupeCandidates([first, better]);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 2);
});
