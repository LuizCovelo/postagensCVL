# Painel de Publicação — Grupo CVL

Envia um vídeo para YouTube, Instagram (Reels) e Facebook a partir de um único painel.
O vídeo passa temporariamente por um repositório no GitHub (para gerar uma URL pública que o Instagram e o Facebook exigem) e você pode apagá-lo de lá com um clique depois de publicado.

**Aviso importante:** enquanto o vídeo estiver no GitHub, o repositório precisa ser **público**, então o arquivo fica acessível a quem tiver o link (não listado, mas não é privado). Use o botão "Apagar vídeo do GitHub" assim que a publicação terminar. O GitHub tem limite prático de ~100&nbsp;MB por arquivo via API — mantenha os vídeos comprimidos abaixo de 90&nbsp;MB.

---

## 1. Criar o repositório no GitHub

1. Crie um repositório novo, **público**, por exemplo `cvl-video-publisher`.
2. Dentro dele, este projeto será enviado (passo 5) e uma pasta `videos/` será criada automaticamente pelo painel a cada envio — não precisa criar antes.

## 2. Gerar o Personal Access Token do GitHub

1. Vá em **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Em **Repository access**, selecione **Only select repositories** e escolha o repositório criado no passo 1.
3. Em **Permissions → Repository permissions**, defina **Contents: Read and write**.
4. Gere e copie o token (ele só aparece uma vez). Você vai colar esse token dentro do painel, na seção "Conexão com o GitHub" — ele fica salvo apenas no seu navegador.

## 3. YouTube (Google Cloud)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com), crie um projeto.
2. Em **APIs e serviços → Biblioteca**, ative a **YouTube Data API v3**.
3. Em **APIs e serviços → Tela de consentimento OAuth**, configure como **Externo** e adicione seu e-mail do YouTube como usuário de teste (não precisa publicar o app).
4. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **App para Desktop**. Anote o **Client ID** e o **Client Secret**.
5. Para obter o **refresh token** (feito uma única vez):
   - Acesse [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground).
   - Clique no ícone de engrenagem, marque **Use your own OAuth credentials** e cole o Client ID e Client Secret do passo 4.
   - Na lista de escopos à esquerda, cole manualmente: `https://www.googleapis.com/auth/youtube.upload`.
   - Clique **Authorize APIs**, faça login com a conta dona do canal do YouTube.
   - Clique **Exchange authorization code for tokens** e copie o **Refresh token** gerado.

Você terá: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.

## 4. Instagram + Facebook (Meta)

Pré-requisito: a conta do Instagram precisa ser **Business ou Criador de Conteúdo**, vinculada a uma **Página do Facebook**.

1. Acesse [developers.facebook.com](https://developers.facebook.com) → **Meus Apps → Criar App** → tipo **Empresa**.
2. No painel do app, adicione o produto **Instagram Graph API** (e mantenha o Facebook Login se pedido).
3. Vá em [Graph API Explorer](https://developers.facebook.com/tools/explorer/), selecione o seu app.
4. Em **Permissions**, adicione: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`. Gere o **User Access Token**.
5. Troque esse token por um de longa duração (60 dias): chame no Explorer ou via URL
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=SEU_APP_ID&client_secret=SEU_APP_SECRET&fb_exchange_token=TOKEN_CURTO`.
6. Com o token de longa duração, chame `GET /me/accounts` — pegue o **access_token da Página** (esse é o `META_ACCESS_TOKEN`, e normalmente não expira enquanto o app estiver ativo) e o **id da Página** (`FB_PAGE_ID`).
7. Chame `GET /{FB_PAGE_ID}?fields=instagram_business_account` para pegar o **IG_USER_ID**.

Você terá: `META_ACCESS_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`.

## 5. Deploy no Vercel

1. Suba esta pasta para o repositório do GitHub criado no passo 1 (pode ser via GitHub Desktop, `git push`, ou fazendo upload dos arquivos pela interface web do GitHub).
2. Em [vercel.com](https://vercel.com), **Add New → Project**, importe esse repositório.
3. O Vercel detecta as funções em `/api` e a pasta `/public` automaticamente — não precisa configurar build command.
4. Em **Settings → Environment Variables**, adicione as 6 variáveis reunidas nos passos 3 e 4 (use `.env.example` como referência).
5. Clique **Deploy**. Ao terminar, você terá uma URL do tipo `https://seu-projeto.vercel.app`.

## 6. Usar o painel

1. Abra a URL do Vercel.
2. Na seção "Conexão com o GitHub", preencha o token (passo 2), o usuário/organização e o nome do repositório. Fica salvo no navegador.
3. Cole o roteiro no formato de exemplo e clique em **Preencher campos**.
4. Revise/edite título, descrição, tags e legendas.
5. Selecione o arquivo de vídeo.
6. Clique **Publicar nas 3 plataformas** e acompanhe o log — a página avisa em cada etapa (GitHub → YouTube → Instagram → Facebook).
7. Ao final, clique **Apagar vídeo do GitHub**.

## Estrutura dos arquivos

```
cvl-publisher/
├── public/index.html      → o painel
├── api/youtube-init.js    → renova token do Google e inicia upload no YouTube
├── api/instagram-create.js
├── api/instagram-status.js
├── api/instagram-publish.js
├── api/facebook-publish.js
├── package.json
├── vercel.json
└── .env.example
```
