// Publica na Página do Facebook.
//  - vídeo: tenta com botão de WhatsApp; se o Facebook recusar, publica sem botão
//  - imagens: 1 foto, ou várias fotos em um único post (aparecem em grade, na ordem enviada)
const G = 'https://graph.facebook.com/v19.0';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { videoUrl, imageUrls, caption } = req.body || {};
    const pageId = process.env.FB_PAGE_ID;
    const token = process.env.META_ACCESS_TOKEN;
    // Número do WhatsApp (apenas dígitos, com DDI). Pode ser sobrescrito pela env WHATSAPP_NUMBER.
    const whatsapp = (process.env.WHATSAPP_NUMBER || '5513997595234').replace(/\D/g, '');

    const post = async (path, params) => {
      const r = await fetch(`${G}/${pageId}/${path}?${new URLSearchParams({ ...params, access_token: token })}`, { method: 'POST' });
      return r.json();
    };

    // ----- Imagens -----
    const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
    if (!videoUrl && urls.length) {
      if (urls.length === 1) {
        const d = await post('photos', { url: urls[0], caption: caption || '' });
        const id = d.post_id || d.id;
        if (!id) return res.status(500).json({ error: 'Falha ao publicar a foto no Facebook', details: d });
        return res.status(200).json({ id, cta: null });
      }
      // várias fotos: sobe cada uma sem publicar e depois junta em um post
      const photos = await Promise.all(urls.map((u) => post('photos', { url: u, published: 'false' })));
      const bad = photos.findIndex((p) => !p.id);
      if (bad !== -1) return res.status(500).json({ error: `Falha ao enviar a imagem ${bad + 1} ao Facebook`, details: photos[bad] });
      const params = { message: caption || '' };
      photos.forEach((p, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: p.id }); });
      const d = await post('feed', params);
      if (!d.id) return res.status(500).json({ error: 'Falha ao publicar as fotos no Facebook', details: d });
      return res.status(200).json({ id: d.id, cta: null });
    }

    // ----- Vídeo -----
    const base = { file_url: videoUrl, description: caption || '' };
    const cta = JSON.stringify({
      type: 'WHATSAPP_MESSAGE',
      value: { link: `https://wa.me/${whatsapp}`, app_destination: 'WHATSAPP' },
    });
    let data = await post('videos', { ...base, call_to_action: cta });
    if (data.id) return res.status(200).json({ ...data, cta: true });

    const ctaError = data.error ? data.error.message : JSON.stringify(data);

    data = await post('videos', base);
    if (!data.id) return res.status(500).json({ error: 'Falha ao publicar no Facebook', details: data });
    res.status(200).json({ ...data, cta: false, ctaError });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
