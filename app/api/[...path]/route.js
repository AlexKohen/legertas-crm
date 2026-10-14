import { NextResponse } from "next/server";
import { HttpError, open } from "../../../src/db";

export const runtime = "nodejs";

const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, key) => {
    keys.push(key);
    return "(\\d+)";
  })}$`);
  routes.push({ method, re, keys, handler });
};

route("GET", "/api/meta", ({ store }) => store.meta());
route("GET", "/api/deals", ({ store, query }) => store.listDeals({ q: query.get("q") }));
route("POST", "/api/deals", async ({ store, body }) => store.getDeal(await store.createDeal(body)));
route("GET", "/api/deals/:id", ({ store, params }) => store.getDeal(params.id));
route("PATCH", "/api/deals/:id", ({ store, params, body }) => store.updateDeal(params.id, body));
route("DELETE", "/api/deals/:id", async ({ store, params }) => {
  await store.deleteDeal(params.id);
  return { ok: true };
});
route("POST", "/api/deals/:id/move", ({ store, params, body }) => store.moveDeal(params.id, body));
route("POST", "/api/deals/:id/favorite", ({ store, params, body }) => store.setFavorite(params.id, Boolean(body.favorite)));
route("POST", "/api/deals/:id/contacts", ({ store, params, body }) => store.addContact(params.id, body));
route("PATCH", "/api/contacts/:id", ({ store, params, body }) => store.updateContact(params.id, body));
route("DELETE", "/api/contacts/:id", async ({ store, params }) => {
  await store.deleteContact(params.id);
  return { ok: true };
});
route("POST", "/api/deals/:id/notes", ({ store, params, body }) => store.addNote(params.id, body.text));
route("PATCH", "/api/notes/:id", ({ store, params, body }) => store.updateNote(params.id, body.text));
route("DELETE", "/api/notes/:id", async ({ store, params }) => {
  await store.deleteNote(params.id);
  return { ok: true };
});
route("GET", "/api/export", async ({ store }) => {
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(await store.exportAll()), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="legertas-crm-export-${stamp}.json"`
    }
  });
});

async function handle(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    const store = await open();
    for (const item of routes) {
      if (item.method !== method) continue;
      const match = path.match(item.re);
      if (!match) continue;

      const params = Object.fromEntries(item.keys.map((key, index) => [key, match[index + 1]]));
      const body = ["POST", "PATCH", "PUT"].includes(method) ? await request.json().catch(() => ({})) : {};
      const result = await item.handler({ store, params, body, query: url.searchParams, request });

      if (result instanceof NextResponse) return result;
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    return NextResponse.json({ error: "Нет такого метода API" }, { status: 404 });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: `Ошибка сервера: ${error.message}` }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
