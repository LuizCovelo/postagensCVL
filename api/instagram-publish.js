export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { creationId } = req.body || {};
    const igUserId = process.env.IG_USER_ID;
    const token = process.env.META_ACCESS_TOKEN;

    const params = new URLSearchParams({ creation_id: creationId, access_token: token });
    const r = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish?${params}`, { method: 'POST' });
    const data = await r.json();
    if (!data.id) return res.status(500).json({ error: 'Falha ao publicar no Instagram', details: data });
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
