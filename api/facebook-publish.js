export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { videoUrl, caption } = req.body || {};
    const pageId = process.env.FB_PAGE_ID;
    const token = process.env.META_ACCESS_TOKEN;

    const params = new URLSearchParams({ file_url: videoUrl, description: caption || '', access_token: token });
    const r = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos?${params}`, { method: 'POST' });
    const data = await r.json();
    if (!data.id) return res.status(500).json({ error: 'Falha ao publicar no Facebook', details: data });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
