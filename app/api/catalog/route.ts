import { env } from "cloudflare:workers";
import { catalog } from "../../../lib/catalog";

const createInquiryTable = `
  CREATE TABLE IF NOT EXISTS print_requests (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    items_json TEXT NOT NULL,
    estimated_subtotal INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createInquiryStatusIndex = `
  CREATE INDEX IF NOT EXISTS idx_print_requests_status_created
  ON print_requests(status, created_at)
`;

export async function GET() {
  return Response.json({ items: catalog, count: catalog.length });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: unknown;
      email?: unknown;
      note?: unknown;
      items?: Array<{ recordId?: unknown; size?: unknown; price?: unknown }>;
    };

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 2000) : "";
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!name || !/^\S+@\S+\.\S+$/.test(email) || items.length === 0) {
      return Response.json({ error: "Name, valid email, and at least one print are required." }, { status: 400 });
    }

    const cleanItems = items.slice(0, 20).map((item) => ({
      recordId: typeof item.recordId === "string" ? item.recordId : "",
      size: typeof item.size === "string" ? item.size : "",
      price: typeof item.price === "number" && Number.isFinite(item.price) ? Math.max(0, Math.round(item.price)) : 0,
    })).filter((item) => catalog.some((record) => record.id === item.recordId));

    if (cleanItems.length === 0) {
      return Response.json({ error: "No valid archive items were provided." }, { status: 400 });
    }

    await env.DB.batch([
      env.DB.prepare(createInquiryTable),
      env.DB.prepare(createInquiryStatusIndex),
    ]);

    const id = crypto.randomUUID();
    const subtotal = cleanItems.reduce((sum, item) => sum + item.price, 0);
    await env.DB.prepare(`
      INSERT INTO print_requests
      (id, customer_name, customer_email, note, items_json, estimated_subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, name.slice(0, 120), email.slice(0, 254), note, JSON.stringify(cleanItems), subtotal).run();

    return Response.json({ id, status: "received" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save print request.";
    return Response.json({ error: message }, { status: 500 });
  }
}
