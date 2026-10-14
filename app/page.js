"use client";

import { useEffect, useMemo, useState } from "react";

const blankDeal = {
  title: "",
  status: "first_message",
  country: "",
  city: "",
  phone: "",
  instagram: "",
  telegram: "",
  viber: "",
  whatsapp: "",
  shop_instagram: "",
  threads: "",
  points_count: "",
  current_system: "",
  sales_mode: [],
  source: "",
  next_call_at: ""
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (response.status === 401) {
    location.href = "/login";
    return null;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function Page() {
  const [meta, setMeta] = useState({ statuses: [], sources: [], sales_modes: [] });
  const [deals, setDeals] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blankDeal);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function load(q = query) {
    const [metaData, dealData] = await Promise.all([
      api("/api/meta"),
      api(`/api/deals${q ? `?q=${encodeURIComponent(q)}` : ""}`)
    ]);
    setMeta(metaData || { statuses: [], sources: [], sales_modes: [] });
    setDeals(dealData || []);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(meta.statuses.map((status) => [status.key, []]));
    for (const deal of deals) (map[deal.status] ||= []).push(deal);
    return map;
  }, [deals, meta.statuses]);

  function edit(deal) {
    setSelected(deal);
    setForm({
      ...blankDeal,
      ...deal,
      points_count: deal.points_count ?? "",
      next_call_at: deal.next_call_at || "",
      sales_mode: deal.sales_mode || []
    });
    setNote("");
  }

  async function saveDeal(event) {
    event.preventDefault();
    const payload = {
      ...form,
      points_count: form.points_count === "" ? null : Number(form.points_count)
    };
    const deal = selected?.id
      ? await api(`/api/deals/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await api("/api/deals", { method: "POST", body: JSON.stringify(payload) });
    setMessage("Saved");
    setSelected(deal);
    await load();
  }

  async function addNote() {
    if (!selected?.id || !note.trim()) return;
    await api(`/api/deals/${selected.id}/notes`, { method: "POST", body: JSON.stringify({ text: note }) });
    setNote("");
    setSelected(await api(`/api/deals/${selected.id}`));
    await load();
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="brand"><span>L</span> Legertas.lt CRM</div>
          <p>Client pipeline, contacts, notes and follow-ups.</p>
        </div>
        <button onClick={logout}>Logout</button>
      </header>

      <section className="toolbar">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals, contacts, notes" />
        <button onClick={() => load(query)}>Search</button>
        <button onClick={() => edit(null)}>New deal</button>
        <a className="button" href="/api/export">Export</a>
      </section>

      {message && <p className="notice">{message}</p>}

      <section className="board">
        {meta.statuses.map((status) => (
          <article className="column" key={status.key}>
            <h2 style={{ borderColor: status.color }}>{status.label}</h2>
            {(grouped[status.key] || []).map((deal) => (
              <button className="deal" key={deal.id} onClick={() => edit(deal)}>
                <strong>{deal.favorite ? "★ " : ""}{deal.title || "Untitled deal"}</strong>
                <span>{[deal.city, deal.country].filter(Boolean).join(", ") || "No location"}</span>
                <small>{deal.last_note?.text || deal.phone || deal.source || "No activity yet"}</small>
              </button>
            ))}
          </article>
        ))}
      </section>

      {(selected !== undefined) && (
        <aside className="panel">
          <form onSubmit={saveDeal}>
            <div className="panel-head">
              <h2>{selected?.id ? "Edit deal" : "New deal"}</h2>
              <button type="button" onClick={() => setSelected(undefined)}>Close</button>
            </div>
            {[
              ["title", "Company / client"],
              ["country", "Country"],
              ["city", "City"],
              ["phone", "Phone"],
              ["instagram", "Instagram"],
              ["telegram", "Telegram"],
              ["viber", "Viber"],
              ["whatsapp", "WhatsApp"],
              ["shop_instagram", "Shop Instagram"],
              ["threads", "Threads"],
              ["points_count", "Points count"],
              ["current_system", "Current system"],
              ["next_call_at", "Next call"]
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type={key === "points_count" ? "number" : key === "next_call_at" ? "datetime-local" : "text"}
                  value={form[key] ?? ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
            <label>
              Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {meta.statuses.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
              </select>
            </label>
            <label>
              Source
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                <option value="">Not set</option>
                {meta.sources.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
            </label>
            <button type="submit">Save deal</button>
          </form>

          {selected?.id && (
            <div className="notes">
              <h3>Notes</h3>
              {(selected.notes || []).map((item) => <p key={item.id}>{item.text}</p>)}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add note" />
              <button onClick={addNote}>Add note</button>
            </div>
          )}
        </aside>
      )}
    </main>
  );
}
