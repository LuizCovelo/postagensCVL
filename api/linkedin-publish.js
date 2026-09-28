// Baixa o vídeo (URL pública do GitHub) e publica no perfil pessoal do LinkedIn.
const API = 'https://api.linkedin.com/rest';
const CHUNK_PARALLEL = 4;

// A "legenda" do LinkedIn usa um formato com caracteres reservados; sem escapar, o texto é cortado.
const escapeCommentary = (t) => String(t || '').replace(/[\\|{}@\[\]()<>*_~]/g, '\\$&').slice(0, 3000);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { videoUrl, caption, title, token, personId } = req.body || {};
    if (!videoUrl || !token || !personId) {
      return res.status(400).json({ error: 'videoUrl, token e personId são obrigatórios' });
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      'LinkedIn-Version': process.env.LINKEDIN_VERSION || '202604',
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };
    const owner = `urn:li:person:${personId}`;

    // 1. Baixar o vídeo do GitHub (com novas tentativas)
    let videoRes = null;
    for (let i = 0; i < 5; i++) {
      videoRes = await fetch(videoUrl, { cache: 'no-store' });
      if (videoRes.ok) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!videoRes || !videoRes.ok) {
      return res.status(500).json({ error: 'Falha ao baixar o vídeo do GitHub', details: `status ${videoRes && videoRes.status}` });
    }
    const buf = Buffer.from(await videoRes.arrayBuffer());

    // 2. Iniciar o upload
    const initRes = await fetch(`${API}/videos?action=initializeUpload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: buf.length, uploadCaptions: false, uploadThumbnail: false } }),
    });
    const initData = await initRes.json();
    if (!initRes.ok || !initData.value) {
      return res.status(initRes.status === 401 ? 401 : 500).json({ error: 'Falha ao iniciar upload no LinkedIn', details: initData });
    }
    const { video, uploadToken, uploadInstructions } = initData.value;

    // 3. Enviar as partes (em pequenos lotes paralelos) e guardar os ETags
    const etags = new Array(uploadInstructions.length);
    for (let i = 0; i < uploadInstructions.length; i += CHUNK_PARALLEL) {
      const batch = uploadInstructions.slice(i, i + CHUNK_PARALLEL).map(async (ins, k) => {
        const part = buf.subarray(ins.firstByte, ins.lastByte + 1);
        const up = await fetch(ins.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: part });
        if (!up.ok) throw new Error(`Falha ao enviar parte ${i + k + 1} (status ${up.status})`);
        etags[i + k] = up.headers.get('etag');
      });
      await Promise.all(batch);
    }

    // 4. Finalizar o upload
    const finRes = await fetch(`${API}/videos?action=finalizeUpload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ finalizeUploadRequest: { video, uploadToken: uploadToken || '', uploadedPartIds: etags } }),
    });
    if (!finRes.ok) {
      return res.status(500).json({ error: 'Falha ao finalizar upload no LinkedIn', details: await finRes.text() });
    }

    // 5. Criar o post
    const postRes = await fetch(`${API}/posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        author: owner,
        commentary: escapeCommentary(caption),
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        content: { media: { title: String(title || 'Vídeo').slice(0, 200), id: video } },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!postRes.ok) {
      return res.status(500).json({ error: 'Falha ao criar o post no LinkedIn', details: await postRes.text() });
    }
    res.status(200).json({ id: postRes.headers.get('x-restli-id') || video });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
