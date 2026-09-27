export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { videoUrl, caption } = req.body || {};
    const igUserId = process.env.IG_USER_ID;
    const token = process.env.META_ACCESS_TOKEN;

    const params = new URLSearchParams({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption || '',
      access_token: token,
    });

    const r = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media?${params}`, { method: 'POST' });
    const data = await r.json();
    if (!data.id) return res.status(500).json({ error: 'Falha ao criar container do Instagram', details: data });
    res.status(200).json({ creationId: data.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
