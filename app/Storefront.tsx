"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  catalog,
  formatIssueDate,
  NewspaperRecord,
  printSizes,
  uniqueDecades,
  uniqueRegions,
} from "../lib/catalog";

type CartLine = {
  key: string;
  recordId: string;
  size: string;
  price: number;
};

function NewspaperPreview({ record, compact = false }: { record: NewspaperRecord; compact?: boolean }) {
  return (
    <div className={`news-preview accent-${record.accent} ${compact ? "compact" : ""}`} aria-hidden="true">
      <div className="news-topline"><span>{record.edition}</span><span>{formatIssueDate(record.issueDate)}</span></div>
      <div className="news-masthead">{record.publication}</div>
      <div className="news-rule" />
      <strong>{record.headline}</strong>
      <div className="news-content">
        <span /><span className="news-photo" /><span />
      </div>
    </div>
  );
}

export default function Storefront() {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [decade, setDecade] = useState("All decades");
  const [region, setRegion] = useState("All locations");
  const [occasion, setOccasion] = useState("All occasions");
  const [sort, setSort] = useState("Featured");
  const [selected, setSelected] = useState<NewspaperRecord | null>(null);
  const [selectedSize, setSelectedSize] = useState<(typeof printSizes)[number]>(printSizes[1]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const results = catalog.filter((item) => {
      const haystack = [
        item.publication,
        item.city,
        item.region,
        item.country,
        item.headline,
        item.summary,
        ...item.keywords,
      ].join(" ").toLowerCase();

      return (
        (!needle || haystack.includes(needle)) &&
        (!date || item.issueDate === date) &&
        (decade === "All decades" || item.decade === decade) &&
        (region === "All locations" || item.region === region) &&
        (occasion === "All occasions" || item.occasion === occasion)
      );
    });

    return [...results].sort((a, b) => {
      if (sort === "Oldest first") return a.issueDate.localeCompare(b.issueDate);
      if (sort === "Newest first") return b.issueDate.localeCompare(a.issueDate);
      if (sort === "City A–Z") return a.city.localeCompare(b.city);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });
  }, [query, date, decade, region, occasion, sort]);

  const clearFilters = () => {
    setQuery("");
    setDate("");
    setDecade("All decades");
    setRegion("All locations");
    setOccasion("All occasions");
  };

  const runSearch = (event: FormEvent) => {
    event.preventDefault();
    document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth" });
  };

  const openRecord = (record: NewspaperRecord) => {
    setSelected(record);
    setSelectedSize(printSizes[1]);
  };

  const addToBag = () => {
    if (!selected) return;
    setCart((lines) => [
      ...lines,
      {
        key: `${selected.id}-${selectedSize.label}-${Date.now()}`,
        recordId: selected.id,
        size: selectedSize.label,
        price: selectedSize.price,
      },
    ]);
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
          items: cart,
        }),
      });
      if (!response.ok) throw new Error("Request failed");
      setOrderStatus("sent");
      setCart([]);
    } catch {
      setOrderStatus("error");
    }
  };

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
          <a href="#how-it-works">How it works</a>
          <button className="bag-button" type="button" onClick={() => setBagOpen(true)} aria-label={`Open print bag with ${cart.length} items`}>
            Print bag <span>{cart.length}</span>
          </button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">THE DAY THAT MADE THEIR STORY</p>
          <h1>A front page from<br />a day they’ll <em>never forget.</em></h1>
          <p className="hero-intro">Search decades of historic newspaper front pages by date and place, then order a museum-quality large-format print made for gifting.</p>
          <form className="date-search" onSubmit={runSearch}>
            <label><span>Choose a memorable date</span><input aria-label="Memorable date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label><span>City or publication</span><input aria-label="City or publication" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Chicago or moon landing" /></label>
            <button type="submit">Search the archive <span aria-hidden="true">→</span></button>
          </form>
          <div className="popular-searches" aria-label="Popular dates">
            <span>Popular:</span>
            <button type="button" onClick={() => { setDate("1969-07-21"); setQuery(""); }}>Moon landing</button>
            <button type="button" onClick={() => { setDate("1945-05-08"); setQuery(""); }}>V-E Day</button>
            <button type="button" onClick={() => { setDate(""); setQuery("hometown"); }}>Hometown stories</button>
          </div>
          <div className="trust-row" aria-label="Product details"><span>Archival-quality paper</span><span>Printed to order</span><span>Prints only—no frames</span></div>
        </div>

        <div className="hero-art" aria-label="Example vintage newspaper print">
          <div className="edition-ticket">A GIFT FOR JULY 21, 1969</div>
          <NewspaperPreview record={catalog[0]} />
          <p className="art-caption">Printed large. Made to keep.</p>
        </div>
      </section>

      <section className="occasion-row" aria-label="Shop by occasion">
        {[
          ["Birthday", "The news from the day they arrived"],
          ["Anniversary", "A shared date, beautifully remembered"],
          ["Hometown", "A place that will always feel like home"],
          ["Sports", "The win they still talk about"],
        ].map(([label, copy], index) => (
          <button type="button" key={label} onClick={() => { setOccasion(label); document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth" }); }}>
            <span>0{index + 1}</span><strong>{label}</strong><small>{copy}</small>
          </button>
        ))}
      </section>

      <section className="archive-section" id="archive">
        <div className="archive-heading">
          <div><p className="eyebrow">THE SEARCHABLE ARCHIVE</p><h2>Find their front page</h2></div>
          <p>Explore by exact date, hometown, historic moment, or publication. Every print is produced to order—never framed.</p>
        </div>

        <div className="archive-layout">
          <aside className="filters" aria-label="Archive filters">
            <div className="filter-title"><strong>Refine the archive</strong><button type="button" onClick={clearFilters}>Clear all</button></div>
            <label><span>Exact date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label><span>Search words</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City, paper, or event" /></label>
            <label><span>Decade</span><select value={decade} onChange={(event) => setDecade(event.target.value)}><option>All decades</option>{uniqueDecades.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Location</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>All locations</option>{uniqueRegions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Occasion</span><select value={occasion} onChange={(event) => setOccasion(event.target.value)}><option>All occasions</option>{["Birthday", "Anniversary", "History", "Sports", "Hometown"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="archive-note"><strong>Can’t find the date?</strong><p>Send a sourcing request. We’ll check partner archives and reproduction availability.</p></div>
          </aside>

          <div className="results-area">
            <div className="results-toolbar">
              <p><strong>{filtered.length}</strong> front {filtered.length === 1 ? "page" : "pages"} found</p>
              <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Featured</option><option>Oldest first</option><option>Newest first</option><option>City A–Z</option></select></label>
            </div>

            {filtered.length > 0 ? (
              <div className="catalog-grid">
                {filtered.map((record) => (
                  <article className="catalog-card" key={record.id}>
                    <button className="preview-button" type="button" onClick={() => openRecord(record)} aria-label={`View ${record.publication} from ${formatIssueDate(record.issueDate)}`}>
                      {record.featured && <span className="card-badge">ARCHIVE FAVORITE</span>}
                      <NewspaperPreview record={record} compact />
                    </button>
                    <div className="catalog-card-copy">
                      <p>{formatIssueDate(record.issueDate)}</p>
                      <h3>{record.headline}</h3>
                      <span>{record.publication} · {record.city}, {record.region}</span>
                      <div><strong>From $64</strong><button type="button" onClick={() => openRecord(record)}>{record.assetStatus === "Print ready" ? "Choose print" : "Request issue"} →</button></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state"><span>NO EDITION FOUND</span><h3>That date is still waiting to be discovered.</h3><p>Try a nearby city or clear the exact date. You can also ask us to source it from a partner archive.</p><button type="button" onClick={clearFilters}>Browse the full archive</button></div>
            )}
          </div>
        </div>
      </section>

      <section className="story-band">
        <div><p className="eyebrow">WHY IT MATTERS</p><blockquote>“The most personal gifts don’t just mark a date. They bring the whole day back.”</blockquote></div>
        <div className="quality-card"><span>THE PRINT</span><h3>Made for the wall, without the frame.</h3><p>Each front page is carefully prepared and printed on heavyweight archival matte paper with generous margins for easy display or custom framing later.</p><ul><li>Large-format pigment printing</li><li>Three print-only sizes</li><li>Protective rolled shipping</li><li>Quality checked by hand</li></ul></div>
      </section>

      <section className="how-section" id="how-it-works">
        <p className="eyebrow">FROM ARCHIVE TO THEIR DOOR</p><h2>Three simple steps</h2>
        <div>{[["01", "Choose the day", "Enter a birthday, anniversary, or unforgettable date."], ["02", "Find the right edition", "Narrow by city, state, publication, or historic event."], ["03", "Pick the print size", "We prepare, print, inspect, and ship it safely rolled."]].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <footer>
        <div className="footer-brand"><span className="brand-mark">FE</span><div><strong>FIRST EDITION</strong><p>Historic front pages, printed for personal milestones.</p></div></div>
        <div><strong>SHOP</strong><a href="#archive">Browse archive</a><a href="#how-it-works">How it works</a><a href="#archive">Request a date</a></div>
        <div><strong>PRINT DETAILS</strong><span>Prints only—no frames</span><span>Archival matte paper</span><span>Ships safely rolled</span></div>
        <p className="rights-note">Archive availability and pricing depend on source quality and confirmed reproduction rights. Sample records shown for catalog demonstration.</p>
      </footer>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-title">
            <button className="modal-close" type="button" onClick={() => setSelected(null)} aria-label="Close product details">×</button>
            <div className="modal-preview"><NewspaperPreview record={selected} /></div>
            <div className="modal-copy">
              <p className="eyebrow">{formatIssueDate(selected.issueDate)} · {selected.city}, {selected.region}</p>
              <h2 id="product-title">{selected.headline}</h2>
              <p className="publication-line">{selected.publication} · {selected.edition}</p>
              <p>{selected.summary}</p>
              <fieldset><legend>Choose your print size</legend>{printSizes.map((size) => <label className={selectedSize.label === size.label ? "selected" : ""} key={size.label}><input type="radio" name="size" value={size.label} checked={selectedSize.label === size.label} onChange={() => setSelectedSize(size)} /><span><strong>{size.label}</strong><small>{size.note}</small></span><b>${size.price}</b></label>)}</fieldset>
              <div className="print-only-note"><strong>Print only</strong><span>No frame or mounting hardware is included.</span></div>
              <button className="add-button" type="button" onClick={addToBag}>{selected.assetStatus === "Print ready" ? `Add print to bag · $${selectedSize.price}` : "Add sourcing request"}</button>
              <small className="availability-note">Final availability is confirmed after archival quality and reproduction rights are reviewed.</small>
            </div>
          </section>
        </div>
      )}

      {bagOpen && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setBagOpen(false); }}>
          <aside className="bag-drawer" role="dialog" aria-modal="true" aria-labelledby="bag-title">
            <div className="bag-heading"><div><span>YOUR PRINT REQUEST</span><h2 id="bag-title">Print bag</h2></div><button type="button" onClick={() => setBagOpen(false)} aria-label="Close print bag">×</button></div>
            {orderStatus === "sent" ? (
              <div className="order-success"><strong>Request received.</strong><p>We’ll review the selected editions and follow up before anything is printed or charged.</p><button type="button" onClick={() => { setOrderStatus("idle"); setBagOpen(false); }}>Keep browsing</button></div>
            ) : cart.length === 0 ? (
              <div className="bag-empty"><p>Your bag is waiting for a piece of history.</p><button type="button" onClick={() => setBagOpen(false)}>Browse the archive</button></div>
            ) : (
              <>
                <div className="bag-lines">{cart.map((line) => { const record = catalog.find((item) => item.id === line.recordId)!; return <article key={line.key}><NewspaperPreview record={record} compact /><div><strong>{record.headline}</strong><span>{formatIssueDate(record.issueDate)}</span><span>{line.size} · Print only</span><button type="button" onClick={() => setCart((lines) => lines.filter((item) => item.key !== line.key))}>Remove</button></div><b>${line.price}</b></article>; })}</div>
                <div className="bag-total"><span>Estimated subtotal</span><strong>${subtotal}</strong></div>
                <form className="order-form" onSubmit={submitOrder}><p>Send this print request for an availability check. No payment is taken yet.</p><label><span>Name</span><input name="name" required autoComplete="name" /></label><label><span>Email</span><input name="email" type="email" required autoComplete="email" /></label><label><span>Gift note or special request</span><textarea name="note" rows={3} placeholder="Optional" /></label><button type="submit" disabled={orderStatus === "sending"}>{orderStatus === "sending" ? "Sending…" : "Request availability"}</button>{orderStatus === "error" && <small>We couldn’t save that request. Please try again.</small>}</form>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
