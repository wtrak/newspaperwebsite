# First Edition

[Open the live First Edition storefront →](https://first-edition-archive.sa639.chatgpt.site)

This repository contains the source code. The complete interactive website—date search, headline search, archive browsing, print selection, and availability requests—is at the link above.

First Edition is a searchable storefront for large-format historic newspaper front-page prints. Customers can search by exact date, location, publication, occasion, or historic event; choose a print-only size; and submit an availability request.

## What is included

- Responsive editorial storefront
- Search by date, city, state, publication, headline, and keyword
- Decade, location, and occasion filters
- Product-detail and print-size selection
- Print bag and durable availability requests
- D1 catalog and inquiry schema
- R2-ready structure for protected previews and print masters
- CSV inventory template with source, rights, scan-quality, and restoration fields
- Image-backed Library of Congress seed catalog with source links and real issue metadata
- Automated visual-fit preflight for Wikimedia Commons candidates

## Two ways to shop

- **Find a meaningful date:** search an exact day and year, or look across different years for the same month and day.
- **Find a famous headline:** search an event, person, place, or remembered headline for a gift or decor print.

All products are unframed prints. Each archive item is checked for source, reuse status, and large-format visual quality before it is marked print-ready.

## Library workflow

The source directory separates direct catalog sources from rights-filtered databases, discovery directories, research-only references, and inactive archives. Wikimedia's supplied search is already filtered for unrestricted files; the included preflight focuses on whether each result is actually a complete, high-resolution portrait front page.

The browse count includes only records with a real archive image and source link. Custom research requests are displayed and counted separately from front pages.

```bash
npm run catalog:build
npm run sources:wikimedia -- --limit=50
```

## Run locally

```bash
npm install
npm run dev
```

For a production check:

```bash
npm test
```

## Catalog files

See `catalog/README.md` and `catalog/newspaper_inventory_template.csv`. Confirm reproduction rights and source quality before marking any issue print-ready. Customer-facing previews should be stored separately from high-resolution print masters.
