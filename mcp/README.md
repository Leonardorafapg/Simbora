# Simbora MCP

Servidor MCP (streamable HTTP) que expõe o CRM Simbora ao Claude. É uma camada fina sobre a
API REST do `backend/`: regras e permissões continuam todas no backend.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `BACKEND_URL` | URL pública do backend, sem `/api/v1` |
| `MCP_SERVICE_EMAIL` | Email da conta de serviço (usuário **não admin**, domínio de email válido) |
| `MCP_SERVICE_PASSWORD` | Senha da conta de serviço |
| `MCP_PATH_SECRET` | Segredo (>= 24 caracteres) que faz parte da URL do MCP. O servidor não sobe sem ele |
| `PORT` | Definida pela Railway |

URL do conector: `https://<domínio>/<MCP_PATH_SECRET>/mcp` — trate a URL inteira como segredo.

## Permissões mínimas da conta de serviço

`client.view`, `client.create`, `client.edit`, `calendar.view`, `calendar.create`, `calendar.edit`,
Para gestão de equipe: `team.view`, `team.create`,
`team.edit`. Para habilitar as tools de apagar: `calendar.delete`.

## Rodar local

```bash
pip install -r requirements.txt
BACKEND_URL=http://127.0.0.1:8000 MCP_SERVICE_EMAIL=... MCP_SERVICE_PASSWORD=... \
MCP_PATH_SECRET=<24+ chars> PORT=8100 python server.py
```

## Tools

Leitura: `list_clients`, `list_team`, `search`,
`list_calendar_entries`, `get_calendar_entry`, `get_calendar_period`.

Escrita: `create_calendar_entry`,
`update_calendar_entry`, `import_calendar` (prévia por padrão), `upload_image_from_url`,
`create_client`, `update_client`.

Equipe (perfil, nunca senha): `list_team_members`, `list_permissions`, `create_team_member`,
`create_team_members` (lote, prévia por padrão), `update_team_member`. A conta nasce sem senha utilizável;
um admin define a senha no painel (Equipe → membro → Alterar senha). Nunca cria/edita administrador,
não concede permissão que a conta de serviço não tem e não edita a si mesma.

Exigem `confirm=true`: `delete_calendar_entry`, `delete_client` (recusa se o cliente
tiver postagens; exige a permissão `client.delete`), e `set_calendar_period_status`
ao finalizar (trava o mês).

Cada chamada gera uma linha de log JSON (`"audit": "mcp_tool"`) com tool, argumentos, resultado e tempo.
