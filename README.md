# data-extraction-rsl

Aplicação React + Vite para gestão de artigos de revisão sistemática, com autenticação e backend Supabase.

## Rodar localmente

```bash
npm ci
npm run dev
```

## Build local

```bash
npm run build
```

## Publicação no GitHub Pages (sem `main`)

Este repositório está configurado para publicar automaticamente no GitHub Pages quando houver push na branch:

`codex/security-data-plan-implementation`

### URL esperada

Após o deploy, a URL pública padrão será:

`https://gabriellyvettore-bit.github.io/data-extraction-rsl/`

### Como habilitar no GitHub

1. Abra o repositório no GitHub.
2. Vá em `Settings` > `Pages`.
3. Em `Source`, selecione `GitHub Actions`.
4. Faça push na branch `codex/security-data-plan-implementation`.
5. Acompanhe o workflow em `Actions` (`Deploy GitHub Pages`).

### Compartilhar com a orientadora

Depois do workflow concluir com sucesso, envie o link:

`https://gabriellyvettore-bit.github.io/data-extraction-rsl/`

## Notas de deploy

- O `vite.config.ts` usa `base` de produção em `/data-extraction-rsl/` para funcionar no subpath do Pages.
- O deploy gera `404.html` a partir de `index.html` para fallback de rotas SPA (refresh em `/articles/...`).

## Seguranca (abril/2026)

- `chat-with-pdf` agora exige `articleId` e valida ownership (`articles.user_id = auth.uid()`), bloqueando acesso cruzado entre usuarios.
- As edge functions usam CORS com allowlist (`ALLOWED_ORIGINS` por variavel de ambiente; fallback para localhost + GitHub Pages).
- Rate limit foi migrado para storage compartilhado (`public.edge_rate_limits` + `public.consume_edge_rate_limit`), removendo dependencia de `Map` em memoria.
- Extracao de PDF valida MIME (`application/pdf`) e assinatura do arquivo (`%PDF-`) no backend.
