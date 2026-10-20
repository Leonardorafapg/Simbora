# Plano — MCP com login OAuth por usuário

> Documento de execução. Cada fase tem **o que fazer**, **arquivos**, **detalhes** e **critério de pronto**.
> Execute em ordem, um commit por fase, rodando os testes ao fim de cada uma.

## 0. Contexto e objetivo

**Hoje**

- `mcp/server.py` (FastMCP, streamable HTTP, `stateless_http=True`) é protegido só por um segredo no caminho da URL (`/{MCP_PATH_SECRET}/mcp`).
- `mcp/client.py` (`BackendClient`) faz login no backend com **uma conta de serviço fixa** (`MCP_SERVICE_EMAIL` / `MCP_SERVICE_PASSWORD`). Todo mundo que usa o MCP age como essa conta.
- O backend (`backend/`, FastAPI) já tem tudo que importa para autorização por usuário:
  - JWT HS256 de sessão (`app/core/security.py`, `create_access_token` / `decode_access_token`);
  - `get_current_user`, `require_admin`, `require_permission(key)` em `app/core/deps.py`;
  - catálogo de permissões granulares em `app/core/permissions.py` (`client.view`, `calendar.edit`, …), `is_admin` vê tudo;
  - travas anti-escalada em `app/routers/team.py` que já usam o usuário chamador.

**Objetivo**

Qualquer cliente MCP (Claude Code, Claude.ai/Desktop, Codex, Gemini CLI, Antigravity) conecta em `https://<mcp>/mcp`, recebe 401, abre o navegador numa tela de login do Simbora, a pessoa entra com **o próprio email e senha** e, a partir daí, cada tool roda **com as permissões daquela pessoa** — exatamente as mesmas do CRM web. Nada de conta de serviço.

**Padrão seguido:** especificação de autorização do MCP (OAuth 2.1 + PKCE S256, RFC 9728 Protected Resource Metadata, RFC 8414 Authorization Server Metadata, RFC 7591 Dynamic Client Registration, RFC 8707 `resource`).

## 1. Arquitetura escolhida

```
 Cliente MCP (Claude/Codex/Gemini/Antigravity)
    │ 1. POST /mcp sem token  → 401 + WWW-Authenticate: resource_metadata=...
    │ 2. GET  <mcp>/.well-known/oauth-protected-resource/mcp  → authorization_servers=[BACKEND]
    │ 3. GET  <backend>/.well-known/oauth-authorization-server
    │ 4. POST <backend>/oauth/register  (DCR)
    │ 5. navegador → <backend>/oauth/authorize  → tela de login Simbora → redirect com ?code
    │ 6. POST <backend>/oauth/token  (code + code_verifier) → access_token + refresh_token
    │ 7. POST /mcp  Authorization: Bearer <access_token>
    ▼
 MCP (resource server, sem banco)
    │ valida o token chamando POST <backend>/oauth/introspect (cache 60s)
    │ repassa o MESMO bearer para a API REST do backend
    ▼
 Backend (authorization server + API)
    get_current_user aceita o token MCP, checa grant não revogado, escopo e rotas permitidas,
    e as permissões do usuário (has_permission) decidem o resto — como já é hoje.
```

Decisões e por quê:

| Decisão | Motivo |
|---|---|
| **Backend é o Authorization Server** | Já é dono dos usuários, senhas e permissões; tem banco. O MCP continua sem estado. |
| **MCP é só Resource Server** (`token_verifier` do SDK) | O SDK `mcp` já gera o 401 correto e o endpoint `/.well-known/oauth-protected-resource`. |
| **Introspecção em vez de validar JWT no MCP** | O MCP não precisa conhecer `SECRET_KEY` (quem tem essa chave consegue forjar token de qualquer um). |
| **Access token = JWT curto (60 min) com `typ="mcp_access"` e `aud=<MCP_RESOURCE_URL>`** | O backend distingue de sessão do CRM, e checa revogação pelo `gid` (grant) a cada request. |
| **Refresh token opaco, guardado só como hash, com rotação** | Revogável; reutilização de refresh antigo revoga a conexão inteira (detecção de roubo). |
| **Escopos `crm.read`, `crm.write`, `crm.delete`** | Teto adicional por conexão. O teto real continua sendo a permissão do usuário. |
| **Lista de rotas permitidas para token MCP** | Token vazado de um cliente de IA não serve para mandar WhatsApp, mexer em senha etc. |
| **Novo serviço Railway em paralelo, depois desliga o antigo** | Zero downtime e sem código de "modo duplo". |

## 2. Variáveis de ambiente

**Backend (novas)**

| Variável | Exemplo | Uso |
|---|---|---|
| `PUBLIC_API_URL` *(já existe)* | `https://simbora-backend.up.railway.app` | Vira o `issuer` OAuth. Sem barra final. **Obrigatória** para o OAuth funcionar. |
| `MCP_RESOURCE_URL` | `https://simbora-mcp.up.railway.app/mcp` | `aud` dos tokens e valor aceito de `resource`. |
| `MCP_INTROSPECTION_SECRET` | 48+ chars aleatórios | Segredo compartilhado só entre MCP e backend para `/oauth/introspect`. |
| `OAUTH_ACCESS_TOKEN_MINUTES` | `60` | Validade do access token MCP. |
| `OAUTH_REFRESH_TOKEN_DAYS` | `30` | Validade do refresh (renova a cada uso). |
| `OAUTH_EXTRA_REDIRECT_HOSTS` | `""` | Hosts HTTPS extras aceitos como redirect (vírgula). |

**MCP (substituem as atuais)**

| Variável | Uso |
|---|---|
| `BACKEND_URL` *(mantém)* | URL do backend. |
| `OAUTH_ISSUER_URL` | Igual ao `PUBLIC_API_URL` do backend. |
| `MCP_RESOURCE_URL` | Igual ao do backend. |
| `MCP_INTROSPECTION_SECRET` | Igual ao do backend. |
| ~~`MCP_SERVICE_EMAIL`, `MCP_SERVICE_PASSWORD`, `MCP_PATH_SECRET`~~ | **Removidas** no serviço novo. |

---

## Fase 1 — Modelos e config do backend

**Arquivos:** `backend/app/core/config.py`, `backend/app/models/oauth.py` (novo), `backend/app/models/__init__.py`.

1. Em `Settings` (`config.py`) adicionar as variáveis da seção 2 com defaults (`MCP_RESOURCE_URL: str = ""`, `MCP_INTROSPECTION_SECRET: str = ""`, `OAUTH_ACCESS_TOKEN_MINUTES: int = 60`, `OAUTH_REFRESH_TOKEN_DAYS: int = 30`, `OAUTH_EXTRA_REDIRECT_HOSTS: str = ""`).
2. Criar `app/models/oauth.py` com 4 tabelas (seguir o estilo de `models/user.py`: `Mapped`, `mapped_column`, `JSONText` de `app.core.types`, datas UTC):

   - **`OAuthClient`** (`oauth_clients`) — cliente registrado via DCR.
     `id` int pk · `client_id` str(64) unique index (gerado com `secrets.token_urlsafe(24)`) · `client_secret_hash` str nullable (só se o cliente pedir auth com secret) · `client_name` str(200) · `redirect_uris` JSONText (lista) · `token_endpoint_auth_method` str(40) (`none` | `client_secret_post` | `client_secret_basic`) · `created_at` · `last_used_at` nullable.
   - **`OAuthGrant`** (`oauth_grants`) — "uma conexão de IA" de um usuário. É o que aparece na tela e o que se revoga.
     `id` int pk · `user_id` fk users · `client_pk` fk oauth_clients.id · `scope` str (escopos separados por espaço) · `resource` str · `created_at` · `last_used_at` nullable · `revoked_at` nullable.
   - **`OAuthAuthorizationCode`** (`oauth_authorization_codes`).
     `id` pk · `code_hash` str(64) unique · `client_pk` fk · `user_id` fk · `redirect_uri` str · `code_challenge` str · `scope` str · `resource` str · `expires_at` · `used_at` nullable.
   - **`OAuthRefreshToken`** (`oauth_refresh_tokens`).
     `id` pk · `token_hash` str(64) unique index · `grant_id` fk oauth_grants · `expires_at` · `rotated_at` nullable · `revoked_at` nullable · `created_at`.

3. Importar os modelos em `app/models/__init__.py` (ou onde os outros são importados antes do `create_all`) para que `run_light_migrations()` → `Base.metadata.create_all` crie as tabelas. **Não precisa ALTER**: são tabelas novas.

**Regra geral:** nenhum segredo (code, refresh token, client secret) é guardado em claro — sempre `hashlib.sha256(valor.encode()).hexdigest()`, comparando com `hmac.compare_digest`.

**Pronto quando:** backend sobe local e as 4 tabelas existem no SQLite.

---

## Fase 2 — Serviço OAuth (lógica, sem HTTP)

**Arquivo:** `backend/app/services/oauth.py` (novo). Toda a regra fica aqui; o router só traduz HTTP.

Constantes:

```python
SCOPES = {"crm.read": "Ler clientes, calendário e equipe",
          "crm.write": "Criar e editar",
          "crm.delete": "Apagar"}
DEFAULT_SCOPES = ["crm.read", "crm.write", "crm.delete"]
CODE_TTL = timedelta(minutes=5)
TOKEN_TYP = "mcp_access"
```

Funções (assinaturas sugeridas):

1. `issuer() -> str` — `settings.PUBLIC_API_URL.rstrip("/")`; levanta erro claro se vazio.
2. `is_redirect_allowed(uri: str) -> bool`
   - `http://localhost:<qualquer porta>/...` e `http://127.0.0.1:<porta>/...` → permitido (RFC 8252, usado por Claude Code, Codex, Gemini CLI).
   - `https://` cujo host está em `{"claude.ai", "claude.com"} ∪ OAUTH_EXTRA_REDIRECT_HOSTS` → permitido.
   - Qualquer outro (inclui `http` não-loopback, esquemas custom, fragmentos `#`) → negado.
   - Motivo: o DCR é aberto; sem allowlist, alguém registra um cliente com redirect para o próprio site e manda o link de login para um funcionário (phishing de código).
3. `register_client(db, payload: dict) -> dict` — valida `redirect_uris` (lista não vazia, todas permitidas), `client_name` (default "Cliente MCP", corta em 200), `token_endpoint_auth_method` (default `none`; se for `client_secret_post`/`client_secret_basic`, gera secret, guarda hash e devolve o secret uma única vez). Resposta no formato RFC 7591: `client_id`, `client_id_issued_at`, `client_name`, `redirect_uris`, `grant_types=["authorization_code","refresh_token"]`, `response_types=["code"]`, `token_endpoint_auth_method`, e `client_secret` se houver.
4. `validate_authorize_request(db, params) -> AuthorizeRequest` — exige `response_type=code`, `client_id` existente, `redirect_uri` **exatamente** igual a um dos registrados, `code_challenge` presente e `code_challenge_method=S256` (rejeitar `plain`), `resource` igual a `MCP_RESOURCE_URL` (ignorar barra final; se ausente, assumir `MCP_RESOURCE_URL`), `scope` ⊆ `SCOPES` (ausente → `DEFAULT_SCOPES`), `state` opcional (repassar intacto).
   - Erros **antes** de validar client/redirect → mostrar página de erro (nunca redirecionar para URI não validada).
   - Erros depois → redirect para `redirect_uri?error=...&state=...`.
5. `authenticate_user(db, email, password) -> User | None` — mesma regra de `routers/auth.py::login` (ativo + `verify_password`). Extrair essa checagem para reaproveitar nos dois lugares.
6. `create_authorization_code(db, req, user, scopes) -> str` — `secrets.token_urlsafe(32)`, salva hash, expira em 5 min.
7. `exchange_code(db, client, code, redirect_uri, code_verifier, resource) -> TokenPair`
   - busca pelo hash; recusa se expirado, `used_at` preenchido, `client_pk` diferente, `redirect_uri` diferente ou `resource` diferente;
   - PKCE: `base64url(sha256(code_verifier))` sem padding == `code_challenge`;
   - **código reutilizado** → revoga o grant que ele gerou (se houver) e responde `invalid_grant`;
   - marca `used_at`, cria `OAuthGrant` (um grant por autorização), emite par de tokens.
8. `issue_tokens(db, grant) -> TokenPair`
   - access token: `jwt.encode({"typ": "mcp_access", "iss": issuer(), "aud": MCP_RESOURCE_URL, "sub": str(user_id), "client_id": client.client_id, "gid": grant.id, "scope": grant.scope, "iat": now, "exp": now + OAUTH_ACCESS_TOKEN_MINUTES, "jti": token_urlsafe(8)}, SECRET_KEY, HS256)`;
   - refresh token: `secrets.token_urlsafe(48)`, salva hash, expira em `OAUTH_REFRESH_TOKEN_DAYS`;
   - retorna `{"access_token", "token_type": "Bearer", "expires_in", "refresh_token", "scope"}`.
9. `refresh(db, client, refresh_token, scope=None) -> TokenPair`
   - busca pelo hash; recusa se expirado/revogado/grant revogado/usuário inativo/cliente diferente;
   - **se `rotated_at` já preenchido (reuso)** → revoga o grant inteiro e todos os refresh dele; `invalid_grant`;
   - marca `rotated_at`, emite par novo; `scope` pedido só pode ser subconjunto do do grant.
10. `decode_mcp_access_token(db, token) -> McpTokenInfo | None` — `jwt.decode(..., audience=MCP_RESOURCE_URL, issuer=issuer())`, exige `typ == "mcp_access"`, carrega o grant, recusa se `revoked_at`, carrega o usuário, recusa se inativo. Atualiza `grant.last_used_at` no máximo 1x por minuto (evita escrita em toda request). Retorna `user`, `scopes: set[str]`, `grant_id`, `client_id`.
11. `revoke_grant(db, grant)` e `revoke_all_for_user(db, user_id)` — preenchem `revoked_at` no grant e nos refresh tokens.
12. `introspect(db, token) -> dict` — `{"active": False}` se inválido; senão `{"active": True, "sub", "client_id", "scope", "exp", "aud", "iss", "token_type": "Bearer", "username": email}`.

**Pronto quando:** funções testáveis isoladamente (testes vêm na Fase 6, mas pode escrever junto).

---

## Fase 3 — Endpoints OAuth no backend

**Arquivos:** `backend/app/routers/oauth.py` (novo), `backend/app/main.py`, `backend/app/routers/auth.py` (só extrair a checagem de senha).

Registrar o router **sem** o prefixo `/api/v1` (o metadata precisa estar na raiz do issuer): `app.include_router(oauth.router)`.

| Método e rota | O que faz |
|---|---|
| `GET /.well-known/oauth-authorization-server` | JSON RFC 8414: `issuer`, `authorization_endpoint` (`{issuer}/oauth/authorize`), `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `introspection_endpoint`, `response_types_supported=["code"]`, `grant_types_supported=["authorization_code","refresh_token"]`, `code_challenge_methods_supported=["S256"]`, `token_endpoint_auth_methods_supported=["none","client_secret_post","client_secret_basic"]`, `scopes_supported=list(SCOPES)`. |
| `GET /.well-known/openid-configuration` | Mesmo JSON (alguns clientes procuram aqui primeiro). |
| `POST /oauth/register` | DCR. Body JSON. 201 com a resposta da Fase 2. Erro: 400 `{"error": "invalid_redirect_uri" \| "invalid_client_metadata", "error_description"}`. Rate limit por IP (ex.: 20/hora). |
| `GET /oauth/authorize` | Valida a requisição; renderiza a **tela de login** (HTML). |
| `POST /oauth/authorize` | Recebe o formulário; autentica; cria code; `303` para `redirect_uri?code=...&state=...`. |
| `POST /oauth/token` | `application/x-www-form-urlencoded`. `grant_type=authorization_code` ou `refresh_token`. Autentica o cliente conforme o método dele (público: só `client_id`). Respostas com `Cache-Control: no-store`. Erros RFC 6749: `{"error": "invalid_grant" \| "invalid_client" \| "invalid_request" \| "unsupported_grant_type"}` com 400 (ou 401 em `invalid_client`). |
| `POST /oauth/revoke` | RFC 7009: aceita refresh token (revoga o grant) ou access token (revoga o grant pelo `gid`). Sempre 200. |
| `POST /oauth/introspect` | RFC 7662. Exige `Authorization: Bearer <MCP_INTROSPECTION_SECRET>` (comparar com `hmac.compare_digest`; se o secret do backend estiver vazio, responder 503). Body form `token=...`. |

**Tela de login (`GET /oauth/authorize`)** — HTML inline com `HTMLResponse`, igual ao estilo do callback do Instagram em `routers/instagram.py`. Conteúdo:

- logo/nome Simbora, texto **"<client_name> quer acessar o CRM Simbora em seu nome"** e o **host do redirect** visível (ex.: "vai voltar para localhost:53412" / "claude.ai") — o usuário precisa ver para onde o acesso vai;
- lista dos escopos pedidos com checkbox (marcados por padrão; `crm.read` obrigatório/desabilitado). O que for desmarcado não entra no grant;
- campos email e senha, botão "Entrar e autorizar", botão "Cancelar" (→ redirect com `error=access_denied`);
- campo hidden `request`: JWT assinado com `SECRET_KEY`, `purpose="mcp_authorize"`, expira em 10 min, contendo os parâmetros já validados (client_id, redirect_uri, code_challenge, scope, resource, state). O POST **só confia nesse JWT**, não em campos soltos;
- CSRF (double submit): no GET gerar `csrf = token_urlsafe(32)`, gravar cookie `mcp_oauth_csrf` (`HttpOnly; Secure; SameSite=Lax; Path=/oauth`) e incluir o mesmo valor em hidden; no POST comparar;
- cabeçalhos: `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:; form-action 'self'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`;
- escapar **todo** texto vindo do cliente (`client_name`, host) com `html.escape` — o `client_name` vem do DCR, é dado de terceiro;
- erro de senha: re-renderiza a mesma tela com "Email ou senha inválidos" (sem dizer qual).

**Rate limit de login** — não existe hoje. Criar `backend/app/core/rate_limit.py` simples em memória (dict + janela deslizante, `threading.Lock`): 10 tentativas por IP e 5 por email a cada 15 min no `POST /oauth/authorize`. Documentar que é por instância (Railway roda 1 réplica). Usar `request.client.host`, mas se houver `X-Forwarded-For` (Railway), pegar o primeiro IP.

**Pronto quando:** dá para fazer o fluxo completo à mão com `curl` + navegador (ver Fase 6).

---

## Fase 4 — Backend aceitando o token MCP

**Arquivos:** `backend/app/core/deps.py`, `backend/app/routers/users.py` (troca de senha), `backend/app/routers/auth.py`.

1. **`get_current_user`** passa a receber `request: Request`:
   - decodifica o JWT sem confiar em nada ainda; se `payload.get("typ") == "mcp_access"` → chama `oauth.decode_mcp_access_token`; senão segue o caminho atual (sessão do CRM) **inalterado**.
   - Atenção: `decode_access_token` atual não verifica `aud`. Um JWT com `aud` falha no `jwt.decode` do PyJWT quando não se passa `audience` — então o caminho de sessão precisa continuar recusando tokens MCP (bom) e o caminho MCP precisa passar `audience`. Testar os dois.
   - Para token MCP, guardar em `request.state.mcp = McpTokenInfo(...)` e aplicar **duas travas** antes de devolver o usuário:
     - **Escopo por método HTTP:** `GET/HEAD` → `crm.read`; `POST/PUT/PATCH` → `crm.write`; `DELETE` → `crm.delete`. Faltou → 403 `"Esta conexão de IA não tem o escopo <x>. Reconecte autorizando esse acesso."`.
     - **Rotas permitidas** (prefixos após `/api/v1`): `/auth/me`, `/clients`, `/calendar-entries`, `/calendar-periods`, `/tags`, `/search`, `/users/directory`, `/team/members`, `/team/permissions`, `/uploads/from-url`. Fora disso → 403 `"Rota não disponível via MCP"`. Manter a lista numa constante em `services/oauth.py` com comentário dizendo que precisa crescer junto com as tools do MCP.
2. **`require_admin`**: se `request.state.mcp` existir → 403 sempre (rotas de admin — senha, `/users`, criar admin — nunca via IA, nem para admin).
3. `require_permission` não muda: continua usando `has_permission(user, key)`, que lê o usuário do banco a cada request → mudar permissão no CRM vale na hora para o MCP.
4. **Revogação automática:**
   - `PUT /users/{id}/password` (users.py) → `oauth.revoke_all_for_user(db, user_id)`;
   - desativar usuário (`is_active=False` em users.py e team.py) → idem (o check de `is_active` já bloqueia, mas revogar deixa a tela de conexões coerente);
   - `DELETE /users/{id}` → idem antes de apagar (ou o FK quebra; alternativamente `ondelete="CASCADE"` nos FKs de grant).
5. Nada muda para o CRM web: tokens de sessão não têm `typ` e seguem o caminho antigo.

**Pronto quando:** testes da Fase 6 de "escopo", "rota bloqueada", "admin bloqueado" e "sessão do CRM continua funcionando" passam.

---

## Fase 5 — Servidor MCP como Resource Server

**Arquivos:** `mcp/server.py`, `mcp/client.py`, `mcp/auth.py` (novo), `mcp/requirements.txt`, `mcp/README.md`, `mcp/railway.json`.

1. **`mcp/auth.py`** — verificador por introspecção:

   ```python
   from mcp.server.auth.provider import AccessToken, TokenVerifier

   class SimboraAccessToken(AccessToken):
       user_id: int
       email: str

   class IntrospectionVerifier(TokenVerifier):
       async def verify_token(self, token: str) -> AccessToken | None:
           # cache: dict[sha256(token)] -> (SimboraAccessToken, expira_em) com TTL 60s
           #        (nunca além do exp do token); sem cache negativo.
           # POST {BACKEND_URL}/oauth/introspect, header Authorization: Bearer MCP_INTROSPECTION_SECRET,
           #      form token=...; timeout 5s.
           # active=False, aud != MCP_RESOURCE_URL ou erro de rede -> None (o SDK responde 401).
           # active=True -> SimboraAccessToken(token=token, client_id=..., scopes=scope.split(),
           #      expires_at=exp, resource=aud, user_id=int(sub), email=username)
   ```

   Conferir no SDK instalado (`pip show mcp`, versão ≥ 1.30) os nomes exatos: `mcp.server.auth.provider.TokenVerifier`/`AccessToken`, `mcp.server.auth.settings.AuthSettings`, `mcp.server.auth.middleware.auth_context.get_access_token`. Se algum mudou, adaptar mantendo a lógica.

2. **`server.py` — construção do FastMCP:**
   - remover `PATH_SECRET` e o `sys.exit` dele;
   - validar no boot que `BACKEND_URL`, `OAUTH_ISSUER_URL`, `MCP_RESOURCE_URL`, `MCP_INTROSPECTION_SECRET` existem (sair com mensagem clara se faltar);
   - `FastMCP(..., streamable_http_path="/mcp", token_verifier=IntrospectionVerifier(), auth=AuthSettings(issuer_url=OAUTH_ISSUER_URL, resource_server_url=MCP_RESOURCE_URL, required_scopes=["crm.read"]))`;
   - conferir com `curl` que o SDK publica `/.well-known/oauth-protected-resource/mcp` (ou `/.well-known/oauth-protected-resource`, depende da versão) com `authorization_servers: [OAUTH_ISSUER_URL]`, e que `POST /mcp` sem token devolve 401 com `WWW-Authenticate: Bearer ... resource_metadata="..."`;
   - `/health` continua público.

3. **Escopo por tipo de tool** (no `audited` ou em wrappers próprios): pegar `get_access_token()`; `write_tool` exige `crm.write`, `danger_tool` exige `crm.delete`. Faltou → `ToolError("Esta conexão não tem permissão de <escrita|apagar>. Reconecte o MCP autorizando esse acesso.")`. É redundante com o backend de propósito: dá mensagem clara antes de qualquer chamada.

4. **Auditoria:** no log JSON do `audited`, incluir `"user_id"`, `"email"` e `"client_id"` do token. Manter o mascaramento de CPF.

5. **`client.py` — `BackendClient`:**
   - remover `email`, `password`, `_token`, `_token_exp`, `_lock`, `_login`, `_get_token`, `_check_config` da conta de serviço;
   - `request()` pega o bearer de `get_access_token().token` (se `None` → `ToolError("Sem usuário autenticado")`) e manda no header;
   - 401 do backend → `ToolError("Sua sessão no Simbora expirou ou foi revogada. Reconecte o MCP.")` (sem retry);
   - em `_format_error`, a mensagem de 403 genérica muda de "a conta de serviço do MCP não tem a permissão necessária" para "Você não tem permissão para essa ação no CRM. Peça a um administrador.";
   - manter um único `httpx.AsyncClient` compartilhado (o token vai por request, não no client).

6. **Ajustes de texto:** docstrings/`NEXT_STEP`/README que falam em "conta de serviço" passam a falar "seu usuário". O `INSTRUCTIONS` ganha uma linha: "As ações rodam com as permissões do usuário logado; se algo for negado, explique qual permissão falta em vez de tentar contornar."

7. **README do MCP:** reescrever seções de variáveis, "como conectar" (seção 7 deste plano) e remover "Permissões mínimas da conta de serviço".

8. `requirements.txt`: manter `mcp>=1.30,<2` e `httpx`; subir o mínimo se a API de auth exigir.

**Pronto quando:** o MCP Inspector (Fase 6) conecta, faz login no navegador e lista/chama tools com o usuário certo.

---

## Fase 6 — Testes

### 6.1 Backend — `backend/tests/test_mcp_oauth.py` (pytest, reutiliza `conftest.py`)

Adicionar ao topo do `conftest.py` (antes de importar `app`): `PUBLIC_API_URL=https://api.test`, `MCP_RESOURCE_URL=https://mcp.test/mcp`, `MCP_INTROSPECTION_SECRET=intro-secret-...`. Criar fixture `member` (usuário não-admin com `client.view`, `calendar.view`, `calendar.edit`) e um helper `do_oauth_flow(test_client, user, scopes=None) -> tokens` que registra cliente, faz GET/POST do authorize (lendo csrf do cookie e o `request` do HTML) e troca o code.

Casos mínimos:

1. Metadata AS tem `issuer=https://api.test` e `S256`.
2. DCR aceita `http://localhost:1234/callback` e `https://claude.ai/api/mcp/auth_callback`; recusa `https://evil.com/cb` e `http://evil.com/cb`.
3. Authorize com `redirect_uri` não registrado → página de erro, **sem** redirect.
4. Authorize sem `code_challenge` ou com `plain` → erro.
5. Senha errada → re-renderiza com erro; após 5 tentativas no mesmo email → 429.
6. POST sem cookie CSRF ou com valor diferente → 400.
7. Fluxo completo → access token funciona em `GET /api/v1/clients` com o usuário certo (`/auth/me` devolve o member).
8. Code reutilizado → `invalid_grant` e o grant gerado na primeira troca fica revogado.
9. `code_verifier` errado → `invalid_grant`.
10. Refresh gira o token; usar o refresh **antigo** de novo → `invalid_grant` e o novo access token passa a dar 401.
11. Token só com `crm.read` → `GET /clients` 200, `POST /clients` 403 com a mensagem de escopo.
12. Token MCP em rota fora da lista (`GET /api/v1/whatsapp/chats`) → 403 mesmo para admin.
13. Token MCP de admin em `GET /api/v1/users` (require_admin) → 403.
14. Permissão do usuário continua mandando: member sem `client.create` com escopo `crm.write` → `POST /clients` 403 "Permissão insuficiente".
15. Trocar a senha do usuário (`PUT /users/{id}/password` como admin) → token MCP dele vira 401 e o refresh falha.
16. Usuário desativado → introspecção `active=false`.
17. `/oauth/introspect` sem o secret → 401; com secret e token de **sessão do CRM** → `active=false`.
18. Token de sessão do CRM continua funcionando em todas as rotas (regressão).
19. `/oauth/revoke` com refresh → grant revogado, access token 401.

Rodar: `cd backend && python -m pytest tests`.

### 6.2 MCP — `mcp/tests/test_auth.py` (novo, pytest + `httpx.MockTransport`)

- introspecção ativa → `SimboraAccessToken` com `user_id` e escopos;
- `active=false`, `aud` diferente, timeout → `None`;
- cache: duas verificações seguidas → 1 chamada ao backend.

### 6.3 Ponta a ponta local

1. Backend: `PUBLIC_API_URL=http://127.0.0.1:8010 MCP_RESOURCE_URL=http://127.0.0.1:8100/mcp MCP_INTROSPECTION_SECRET=... python -m uvicorn app.main:app --port 8010` (em dev, permitir `http://127.0.0.1` como issuer).
2. MCP: `BACKEND_URL=http://127.0.0.1:8010 OAUTH_ISSUER_URL=http://127.0.0.1:8010 MCP_RESOURCE_URL=http://127.0.0.1:8100/mcp MCP_INTROSPECTION_SECRET=... PORT=8100 python server.py`.
3. `npx @modelcontextprotocol/inspector` → transporte Streamable HTTP → `http://127.0.0.1:8100/mcp` → "Open Auth Settings" → "Quick OAuth Flow". Conferir: tela de login aparece, login funciona, `list_clients` retorna, `delete_client` sem escopo `crm.delete` é recusado.
4. `claude mcp add --transport http simbora-local http://127.0.0.1:8100/mcp`, depois `/mcp` no Claude Code → autenticar → usar uma tool.
5. Repetir com dois usuários de permissões diferentes e confirmar que cada um só vê/faz o que pode no CRM.

---

## Fase 7 — Tela "Conexões de IA" no CRM

Sem isso ninguém consegue ver nem revogar acessos sem mexer no banco.

**Backend** (`routers/oauth.py`, com prefixo `/api/v1`, autenticado por sessão normal — **recusar token MCP** nessas rotas para a IA não conseguir revogar/listar conexões):

- `GET /api/v1/oauth/grants` → conexões ativas do usuário logado: `id`, `client_name`, `scope`, `created_at`, `last_used_at`.
- `DELETE /api/v1/oauth/grants/{id}` → revoga se for do próprio usuário, ou se o chamador for admin.
- `GET /api/v1/oauth/grants?user_id=<id>` → só admin (para revogar conexões de quem saiu da equipe).

**CRM** (seguir `crm/AGENTS.md` e o padrão de `app/api/tags/[id]/route.ts` com `backendFetch`/`proxyJson`):

- `crm/app/api/ai-connections/route.ts` (GET) e `crm/app/api/ai-connections/[id]/route.ts` (DELETE);
- `crm/services/client/aiConnectionsApi.ts`, `crm/types/aiConnection.ts`;
- `crm/components/settings/AiConnectionsCard.tsx` — lista com nome do app, escopos em linguagem humana ("Ler", "Criar e editar", "Apagar"), "conectado em", "último uso", botão "Desconectar" com `ConfirmDialog`. Estado vazio explicando como conectar (link/instrução da seção 7). Incluir o card em `SettingsPageClient.tsx` abaixo do `WhatsAppConnectionCard`;
- opcional: no `TeamMemberDetail` (admin), seção "Conexões de IA" com revogar.
- Ler o guia do Next em `crm/node_modules/next/dist/docs/` antes, como pede o `AGENTS.md`.

Verificar no navegador (preview `crm` + `backend-ig` do `.claude/launch.json`): conectar via Inspector, ver a conexão aparecer, desconectar, conferir que o Inspector passa a receber 401.

---

## Fase 8 — Deploy e migração

1. **Backend (Railway):** configurar `MCP_RESOURCE_URL`, `MCP_INTROSPECTION_SECRET` (gerar com `python -c "import secrets;print(secrets.token_urlsafe(48))"`), conferir `PUBLIC_API_URL`. Deploy. Tabelas nascem sozinhas.
2. **MCP novo:** criar **outro serviço** Railway a partir de `mcp/` (ex.: `simbora-mcp-auth`) com as variáveis novas; domínio próprio → esse é o `MCP_RESOURCE_URL` (com `/mcp`). Healthcheck `/health`.
3. Conferir em produção:
   - `curl -i -X POST https://<mcp>/mcp` → 401 com `WWW-Authenticate`;
   - `curl https://<backend>/.well-known/oauth-authorization-server`.
4. Piloto: uma pessoa conecta pelo Claude e pelo Codex; comparar o que ela consegue fazer com as permissões dela no CRM.
5. Todos migram para a URL nova.
6. Desligar o serviço MCP antigo; **desativar a conta de serviço** no CRM (Equipe → desativar); apagar `MCP_SERVICE_EMAIL`/`MCP_SERVICE_PASSWORD`/`MCP_PATH_SECRET` do Railway.

---

## 7. Como cada cliente conecta (vai no README do MCP)

URL única: `https://<dominio-do-mcp>/mcp`. Em todos, a primeira chamada abre o navegador na tela de login do Simbora.

| Cliente | Como adicionar | Como autenticar |
|---|---|---|
| **Claude Code** | `claude mcp add --transport http simbora https://<mcp>/mcp` | `/mcp` → simbora → Authenticate |
| **Claude.ai / Desktop** | Configurações → Conectores → Adicionar conector personalizado → URL | Botão "Conectar" (redirect `https://claude.ai/api/mcp/auth_callback`, já na allowlist) |
| **Codex CLI** | `~/.codex/config.toml`: `[mcp_servers.simbora]` com `url = "https://<mcp>/mcp"` | `codex mcp login simbora` |
| **Gemini CLI** | `~/.gemini/settings.json`: `"mcpServers": {"simbora": {"httpUrl": "https://<mcp>/mcp"}}` | Automático no 1º uso, ou `/mcp auth simbora` |
| **Antigravity** | `mcp_config.json`: `"simbora": {"serverUrl": "https://<mcp>/mcp"}` | Se não abrir o login sozinho, usar a ponte abaixo |
| **Qualquer cliente só-stdio** | `{"command": "npx", "args": ["-y", "mcp-remote", "https://<mcp>/mcp"]}` | `mcp-remote` faz o OAuth no navegador (redirect em localhost) |

> Os detalhes de configuração de Codex, Gemini e Antigravity mudam com frequência — **validar cada um na Fase 8, passo 4**, e ajustar o README com o que funcionou de fato. Se algum cliente exigir um host de redirect que não é loopback nem claude.ai, adicionar em `OAUTH_EXTRA_REDIRECT_HOSTS` (nunca abrir a allowlist inteira).

---

## 8. Checklist de segurança (revisar antes do merge)

- [ ] Nenhum segredo OAuth gravado em claro (code, refresh, client secret) — só SHA-256.
- [ ] PKCE S256 obrigatório; `plain` recusado.
- [ ] `redirect_uri` comparado por igualdade exata com o registrado; allowlist de hosts no DCR.
- [ ] Nunca redirecionar para URI não validada (erros iniciais viram página).
- [ ] Code: 5 min, uso único, reuso revoga o grant.
- [ ] Refresh: rotação + detecção de reuso.
- [ ] Access token MCP com `aud` e `typ` checados; token de sessão do CRM **não** é aceito pelo MCP (introspecção dá `active=false`).
- [ ] MCP não conhece `SECRET_KEY`; introspecção protegida por secret próprio.
- [ ] Tela de login: CSRF, `frame-ancestors 'none'`, `html.escape` em tudo que vem do cliente, host de retorno visível.
- [ ] Rate limit no login do OAuth e no DCR.
- [ ] Token MCP: escopo por método, lista de rotas, `require_admin` sempre bloqueado.
- [ ] Rotas de gerenciar conexões recusam token MCP.
- [ ] Trocar senha / desativar / apagar usuário revoga as conexões.
- [ ] Logs de auditoria com `user_id`; nenhum token aparece em log (cuidado com logs de URL contendo `code`).
- [ ] `SECRET_KEY` de produção não é o default `change-me-in-env` (adicionar checagem no boot se `PUBLIC_API_URL` for https).

## 9. Fora do escopo (futuro)

- Client ID Metadata Documents (registro de cliente sem DCR, previsto na spec MCP mais nova) — adicionar quando algum cliente exigir.
- Login social/SSO na tela de autorização.
- Reaproveitar a sessão do CRM (se já estiver logado no CRM, pular a senha e só mostrar o consentimento).
- Rate limit distribuído (Redis) se o backend passar a ter mais de uma réplica.
- Tools novas no MCP (WhatsApp, Instagram): cada uma exige adicionar a rota na lista da Fase 4.
