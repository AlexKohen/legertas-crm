import postgres from "postgres";

export const STATUSES = [
  { key: "first_message", label: "отправлено первое сообщение", color: "#FFF98C" },
  { key: "first_contact", label: "Первый контакт", color: "#FFF050" },
  { key: "chatting", label: "Переписка", color: "#E6DCFB" },
  { key: "demo", label: "Демо", color: "#FDE6B3" },
  { key: "thinking", label: "Думает", color: "#FAD4E4" },
  { key: "free", label: "пользуется бесплатно", color: "#BEDBFB" },
  { key: "paid", label: "пользуется платно", color: "#A6CAFD" },
  { key: "sale", label: "Продажа", color: "#F8D98C" },
  { key: "done", label: "Успешно реализовано", color: "#D7FB84" },
  { key: "on_hold", label: "На холде", color: "#CDEBE6" },
  { key: "cancelled", label: "Отменена", color: "#D9D9DE" }
];

const STATUS_KEYS = new Set(STATUSES.map((item) => item.key));
const STATUS_LABEL = Object.fromEntries(STATUSES.map((item) => [item.key, item.label]));
const SOURCES = ["Threads", "Instagram", "Telegram", "WhatsApp", "Viber", "Сайт", "Рекомендация", "Другое"];
const SALES_MODES = ["online", "offline"];
const TEXT_FIELDS = ["title", "country", "city", "phone", "instagram", "telegram", "viber", "whatsapp", "shop_instagram", "threads", "current_system", "source"];
const DEAL_FIELDS = [...TEXT_FIELDS, "status", "points_count", "sales_mode", "next_call_at"];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const now = () => new Date().toISOString();
const str = (value) => (value == null ? "" : String(value).trim().slice(0, 2000));

function json(value, fallback) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value || fallback;
  } catch {
    return fallback;
  }
}

let sql;
let schemaReady;

function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  sql ||= postgres(process.env.DATABASE_URL, { max: 4, ssl: "require" });
  return sql;
}

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const s = db();
    await s`CREATE TABLE IF NOT EXISTS deals (id SERIAL PRIMARY KEY, title TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'first_message', position INTEGER NOT NULL DEFAULT 0, country TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', instagram TEXT NOT NULL DEFAULT '', telegram TEXT NOT NULL DEFAULT '', viber TEXT NOT NULL DEFAULT '', whatsapp TEXT NOT NULL DEFAULT '', shop_instagram TEXT NOT NULL DEFAULT '', threads TEXT NOT NULL DEFAULT '', points_count INTEGER, current_system TEXT NOT NULL DEFAULT '', sales_mode TEXT NOT NULL DEFAULT '[]', source TEXT NOT NULL DEFAULT '', next_call_at TEXT, favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`;
    await s`CREATE INDEX IF NOT EXISTS deals_status_pos ON deals(status, position)`;
    await s`CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', telegram TEXT NOT NULL DEFAULT '', comment TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`;
    await s`CREATE INDEX IF NOT EXISTS contacts_deal ON contacts(deal_id)`;
    await s`CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE, kind TEXT NOT NULL DEFAULT 'user', text TEXT NOT NULL, created_at TEXT NOT NULL, edited_at TEXT)`;
    await s`CREATE INDEX IF NOT EXISTS notes_deal ON notes(deal_id, created_at)`;
  })();
  return schemaReady;
}

function clean(input = {}, partial = false) {
  const out = {};
  for (const field of DEAL_FIELDS) {
    if (!(field in input)) continue;
    const value = input[field];
    if (TEXT_FIELDS.includes(field)) out[field] = str(value);
    if (field === "status") {
      if (!STATUS_KEYS.has(value)) throw new HttpError(400, `Unknown status: ${value}`);
      out.status = value;
    }
    if (field === "points_count") {
      if (value === "" || value == null) out.points_count = null;
      else {
        const number = Number(value);
        if (!Number.isInteger(number) || number < 0) throw new HttpError(400, "Points count must be a positive integer.");
        out.points_count = number;
      }
    }
    if (field === "sales_mode") out.sales_mode = JSON.stringify(SALES_MODES.filter((mode) => Array.isArray(value) && value.includes(mode)));
    if (field === "next_call_at") out.next_call_at = value ? String(value) : null;
  }
  if (!partial && !out.status) out.status = "first_message";
  return out;
}

function deal(row) {
  return row ? { ...row, sales_mode: json(row.sales_mode, []), favorite: Boolean(row.favorite) } : row;
}

async function requireDeal(s, id) {
  const [row] = await s`SELECT * FROM deals WHERE id = ${Number(id)}`;
  if (!row) throw new HttpError(404, "Deal not found.");
  return row;
}

async function nextPosition(s, status) {
  const [row] = await s`SELECT COALESCE(MIN(position), 1) AS position FROM deals WHERE status = ${status}`;
  return Number(row?.position || 1) - 1;
}

async function touch(s, dealId, time = now()) {
  await s`UPDATE deals SET updated_at = ${time} WHERE id = ${Number(dealId)}`;
}

export class Store {
  constructor(s = db()) {
    this.db = s;
  }

  async meta() {
    return { statuses: STATUSES, sources: SOURCES, sales_modes: SALES_MODES };
  }

  async listDeals({ q } = {}) {
    const rows = (await this.db`SELECT * FROM deals ORDER BY status, favorite DESC, position, id`).map(deal);
    const contacts = await this.db`SELECT * FROM contacts ORDER BY sort, id`;
    const notes = await this.db`SELECT DISTINCT ON (deal_id) deal_id, text, kind, created_at FROM notes WHERE kind = 'user' ORDER BY deal_id, created_at DESC, id DESC`;
    const byId = new Map(rows.map((item) => [item.id, Object.assign(item, { contacts: [], last_note: null })]));
    for (const contact of contacts) byId.get(contact.deal_id)?.contacts.push(contact);
    for (const note of notes) if (byId.has(note.deal_id)) byId.get(note.deal_id).last_note = note;
    const needle = String(q || "").trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((item) => [item.title, item.country, item.city, item.phone, item.instagram, item.telegram, item.viber, item.whatsapp, item.shop_instagram, item.threads, item.current_system, item.source, ...item.contacts.flatMap((c) => [c.name, c.phone, c.telegram, c.comment]), item.last_note?.text].join("\n").toLowerCase().includes(needle));
  }

  async getDeal(id) {
    const item = deal(await requireDeal(this.db, id));
    item.contacts = await this.db`SELECT * FROM contacts WHERE deal_id = ${item.id} ORDER BY sort, id`;
    item.notes = await this.db`SELECT * FROM notes WHERE deal_id = ${item.id} ORDER BY created_at, id`;
    return item;
  }

  async createDeal(input = {}) {
    const data = clean(input, false);
    const time = now();
    const [row] = await this.db`INSERT INTO deals ${this.db({ ...data, position: await nextPosition(this.db, data.status), favorite: input.favorite ? 1 : 0, created_at: time, updated_at: time })} RETURNING id`;
    return row.id;
  }

  async updateDeal(id, input = {}) {
    const before = await requireDeal(this.db, id);
    const data = clean(input, true);
    if (!Object.keys(data).length) return this.getDeal(id);
    const time = now();
    await this.db.begin(async (s) => {
      if (data.status && data.status !== before.status) {
        data.position = await nextPosition(s, data.status);
        await s`INSERT INTO notes (deal_id, kind, text, created_at) VALUES (${before.id}, 'system', ${`Status: ${STATUS_LABEL[before.status]} -> ${STATUS_LABEL[data.status]}`}, ${time})`;
      }
      await s`UPDATE deals SET ${s({ ...data, updated_at: time }, Object.keys({ ...data, updated_at: time }))} WHERE id = ${before.id}`;
    });
    return this.getDeal(id);
  }

  async moveDeal(id, { status, index }) {
    const before = await requireDeal(this.db, id);
    if (!STATUS_KEYS.has(status)) throw new HttpError(400, `Unknown status: ${status}`);
    const time = now();
    await this.db.begin(async (s) => {
      const rows = await s`SELECT id FROM deals WHERE status = ${status} AND id != ${before.id} ORDER BY favorite DESC, position, id`;
      const ids = rows.map((row) => row.id);
      ids.splice(Math.max(0, Math.min(Number(index) || 0, ids.length)), 0, before.id);
      await Promise.all(ids.map((dealId, position) => s`UPDATE deals SET position = ${position} WHERE id = ${dealId}`));
      await s`UPDATE deals SET status = ${status}, updated_at = ${time} WHERE id = ${before.id}`;
    });
    return this.getDeal(id);
  }

  async setFavorite(id, favorite) {
    const item = await requireDeal(this.db, id);
    await this.db`UPDATE deals SET favorite = ${favorite ? 1 : 0}, updated_at = ${now()} WHERE id = ${item.id}`;
    return { id: item.id, favorite: Boolean(favorite) };
  }

  async deleteDeal(id) {
    await requireDeal(this.db, id);
    await this.db`DELETE FROM deals WHERE id = ${Number(id)}`;
  }

  async addContact(dealId, input = {}) {
    const item = await requireDeal(this.db, dealId);
    const [sort] = await this.db`SELECT COALESCE(MAX(sort), 0) + 1 AS value FROM contacts WHERE deal_id = ${item.id}`;
    const [contact] = await this.db`INSERT INTO contacts (deal_id, name, phone, telegram, comment, sort, created_at) VALUES (${item.id}, ${str(input.name)}, ${str(input.phone)}, ${str(input.telegram)}, ${str(input.comment)}, ${sort.value}, ${now()}) RETURNING *`;
    await touch(this.db, item.id);
    return contact;
  }

  async updateContact(id, input = {}) {
    const [contact] = await this.db`SELECT * FROM contacts WHERE id = ${Number(id)}`;
    if (!contact) throw new HttpError(404, "Contact not found.");
    const next = { name: "name" in input ? str(input.name) : contact.name, phone: "phone" in input ? str(input.phone) : contact.phone, telegram: "telegram" in input ? str(input.telegram) : contact.telegram, comment: "comment" in input ? str(input.comment) : contact.comment };
    const [updated] = await this.db`UPDATE contacts SET ${this.db(next, Object.keys(next))} WHERE id = ${contact.id} RETURNING *`;
    await touch(this.db, contact.deal_id);
    return updated;
  }

  async deleteContact(id) {
    const [contact] = await this.db`DELETE FROM contacts WHERE id = ${Number(id)} RETURNING *`;
    if (!contact) throw new HttpError(404, "Contact not found.");
    await touch(this.db, contact.deal_id);
  }

  async addNote(dealId, text) {
    const item = await requireDeal(this.db, dealId);
    const body = String(text || "").trim();
    if (!body) throw new HttpError(400, "Note is empty.");
    const [note] = await this.db`INSERT INTO notes (deal_id, kind, text, created_at) VALUES (${item.id}, 'user', ${body.slice(0, 20000)}, ${now()}) RETURNING *`;
    await touch(this.db, item.id);
    return note;
  }

  async updateNote(id, text) {
    const body = String(text || "").trim();
    if (!body) throw new HttpError(400, "Note is empty.");
    const [note] = await this.db`UPDATE notes SET text = ${body}, edited_at = ${now()} WHERE id = ${Number(id)} AND kind = 'user' RETURNING *`;
    if (!note) throw new HttpError(404, "Note not found.");
    await touch(this.db, note.deal_id);
    return note;
  }

  async deleteNote(id) {
    const [note] = await this.db`DELETE FROM notes WHERE id = ${Number(id)} RETURNING *`;
    if (!note) throw new HttpError(404, "Note not found.");
    await touch(this.db, note.deal_id);
  }

  async exportAll() {
    const rows = (await this.db`SELECT * FROM deals ORDER BY id`).map(deal);
    for (const item of rows) {
      item.contacts = await this.db`SELECT * FROM contacts WHERE deal_id = ${item.id} ORDER BY sort, id`;
      item.notes = await this.db`SELECT * FROM notes WHERE deal_id = ${item.id} ORDER BY created_at, id`;
    }
    return { format: "legertas-crm", version: 1, exported_at: now(), deals: rows };
  }
}

export async function open() {
  await ensureSchema();
  return new Store();
}
