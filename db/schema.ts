import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const publications = sqliteTable(
  "publications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    region: text("region").notNull(),
    country: text("country").notNull().default("United States"),
    language: text("language").notNull().default("English"),
    coverageStart: text("coverage_start"),
    coverageEnd: text("coverage_end"),
    archiveSource: text("archive_source").notNull().default(""),
    rightsNotes: text("rights_notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_publications_slug").on(table.slug),
    index("idx_publications_location").on(table.country, table.region, table.city),
  ],
);

export const newspaperIssues = sqliteTable(
  "newspaper_issues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    publicationId: integer("publication_id").notNull().references(() => publications.id),
    issueDate: text("issue_date").notNull(),
    decade: text("decade").notNull(),
    edition: text("edition").notNull().default(""),
    headline: text("headline").notNull(),
    summary: text("summary").notNull().default(""),
    occasion: text("occasion").notNull().default("History"),
    keywords: text("keywords").notNull().default("[]"),
    rightsStatus: text("rights_status").notNull().default("Rights review"),
    assetStatus: text("asset_status").notNull().default("Source requested"),
    sourceReference: text("source_reference").notNull().default(""),
    previewAssetKey: text("preview_asset_key"),
    printAssetKey: text("print_asset_key"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_newspaper_issues_slug").on(table.slug),
    uniqueIndex("idx_newspaper_issues_publication_date_edition").on(table.publicationId, table.issueDate, table.edition),
    index("idx_newspaper_issues_date").on(table.issueDate),
    index("idx_newspaper_issues_decade_occasion").on(table.decade, table.occasion),
    index("idx_newspaper_issues_asset_status").on(table.assetStatus),
  ],
);

export const printRequests = sqliteTable(
  "print_requests",
  {
    id: text("id").primaryKey(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    note: text("note").notNull().default(""),
    itemsJson: text("items_json").notNull(),
    estimatedSubtotal: integer("estimated_subtotal").notNull().default(0),
    status: text("status").notNull().default("new"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_print_requests_status_created").on(table.status, table.createdAt)],
);
