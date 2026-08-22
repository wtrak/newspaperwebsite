# Newspaper archive organization

Use `newspaper_inventory_template.csv` as the intake sheet for every front page. One row represents one publication, date, and edition.

The `month_day` field is stored separately from `issue_date` so a gift shopper can search one birthday or anniversary across every indexed year. Headline and keyword fields power the separate decor/history search path.

## Required before a print can be sold

- Confirm the publication, issue date, edition, and location.
- Record the archive or owner that supplied the scan.
- Confirm the reproduction-rights status in writing.
- Record the rights basis, the date it was checked, and a commercial-use decision. Archive access by itself is not permission to sell a reproduction.
- Store the web preview and print master as separate assets.
- Mark the item `Print ready` only after resolution, cropping, restoration, and a physical test print are approved.

## File naming

Use `publication-city-YYYY-MM-DD-edition` for the slug and asset base name. Keep lightweight previews under `previews/` and original print masters under `masters/` in object storage. Never serve the high-resolution master directly on the public site.
