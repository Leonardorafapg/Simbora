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
`demand.view`, `demand.create`, `demand.edit`. Para habilitar as tools de apagar:
`calendar.delete` e `demand.delete`.

## Rodar local

```bash
pip install -r requirements.txt
BACKEND_URL=http://127.0.0.1:8000 MCP_SERVICE_EMAIL=... MCP_SERVICE_PASSWORD=... \
MCP_PATH_SECRET=<24+ chars> PORT=8100 python server.py
```

## Tools

Leitura: `list_clients`, `list_team`, `search`, `list_demands`, `get_demand`,
`list_calendar_entries`, `get_calendar_entry`, `get_calendar_period`, `production_summary`.

Escrita: `create_demand`, `update_demand`, `assign_demand`, `set_demand_status`,
`update_demand_checklist`, `update_demand_assets`, `create_calendar_entry`,
`update_calendar_entry`, `import_calendar` (prévia por padrão), `upload_image_from_url`,
`create_client`, `update_client`.

Exigem `confirm=true`: `delete_demand`, `delete_calendar_entry`, e `set_calendar_period_status`
ao finalizar (trava o mês e gera uma demanda por postagem).

Cada chamada gera uma linha de log JSON (`"audit": "mcp_tool"`) com tool, argumentos, resultado e tempo.
