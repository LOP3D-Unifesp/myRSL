# myRSL

Aplicacao React + Vite para gestao de artigos de revisao sistematica, com autenticacao e backend Supabase.

## Rodar localmente

```bash
npm ci
npm run dev
```

## Build local

```bash
npm run build
```

## GitHub Pages (repositorio novo)

Repositorio: `https://github.com/LOP3D-Unifesp/myRSL`

Deploy automatico:
- workflow: `.github/workflows/deploy-github-pages.yml`
- branch: `main`

URL esperada do site:
- `https://lop3d-unifesp.github.io/myRSL/`

## Como habilitar no GitHub

1. Abra o repositorio `LOP3D-Unifesp/myRSL`.
2. Va em `Settings` > `Pages`.
3. Em `Source`, selecione `GitHub Actions`.
4. Va em `Settings` > `Secrets and variables` > `Actions` e crie os secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Faça push na `main` (ou rode manualmente o workflow em `Actions`).
6. Acompanhe o workflow `Deploy GitHub Pages`.

## Notas de deploy

- `vite.config.ts` usa `base` de producao em `/myRSL/` para funcionar no subpath do Pages.
- O workflow copia `dist/index.html` para `dist/404.html` para fallback de rotas SPA.

## Seguranca (abril/2026)

- `chat-with-pdf` exige `articleId` e valida ownership (`articles.user_id = auth.uid()`), bloqueando acesso cruzado.
- As edge functions usam CORS com allowlist (`ALLOWED_ORIGINS`), com fallback para localhost e dominio Pages da org.
- Rate limit foi migrado para storage compartilhado (`public.edge_rate_limits` + `public.consume_edge_rate_limit`).
- Extracao de PDF valida MIME (`application/pdf`) e assinatura `%PDF-` no backend.
