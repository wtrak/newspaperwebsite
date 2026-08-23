export type SourceRole =
  | "Direct catalog source"
  | "Rights-filtered source"
  | "Discovery directory"
  | "Research only"
  | "Legacy / inactive";

export type ArchiveSource = {
  id: string;
  name: string;
  url: string;
  role: SourceRole;
  coverage: string;
  rightsGuidance: string;
  featured?: boolean;
};

export const archiveSources: ArchiveSource[] = [
  {
    id: "loc",
    name: "Library of Congress — Chronicling America",
    url: "https://www.loc.gov/newspapers/",
    role: "Direct catalog source",
    coverage: "Historic United States newspapers with public search, OCR, IIIF images, and structured data.",
    rightsGuidance: "Primary automated feed. U.S. issues more than 95 years old are public domain in their entirety and move directly to scan-quality checks.",
    featured: true,
  },
  {
    id: "cdnc",
    name: "California Digital Newspaper Collection",
    url: "https://cdnc.ucr.edu/",
    role: "Direct catalog source",
    coverage: "California newspapers from 1846 to the present, with searchable OCR and page images.",
    rightsGuidance: "The collection states that its pre-1930 newspapers are public domain with no use restrictions and asks for source credit when images are reproduced.",
    featured: true,
  },
  {
    id: "nypl",
    name: "New York Public Library Digital Collections",
    url: "https://digitalcollections.nypl.org/",
    role: "Direct catalog source",
    coverage: "More than one million digitized items, including newspapers, periodicals, illustrations, and photographs.",
    rightsGuidance: "Ingest only items carrying NYPL's public-domain or no-known-U.S.-copyright-restrictions label. Those items require no NYPL permission and offer high-resolution downloads.",
    featured: true,
  },
  {
    id: "trove",
    name: "Trove — National Library of Australia",
    url: "https://trove.nla.gov.au/",
    role: "Rights-filtered source",
    coverage: "A large full-text collection of Australian newspapers and gazettes from national and regional partners.",
    rightsGuidance: "Use the out-of-copyright historic newspaper subset and retain each record's rights statement. In-copyright partner content remains unavailable without permission.",
    featured: true,
  },
  {
    id: "idnc",
    name: "Illinois Digital Newspaper Collections",
    url: "https://idnc.library.illinois.edu/cgi-bin/illinois?a=p&p=home&e=-------en-20--1--txt-txIN-------",
    role: "Rights-filtered source",
    coverage: "Digitized Illinois newspapers with date browsing, full-text search, and page images.",
    rightsGuidance: "Strong date-and-location source. Automatically admit U.S. issues beyond the copyright term; record item-level guidance for anything newer.",
    featured: true,
  },
  {
    id: "europeana",
    name: "Europeana Newspapers",
    url: "https://www.europeana.eu/",
    role: "Rights-filtered source",
    coverage: "European newspaper records and OCR aggregated from many cultural institutions through Europeana.",
    rightsGuidance: "The API exposes a machine-readable rights statement for each object. Ingest only public-domain, CC0, or otherwise commercially reusable records.",
    featured: true,
  },
  {
    id: "wikimedia-commons",
    name: "Wikimedia Commons",
    url: "https://commons.wikimedia.org/w/index.php?search=newspaper+front+page+&title=Special%3AMediaSearch&type=image&haslicense=unrestricted&fileres=%3E1000",
    role: "Direct catalog source",
    coverage: "Freely licensed and public-domain newspaper front-page images from institutions and individual contributors worldwide.",
    rightsGuidance: "The supplied search is already filtered to unrestricted files. Preserve each file's attribution metadata, then use the visual-fit preflight to reject non-front-pages, weak scans, landscape spreads, and duplicates.",
    featured: true,
  },
  {
    id: "internet-archive",
    name: "Internet Archive — Miscellaneous Newspapers",
    url: "https://archive.org/details/newspapers_miscellaneous",
    role: "Direct catalog source",
    coverage: "More than 280,000 dated newspaper issue records, many with compact downloadable PDFs and complete front-page scans.",
    rightsGuidance: "Import pre-1931 issues as public-domain newspaper content, then require a complete portrait front page and sufficient scan resolution before the issue appears in the sellable catalog.",
    featured: true,
  },
  {
    id: "slq",
    name: "State Library of Queensland Newspapers",
    url: "https://www.slq.qld.gov.au/collections/information-collections/newspapers",
    role: "Rights-filtered source",
    coverage: "Australian newspaper research gateway linking Trove's historic collection and licensed newspaper databases.",
    rightsGuidance: "Route the out-of-copyright Trove subset into catalog review. Treat newer and subscription databases as research-only.",
    featured: true,
  },
  {
    id: "delpher",
    name: "Delpher",
    url: "https://www.delpher.nl/nl/kranten",
    role: "Research only",
    coverage: "Historic Dutch newspapers and periodicals.",
    rightsGuidance: "Useful for identifying editions, dates, and publishers. Delpher's platform terms restrict republication and commercial exploitation without separate permission.",
  },
  {
    id: "google-news",
    name: "Google News Archive",
    url: "https://news.google.com/newspapers",
    role: "Discovery directory",
    coverage: "A broad index of scanned newspapers from many publishers and years.",
    rightsGuidance: "Use it to identify a paper and issue, then obtain the page from a source that provides a reusable asset. No blanket commercial reproduction license is assumed.",
  },
  {
    id: "national-security-archive",
    name: "National Security Archive",
    url: "https://nsarchive.gwu.edu/",
    role: "Research only",
    coverage: "Declassified U.S. government records, research briefings, and primary-source documents rather than newspaper scans.",
    rightsGuidance: "Use public-domain U.S. government documents to verify event context and search terms. National Security Archive editorial content has separate terms.",
  },
  {
    id: "free-newspaper-archives-us",
    name: "Free Newspapers in the US",
    url: "http://www.freenewspaperarchives.us/",
    role: "Legacy / inactive",
    coverage: "A directory intended to point researchers toward free U.S. newspaper archives.",
    rightsGuidance: "The supplied site is currently unstable and should not power automated search. Retain it only as a lead list pending manual link validation.",
  },
  {
    id: "research-guides",
    name: "Historical Newspapers and Indexes on the Internet",
    url: "http://www.researchguides.net/newspapers.htm",
    role: "Discovery directory",
    coverage: "A genealogy-oriented directory of U.S. historical newspaper collections and indexes.",
    rightsGuidance: "The original page now redirects to a successor directory. Use links as leads; apply the destination archive's own rights and access rules.",
  },
  {
    id: "fulton-history",
    name: "Old Fulton New York Postcards / Fulton History",
    url: "https://www.fultonhistory.com/Fulton.html",
    role: "Discovery directory",
    coverage: "A large independently digitized collection of New York and other U.S. newspapers.",
    rightsGuidance: "Excellent for locating rare titles and dates. Without a production API or clear commercial-reuse grant, source the final public-domain page from a documented provider or original scan.",
  },
  {
    id: "online-newspapers-site",
    name: "Online Historical Newspapers Website",
    url: "https://sites.google.com/site/onlinenewspapersite/",
    role: "Discovery directory",
    coverage: "A curated Google Sites directory pointing to historical newspaper collections around the world.",
    rightsGuidance: "Use only to locate collections. Validate availability, rights, and file quality at each destination.",
  },
  {
    id: "ibiblio-news-archives",
    name: "U.S. News Archives on the Web",
    url: "http://www.ibiblio.org/slanews/internet/archives.html",
    role: "Legacy / inactive",
    coverage: "A state-by-state list of newspaper websites, archive dates, and historical retrieval costs.",
    rightsGuidance: "Partly updated in 2008, so links and prices are stale. Keep as a historical lead list, never as an automated source.",
  },
  {
    id: "wikipedia-online-archives",
    name: "Wikipedia — List of Online Newspaper Archives",
    url: "https://en.wikipedia.org/wiki/Wikipedia:List_of_online_newspaper_archives",
    role: "Discovery directory",
    coverage: "A community-maintained international directory of free and subscription newspaper archives.",
    rightsGuidance: "Use it to discover providers, then verify each provider and item independently. Wikipedia does not supply print assets or reuse rights.",
  },
  {
    id: "elephind",
    name: "Elephind",
    url: "https://elephind.com/",
    role: "Discovery directory",
    coverage: "A federated search service spanning historical newspaper collections from multiple institutions.",
    rightsGuidance: "Search results inherit the contributing collection's rules. Use Elephind for discovery and retain the original provider as the asset source.",
  },
  {
    id: "icon",
    name: "International Coalition on Newspapers",
    url: "https://icon.crl.edu/digitization.php",
    role: "Discovery directory",
    coverage: "A preservation and digitization registry for international newspaper holdings and projects.",
    rightsGuidance: "Use to identify institutions and digitized runs. Obtain rights and scans from the holding institution.",
  },
  {
    id: "newspapersg",
    name: "NewspaperSG",
    url: "https://eresources.nlb.gov.sg/newspapers/",
    role: "Research only",
    coverage: "Singapore and Malaya newspapers digitized by Singapore's National Library Board.",
    rightsGuidance: "Use for research and issue discovery. Commercial reproduction requires compliance with NLB and publisher terms; do not ingest scans automatically.",
  },
  {
    id: "nyt-archive",
    name: "New York Times Article Archive",
    url: "https://archive.nytimes.com/www.nytimes.com/ref/membercenter/nytarchive.html",
    role: "Research only",
    coverage: "The New York Times article archive, including paid access across historic and modern years.",
    rightsGuidance: "A paid article archive is not a reproduction license. Use for headline and date research unless a separate commercial license is obtained.",
  },
  {
    id: "life-magazine",
    name: "LIFE Magazine Archive",
    url: "https://books.google.no/books/about/LIFE.html?id=N0EEAAAAMBAJ&redir_esc=y",
    role: "Research only",
    coverage: "Google Books scans of LIFE magazine issues from 1936–1972; useful for cultural-event research but outside the newspaper product catalog.",
    rightsGuidance: "Magazine pages and Google-hosted scans are not assumed commercially reusable. Use only as research unless separately licensed.",
  },
  {
    id: "newseum",
    name: "Newseum",
    url: "https://www.newseum.org/",
    role: "Legacy / inactive",
    coverage: "Former museum and daily front-page showcase; the physical museum closed in 2019.",
    rightsGuidance: "Do not rely on it as an archive or production source. Preserve the link only as a historical sourcing lead.",
  },
  {
    id: "newspapers-com",
    name: "Newspapers.com by Ancestry",
    url: "https://www.newspapers.com/",
    role: "Research only",
    coverage: "A subscription database containing more than a billion newspaper pages from thousands of titles.",
    rightsGuidance: "Use the subscription for research and discovery. Do not treat access to its scans as commercial reproduction permission; source public-domain pages elsewhere.",
  },
  {
    id: "marxists-periodicals",
    name: "Marxists Internet Archive — Periodicals",
    url: "https://www.marxists.org/glossary/periodicals/archive/index.htm",
    role: "Research only",
    coverage: "A thematic list of digitized political periodicals, newspapers, and journals.",
    rightsGuidance: "Useful for issue discovery and historical context. Rights vary by publication and hosted scan, so no automatic commercial ingestion.",
  },
  {
    id: "montana-newspapers",
    name: "Digitized Montana Newspapers",
    url: "https://mhs.mt.gov/research/collections/newspapers/mtnews",
    role: "Discovery directory",
    coverage: "Historic Montana newspapers and links to state and national digitization projects.",
    rightsGuidance: "Use to find titles and dates. Montana Historical Society requires written reuse permission for its reproductions, so obtain a permitted public-domain scan source before sale.",
  },
  {
    id: "newslink",
    name: "Newslink",
    url: "http://www.newslink.org/news.html",
    role: "Legacy / inactive",
    coverage: "The original English-language newspaper directory has been replaced by a Korean current-news link directory.",
    rightsGuidance: "Not suitable for historical archive discovery or automated ingestion in its current form.",
  },
];

export const featuredArchiveSources = archiveSources.filter((source) => source.featured);

export const sourceRoles: SourceRole[] = [
  "Direct catalog source",
  "Rights-filtered source",
  "Discovery directory",
  "Research only",
  "Legacy / inactive",
];
