# Newspaper archive organization

Use `newspaper_inventory_template.csv` as the intake sheet for every front page. One row represents one publication, date, and edition.

The `month_day` field is stored separately from `issue_date` so a gift shopper can search one birthday or anniversary across every indexed year. Headline and keyword fields power the separate decor/history search path.

`loc_front_pages.json` is the website's generated, image-backed seed catalog. Rebuild it with `npm run catalog:build`. A record is counted as a front page only when it has a real Library of Congress page image and source URL; demonstration records and unresolved research requests do not count as archive holdings.

## Required before a print can be sold

- Confirm the publication, issue date, edition, and location.
- Record the archive or owner that supplied the scan.
- Confirm the reproduction-rights status in writing.
- Record the rights basis, the date it was checked, and a commercial-use decision. Public-domain determinations skip the permission step; for unexpired works, archive access by itself is not permission to sell a reproduction.
- Store the web preview and print master as separate assets.
- Mark the item `Print ready` only after resolution, cropping, restoration, and a physical test print are approved.

## File naming

Use `publication-city-YYYY-MM-DD-edition` for the slug and asset base name. Keep lightweight previews under `previews/` and original print masters under `masters/` in object storage. Never serve the high-resolution master directly on the public site.

## Local print-master library

The website catalog stays small because it stores metadata and preview links. Full-resolution Library of Congress files belong in the git-ignored `local-archive/` directory or on a dedicated external drive.

On a Mac, double-click `Resume Newspaper Downloads.command` to continue only missing files, or `Open Newspaper Inventory.command` to open the searchable CSV inventory. The equivalent command-line options are below.

```bash
# Estimate storage for the current catalog
npm run masters:estimate

# Download every front page as a full-resolution JPEG 2000 master
npm run masters:download -- --all

# Retry only files that are not yet safely stored
npm run masters:download -- --only-missing --timeout-ms=600000

# Download only one order, date, or recurring calendar day
npm run masters:download -- --record=sn84020657
npm run masters:download -- --date=1912-11-11
npm run masters:download -- --month-day=11-11

# Put the library on an external drive
npm run masters:download -- --all --output="/Volumes/Newspaper Masters"
```

Downloads are resumable. Complete files are skipped, and incomplete `.part` files continue in verified byte ranges instead of restarting. `local-archive/inventory/` receives both JSON and CSV inventories with the publication, date, location, source URL, local filename, byte count, SHA-256 checksum, and status. Use `--format=pdf` for LOC PDF derivatives or `--format=both` to retain both JP2 and PDF copies. JP2 is the default preservation/print master and avoids doubling the initial storage requirement.
