// Renova o access token do Google e inicia uma sessão de upload resumível no YouTube.
// O corpo do vídeo é enviado depois, diretamente do navegador para a uploadUrl retornada
// (assim o arquivo não passa pelo servidor, evitando o limite de tamanho de corpo do Vercel).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { title, description, tags } = req.body || {};

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'Falha ao renovar token do Google', details: tokenData });
    }
    const accessToken = tokenData.access_token;

    const metadata = {
      snippet: {
        title: (title || 'Sem título').slice(0, 100),
        description: description || '',
        tags: (tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      },
      status: { privacyStatus: 'public' },
    };

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/*',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const details = await initRes.text();
      return res.status(500).json({ error: 'Falha ao iniciar upload no YouTube', details });
    }

    const uploadUrl = initRes.headers.get('location');
    res.status(200).json({ uploadUrl, accessToken });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
