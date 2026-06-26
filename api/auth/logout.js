// GET /api/auth/logout — トークン Cookie を破棄してランディングへ戻す
const { serializeCookie, appendCookie } = require('../_lib/google');

module.exports = (req, res) => {
  appendCookie(res, serializeCookie('uf_at', '', { maxAge: 0 }));
  res.writeHead(302, { Location: '/lectures/lecture9/' });
  res.end();
};
