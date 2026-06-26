// GET /api/gmail/messages — ログインユーザー自身の Gmail（受信トレイ）を readonly で取得し、
// { from, subject, body, date } の配列に整形して返す。
// 重要：取得したメール本文はサーバ側に一切永続保存しない（その場で整形して返すだけ）。
// AI 解析（分類・締切抽出・要約・返信ドラフト）はブラウザ側で行うため、本文を外部 AI へは送らない。
const { parseCookies } = require('../_lib/google');

function getHeader(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function b64urlDecode(data) {
  if (!data) return '';
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  } catch (e) {
    return '';
  }
}

// MIME ツリーを辿って本文を抽出（text/plain を優先、なければ text/html をタグ除去）
function extractBody(payload) {
  if (!payload) return '';
  let plain = '';
  let html = '';
  (function walk(p) {
    if (!p) return;
    if (p.mimeType === 'text/plain' && p.body && p.body.data) plain += b64urlDecode(p.body.data);
    else if (p.mimeType === 'text/html' && p.body && p.body.data) html += b64urlDecode(p.body.data);
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  })(payload);
  const text = plain || html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  return text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const at = parseCookies(req).uf_at;
  if (!at) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX',
      { headers: { Authorization: `Bearer ${at}` } }
    );
    if (listRes.status === 401) {
      res.status(401).json({ error: 'token_expired' });
      return;
    }
    if (!listRes.ok) {
      res.status(502).json({ error: 'gmail_list_failed', status: listRes.status });
      return;
    }

    const list = await listRes.json();
    const ids = (list.messages || []).map((m) => m.id);

    const messages = await Promise.all(
      ids.map(async (id) => {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${at}` } }
        );
        if (!r.ok) return null;
        const m = await r.json();
        const headers = m.payload ? m.payload.headers : [];
        return {
          id: m.id,
          from: getHeader(headers, 'From'),
          subject: getHeader(headers, 'Subject'),
          date: getHeader(headers, 'Date'),
          snippet: m.snippet || '',
          body: extractBody(m.payload) || m.snippet || '',
        };
      })
    );

    res.status(200).json({ messages: messages.filter(Boolean) });
  } catch (e) {
    res.status(500).json({ error: 'gmail_fetch_failed' });
  }
};
