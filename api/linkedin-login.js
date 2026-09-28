// Redireciona o navegador para a tela de autorização do LinkedIn.
export default function handler(req, res) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) return res.status(500).send('LINKEDIN_CLIENT_ID não configurado no Vercel.');
  const state = String(req.query.state || '');
  const redirectUri = `https://${req.headers.host}/api/linkedin-callback`;
  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'openid profile w_member_social');
  res.redirect(302, url.toString());
}
