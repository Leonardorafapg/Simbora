# Simbora CRM

App interno de gestão/operação da Simbora (Next.js). Separado do site público (`../frontend`).

## Rodando

Precisa do backend no ar (`../backend`):

```bash
cd ../backend && ./venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

Depois:

```bash
npm install
npm run dev -- -p 3001
```

Porta 3001 para não colidir com o site público (3000).

## Variáveis de ambiente (`.env.local`)

| Chave | Descrição |
|---|---|
| `BACKEND_URL` | Base do FastAPI, ex. `http://localhost:8000` |
| `JWT_SECRET` | **Precisa ser idêntico** ao `SECRET_KEY` do backend — o proxy valida o token localmente |

## Primeiro acesso

O usuário admin é criado pelo seed do backend:

```bash
cd ../backend && ./venv/Scripts/python.exe -m app.scripts.seed
```

## Estrutura

Ver `AGENTS.md` para as convenções de pastas.
