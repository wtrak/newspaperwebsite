# First Edition

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

## Run locally

```bash
npm install
npm run dev
```

For a production check:

```bash
npm test
```

## Archive workflow

See `catalog/README.md` and `catalog/newspaper_inventory_template.csv`. Confirm reproduction rights and source quality before marking any issue print-ready. Customer-facing previews should be stored separately from high-resolution print masters.
