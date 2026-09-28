// Cria o "container" de mídia no Instagram.
//  - vídeo  -> Reels
//  - 1 imagem -> foto simples
//  - 2 a 10 imagens -> carrossel (a ordem de imageUrls é a ordem dos slides)
const G = 'https://graph.facebook.com/v19.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFinished(id, token, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${G}/${id}?fields=status_code&access_token=${token}`);
    const d = await r.json();
    if (d.status_code === 'FINISHED') return true;
    if (d.status_code === 'ERROR') return false;
    await sleep(2000);
  }
  return true; // segue; o painel ainda confere o container principal
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { videoUrl, imageUrls, caption } = req.body || {};
    const igUserId = process.env.IG_USER_ID;
    const token = process.env.META_ACCESS_TOKEN;

    const create = async (params) => {
      const r = await fetch(`${G}/${igUserId}/media?${new URLSearchParams({ ...params, access_token: token })}`, { method: 'POST' });
      return r.json();
    };

    // Vídeo (Reels)
    if (videoUrl) {
      const data = await create({ media_type: 'REELS', video_url: videoUrl, caption: caption || '' });
      if (!data.id) return res.status(500).json({ error: 'Falha ao criar container do Instagram', details: data });
      return res.status(200).json({ creationId: data.id });
    }

    const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
    if (urls.length < 1 || urls.length > 10) {
      return res.status(400).json({ error: 'Envie de 1 a 10 imagens para o Instagram' });
    }

    // 1 imagem
    if (urls.length === 1) {
      const data = await create({ image_url: urls[0], caption: caption || '' });
      if (!data.id) return res.status(500).json({ error: 'Falha ao criar container da imagem no Instagram', details: data });
      return res.status(200).json({ creationId: data.id });
    }

    // Carrossel: um container por imagem (em paralelo; Promise.all mantém a ordem)
    const kids = await Promise.all(urls.map((u) => create({ image_url: u, is_carousel_item: 'true' })));
    const bad = kids.findIndex((k) => !k.id);
    if (bad !== -1) {
      return res.status(500).json({ error: `Falha ao criar a imagem ${bad + 1} do carrossel no Instagram`, details: kids[bad] });
    }
    const ids = kids.map((k) => k.id);
    const okList = await Promise.all(ids.map((id) => waitFinished(id, token)));
    const failed = okList.findIndex((ok) => !ok);
    if (failed !== -1) {
      return res.status(500).json({ error: `O Instagram recusou a imagem ${failed + 1} do carrossel (confira se é JPEG e a proporção)` });
    }

    const parent = await create({ media_type: 'CAROUSEL', children: ids.join(','), caption: caption || '' });
    if (!parent.id) return res.status(500).json({ error: 'Falha ao criar o carrossel no Instagram', details: parent });
    res.status(200).json({ creationId: parent.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
