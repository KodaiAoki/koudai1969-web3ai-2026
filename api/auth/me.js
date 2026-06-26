// GET /api/auth/me — ログイン状態のみを返す（トークン本体は返さない）
const { parseCookies } = require('../_lib/google');

module.exports = (req, res) => {
  const c = parseCookies(req);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ loggedIn: !!c.uf_at });
};
