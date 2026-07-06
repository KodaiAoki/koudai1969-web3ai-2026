// GET /api/auth/callback — Google から code を受け取り、サーバ側でトークンに交換する
// client_secret を使った交換はここ（サーバ）でのみ行い、アクセストークンは
// HttpOnly Cookie に格納する（フロントの JS からは読めない）。
const { getConfig, parseCookies, serializeCookie, appendCookie } = require('../_lib/google');

const LANDING = '/lectures/lecture10/';
const DASHBOARD = '/lectures/lecture10/dashboard.html';

module.exports = async (req, res) => {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const { code, state, error } = req.query;
  const cookies = parseCookies(req);

  if (error) {
    res.writeHead(302, { Location: `${LANDING}?error=${encodeURIComponent(error)}` });
    res.end();
    return;
  }
  // state 検証（CSRF 対策）
  if (!code || !state || state !== cookies.uf_state) {
    res.writeHead(302, { Location: `${LANDING}?error=invalid_state` });
    res.end();
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tok = await tokenRes.json();

    if (!tok.access_token) {
      res.writeHead(302, { Location: `${LANDING}?error=token_exchange` });
      res.end();
      return;
    }

    // state Cookie をクリアし、アクセストークンを HttpOnly Cookie に保存
    appendCookie(res, serializeCookie('uf_state', '', { maxAge: 0 }));
    appendCookie(res, serializeCookie('uf_at', tok.access_token, {
      maxAge: tok.expires_in || 3600,
      sameSite: 'Lax',
    }));

    res.writeHead(302, { Location: DASHBOARD });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: `${LANDING}?error=server` });
    res.end();
  }
};
