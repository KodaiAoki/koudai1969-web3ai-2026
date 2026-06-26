// ===== UniFilter AI v5 — Google OAuth / Cookie 共通ヘルパ（サーバ側のみ） =====
// クライアントシークレットやアクセストークンはこのサーバ側コードでのみ扱う。
// フロントエンド(JS)には一切渡さない（トークンは HttpOnly Cookie に格納する）。
const crypto = require('crypto');

// スコープは読み取り専用に限定（送信・削除・変更系は一切要求しない）。
// openid / email / profile はログインユーザーの識別用。
const SCOPE = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // リダイレクトURIは明示設定を優先。なければ Vercel のドメインから組み立て、最後に localhost。
  let redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri) {
    if (process.env.VERCEL_URL) redirectUri = `https://${process.env.VERCEL_URL}/api/auth/callback`;
    else redirectUri = 'http://localhost:3000/api/auth/callback';
  }
  return { clientId, clientSecret, redirectUri, scope: SCOPE };
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function serializeCookie(name, value, opts = {}) {
  let s = `${name}=${encodeURIComponent(value)}`;
  if (opts.maxAge != null) s += `; Max-Age=${Math.floor(opts.maxAge)}`;
  s += `; Path=${opts.path || '/'}`;
  if (opts.httpOnly !== false) s += '; HttpOnly'; // JS から読めないようにする
  s += `; SameSite=${opts.sameSite || 'Lax'}`;
  if (opts.secure !== false) s += '; Secure';
  return s;
}

// 複数の Set-Cookie を安全に追加する
function appendCookie(res, cookieStr) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', cookieStr);
  else if (Array.isArray(prev)) res.setHeader('Set-Cookie', prev.concat(cookieStr));
  else res.setHeader('Set-Cookie', [prev, cookieStr]);
}

function randomToken() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { SCOPE, getConfig, parseCookies, serializeCookie, appendCookie, randomToken };
