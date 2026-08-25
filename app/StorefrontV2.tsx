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
} from "../lib/catalog";
import { searchLocSameDay } from "../lib/loc-archive";

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

const notableHeadlines = [
  {
    title: "Titanic Sinks on Her Maiden Voyage",
    publication: "The Times-Dispatch",
    issueDate: "1912-04-16",
    image: "/archive/notable-headlines/titanic-times-dispatch-preview.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:TheTimesDispatch-Titanic-1912-4-16.jpg",
    summary: "A single front page captures the scale, uncertainty, and heartbreak of the disaster.",
  },
  {
    title: "Hundreds Dead After San Francisco Earthquake",
    publication: "The Daily News",
    issueDate: "1906-04-18",
    image: "/archive/notable-headlines/san-francisco-daily-news.gif",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:SF_Daily_News_April_18_1906.gif",
    summary: "An extra edition reports the earthquake and fire while the city is still in crisis.",
  },
  {
    title: "With Armistice, the War Comes to an End",
    publication: "The New York Times",
    issueDate: "1918-11-11",
    image: "/archive/notable-headlines/armistice-1918.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:NYTimes-Page1-11-11-1918.jpg",
    summary: "The armistice reaches page one as the First World War comes to an end.",
  },
  {
    title: "Wall Street Explosion Kills 30",
    publication: "The New York Times",
    issueDate: "1920-09-17",
    image: "/archive/notable-headlines/wall-street-bombing-preview.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Wallstreetbombing1920-page-001.jpg",
    summary: "A dramatic page records the bombing, the warnings, and the shock in lower Manhattan.",
  },
  {
    title: "50-Year Struggle Ends in Victory for Women",
    publication: "The Washington Evening Star",
    issueDate: "1920-08-26",
    image: "/archive/notable-headlines/womens-suffrage-1920.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Headline_of_Washington_Evening_Star,_August_26,_1920-_%22Suffrage_proclaimed_by_(Bainbridge)_Colby_(Sec%27y_of_State)...50-year_struggle_ends_in_victory_for_women%22_LCCN2005679744.jpg",
    summary: "The Nineteenth Amendment is proclaimed and a new era of voting rights begins.",
  },
  {
    title: "President Harding Dies Suddenly",
    publication: "The New York Times",
    issueDate: "1923-08-04",
    image: "/archive/notable-headlines/harding-death.gif",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:WarrenGHardingdeathnews.gif",
    summary: "An extra edition announces the president's death and Calvin Coolidge's succession.",
  },
] as const;

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
  const [month, setMonth] = useState("11");
  const [day, setDay] = useState("11");
  const [locationQuery, setLocationQuery] = useState("");
  const [decade, setDecade] = useState("All decades");
  const [region, setRegion] = useState("All locations");
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

  const dayRecords = useMemo(() => {
    const monthDay = `${month}-${day.padStart(2, "0")}`;
    return allRecords.filter((item) => item.issueDate.slice(5) === monthDay);
  }, [allRecords, month, day]);

  const dayRegions = useMemo(() => [...new Set(dayRecords.map((item) => item.region).filter(Boolean))].sort(), [dayRecords]);
  const daySearchSuggestions = useMemo(() => [...new Set(dayRecords.flatMap((item) => [item.city, item.region, item.publication]).filter(Boolean))].sort(), [dayRecords]);
  const dayPublicationCount = useMemo(() => new Set(dayRecords.map((item) => item.publication)).size, [dayRecords]);
  const dayPlaceCount = useMemo(() => new Set(dayRecords.map((item) => `${item.city}|${item.region}`)).size, [dayRecords]);

  const filtered = useMemo(() => {
    const locationNeedle = locationQuery.trim().toLowerCase();
    const results = dayRecords.filter((item) => {
      const locationText = [item.city, item.region, item.country, item.publication].join(" ").toLowerCase();

      return (!locationNeedle || locationText.includes(locationNeedle))
        && (decade === "All decades" || item.decade === decade)
        && (region === "All locations" || item.region === region);
    });

    return [...results].sort((a, b) => {
      if (sort === "Oldest first") return a.issueDate.localeCompare(b.issueDate);
      if (sort === "Newest first") return b.issueDate.localeCompare(a.issueDate);
      if (sort === "City A–Z") return a.city.localeCompare(b.city);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });
  }, [dayRecords, locationQuery, decade, region, sort]);

  const visibleRecords = filtered.slice(0, visibleLimit);

  const clearFilters = () => {
    setLocationQuery("");
    setDecade("All decades");
    setRegion("All locations");
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
    document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth" });

    setLiveStatus("loading");
    try {
      const items = await searchLocSameDay(month, day);

      setLiveResults(items);
      setLiveStatus("done");
    } catch {
      setLiveStatus("error");
    }
  };

  const chooseMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    setRegion("All locations");
    setDecade("All decades");
    setVisibleLimit(PAGE_SIZE);
    const lastDay = new Date(2024, Number(nextMonth), 0).getDate();
    if (Number(day) > lastDay) setDay(String(lastDay));
  };

  const chooseDay = (nextDay: string) => {
    setDay(nextDay);
    setRegion("All locations");
    setDecade("All decades");
    setVisibleLimit(PAGE_SIZE);
  };

  const exploreNotableDate = (issueDate: string) => {
    setMonth(issueDate.slice(5, 7));
    setDay(String(Number(issueDate.slice(8, 10))));
    setLocationQuery("");
    setDecade("All decades");
    setRegion("All locations");
    setLiveResults([]);
    setLiveStatus("idle");
    setVisibleLimit(PAGE_SIZE);
    document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth" });
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
      if (!response.ok) throw new Error("Order failed");
      setOrderStatus("sent");
      setCart([]);
    } catch {
      setOrderStatus("error");
    }
  };

  const archiveTitle = `What happened on ${months.find(([value]) => value === month)?.[1]} ${Number(day)}?`;
  const subtotal = cart.reduce((sum, line) => sum + line.price, 0);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="First Edition home">
          <span className="brand-mark">FE</span>
          <span><strong>FIRST EDITION</strong><small>HISTORY, MADE PERSONAL</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#archive">Shop by date</a>
          <a href="#notable-headlines">Notable headlines</a>
          <a href="#sources">Our sources</a>
          <button className="bag-button" type="button" onClick={() => setBagOpen(true)} aria-label={`Open print bag with ${cart.length} items`}>Print bag <span>{cart.length}</span></button>
        </nav>
      </header>

      <section className="hero journey-hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">THE NEWS FROM THEIR DAY · THROUGH HISTORY</p>
          <h1>Give them the world from <em>their special day.</em></h1>
          <p className="hero-intro">Choose the month and day of a birthday, anniversary, or milestone. Then discover the real front pages published on that same date across generations—and turn the most surprising one into a truly personal gift.</p>

          <form className="journey-search" onSubmit={runSearch}>
            <div className="journey-fields">
              <div className="month-day-fields" aria-label="Celebration month and day">
                <label><span>Celebration month</span><select value={month} onChange={(event) => chooseMonth(event.target.value)}>{months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>Day</span><select value={day} onChange={(event) => chooseDay(event.target.value)}>{Array.from({ length: new Date(2024, Number(month), 0).getDate() }, (_, index) => `${index + 1}`).map((value) => <option key={value}>{value}</option>)}</select></label>
              </div>
              <label><span>Place or publication (optional)</span><input type="search" list="place-publication-options" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Try Florida or Chicago" /></label>
              <button type="submit">See their day in history <span aria-hidden="true">→</span></button>
            </div>
          </form>

          <datalist id="place-publication-options">{daySearchSuggestions.map((value) => <option key={value} value={value} />)}</datalist>

          <p className="search-explainer">No year needed. At least 40 real front pages are available for every day of the year, so you can choose the story, surprise, or personal connection that fits best.</p>
          <div className="trust-row" aria-label="Product details"><span>Archival-quality paper</span><span>Rights checked before printing</span><span>Prints only—no frames</span></div>
        </div>

        <div className="hero-art" aria-label="Verified historic newspaper front page example">
          <div className="edition-ticket">A REAL FRONT PAGE · {formatIssueDate(catalog[0].issueDate).toUpperCase()}</div>
          <NewspaperPreview record={catalog[0]} />
          <p className="art-caption">A meaningful date can uncover an unforgettable headline.</p>
        </div>
      </section>

      <section className="occasion-row" aria-label="Shop by occasion">
        {[["Birthday", "What the world was talking about on the day they celebrate"], ["Anniversary", "A surprising piece of history tied to the date they share"], ["Wedding", "A conversation-starting keepsake for the couple's special day"], ["Milestone", "A one-of-a-kind gift for retirements, reunions, and big moments"]].map(([label, copy], index) => (
          <article key={label}><span>0{index + 1}</span><strong>{label}</strong><small>{copy}</small></article>
        ))}
      </section>

      <section className="archive-section" id="archive">
        <div className="archive-heading">
          <div><p className="eyebrow">THE SEARCHABLE ARCHIVE</p><h2>{archiveTitle}</h2></div>
          <p>Browse the news that shared their month and day across the years, then choose the edition with the best story, surprise, or hometown connection.</p>
        </div>

        <div className="archive-layout">
          <aside className="filters" aria-label="Archive filters">
            <div className="filter-title"><strong>Refine these results</strong><button type="button" onClick={clearFilters}>Clear all</button></div>
            <div className="filter-path"><span>CELEBRATION DATE</span><strong>{months.find(([value]) => value === month)?.[1]} {Number(day)} · Through history</strong></div>
            <label><span>Place or publication</span><input type="search" list="place-publication-options" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="City, state, or newspaper" /></label>
            <label><span>Decade</span><select value={decade} onChange={(event) => setDecade(event.target.value)}><option>All decades</option>{uniqueDecades.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Location</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>All locations</option>{dayRegions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="archive-note"><strong>Every listing is available</strong><p>Choose any front page shown here, select a size, and add the print directly to your bag.</p></div>
          </aside>

          <div className="results-area">
            <div className="results-toolbar">
              <div><p><strong>{filtered.length}</strong> available front {filtered.length === 1 ? "page" : "pages"}</p><small className="coverage-summary">{dayPublicationCount} publications · {dayPlaceCount} places represented on this date</small>{liveStatus === "loading" && <small className="lookup-status">Checking the live Library of Congress archive…</small>}{liveStatus === "done" && <small className="lookup-status">Search complete. Every front page shown is available to order.</small>}{liveStatus === "error" && <small className="lookup-status error">The live archive is temporarily unavailable; showing cataloged prints.</small>}</div>
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
                      <div><strong>From $35</strong><button type="button" onClick={() => openRecord(record)}>Choose print →</button></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state"><span>NO EDITION FOUND</span><h3>Try widening your search.</h3><p>Remove the location or decade filters to see more front pages from this calendar day.</p><button type="button" onClick={clearFilters}>Clear the extra filters</button></div>
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
        <div className="quality-card"><span>THE PRINT</span><h3>Made for the wall, without the frame.</h3><p>Each cleared front page is prepared and printed on heavyweight archival matte paper with generous margins for easy display or custom framing later.</p><ul><li>Large-format pigment printing</li><li>Four print-only sizes</li><li>Protective rolled shipping</li><li>Quality checked by hand</li></ul></div>
      </section>

      <section className="notable-section" id="notable-headlines">
        <div className="notable-heading">
          <div><p className="eyebrow">NOTABLE HEADLINES</p><h2>See how one ordinary date can hold extraordinary history.</h2></div>
          <p>These public-domain front pages are here for inspiration. Choose one of their dates to explore what newspapers were reporting on that same month and day across many other years.</p>
        </div>
        <div className="notable-grid">
          {notableHeadlines.map((item) => (
            <article key={item.title}>
              <button className="notable-image" type="button" onClick={() => exploreNotableDate(item.issueDate)} aria-label={`Explore ${formatIssueDate(item.issueDate)} through history`}>
                <img src={item.image} loading="lazy" alt={`${item.publication} front page for ${formatIssueDate(item.issueDate)}`} />
                <span>PUBLIC DOMAIN</span>
              </button>
              <div className="notable-copy">
                <p>{formatIssueDate(item.issueDate)} · {item.publication}</p>
                <h3>{item.title}</h3>
                <span>{item.summary}</span>
                <div><button type="button" onClick={() => exploreNotableDate(item.issueDate)}>Explore this day →</button><a href={item.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a></div>
              </div>
            </article>
          ))}
        </div>
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
        <div>{[["01", "Choose their month and day", "Start with the date of the birthday, anniversary, or celebration—no year needed."], ["02", "Discover that day through history", "Compare real front pages published on the same calendar day across generations."], ["03", "Choose the perfect surprise", "Pick the most interesting edition, select a print size, and we’ll ship it safely rolled—never framed."]].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <footer>
        <div className="footer-brand"><span className="brand-mark">FE</span><div><strong>FIRST EDITION</strong><p>Historic front pages, printed for personal milestones.</p></div></div>
        <div><strong>SHOP</strong><a href="#top">Choose a celebration date</a><a href="#notable-headlines">Notable headlines</a><a href="#archive">Browse date results</a></div>
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
              <div className="record-audit"><span><b>Source</b>{selected.sourceName ?? "Historic newspaper archive"}</span><span><b>Rights</b>{selected.rightsStatus}</span><span><b>Availability</b>Available to print</span></div>
              {selected.sourceUrl && <a className="source-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">View the archive record ↗</a>}
              <fieldset><legend>Choose your print size</legend>{printSizes.map((size) => <label className={selectedSize.label === size.label ? "selected" : ""} key={size.label}><input type="radio" name="size" value={size.label} checked={selectedSize.label === size.label} onChange={() => setSelectedSize(size)} /><span><strong>{size.label}</strong><small>{size.note}</small></span><b>${size.price}</b></label>)}</fieldset>
              <div className="print-only-note"><strong>Print only</strong><span>No frame or mounting hardware is included. The full front page is fitted proportionally without cropping.</span></div>
              <button className="add-button" type="button" onClick={addToBag}>Add print to bag · ${selectedSize.price}</button>
              <small className="availability-note">All prices are before shipping. This print will be quality checked before production.</small>
            </div>
          </section>
        </div>
      )}

      {bagOpen && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setBagOpen(false); }}>
          <aside className="bag-drawer" role="dialog" aria-modal="true" aria-labelledby="bag-title">
            <div className="bag-heading"><div><span>YOUR PRINT ORDER</span><h2 id="bag-title">Print bag</h2></div><button type="button" onClick={() => setBagOpen(false)} aria-label="Close print bag">×</button></div>
            {orderStatus === "sent" ? <div className="order-success"><strong>Order received.</strong><p>We’ll email your secure payment link and production details next.</p><button type="button" onClick={() => { setOrderStatus("idle"); setBagOpen(false); }}>Keep browsing</button></div> : cart.length === 0 ? <div className="bag-empty"><p>Your bag is waiting for a piece of history.</p><button type="button" onClick={() => setBagOpen(false)}>Browse the archive</button></div> : <>
              <div className="bag-lines">{cart.map((line) => <article key={line.key}><NewspaperPreview record={line.record} compact /><div><strong>{line.record.headline}</strong><span>{formatIssueDate(line.record.issueDate)}</span><span>{line.size} · Print only</span><button type="button" onClick={() => setCart((lines) => lines.filter((item) => item.key !== line.key))}>Remove</button></div><b>${line.price}</b></article>)}</div>
              <div className="bag-total"><span>Print subtotal · shipping added separately</span><strong>${subtotal}</strong></div>
              <form className="order-form" onSubmit={submitOrder}><p>Place your order now. We’ll email a secure payment link with shipping and production details.</p><label><span>Name</span><input name="name" required autoComplete="name" /></label><label><span>Email</span><input name="email" type="email" required autoComplete="email" /></label><label><span>Gift note or order instructions</span><textarea name="note" rows={3} placeholder="Optional" /></label><button type="submit" disabled={orderStatus === "sending"}>{orderStatus === "sending" ? "Placing order…" : "Place order"}</button>{orderStatus === "error" && <small>We couldn’t save that order. Please try again.</small>}</form>
            </>}
          </aside>
        </div>
      )}
    </main>
  );
}
