// Renova o access token do Google, baixa o vídeo (a partir da URL pública do GitHub)
// e faz o upload inteiro no YouTube, tudo no servidor (evita o erro de CORS que acontece
// quando o navegador tenta enviar o vídeo direto para o Google).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { title, description, tags, videoUrl } = req.body || {};
    if (!videoUrl) {
      return res.status(400).json({ error: 'videoUrl não informado' });
    }

    // 1. Renovar o access token do Google
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

    // 2. Baixar o vídeo do GitHub (servidor a servidor, sem CORS)
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      return res.status(500).json({ error: 'Falha ao baixar o vídeo do GitHub', details: `status ${videoRes.status}` });
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const contentType = videoRes.headers.get('content-type') || 'video/mp4';

    // 3. Iniciar a sessão de upload resumível no YouTube
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
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(videoBuffer.length),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const details = await initRes.text();
      return res.status(500).json({ error: 'Falha ao iniciar upload no YouTube', details });
    }

    const uploadUrl = initRes.headers.get('location');

    // 4. Enviar os bytes do vídeo para a uploadUrl (servidor a servidor)
    const upRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
        'Content-Length': String(videoBuffer.length),
      },
      body: videoBuffer,
    });

    const upData = await upRes.json();
    if (!upRes.ok) {
      return res.status(500).json({ error: 'Falha ao enviar vídeo ao YouTube', details: upData });
    }

    res.status(200).json({ id: upData.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
