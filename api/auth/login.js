// GET /api/auth/login — Google の同意画面へリダイレクトして OAuth を開始する
const { getConfig, serializeCookie, appendCookie, randomToken } = require('../_lib/google');

module.exports = (req, res) => {
  const { clientId, redirectUri, scope } = getConfig();
  if (!clientId) {
    res.status(500).send('設定エラー: GOOGLE_CLIENT_ID が未設定です（Vercel 環境変数を確認）');
    return;
  }

  // CSRF 対策の state を発行し、検証用に短命 Cookie に保存
  const state = randomToken();
  appendCookie(res, serializeCookie('uf_state', state, { maxAge: 600, sameSite: 'Lax' }));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });

  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  res.end();
};
