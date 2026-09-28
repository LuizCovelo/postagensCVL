export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { videoUrl, caption } = req.body || {};
    const pageId = process.env.FB_PAGE_ID;
    const token = process.env.META_ACCESS_TOKEN;
    // Número do WhatsApp (apenas dígitos, com DDI). Pode ser sobrescrito pela env WHATSAPP_NUMBER.
    const whatsapp = (process.env.WHATSAPP_NUMBER || '5513997595234').replace(/\D/g, '');

    const base = { file_url: videoUrl, description: caption || '', access_token: token };

    // Tentativa 1 (experimental): com botão de WhatsApp
    const cta = JSON.stringify({
      type: 'WHATSAPP_MESSAGE',
      value: { link: `https://wa.me/${whatsapp}`, app_destination: 'WHATSAPP' },
    });
    let r = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos?${new URLSearchParams({ ...base, call_to_action: cta })}`, { method: 'POST' });
    let data = await r.json();
    if (data.id) return res.status(200).json({ ...data, cta: true });

    const ctaError = data.error ? data.error.message : JSON.stringify(data);

    // Tentativa 2: sem botão (comportamento original)
    r = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos?${new URLSearchParams(base)}`, { method: 'POST' });
    data = await r.json();
    if (!data.id) return res.status(500).json({ error: 'Falha ao publicar no Facebook', details: data });
    res.status(200).json({ ...data, cta: false, ctaError });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
