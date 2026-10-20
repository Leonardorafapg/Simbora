# Simbora MCP

Servidor MCP (streamable HTTP) que expõe o CRM Simbora a apps de IA (Claude, Codex, Gemini, Antigravity).
É uma camada fina sobre a API REST do `backend/`: regras e permissões continuam todas no backend.

**Login por usuário.** Cada pessoa entra com o próprio email e senha do Simbora (OAuth 2.1 + PKCE). O backend
emite os tokens (`/oauth/*`); o MCP só valida cada token em `POST {BACKEND_URL}/oauth/introspect` (cache de 60 s).
As tools rodam com as **permissões daquele usuário** — as mesmas do CRM web. Não existe mais conta de serviço.
Desenho completo em [`docs/plano-mcp-oauth.md`](../docs/plano-mcp-oauth.md).

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `BACKEND_URL` | URL pública do backend, sem `/api/v1` |
| `OAUTH_ISSUER_URL` | Igual ao `PUBLIC_API_URL` do backend (é o servidor de login) |
| `MCP_RESOURCE_URL` | URL pública deste MCP **com `/mcp` no fim** (ex.: `https://simbora-mcp.up.railway.app/mcp`) |
| `MCP_INTROSPECTION_SECRET` | Segredo compartilhado com o backend (mesmo valor nos dois serviços) |
| `PORT` | Definida pela Railway |

O servidor não sobe se faltar alguma das quatro primeiras.

**No backend** (além do que já existia): `PUBLIC_API_URL`, `MCP_RESOURCE_URL` (igual ao do MCP),
`MCP_INTROSPECTION_SECRET` (igual ao do MCP) e, opcionais, `OAUTH_ACCESS_TOKEN_MINUTES` (60),
`OAUTH_REFRESH_TOKEN_DAYS` (30) e `OAUTH_EXTRA_REDIRECT_HOSTS` (hosts HTTPS extras aceitos como retorno do login).
Gerar segredo: `python -c "import secrets;print(secrets.token_urlsafe(48))"`.

## Como conectar

URL única: `https://<dominio-do-mcp>/mcp`. Na primeira chamada o app abre o navegador na tela de login do
Simbora; ali a pessoa vê o que o app pede e pode desmarcar "Criar e editar" ou "Apagar".

| Cliente | Como adicionar | Como autenticar |
|---|---|---|
| **Claude Code** | `claude mcp add --transport http simbora https://<mcp>/mcp` | `/mcp` → simbora → Authenticate |
| **Claude.ai / Desktop** | Configurações → Conectores → Adicionar conector personalizado → URL | Botão "Conectar" |
| **Codex CLI** | `~/.codex/config.toml`: `[mcp_servers.simbora]` com `url = "https://<mcp>/mcp"` | `codex mcp login simbora` |
| **Gemini CLI** | `~/.gemini/settings.json`: `"mcpServers": {"simbora": {"httpUrl": "https://<mcp>/mcp"}}` | Automático no 1º uso, ou `/mcp auth simbora` |
| **Antigravity** | `mcp_config.json`: `"simbora": {"serverUrl": "https://<mcp>/mcp"}` | Se não abrir o login sozinho, usar a ponte abaixo |
| **Só stdio** | `{"command": "npx", "args": ["-y", "mcp-remote", "https://<mcp>/mcp"]}` | `mcp-remote` faz o OAuth no navegador |

> Codex, Gemini CLI e Antigravity não foram testados aqui — confirme a configuração de cada um no primeiro uso.
> O fluxo (descoberta → registro → login → token) foi validado com o cliente MCP do SDK oficial.
> Se um cliente voltar o login para um host que não é `localhost` nem `claude.ai`/`claude.com`, adicione-o em
> `OAUTH_EXTRA_REDIRECT_HOSTS` no backend (nunca abra a lista toda).

Quem conectou vê e desconecta os apps em **Configurações → Conexões de IA** no CRM. Trocar a senha de alguém,
desativar ou apagar o usuário derruba as conexões dele.

## Rodar local

```bash
# backend (porta 8010)
cd backend
PUBLIC_API_URL=http://127.0.0.1:8010 MCP_RESOURCE_URL=http://127.0.0.1:8100/mcp \
MCP_INTROSPECTION_SECRET=<48+ chars> python -m uvicorn app.main:app --port 8010

# mcp (porta 8100)
cd mcp
pip install -r requirements.txt
BACKEND_URL=http://127.0.0.1:8010 OAUTH_ISSUER_URL=http://127.0.0.1:8010 \
MCP_RESOURCE_URL=http://127.0.0.1:8100/mcp MCP_INTROSPECTION_SECRET=<mesmo valor> PORT=8100 python server.py
```

Teste interativo: `npx @modelcontextprotocol/inspector` → Streamable HTTP → `http://127.0.0.1:8100/mcp` → Quick OAuth Flow.
Testes: `cd backend && python -m pytest tests` e `cd mcp && python -m pytest tests`.

## Escopos e limites

A conexão tem três escopos, escolhidos na tela de login: `crm.read` (sempre), `crm.write` (criar/editar) e
`crm.delete` (apagar/finalizar). Eles são um teto *a mais*: o que a pessoa pode fazer continua sendo o que as
permissões dela no CRM permitem. Além disso, um token MCP só alcança as rotas de clientes, calendário, etiquetas,
busca, equipe (`/team/*`, `/users/directory`) e upload por URL — nunca WhatsApp, Instagram, senhas nem rotas de
administrador, mesmo que o dono seja admin. Ao criar uma tool nova que use outra rota, inclua-a em
`MCP_ALLOWED_PREFIXES` (`backend/app/services/oauth.py`).

## Tools

Leitura: `list_clients`, `list_team`, `search`,
`list_calendar_entries`, `get_calendar_entry`, `get_calendar_period`.

Escrita (`crm.write`): `create_calendar_entry`,
`update_calendar_entry`, `import_calendar` (prévia por padrão), `upload_image_from_url`,
`create_client`, `update_client`.

Equipe (perfil, nunca senha): `list_team_members`, `list_permissions`, `create_team_member`,
`create_team_members` (lote, prévia por padrão), `update_team_member`. A conta nasce sem senha utilizável;
um admin define a senha no painel (Equipe → membro → Alterar senha). Nunca cria/edita administrador,
não concede permissão que o próprio usuário não tem e não edita a si mesmo.

Apagar/finalizar (`crm.delete` + `confirm=true`): `delete_calendar_entry`, `delete_client` (recusa se o cliente
tiver postagens; exige a permissão `client.delete`), e `set_calendar_period_status` ao finalizar (trava o mês).

Cada chamada gera uma linha de log JSON (`"audit": "mcp_tool"`) com tool, usuário, app, argumentos, resultado e tempo.
