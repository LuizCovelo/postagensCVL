// Baixa o vídeo ou as imagens (URLs públicas do GitHub) e publica no perfil pessoal do LinkedIn.
//  - vídeo: post de vídeo
//  - 1 imagem: post de imagem
//  - 2+ imagens: post com várias imagens (grade), na ordem enviada
// "footer" (rodapé, ex.: link do WhatsApp) é acrescentado ao final do texto só aqui.
const API = 'https://api.linkedin.com/rest';
const CHUNK_PARALLEL = 4;
const MAX_TEXT = 3000;

// A "legenda" do LinkedIn usa um formato com caracteres reservados; sem escapar, o texto é cortado.
const esc = (t) => String(t || '').replace(/[\\|{}@\[\]()<>*_~]/g, '\\$&');

// Junta legenda + rodapé sem deixar o rodapé ser cortado pelo limite de caracteres.
function buildCommentary(caption, footer) {
  const f = esc(String(footer || '').trim());
  let body = esc(caption);
  if (!f) return trimEsc(body, MAX_TEXT);
  body = trimEsc(body, MAX_TEXT - f.length - 2);
  return `${body}\n\n${f}`;
}
function trimEsc(s, max) {
  if (s.length <= max) return s;
  let out = s.slice(0, Math.max(0, max));
  const trailing = out.match(/\\+$/); // não deixar uma barra de escape solta no fim
  if (trailing && trailing[0].length % 2 === 1) out = out.slice(0, -1);
  return out;
}

async function download(url) {
  let r = null;
  for (let i = 0; i < 5; i++) {
    r = await fetch(url, { cache: 'no-store' });
    if (r.ok) break;
    await new Promise((x) => setTimeout(x, 2000));
  }
  if (!r || !r.ok) throw new Error(`Falha ao baixar do GitHub (status ${r && r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

async function uploadImage(url, owner, headers, token) {
  const buf = await download(url);
  const initRes = await fetch(`${API}/images?action=initializeUpload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const init = await initRes.json();
  if (!initRes.ok || !init.value) {
    const err = new Error('Falha ao iniciar upload de imagem no LinkedIn');
    err.status = initRes.status; err.details = init; throw err;
  }
  const up = await fetch(init.value.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: buf,
  });
  if (!up.ok) throw new Error(`Falha ao enviar imagem ao LinkedIn (status ${up.status})`);
  return init.value.image; // urn:li:image:...
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const { videoUrl, imageUrls, caption, footer, title, token, personId } = req.body || {};
    const images = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
    if ((!videoUrl && !images.length) || !token || !personId) {
      return res.status(400).json({ error: 'videoUrl (ou imageUrls), token e personId são obrigatórios' });
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      'LinkedIn-Version': process.env.LINKEDIN_VERSION || '202604',
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };
    const owner = `urn:li:person:${personId}`;
    let content;

    if (!videoUrl) {
      // ----- Imagens -----
      let urns;
      try {
        urns = await Promise.all(images.map((u) => uploadImage(u, owner, headers, token)));
      } catch (e) {
        return res.status(e.status === 401 ? 401 : 500).json({ error: e.message, details: e.details });
      }
      content = urns.length === 1
        ? { media: { title: String(title || 'Imagem').slice(0, 200), id: urns[0] } }
        : { multiImage: { images: urns.map((id) => ({ id, altText: String(title || 'Imagem').slice(0, 120) })) } };
    } else {
      // ----- Vídeo -----
      const buf = await download(videoUrl);
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

      const finRes = await fetch(`${API}/videos?action=finalizeUpload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ finalizeUploadRequest: { video, uploadToken: uploadToken || '', uploadedPartIds: etags } }),
      });
      if (!finRes.ok) {
        return res.status(500).json({ error: 'Falha ao finalizar upload no LinkedIn', details: await finRes.text() });
      }
      content = { media: { title: String(title || 'Vídeo').slice(0, 200), id: video } };
    }

    // ----- Criar o post -----
    const postRes = await fetch(`${API}/posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        author: owner,
        commentary: buildCommentary(caption, footer),
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        content,
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!postRes.ok) {
      return res.status(500).json({ error: 'Falha ao criar o post no LinkedIn', details: await postRes.text() });
    }
    res.status(200).json({ id: postRes.headers.get('x-restli-id') || 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
