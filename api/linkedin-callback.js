// Recebe o retorno do LinkedIn, troca o code pelo token e devolve ao painel via #fragmento
// (o fragmento não é enviado a servidores; o painel guarda o token no navegador).
export default async function handler(req, res) {
  const back = (params) => res.redirect(302, `/index.html#${new URLSearchParams(params)}`);
  try {
    const { code, state, error, error_description } = req.query;
    if (error) return back({ li_error: error_description || error });
    if (!code) return back({ li_error: 'Código de autorização ausente' });

    const redirectUri = `https://${req.headers.host}/api/linkedin-callback`;
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return back({ li_error: tokenData.error_description || tokenData.error || 'Falha ao obter token do LinkedIn' });
    }

    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const me = await meRes.json();
    if (!me.sub) return back({ li_error: 'Não foi possível ler o perfil do LinkedIn' });

    back({
      li_token: tokenData.access_token,
      li_sub: me.sub,
      li_name: me.name || '',
      li_exp: String(tokenData.expires_in || 5184000),
      li_state: String(state || ''),
    });
  } catch (e) {
    back({ li_error: e.message });
  }
}
