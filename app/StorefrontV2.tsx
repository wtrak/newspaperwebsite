"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useMemo, useState } from "react";
import { archiveSources, featuredArchiveSources, sourceRoles } from "../lib/archive-sources";
import {
  catalog,
  formatIssueDate,
  NewspaperRecord,
  printSizes,
  uniqueDecades,
  uniqueRegions,
} from "../lib/catalog";
import { createDateRequestRecord, createSameDayRequestRecord, searchLocArchive, searchLocSameDay } from "../lib/loc-archive";

type SearchPath = "date" | "headline";
type DateMode = "exact" | "month-day";
type LiveStatus = "idle" | "loading" | "done" | "error";

type CartLine = {
  key: string;
  record: NewspaperRecord;
  size: string;
  price: number;
};

const months = [
  ["01", "January"], ["02", "February"], ["03", "March"], ["04", "April"],
  ["05", "May"], ["06", "June"], ["07", "July"], ["08", "August"],
  ["09", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
];

const PAGE_SIZE = 48;

function detailPreviewUrl(previewUrl: string) {
  return previewUrl
    .replace(/\/pct:(?:3\.125|6\.25|12\.5)\//, "/pct:25/")
    .replace(/#.*$/, "");
}

function NewspaperPreview({ record, compact = false, detail = false }: { record: NewspaperRecord; compact?: boolean; detail?: boolean }) {
  if (record.previewUrl) {
    return (
      <div className={`news-preview actual-preview ${compact ? "compact" : ""} ${detail ? "detail" : ""}`}>
        {/* The source scan is shown as a discovery preview; print readiness is checked separately. */}
        <img src={detail ? detailPreviewUrl(record.previewUrl) : record.previewUrl} loading={compact ? "lazy" : "eager"} alt={`Front page of ${record.publication} dated ${formatIssueDate(record.issueDate)}`} />
      </div>
    );
  }

  return (
    <div className={`news-preview accent-${record.accent} ${compact ? "compact" : ""}`} aria-hidden="true">
      <div className="news-topline"><span>{record.edition}</span><span>{formatIssueDate(record.issueDate)}</span></div>
      <div className="news-masthead">{record.publication}</div>
      <div className="news-rule" />
      <strong>{record.headline}</strong>
      <div className="news-content"><span /><span className="news-photo" /><span /></div>
    </div>
  );
}

export default function StorefrontV2() {
  const [searchPath, setSearchPath] = useState<SearchPath>("date");
  const [dateMode, setDateMode] = useState<DateMode>("exact");
  const [date, setDate] = useState("");
  const [month, setMonth] = useState("11");
  const [day, setDay] = useState("11");
  const [headlineQuery, setHeadlineQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [decade, setDecade] = useState("All decades");
  const [region, setRegion] = useState("All locations");
  const [occasion, setOccasion] = useState("All occasions");
  const [sort, setSort] = useState("Featured");
  const [liveResults, setLiveResults] = useState<NewspaperRecord[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [selected, setSelected] = useState<NewspaperRecord | null>(null);
  const [selectedSize, setSelectedSize] = useState<(typeof printSizes)[number]>(printSizes[1]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  const allRecords = useMemo(() => {
    const seen = new Set<string>();
    return [...liveResults, ...catalog].filter((record) => {
      if (seen.has(record.id)) return false;
      seen.add(record.id);
      return true;
    });
  }, [liveResults]);

  const filtered = useMemo(() => {
    const headlineNeedle = headlineQuery.trim().toLowerCase();
    const locationNeedle = locationQuery.trim().toLowerCase();
    const monthDay = `${month}-${day.padStart(2, "0")}`;
    const results = allRecords.filter((item) => {
      const headlineText = [item.headline, item.summary, item.publication, ...item.keywords].join(" ").toLowerCase();
      const locationText = [item.city, item.region, item.country, item.publication].join(" ").toLowerCase();
      const pathMatch = searchPath === "headline"
        ? (!headlineNeedle || headlineText.includes(headlineNeedle))
        : dateMode === "exact"
          ? (!date || item.issueDate === date)
          : item.issueDate.slice(5) === monthDay;

      return pathMatch
        && (!locationNeedle || locationText.includes(locationNeedle))
        && (decade === "All decades" || item.decade === decade)
        && (region === "All locations" || item.region === region)
        && (occasion === "All occasions" || item.occasion === occasion);
    });

    return [...results].sort((a, b) => {
      if (sort === "Oldest first") return a.issueDate.localeCompare(b.issueDate);
      if (sort === "Newest first") return b.issueDate.localeCompare(a.issueDate);
      if (sort === "City A–Z") return a.city.localeCompare(b.city);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });
  }, [allRecords, searchPath, dateMode, date, month, day, headlineQuery, locationQuery, decade, region, occasion, sort]);

  const visibleRecords = filtered.slice(0, visibleLimit);

  const choosePath = (path: SearchPath) => {
    setSearchPath(path);
    setVisibleLimit(PAGE_SIZE);
    setLiveResults([]);
    setLiveStatus("idle");
  };

  const clearFilters = () => {
    setDate("");
    setHeadlineQuery("");
    setLocationQuery("");
    setDecade("All decades");
    setRegion("All locations");
    setOccasion("All occasions");
    setLiveResults([]);
    setVisibleLimit(PAGE_SIZE);
    setLiveStatus("idle");
  };

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    setLiveResults([]);
    setVisibleLimit(PAGE_SIZE);
    setLiveStatus("idle");
    setDecade("All decades");
    setRegion("All locations");
    setOccasion("All occasions");
    document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth" });

    if (searchPath === "date" && dateMode === "exact" && !date) return;
    if (searchPath === "headline" && !headlineQuery.trim()) return;

    setLiveStatus("loading");
    try {
      let items: NewspaperRecord[] = [];
      if (searchPath === "date" && dateMode === "month-day") {
        items = await searchLocSameDay(month, day);
        if (items.length === 0) items = [createSameDayRequestRecord(month, day, locationQuery.trim())];
      } else {
        const mode = searchPath === "date" ? "date" : "headline";
        try {
          items = await searchLocArchive({ mode, date, query: headlineQuery.trim() });
        } catch {
          const params = new URLSearchParams({ mode });
          if (mode === "date") params.set("date", date);
          else params.set("q", headlineQuery.trim());
          const response = await fetch(`/api/archive-search?${params}`);
          if (!response.ok) throw new Error("Archive lookup failed");
          const payload = await response.json() as { items?: NewspaperRecord[] };
          items = Array.isArray(payload.items) ? payload.items : [];
        }
      }

      if (searchPath === "date" && dateMode === "exact" && items.length === 0) {
        items = [createDateRequestRecord(date, locationQuery.trim())];
      }
      setLiveResults(items);
      setLiveStatus("done");
    } catch {
      if (searchPath === "date" && dateMode === "exact") {
        setLiveResults([createDateRequestRecord(date, locationQuery.trim())]);
        setLiveStatus("done");
      } else {
        setLiveStatus("error");
      }
    }
  };

  const openRecord = (record: NewspaperRecord) => {
    setSelected(record);
    setSelectedSize(printSizes[1]);
  };

  const addToBag = () => {
    if (!selected) return;
    setCart((lines) => [...lines, {
      key: `${selected.id}-${selectedSize.label}-${Date.now()}`,
      record: selected,
      size: selectedSize.label,
      price: selectedSize.price,
    }]);
    setSelected(null);
    setBagOpen(true);
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setOrderStatus("sending");
    try {
      const response = await fetch("/api/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          note: form.get("note"),
          items: cart.map((line) => ({
            recordId: line.record.id,
            headline: line.record.headline,
            publication: line.record.publication,
            issueDate: line.record.issueDate,
            sourceUrl: line.record.sourceUrl,
            size: line.size,
            price: line.price,
          })),
        }),
      });
      if (!response.ok) throw new Error("Request failed");
      setOrderStatus("sent");
      setCart([]);
    } catch {
      setOrderStatus("error");
    }
  };

  const archiveTitle = searchPath === "headline"
    ? "Find the front page you remember"
    : dateMode === "month-day"
      ? `What happened on ${months.find(([value]) => value === month)?.[1]} ${Number(day)}?`
      : "Discover the news from their day";
  const subtotal = cart.reduce((sum, line) => sum + line.price, 0);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="First Edition home">
          <span className="brand-mark">FE</span>
          <span><strong>FIRST EDITION</strong><small>HISTORY, MADE PERSONAL</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#archive">Browse archive</a>
          <a href="#sources">Our sources</a>
          <button className="bag-button" type="button" onClick={() => setBagOpen(true)} aria-label={`Open print bag with ${cart.length} items`}>Print bag <span>{cart.length}</span></button>
        </nav>
      </header>

      <section className="hero journey-hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">ONE ARCHIVE · TWO WAYS TO FIND THE RIGHT PAGE</p>
          <h1>{searchPath === "date" ? <>Give them the world from <em>their day.</em></> : <>Find the headline that <em>made history.</em></>}</h1>
          <p className="hero-intro">{searchPath === "date" ? "Start with a birthday or anniversary and discover what was making news that day—the surprise is the gift." : "Start with an event, person, team, or remembered phrase and find a front page made for display."}</p>

          <div className="journey-switch" role="tablist" aria-label="Choose how to search">
            <button type="button" role="tab" aria-selected={searchPath === "date"} className={searchPath === "date" ? "active" : ""} onClick={() => choosePath("date")}><span>01</span><strong>Shop by date</strong><small>Birthdays & anniversaries</small></button>
            <button type="button" role="tab" aria-selected={searchPath === "headline"} className={searchPath === "headline" ? "active" : ""} onClick={() => choosePath("headline")}><span>02</span><strong>Shop by headline</strong><small>History & decor</small></button>
          </div>

          <form className="journey-search" onSubmit={runSearch}>
            {searchPath === "date" ? (
              <>
                <div className="date-mode-switch">
                  <button type="button" className={dateMode === "exact" ? "active" : ""} onClick={() => { setDateMode("exact"); setLiveResults([]); }}>Exact date + year</button>
                  <button type="button" className={dateMode === "month-day" ? "active" : ""} onClick={() => { setDateMode("month-day"); setLiveResults([]); }}>Same day, any year</button>
                </div>
                <div className="journey-fields">
                  {dateMode === "exact" ? (
                    <label><span>The meaningful date</span><input aria-label="Exact date and year" type="date" value={date} onInput={(event) => setDate(event.currentTarget.value)} /></label>
                  ) : (
                    <div className="month-day-fields" aria-label="Month and day">
                      <label><span>Month</span><select value={month} onChange={(event) => setMonth(event.target.value)}>{months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label><span>Day</span><select value={day} onChange={(event) => setDay(event.target.value)}>{Array.from({ length: 31 }, (_, index) => `${index + 1}`).map((value) => <option key={value}>{value}</option>)}</select></label>
                    </div>
                  )}
                  <label><span>Place or publication (optional)</span><input type="search" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Try Florida or Chicago" /></label>
                  <button type="submit">{dateMode === "exact" ? "Find that day's news" : "Explore every year"} <span aria-hidden="true">→</span></button>
                </div>
              </>
            ) : (
              <div className="journey-fields headline-fields">
                <label><span>Headline, event, person, or team</span><input type="search" value={headlineQuery} onChange={(event) => setHeadlineQuery(event.target.value)} placeholder="Try armistice, Apollo 11, or Cubs" /></label>
                <label><span>Place or publication (optional)</span><input type="search" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Try New York or Chicago" /></label>
                <button type="submit">Find a headline <span aria-hidden="true">→</span></button>
              </div>
            )}
          </form>

          <p className="search-explainer">{searchPath === "date" && dateMode === "month-day" ? "Compare the same calendar day across our catalog and a live sampler of historic decades." : searchPath === "date" ? "Exact-date searches check the live archive; if a page is not indexed yet, you can submit that date for research." : "Headline searches look through titles, summaries, subjects, and archive OCR."}</p>
          <div className="trust-row" aria-label="Product details"><span>Archival-quality paper</span><span>Rights checked before printing</span><span>Prints only—no frames</span></div>
        </div>

        <div className="hero-art" aria-label="Verified historic newspaper front page example">
          <div className="edition-ticket">A REAL FRONT PAGE · {formatIssueDate(catalog[0].issueDate).toUpperCase()}</div>
          <NewspaperPreview record={catalog[0]} />
          <p className="art-caption">A meaningful date can uncover an unforgettable headline.</p>
        </div>
      </section>

      <section className="occasion-row" aria-label="Shop by occasion">
        {[["Birthday", "The news from the day they arrived"], ["Anniversary", "The world on the day they said yes"], ["Hometown", "A place that will always feel like home"], ["History", "The front page that captured the moment"]].map(([label, copy], index) => (
          <button type="button" key={label} onClick={() => { setOccasion(label); document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth" }); }}><span>0{index + 1}</span><strong>{label}</strong><small>{copy}</small></button>
        ))}
      </section>

      <section className="archive-section" id="archive">
        <div className="archive-heading">
          <div><p className="eyebrow">THE SEARCHABLE ARCHIVE</p><h2>{archiveTitle}</h2></div>
          <p>{searchPath === "date" ? "The date comes first. Browse the headlines that happened to share it, then choose the edition with the best story or hometown connection." : "The story comes first. Search for a known moment and compare how different newspapers put it on page one."}</p>
        </div>

        <div className="archive-layout">
          <aside className="filters" aria-label="Archive filters">
            <div className="filter-title"><strong>Refine these results</strong><button type="button" onClick={clearFilters}>Clear all</button></div>
            <div className="filter-path"><span>SEARCHING BY</span><strong>{searchPath === "date" ? (dateMode === "exact" ? "Exact date + year" : "Same day, any year") : "Specific headline"}</strong></div>
            <label><span>Place or publication</span><input type="search" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="City, state, country, or paper" /></label>
            <label><span>Decade</span><select value={decade} onChange={(event) => setDecade(event.target.value)}><option>All decades</option>{uniqueDecades.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Location</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>All locations</option>{uniqueRegions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Occasion</span><select value={occasion} onChange={(event) => setOccasion(event.target.value)}><option>All occasions</option>{["Birthday", "Anniversary", "History", "Sports", "Hometown"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="archive-note"><strong>Can’t find it?</strong><p>Add any archive lead to your print bag. Public-domain issues skip permission review; every issue still receives a scan-quality check before printing.</p></div>
          </aside>

          <div className="results-area">
            <div className="results-toolbar">
              <div><p><strong>{filtered.filter((record) => record.previewUrl && record.sourceUrl).length}</strong> real front {filtered.filter((record) => record.previewUrl && record.sourceUrl).length === 1 ? "page" : "pages"}{filtered.some((record) => !record.previewUrl) && <> · <strong>{filtered.filter((record) => !record.previewUrl).length}</strong> research {filtered.filter((record) => !record.previewUrl).length === 1 ? "request" : "requests"}</>}</p>{liveStatus === "loading" && <small className="lookup-status">Checking the live Library of Congress archive…</small>}{liveStatus === "done" && <small className="lookup-status">Search complete. Every archive result shown with an image links to its original record.</small>}{liveStatus === "error" && <small className="lookup-status error">The live archive is temporarily unavailable; showing cataloged results.</small>}</div>
              <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Featured</option><option>Oldest first</option><option>Newest first</option><option>City A–Z</option></select></label>
            </div>

            {filtered.length > 0 ? (
              <div className="catalog-grid">
                {visibleRecords.map((record) => (
                  <article className="catalog-card" key={record.id}>
                    <button className="preview-button" type="button" onClick={() => openRecord(record)} aria-label={`View ${record.publication} from ${formatIssueDate(record.issueDate)}`}>
                      {record.featured && <span className="card-badge">ARCHIVE FAVORITE</span>}
                      <NewspaperPreview record={record} compact />
                      <span className="preview-enlarge">Click to enlarge</span>
                    </button>
                    <div className="catalog-card-copy">
                      <p>{formatIssueDate(record.issueDate)}</p>
                      <h3>{record.headline}</h3>
                      <span>{record.publication} · {record.city}{record.region ? `, ${record.region}` : ""}</span>
                      {record.sourceName && <small className="source-chip">SOURCE: {record.sourceName.replace("Library of Congress — ", "")}</small>}
                      <div><strong>{record.previewUrl ? "From $64" : "Research request"}</strong><button type="button" onClick={() => openRecord(record)}>{record.previewUrl ? (record.assetStatus === "Print ready" ? "Choose print" : "Request issue") : "Request research"} →</button></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state"><span>NO EDITION FOUND YET</span><h3>The right page may still be in an outside archive.</h3><p>Try another place, remove a filter, or search a nearby date. New records enter the sellable catalog only after source, image quality, and rights checks.</p><button type="button" onClick={clearFilters}>Browse the full archive</button></div>
            )}
            {filtered.length > visibleRecords.length && (
              <div className="catalog-pagination">
                <p>Showing {visibleRecords.length.toLocaleString()} of {filtered.length.toLocaleString()} front pages</p>
                <button type="button" onClick={() => setVisibleLimit((current) => current + PAGE_SIZE)}>Show 48 more</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="story-band">
        <div><p className="eyebrow">WHY DATE-FIRST WORKS</p><blockquote>“The surprise isn’t the date. It’s discovering what the world was talking about that day.”</blockquote></div>
        <div className="quality-card"><span>THE PRINT</span><h3>Made for the wall, without the frame.</h3><p>Each cleared front page is prepared and printed on heavyweight archival matte paper with generous margins for easy display or custom framing later.</p><ul><li>Large-format pigment printing</li><li>Three print-only sizes</li><li>Protective rolled shipping</li><li>Quality checked by hand</li></ul></div>
      </section>

      <section className="sources-section" id="sources">
        <div className="sources-heading"><div><p className="eyebrow">A LIBRARY BUILT RESPONSIBLY</p><h2>Public domain first. Rights review where needed.</h2></div><p>Older U.S. issues whose copyright has expired are ready for commercial use without permission. Every source has a defined job so a search directory or paid database is never confused with a reusable print asset.</p></div>
        <div className="source-stats" aria-label="Archive source summary"><span><b>{archiveSources.length}</b> sources mapped</span><span><b>{archiveSources.filter((source) => source.role === "Direct catalog source").length}</b> direct catalog sources</span><span><b>{archiveSources.filter((source) => source.role === "Rights-filtered source").length}</b> rights-filtered sources</span></div>
        <div className="visual-preflight">
          <div><span>AUTOMATED BEFORE HUMAN REVIEW</span><h3>Thousands of images in. A short, printable list out.</h3><p>The Wikimedia search already handles reuse eligibility. Our preflight handles the messier visual question: is this actually one complete newspaper front page, and can it survive a large-format print?</p></div>
          <ol><li><b>01</b><span><strong>Front-page confidence</strong>Titles and descriptions must describe one complete page.</span></li><li><b>02</b><span><strong>Print size</strong>Pixel dimensions must support a large-format print.</span></li><li><b>03</b><span><strong>Page shape</strong>Portrait pages outrank photos, clippings, and spreads.</span></li><li><b>04</b><span><strong>Metadata</strong>Date, source, attribution, and provenance raise the score.</span></li></ol>
        </div>
        <div className="source-grid">{featuredArchiveSources.map((source) => <article key={source.id}><span className={`source-role role-${source.role.toLowerCase().replaceAll(" ", "-")}`}>{source.role}</span><h3>{source.name}</h3><p>{source.coverage}</p><small>{source.rightsGuidance}</small><a href={source.url} target="_blank" rel="noreferrer">Visit source ↗</a></article>)}</div>
        <details className="source-directory">
          <summary><span>View the complete sourcing directory</span><b>{archiveSources.length} verified and classified links</b></summary>
          <div className="source-directory-groups">
            {sourceRoles.map((role) => {
              const sources = archiveSources.filter((source) => source.role === role);
              return <section key={role}><div className="directory-group-title"><h3>{role}</h3><span>{sources.length}</span></div><ul>{sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a><p>{source.coverage}</p><small>{source.rightsGuidance}</small></li>)}</ul></section>;
            })}
          </div>
        </details>
      </section>

      <section className="how-section" id="how-it-works">
        <p className="eyebrow">FROM ARCHIVE TO THEIR DOOR</p><h2>Three careful steps</h2>
        <div>{[["01", "Find the date or story", "Search an exact date, the same day across years, or a remembered headline."], ["02", "We verify the edition", "We confirm the source, reproduction rights, and whether the scan can produce a beautiful large print."], ["03", "Choose the print size", "Once confirmed, we prepare, inspect, and ship the print safely rolled—never framed."]].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <footer>
        <div className="footer-brand"><span className="brand-mark">FE</span><div><strong>FIRST EDITION</strong><p>Historic front pages, printed for personal milestones.</p></div></div>
        <div><strong>SHOP</strong><a href="#top" onClick={() => choosePath("date")}>Shop by date</a><a href="#top" onClick={() => choosePath("headline")}>Shop by headline</a><a href="#archive">Request an issue</a></div>
        <div><strong>PRINT DETAILS</strong><span>Prints only—no frames</span><span>Archival matte paper</span><span>Ships safely rolled</span></div>
        <p className="rights-note">U.S. issues published more than 95 years ago are treated as public domain and need no copyright permission. Newer or restricted material remains unavailable until commercial reproduction rights are documented. Every scan is still checked for print quality.</p>
      </footer>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-title">
            <button className="modal-close" type="button" onClick={() => setSelected(null)} aria-label="Close product details">×</button>
            <div className="modal-preview">
              <NewspaperPreview record={selected} detail />
              {selected.previewUrl && <a className="full-scan-link" href={detailPreviewUrl(selected.previewUrl)} target="_blank" rel="noreferrer">Open larger scan ↗</a>}
            </div>
            <div className="modal-copy">
              <p className="eyebrow">{formatIssueDate(selected.issueDate)} · {selected.city}{selected.region ? `, ${selected.region}` : ""}</p>
              <h2 id="product-title">{selected.headline}</h2>
              <p className="publication-line">{selected.publication} · {selected.edition}</p>
              <p>{selected.summary}</p>
              <div className="record-audit"><span><b>Source</b>{selected.sourceName ?? "Catalog demonstration"}</span><span><b>Rights</b>{selected.rightsStatus}</span><span><b>Asset</b>{selected.assetStatus}</span></div>
              {selected.sourceUrl && <a className="source-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">View the archive record ↗</a>}
              <fieldset><legend>Choose your print size</legend>{printSizes.map((size) => <label className={selectedSize.label === size.label ? "selected" : ""} key={size.label}><input type="radio" name="size" value={size.label} checked={selectedSize.label === size.label} onChange={() => setSelectedSize(size)} /><span><strong>{size.label}</strong><small>{size.note}</small></span><b>${size.price}</b></label>)}</fieldset>
              <div className="print-only-note"><strong>Print only</strong><span>No frame or mounting hardware is included.</span></div>
              <button className="add-button" type="button" onClick={addToBag}>{selected.assetStatus === "Print ready" ? `Add print to bag · $${selectedSize.price}` : selected.rightsStatus === "Public domain" ? "Request print preparation" : "Add sourcing request"}</button>
              <small className="availability-note">{selected.rightsStatus === "Public domain" ? "This issue needs no copyright permission. We only confirm that the available scan will produce a beautiful large-format print." : "No payment is taken now. Final availability is confirmed after archival quality and reproduction rights are reviewed."}</small>
            </div>
          </section>
        </div>
      )}

      {bagOpen && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setBagOpen(false); }}>
          <aside className="bag-drawer" role="dialog" aria-modal="true" aria-labelledby="bag-title">
            <div className="bag-heading"><div><span>YOUR PRINT REQUEST</span><h2 id="bag-title">Print bag</h2></div><button type="button" onClick={() => setBagOpen(false)} aria-label="Close print bag">×</button></div>
            {orderStatus === "sent" ? <div className="order-success"><strong>Request received.</strong><p>We’ll review the selected editions and follow up before anything is printed or charged.</p><button type="button" onClick={() => { setOrderStatus("idle"); setBagOpen(false); }}>Keep browsing</button></div> : cart.length === 0 ? <div className="bag-empty"><p>Your bag is waiting for a piece of history.</p><button type="button" onClick={() => setBagOpen(false)}>Browse the archive</button></div> : <>
              <div className="bag-lines">{cart.map((line) => <article key={line.key}><NewspaperPreview record={line.record} compact /><div><strong>{line.record.headline}</strong><span>{formatIssueDate(line.record.issueDate)}</span><span>{line.size} · Print only</span><button type="button" onClick={() => setCart((lines) => lines.filter((item) => item.key !== line.key))}>Remove</button></div><b>${line.price}</b></article>)}</div>
              <div className="bag-total"><span>Estimated subtotal</span><strong>${subtotal}</strong></div>
              <form className="order-form" onSubmit={submitOrder}><p>Send this print request for an availability check. No payment is taken yet.</p><label><span>Name</span><input name="name" required autoComplete="name" /></label><label><span>Email</span><input name="email" type="email" required autoComplete="email" /></label><label><span>Gift note or special request</span><textarea name="note" rows={3} placeholder="Optional" /></label><button type="submit" disabled={orderStatus === "sending"}>{orderStatus === "sending" ? "Sending…" : "Request availability"}</button>{orderStatus === "error" && <small>We couldn’t save that request. Please try again.</small>}</form>
            </>}
          </aside>
        </div>
      )}
    </main>
  );
}
