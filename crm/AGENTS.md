# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Notably: the `middleware.ts` convention is deprecated — this project uses `proxy.ts` (exporting `proxy`), which runs on the Node.js runtime.

# Sobre este app

App interno (CRM) da Simbora — uso operacional da equipe, não é o site público.

- Domínio alvo: `app.simbora.com` ou `crm.simbora.com` (a definir).
- Site público/LP vive em `../frontend` (projeto Next separado).
- Backend em `../backend` (FastAPI). O CRM nunca chama o backend direto do
  browser: passa sempre pelas Route Handlers em `app/api/*`, que anexam o JWT
  guardado num cookie httpOnly.

# Convenções de pastas

| Pasta | Conteúdo |
|---|---|
| `app/` | **Somente rotas** — páginas e Route Handlers. Sem lógica de negócio. |
| `components/<feature>/` | Componentes da feature. `components/ui/` para primitivos reutilizáveis. |
| `hooks/` | Estado e efeitos de cliente (`use*`). |
| `services/server/` | Código **server-only** (usa `next/headers`, segredos, chama o backend). |
| `services/client/` | Chamadas do browser para as rotas `app/api/*`. |
| `lib/` | Funções puras, sem estado nem I/O (formatação, regras de permissão). |
| `types/` | Tipos compartilhados. |

`proxy.ts` fica na raiz por exigência do Next. Ele importa apenas
`services/server/session.ts`, que é propositalmente livre de `next/headers` —
para ler a sessão em Server Components use `getSession()` de
`services/server/auth.ts`.

# Permissões

`lib/permissions.ts` espelha `backend/app/core/permissions.py`. As checagens no
front são de UX; a autorização real é sempre reavaliada no backend a cada
requisição (o nível dentro do JWT pode estar desatualizado até o token expirar).
