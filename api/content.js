/*
 * Хранилище текста приглашения (Vercel Serverless Function).
 *
 * GET  /api/content            -> { content: {...} | null }
 * POST /api/content            -> сохранить (нужен пароль)
 *      body: { password: "...", content: {...} }
 *
 * Данные лежат в Vercel KV (Upstash Redis), доступ по REST.
 * Нужны переменные окружения (Vercel задаёт их сам при подключении KV):
 *   KV_REST_API_URL, KV_REST_API_TOKEN
 * И пароль на сохранение (задать вручную в Project Settings -> Environment Variables):
 *   EDIT_SECRET
 */

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = "wedding:content";

async function kvGet() {
  if (!KV_URL || !KV_TOKEN) return null;
  const r = await fetch(`${KV_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data || data.result == null) return null;
  try {
    return JSON.parse(data.result);
  } catch (e) {
    return null;
  }
}

async function kvSet(value) {
  if (!KV_URL || !KV_TOKEN) throw new Error("KV not configured");
  const r = await fetch(`${KV_URL}/set/${KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error("KV write failed: " + r.status);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    try {
      const content = await kvGet();
      return res.status(200).json({ content });
    } catch (e) {
      return res.status(200).json({ content: null });
    }
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const secret = process.env.EDIT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "EDIT_SECRET не задан на сервере" });
    }
    if (body.password !== secret) {
      return res.status(401).json({ error: "Неверный пароль" });
    }
    if (!body.content || typeof body.content !== "object") {
      return res.status(400).json({ error: "Нет данных content" });
    }

    try {
      await kvSet(body.content);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
