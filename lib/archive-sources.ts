export type ArchiveSource = {
  id: string;
  name: string;
  url: string;
  role: "Ingestion candidate" | "Discovery only" | "Mixed — review collection";
  coverage: string;
  rightsGuidance: string;
};

export const archiveSources: ArchiveSource[] = [
  {
    id: "loc",
    name: "Library of Congress — Chronicling America",
    url: "https://www.loc.gov/newspapers/",
    role: "Ingestion candidate",
    coverage: "Historic United States newspapers with public search, OCR, IIIF images, and structured data.",
    rightsGuidance: "Strongest automated source. Issues more than 95 years old are generally public domain, but every item and scan still receives a recorded rights and quality check.",
  },
  {
    id: "delpher",
    name: "Delpher",
    url: "https://www.delpher.nl/nl/kranten",
    role: "Discovery only",
    coverage: "Historic Dutch newspapers and periodicals.",
    rightsGuidance: "Useful for research and finding editions. Delpher's terms restrict republication and commercial exploitation, so records are not offered for sale without separate permission.",
  },
  {
    id: "google-news",
    name: "Google News Archive",
    url: "https://news.google.com/newspapers",
    role: "Discovery only",
    coverage: "A broad index of scanned newspapers from many publishers and years.",
    rightsGuidance: "No blanket commercial reproduction license is assumed. Use it to identify a paper, then verify rights and obtain a permitted source asset elsewhere.",
  },
  {
    id: "slq-trove",
    name: "State Library of Queensland / Trove",
    url: "https://www.slq.qld.gov.au/collections/information-collections/newspapers",
    role: "Mixed — review collection",
    coverage: "Australian newspapers, including the Trove 1803–1954 out-of-copyright subset and licensed databases.",
    rightsGuidance: "Trove's historic out-of-copyright subset is a potential catalog source. More recent and database-licensed material remains discovery-only unless separately cleared.",
  },
];
